// app/services/marketPriceService.ts - Simplified Monthly Data Version

export interface PriceCurveParams {
  curve?: string;
  year?: string | number;
  profile?: string;
  type?: string;
  state?: string;
}

export interface MonthlyPricePoint {
  month: number; // 1-12
  monthName: string;
  price: number;
  year: number;
}

export interface PriceCurveResponse {
  success: boolean;
  marketPrices: { [key: string]: MonthlyPricePoint[] };
  metadata: {
    curve: string;
    profile: string;
    type: string;
    year: number | string;
    state?: string;
    recordCount: number;
    seriesCount: number;
  };
  error?: string;
}

export interface ContractPriceRequest {
  state: string;
  contractType: 'Energy' | 'Green';
  volumeShape: string;
  year?: number;
  curve?: string;
  profile?: string;
}

export interface ContractPriceResponse {
  success: boolean;
  monthlyPrices: number[]; // 12 months of prices
  averagePrice: number;
  priceProfile: string;
  error?: string;
}

/**
 * Simplified Market Price Service - Monthly Data Only
 */
export class MarketPriceService {
  private static instance: MarketPriceService;
  private cache: Map<string, PriceCurveResponse> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static getInstance(): MarketPriceService {
    if (!MarketPriceService.instance) {
      MarketPriceService.instance = new MarketPriceService();
    }
    return MarketPriceService.instance;
  }

  /**
   * Generate cache key for request parameters
   */
  private getCacheKey(params: PriceCurveParams): string {
    return JSON.stringify({
      curve: params.curve || 'Aurora Jan 2025',
      year: params.year || 'all',
      profile: params.profile || 'baseload',
      type: params.type || 'Energy',
      state: params.state || 'all'
    });
  }

