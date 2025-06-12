// app/services/marketPriceService.ts

export interface PriceCurveParams {
  curve?: string;
  year?: string | number;
  profile?: string;
  type?: string;
  interval?: string;
  cpiRate?: string | number;
  refYear?: string | number;
}

export interface PriceCurveMetadata {
  curve: string;
  profile: string;
  type: string;
  year: number | string;
  availableYears: number[];
  availableProfiles: string[];
  availableTypes: string[];
  availableStates: string[];
  recordCount: number;
  timePoints: number;
  seriesCount: number;
  interval?: string;
}

export interface PriceCurveResponse {
  success: boolean;
  marketPrices: { [key: string]: number[] };
  timeLabels: string[];
  isTimeSeries: boolean;
  metadata: PriceCurveMetadata;
  cpiSettings?: any;
  error?: string;
  details?: string;
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
  marketPrice: number[];
  averagePrice: number;
  priceProfile: string;
  dataSource: string;
  error?: string;
}

/**
 * Market Price Service
 * Provides unified access to price curve data for both visualization and contract valuation
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
   * Convert UI contract types to database types
   */
  private getDbContractType(uiType: string): string {
    switch (uiType) {
      case 'Green':
        return 'green';  // Convert UI "Green" to database "green"
      case 'Energy':
        return 'Energy'; // Keep Energy as-is
      default:
        return uiType.toLowerCase(); // Default to lowercase for safety
    }
  }

  /**
   * Generate cache key for request parameters
   */
  private getCacheKey(params: PriceCurveParams): string {
    const normalizedParams = {
      curve: params.curve || 'Aurora Jan 2025',
      year: params.year || 'all',
      profile: params.profile || 'baseload',
      type: this.getDbContractType(params.type || 'Energy'),
      interval: params.interval || 'auto',
      cpiRate: params.cpiRate || '2.5',
      refYear: params.refYear || '2025'
    };
    
    return JSON.stringify(normalizedParams);
  }

  /**
   * Fetch price curve data from the API
   */
  async fetchPriceCurveData(params: PriceCurveParams = {}): Promise<PriceCurveResponse> {
    const cacheKey = this.getCacheKey(params);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < this.cacheTimeout) {
      console.log('🚀 Using cached price curve data');
      return cached;
    }

    try {
      // Convert UI type to database type
      const dbType = this.getDbContractType(params.type || 'Energy');
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        curve: params.curve || 'Aurora Jan 2025',
        profile: params.profile || 'baseload',
        type: dbType,
        interval: params.interval || 'auto',
        cpiRate: (params.cpiRate || '2.5').toString(),
        refYear: (params.refYear || '2025').toString()
      });
      
      // Only add year if it's not "all"
      if (params.year && params.year !== 'all') {
        queryParams.append('year', params.year.toString());
      }
      
      console.log(`🔍 Fetching price curves: UI type="${params.type}" -> DB type="${dbType}"`);
      console.log(`📊 API URL: /api/price-curves?${queryParams.toString()}`);
      
      const response = await fetch(`/api/price-curves?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: PriceCurveResponse = await response.json();
      
      if (result.success) {
        // Add metadata for series count
        result.metadata.seriesCount = Object.keys(result.marketPrices).length;
        
        // Cache the successful result with timestamp
        (result as any).timestamp = Date.now();
        this.cache.set(cacheKey, result);
        
        console.log('✅ Successfully fetched price curve data:', {
          recordCount: result.metadata.recordCount,
          seriesCount: result.metadata.seriesCount,
          timePoints: result.metadata.timePoints,
          isTimeSeries: result.isTimeSeries
        });
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to fetch price curve data');
      }
    } catch (error) {
      console.error('❌ Error fetching price curves:', error);
      
      // Return error response with fallback data
      const fallbackResponse: PriceCurveResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketPrices: this.getFallbackPrices(params.type || 'Energy'),
        timeLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        isTimeSeries: false,
        metadata: {
          curve: params.curve || 'Aurora Jan 2025',
          profile: params.profile || 'baseload',
          type: params.type || 'Energy',
          year: params.year || 'all',
          availableYears: [2025, 2026, 2027],
          availableProfiles: ['baseload', 'solar', 'wind'],
          availableTypes: ['Energy', 'Green'],
          availableStates: ['NSW', 'VIC', 'QLD', 'SA', 'WA'],
          recordCount: 0,
          timePoints: 12,
          seriesCount: 5
        }
      };
      
      return fallbackResponse;
    }
  }

  /**
   * Get market price for a specific contract configuration
   */
  async getContractMarketPrice(request: ContractPriceRequest): Promise<ContractPriceResponse> {
    try {
      console.log(`🎯 Getting market price for contract:`, request);
      
      // Determine the best profile based on volume shape
      let profileType = request.profile || 'baseload';
      if (!request.profile) {
        const volumeShape = request.volumeShape.toLowerCase();
        if (volumeShape.includes('solar')) {
          profileType = 'solar';
        } else if (volumeShape.includes('wind')) {
          profileType = 'wind';
        }
      }

      // Fetch price curve data with the determined parameters
      const priceData = await this.fetchPriceCurveData({
        curve: request.curve || 'Aurora Jan 2025',
        year: request.year || 'all',
        profile: profileType,
        type: request.contractType
      });

      if (!priceData.success) {
        throw new Error(priceData.error || 'Failed to fetch price data');
      }

      // Find the best matching price series
      const marketPrice = this.findBestPriceMatch(
        priceData.marketPrices,
        request.state,
        request.contractType,
        profileType
      );

      if (!marketPrice || marketPrice.length === 0) {
        throw new Error(`No market price data found for ${request.state} ${profileType} ${request.contractType}`);
      }

      // Calculate average price
      const validPrices = marketPrice.filter(price => price > 0);
      const averagePrice = validPrices.length > 0 
        ? validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length 
        : 0;

      console.log(`✅ Found market price: ${request.state} ${profileType} ${request.contractType} - Avg: $${averagePrice.toFixed(2)}/MWh`);

      return {
        success: true,
        marketPrice,
        averagePrice,
        priceProfile: profileType,
        dataSource: priceData.isTimeSeries ? 'Time Series' : 'Monthly Data'
      };

    } catch (error) {
      console.error(`❌ Error getting contract market price:`, error);
      
      // Return fallback prices
      const fallbackPrice = request.contractType === 'Green' ? 45 : 80;
      const fallbackPrices = Array(12).fill(fallbackPrice);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketPrice: fallbackPrices,
        averagePrice: fallbackPrice,
        priceProfile: 'fallback',
        dataSource: 'Fallback Data'
      };
    }
  }

  /**
   * Find the best price match from available market price keys
   */
  private findBestPriceMatch(
    marketPrices: { [key: string]: number[] },
    state: string,
    contractType: string,
    profileType: string
  ): number[] {
    const seriesKeys = Object.keys(marketPrices);
    console.log(`🔍 Finding best price match from keys:`, seriesKeys);
    
    // Handle Green certificates
    if (contractType === 'Green') {
      const greenKeys = [
        `${state} - ${profileType} - green`,     // e.g., "QLD - solar - green"
        `${state} - baseload - green`,           // e.g., "QLD - baseload - green"
        `${state} - green`,                      // e.g., "QLD - green"
        `${state}-green`,                        // e.g., "QLD-green"
        // Try other states if current state not found
        ...['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(s => `${s} - baseload - green`),
        // Generic green keys
        'green',
        'Green',
        'baseload - green',
        // Search for any key containing green
        ...seriesKeys.filter(key => 
          key.toLowerCase().includes('green') || 
          key.toLowerCase().includes('certificate') ||
          key.toLowerCase().includes('rec')
        )
      ];
      
      // Remove duplicates while preserving order
      const uniqueGreenKeys = [...new Set(greenKeys)];
      
      for (const key of uniqueGreenKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Green certificate prices using key: "${key}"`);
          return marketPrices[key];
        }
      }
    } else {
      // Handle Energy prices
      const energyKeys = [
        `${state} - ${profileType} - Energy`,    // e.g., "QLD - solar - Energy"
        `${state} - ${profileType} - energy`,    // e.g., "QLD - solar - energy" 
        `${state} - ${profileType}`,             // e.g., "QLD - solar"
        `${state} - baseload - Energy`,          // fallback to baseload
        `${state} - baseload - energy`,        
        `${state} - baseload`,                 
        `${state}`,                              // e.g., "QLD"
        // Try other states as fallback
        ...['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(s => `${s} - baseload - Energy`)
      ];
      
      for (const key of energyKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Energy prices using key: "${key}"`);
          return marketPrices[key];
        }
      }
    }
    
    // Last resort: try any series that exists
    const firstAvailableKey = seriesKeys.find(key => 
      marketPrices[key] && marketPrices[key].length > 0
    );
    
    if (firstAvailableKey) {
      console.log(`⚠️ Using fallback key: "${firstAvailableKey}"`);
      return marketPrices[firstAvailableKey];
    }
    
    console.warn(`❌ No market prices found for ${state} ${profileType} ${contractType}`);
    return [];
  }

  /**
   * Get fallback prices when API fails
   */
  private getFallbackPrices(contractType: string): { [key: string]: number[] } {
    if (contractType === 'Green') {
      // Green certificate fallback prices (typically $20-60/MWh)
      return {
        'NSW - baseload - green': [45, 42, 38, 35, 40, 48, 52, 55, 50, 44, 41, 47],
        'VIC - baseload - green': [43, 40, 36, 33, 38, 46, 50, 53, 48, 42, 39, 45],
        'QLD - baseload - green': [47, 44, 40, 37, 42, 50, 54, 57, 52, 46, 43, 49],
        'SA - baseload - green': [49, 46, 42, 39, 44, 52, 56, 59, 54, 48, 45, 51],
        'WA - baseload - green': [41, 38, 34, 31, 36, 44, 48, 51, 46, 40, 37, 43]
      };
    } else {
      // Energy fallback prices
      return {
        'NSW': [85.20, 78.50, 72.30, 69.80, 75.60, 82.40, 89.70, 91.20, 86.50, 79.30, 74.80, 81.60],
        'VIC': [82.10, 76.20, 70.50, 67.90, 73.20, 79.80, 86.30, 88.50, 83.70, 76.80, 72.40, 78.90],
        'QLD': [88.50, 81.70, 75.80, 73.20, 78.90, 85.60, 92.10, 94.30, 89.20, 82.40, 77.60, 84.80],
        'SA': [91.20, 84.60, 78.30, 75.70, 81.50, 88.90, 95.80, 98.20, 92.60, 85.30, 80.10, 87.40],
        'WA': [79.80, 73.50, 67.90, 65.40, 71.20, 77.60, 83.90, 86.10, 81.40, 74.70, 70.20, 76.50]
      };
    }
  }

  /**
   * Clear the cache (useful for forcing fresh data)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Market price cache cleared');
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

// Convenience functions for common use cases
export const fetchPriceCurves = (params?: PriceCurveParams) => 
  marketPriceService.fetchPriceCurveData(params);

export const getContractPrice = (request: ContractPriceRequest) => 
  marketPriceService.getContractMarketPrice(request);

export const clearPriceCache = () => 
  marketPriceService.clearCache();

// Example usage:
/*
// For Price Curve Tab:
const priceData = await fetchPriceCurves({
  curve: 'Aurora Jan 2025',
  year: '2025',
  profile: 'baseload',
  type: 'Energy'
});

// For Mark-to-Market Tab:
const contractPrice = await getContractPrice({
  state: 'QLD',
  contractType: 'Green',
  volumeShape: 'solar',
  year: 2025
});
*/