  /**
   * Fetch monthly price curve data
   */
  async fetchPriceCurveData(params: PriceCurveParams = {}): Promise<PriceCurveResponse> {
    const cacheKey = this.getCacheKey(params);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < this.cacheTimeout) {
      console.log('🚀 Using cached monthly price data');
      return cached;
    }

    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        curve: params.curve || 'Aurora Jan 2025',
        profile: params.profile || 'baseload',
        type: params.type || 'Energy'
      });
      
      // Add optional parameters
      if (params.year && params.year !== 'all') {
        queryParams.append('year', params.year.toString());
      }
      if (params.state && params.state !== 'all') {
        queryParams.append('state', params.state);
      }
      
      console.log(`🔍 Fetching monthly price curves: /api/price-curves?${queryParams}`);
      
      const response = await fetch(`/api/price-curves?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiResult = await response.json();
      
      if (apiResult.success) {
        // Convert API response to simplified format
        const result: PriceCurveResponse = {
          success: true,
          marketPrices: this.convertToMonthlyFormat(apiResult.marketPrices),
          metadata: {
            curve: params.curve || 'Aurora Jan 2025',
            profile: params.profile || 'baseload',
            type: params.type || 'Energy',
            year: params.year || 'all',
            state: params.state || 'all',
            recordCount: apiResult.metadata?.recordCount || 0,
            seriesCount: Object.keys(apiResult.marketPrices || {}).length
          }
        };
        
        // Cache the result
        (result as any).timestamp = Date.now();
        this.cache.set(cacheKey, result);
        
        console.log('✅ Successfully fetched monthly price data:', {
          seriesCount: result.metadata.seriesCount,
          recordCount: result.metadata.recordCount
        });
        
        return result;
      } else {
        throw new Error(apiResult.error || 'Failed to fetch price curve data');
      }
    } catch (error) {
      console.error('❌ Error fetching monthly price curves:', error);
      
      // No fallback - data should exist
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketPrices: {},
        metadata: {
          curve: params.curve || 'Aurora Jan 2025',
          profile: params.profile || 'baseload',
          type: params.type || 'Energy',
          year: params.year || 'all',
          state: params.state || 'all',
          recordCount: 0,
          seriesCount: 0
        }
      };
    }
  }

  /**
   * Convert API response to monthly format
   */
  private convertToMonthlyFormat(apiMarketPrices: any): { [key: string]: MonthlyPricePoint[] } {
    const monthlyPrices: { [key: string]: MonthlyPricePoint[] } = {};
    
    if (!apiMarketPrices) {
      return monthlyPrices;
    }
    
    Object.entries(apiMarketPrices).forEach(([seriesKey, timeSeriesData]: [string, any]) => {
      if (Array.isArray(timeSeriesData)) {
        const monthlyData: MonthlyPricePoint[] = timeSeriesData.map(point => ({
          month: point.month || 1,
          monthName: point.monthName || 'Unknown',
          price: point.price || 0,
          year: point.year || 2025
        }));
        
        // Sort by month
        monthlyData.sort((a, b) => a.month - b.month);
        monthlyPrices[seriesKey] = monthlyData;
      }
    });
    
    return monthlyPrices;
  }

  /**
   * Get market price for contract - simplified
   */
  async getContractMarketPrice(request: ContractPriceRequest): Promise<ContractPriceResponse> {
    // Define profileType outside try-catch so it's available in both blocks
    let profileType = request.profile || 'baseload';
    try {
      console.log(`🎯 Getting monthly market price for contract:`, request);
      
      // Determine profile based on volume shape
      if (!request.profile) {
        const volumeShape = request.volumeShape.toLowerCase();
        if (volumeShape.includes('solar')) {
          profileType = 'solar';
        } else if (volumeShape.includes('wind')) {
          profileType = 'wind';
        }
      }

      // Fetch price curve data
      const priceData = await this.fetchPriceCurveData({
        curve: request.curve || 'Aurora Jan 2025',
        year: request.year || 'all',
        profile: profileType,
        type: request.contractType,
        state: request.state
      });

      if (!priceData.success) {
        throw new Error(priceData.error || 'Failed to fetch price data');
      }

      // Find the best matching price series
      const monthlyPriceData = this.findBestPriceSeriesMatch(
        priceData.marketPrices,
        request.state,
        request.contractType,
        profileType
      );

      if (!monthlyPriceData || monthlyPriceData.length === 0) {
        throw new Error(`No market price data found for ${request.state} ${profileType} ${request.contractType}`);
      }

      // Convert to 12-month array
      const monthlyPrices = this.convertToMonthlyArray(monthlyPriceData);
      
      // Calculate average price
      const validPrices = monthlyPrices.filter(p => p > 0);
      const averagePrice = validPrices.length > 0 
        ? validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length 
        : 0;

      console.log(`✅ Found monthly market prices: ${request.state} ${profileType} ${request.contractType} - Avg: $${averagePrice.toFixed(2)}/MWh`);

      return {
        success: true,
        monthlyPrices,
        averagePrice,
        priceProfile: profileType
      };

    } catch (error) {
      console.error(`❌ Error getting monthly contract market price:`, error);
      
      // No fallback - data should exist, fail properly
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        monthlyPrices: [],
        averagePrice: 0,
        priceProfile: profileType
      };
    }
  }

  /**
   * Find best price series match - simplified
   */
  private findBestPriceSeriesMatch(
    marketPrices: { [key: string]: MonthlyPricePoint[] },
    state: string,
    contractType: string,
    profileType: string
  ): MonthlyPricePoint[] {
    const seriesKeys = Object.keys(marketPrices);
    console.log(`🔍 Finding best price series from keys:`, seriesKeys);
    
    if (contractType === 'Green') {
      // Green certificate price matching
      const greenKeys = [
        `${state} - ${profileType} - green`,
        `${state} - baseload - green`,
        `${state} - green`,
        `${state}-green`,
        // Try other states
        'NSW - baseload - green',
        'VIC - baseload - green',
        'QLD - baseload - green',
        'SA - baseload - green',
        // Generic
        'green',
        'Green'
      ];
      
      for (const key of greenKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Green price series: "${key}"`);
          return marketPrices[key];
        }
      }
    } else {
      // Energy price matching
      const energyKeys = [
        `${state} - ${profileType} - Energy`,
        `${state} - ${profileType}`,
        `${state} - baseload - Energy`,
        `${state} - baseload`,
        `${state}`,
        // Try other states
        'NSW - baseload - Energy',
        'VIC - baseload - Energy',
        'QLD - baseload - Energy',
        'SA - baseload - Energy',
        'NSW',
        'VIC',
        'QLD',
        'SA'
      ];
      
      for (const key of energyKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Energy price series: "${key}"`);
          return marketPrices[key];
        }
      }
    }
    
    // Last resort: first available series
    const firstAvailableKey = seriesKeys.find(key => 
      marketPrices[key] && marketPrices[key].length > 0
    );
    
    if (firstAvailableKey) {
      console.log(`⚠️ Using fallback series: "${firstAvailableKey}"`);
      return marketPrices[firstAvailableKey];
    }
    
    console.warn(`❌ No price series found for ${state} ${profileType} ${contractType}`);
    return [];
  }

  /**
   * Convert monthly price data to 12-month array
   */
  private convertToMonthlyArray(monthlyData: MonthlyPricePoint[]): number[] {
    const monthlyPrices = new Array(12).fill(0);
    
    monthlyData.forEach(point => {
      if (point.month >= 1 && point.month <= 12) {
        monthlyPrices[point.month - 1] = point.price;
      }
    });
    
    return monthlyPrices;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Monthly price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance and convenience functions
export const marketPriceService = MarketPriceService.getInstance();

export const fetchPriceCurves = (params?: PriceCurveParams) => 
  marketPriceService.fetchPriceCurveData(params);

export const getContractPrice = (request: ContractPriceRequest) => 
  marketPriceService.getContractMarketPrice(request);

export const clearPriceCache = () => 
  marketPriceService.clearCache();

// Simple example usage:
/*
// For monthly price curves:
const priceData = await fetchPriceCurves({
  curve: 'Aurora Jan 2025',
  state: 'QLD',
  profile: 'solar',
  type: 'Energy',
  year: 2025
});

// For contract mark-to-market:
const contractPrice = await getContractPrice({
  state: 'QLD',
  contractType: 'Green',
  volumeShape: 'solar',
  year: 2025
});
*/