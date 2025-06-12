// app/services/marketPriceService.ts

export interface PriceCurveParams {
  curve?: string;
  year?: string | number;
  profile?: string;
  type?: string;
  interval?: string;
  cpiRate?: string | number;
  refYear?: string | number;
  state?: string;
  startDate?: string;
  endDate?: string;
  timeResolution?: 'auto' | '30min' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface TimeSeriesPoint {
  time: string; // ISO date string or time period identifier
  price: number;
  date: Date;
  year: number;
  month: number;
  monthName: string;
  // Additional time granularity fields
  day?: number;
  hour?: number;
  minute?: number;
  quarter?: number;
  week?: number;
}

export interface PriceCurveMetadata {
  curve: string;
  profile: string;
  type: string;
  year: number | string;
  state?: string;
  availableYears: number[];
  availableProfiles: string[];
  availableTypes: string[];
  availableStates: string[];
  recordCount: number;
  timePoints: number;
  seriesCount: number;
  interval?: string;
  timeResolution: string;
  startDate: string;
  endDate: string;
  dataFrequency: string; // e.g., "monthly", "daily", "30min"
}

export interface PriceCurveResponse {
  success: boolean;
  marketPrices: { [key: string]: TimeSeriesPoint[] }; // Changed to include full time series data
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
  startDate?: string;
  endDate?: string;
  timeResolution?: string;
}

export interface ContractPriceResponse {
  success: boolean;
  marketPrice: TimeSeriesPoint[];
  averagePrice: number;
  priceProfile: string;
  dataSource: string;
  timeResolution: string;
  matchedPeriods: number;
  error?: string;
}

/**
 * Enhanced Market Price Service with flexible time interval support
 * Provides unified access to price curve data for any time resolution
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
        return 'Green';  // Convert UI "Green" to database "green" (lowercase)
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
      state: params.state || 'all',
      interval: params.interval || 'auto',
      timeResolution: params.timeResolution || 'auto',
      startDate: params.startDate || '',
      endDate: params.endDate || '',
      cpiRate: params.cpiRate || '2.5',
      refYear: params.refYear || '2025'
    };
    
    return JSON.stringify(normalizedParams);
  }

  /**
   * Detect the time resolution from the data
   */
  private detectTimeResolution(timeSeriesData: TimeSeriesPoint[]): PriceCurveParams['timeResolution'] {
    if (timeSeriesData.length < 2) return 'unknown';
    
    const sortedData = timeSeriesData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const timeDiffs = [];
    
    for (let i = 1; i < Math.min(10, sortedData.length); i++) {
      const diff = new Date(sortedData[i].time).getTime() - new Date(sortedData[i-1].time).getTime();
      timeDiffs.push(diff);
    }
    
    const avgDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    const minutes = avgDiff / (1000 * 60);
    
    if (minutes <= 35) return '30min';
    if (minutes <= 65) return 'hourly';
    if (minutes <= 1500) return 'daily';
    if (minutes <= 10500) return 'weekly';
    if (minutes <= 45000) return 'monthly';
    if (minutes <= 135000) return 'quarterly';
    return 'yearly';
  }

  /**
   * Match time intervals between contract periods and price data
   */
  private matchTimeIntervals(
    contractPeriods: string[],
    priceData: TimeSeriesPoint[],
    timeResolution: string
  ): { matched: TimeSeriesPoint[]; unmatched: string[] } {
    const matched: TimeSeriesPoint[] = [];
    const unmatched: string[] = [];
    
    contractPeriods.forEach(contractPeriod => {
      const matchedPrice = this.findPriceForPeriod(contractPeriod, priceData, timeResolution);
      if (matchedPrice) {
        matched.push(matchedPrice);
      } else {
        unmatched.push(contractPeriod);
      }
    });
    
    return { matched, unmatched };
  }

  /**
   * Find price data for a specific time period
   */
  private findPriceForPeriod(
    targetPeriod: string,
    priceData: TimeSeriesPoint[],
    timeResolution: string
  ): TimeSeriesPoint | null {
    // Direct match first
    const directMatch = priceData.find(point => point.time === targetPeriod);
    if (directMatch) return directMatch;
    
    // Parse target period
    const targetDate = new Date(targetPeriod);
    if (isNaN(targetDate.getTime())) {
      // Handle period formats like "2024-01", "2024-Q1", etc.
      return this.findByPeriodFormat(targetPeriod, priceData, timeResolution);
    }
    
    // Find closest match based on time resolution
    return this.findClosestTimeMatch(targetDate, priceData, timeResolution);
  }

  /**
   * Handle period formats like "2024-01", "2024-Q1"
   */
  private findByPeriodFormat(
    period: string,
    priceData: TimeSeriesPoint[],
    timeResolution: string
  ): TimeSeriesPoint | null {
    if (period.includes('-') && period.length <= 7) {
      // Monthly format: "2024-01"
      const [year, month] = period.split('-').map(Number);
      return priceData.find(point => point.year === year && point.month === month) || null;
    }
    
    if (period.includes('Q')) {
      // Quarterly format: "2024-Q1"
      const [year, quarterStr] = period.split('-');
      const quarter = parseInt(quarterStr.replace('Q', ''));
      return priceData.find(point => point.year === parseInt(year) && point.quarter === quarter) || null;
    }
    
    return null;
  }

  /**
   * Find closest time match based on resolution
   */
  private findClosestTimeMatch(
    targetDate: Date,
    priceData: TimeSeriesPoint[],
    timeResolution: string
  ): TimeSeriesPoint | null {
    let bestMatch: TimeSeriesPoint | null = null;
    let smallestDiff = Infinity;
    
    priceData.forEach(point => {
      const pointDate = new Date(point.time);
      const diff = Math.abs(targetDate.getTime() - pointDate.getTime());
      
      // Define tolerance based on resolution
      const tolerance = this.getTimeTolerance(timeResolution);
      
      if (diff <= tolerance && diff < smallestDiff) {
        smallestDiff = diff;
        bestMatch = point;
      }
    });
    
    return bestMatch;
  }

  /**
   * Get time tolerance for matching based on resolution
   */
  private getTimeTolerance(timeResolution: string): number {
    const tolerances: { [key: string]: number } = {
      '30min': 30 * 60 * 1000,      // 30 minutes
      'hourly': 60 * 60 * 1000,     // 1 hour
      'daily': 24 * 60 * 60 * 1000, // 1 day
      'weekly': 7 * 24 * 60 * 60 * 1000, // 1 week
      'monthly': 31 * 24 * 60 * 60 * 1000, // 1 month
      'quarterly': 93 * 24 * 60 * 60 * 1000, // 3 months
      'yearly': 366 * 24 * 60 * 60 * 1000  // 1 year
    };
    
    return tolerances[timeResolution] || tolerances['daily'];
  }

  /**
   * Enhanced fetch price curve data with flexible time intervals
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
        timeResolution: params.timeResolution || 'auto',
        cpiRate: (params.cpiRate || '2.5').toString(),
        refYear: (params.refYear || '2025').toString()
      });
      
      // Add optional parameters
      if (params.year && params.year !== 'all') {
        queryParams.append('year', params.year.toString());
      }
      if (params.state && params.state !== 'all') {
        queryParams.append('state', params.state);
      }
      if (params.startDate) {
        queryParams.append('startDate', params.startDate);
      }
      if (params.endDate) {
        queryParams.append('endDate', params.endDate);
      }
      
      console.log(`🔍 Fetching enhanced price curves: UI type="${params.type}" -> DB type="${dbType}"`);
      console.log(`📊 Enhanced API URL: /api/price-curves?${queryParams.toString()}`);
      
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
        
        console.log('✅ Successfully fetched enhanced price curve data:', {
          recordCount: result.metadata.recordCount,
          seriesCount: result.metadata.seriesCount,
          timePoints: result.metadata.timePoints,
          timeResolution: result.metadata.timeResolution,
          isTimeSeries: result.isTimeSeries
        });
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to fetch price curve data');
      }
    } catch (error) {
      console.error('❌ Error fetching enhanced price curves:', error);
      
      // Return error response with fallback data
      const fallbackResponse: PriceCurveResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketPrices: this.getFallbackTimeSeries(params.type || 'Energy'),
        timeLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        isTimeSeries: true,
        metadata: {
          curve: params.curve || 'Aurora Jan 2025',
          profile: params.profile || 'baseload',
          type: params.type || 'Energy',
          year: params.year || 'all',
          state: params.state || 'all',
          availableYears: [2025, 2026, 2027],
          availableProfiles: ['baseload', 'solar', 'wind'],
          availableTypes: ['Energy', 'Green'],
          availableStates: ['NSW', 'VIC', 'QLD', 'SA', 'WA'],
          recordCount: 0,
          timePoints: 12,
          seriesCount: 5,
          timeResolution: 'monthly',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          dataFrequency: 'monthly'
        }
      };
      
      return fallbackResponse;
    }
  }

  /**
   * Get market price for contract with flexible time matching
   */
  async getContractMarketPrice(request: ContractPriceRequest): Promise<ContractPriceResponse> {
    try {
      console.log(`🎯 Getting enhanced market price for contract:`, request);
      
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

      // Fetch price curve data with enhanced parameters
      const priceData = await this.fetchPriceCurveData({
        curve: request.curve || 'Aurora Jan 2025',
        year: request.year || 'all',
        profile: profileType,
        type: request.contractType,
        state: request.state,
        startDate: request.startDate,
        endDate: request.endDate,
        timeResolution: (request.timeResolution || 'auto') as PriceCurveParams['timeResolution']
      });

      if (!priceData.success) {
        throw new Error(priceData.error || 'Failed to fetch price data');
      }

      // Find the best matching price series
      const marketPriceSeries = this.findBestPriceSeriesMatch(
        priceData.marketPrices,
        request.state,
        request.contractType,
        profileType
      );

      if (!marketPriceSeries || marketPriceSeries.length === 0) {
        throw new Error(`No market price data found for ${request.state} ${profileType} ${request.contractType}`);
      }

      // Calculate average price
      const validPrices = marketPriceSeries.filter(point => point.price > 0);
      const averagePrice = validPrices.length > 0 
        ? validPrices.reduce((sum, point) => sum + point.price, 0) / validPrices.length 
        : 0;

      console.log(`✅ Found enhanced market price: ${request.state} ${profileType} ${request.contractType} - Avg: $${averagePrice.toFixed(2)}/MWh`);
      console.log(`📊 Time resolution: ${priceData.metadata.timeResolution}, Matched periods: ${marketPriceSeries.length}`);

      return {
        success: true,
        marketPrice: marketPriceSeries,
        averagePrice,
        priceProfile: profileType,
        dataSource: priceData.isTimeSeries ? 'Time Series' : 'Static Data',
        timeResolution: priceData.metadata.timeResolution,
        matchedPeriods: marketPriceSeries.length
      };

    } catch (error) {
      console.error(`❌ Error getting enhanced contract market price:`, error);
      
      // Return fallback prices with time series format
      const fallbackPrice = request.contractType === 'Green' ? 45 : 80;
      const fallbackTimeSeries = this.generateFallbackTimeSeries(fallbackPrice, 'monthly');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        marketPrice: fallbackTimeSeries,
        averagePrice: fallbackPrice,
        priceProfile: 'fallback',
        dataSource: 'Fallback Data',
        timeResolution: 'monthly',
        matchedPeriods: fallbackTimeSeries.length
      };
    }
  }

  /**
   * Find best price series match with enhanced logic
   */
  private findBestPriceSeriesMatch(
    marketPrices: { [key: string]: TimeSeriesPoint[] },
    state: string,
    contractType: string,
    profileType: string
  ): TimeSeriesPoint[] {
    const seriesKeys = Object.keys(marketPrices);
    console.log(`🔍 Finding best price series match from keys:`, seriesKeys);
    
    // Enhanced matching logic for different contract types
    if (contractType === 'Green') {
      const greenKeys = [
        `${state} - ${profileType} - green`,
        `${state} - baseload - green`,
        `${state} - green`,
        `${state}-green`,
        ...['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(s => `${s} - baseload - green`),
        'green',
        'Green',
        'baseload - green',
        ...seriesKeys.filter(key => 
          key.toLowerCase().includes('green') || 
          key.toLowerCase().includes('certificate') ||
          key.toLowerCase().includes('rec')
        )
      ];
      
      const uniqueGreenKeys = [...new Set(greenKeys)];
      
      for (const key of uniqueGreenKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Green certificate price series using key: "${key}"`);
          return marketPrices[key];
        }
      }
    } else {
      // Enhanced Energy price matching
      const energyKeys = [
        `${state} - ${profileType} - Energy`,
        `${state} - ${profileType} - energy`,
        `${state} - ${profileType}`,
        `${state} - baseload - Energy`,
        `${state} - baseload - energy`,
        `${state} - baseload`,
        `${state}`,
        ...['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(s => `${s} - baseload - Energy`)
      ];
      
      for (const key of energyKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Energy price series using key: "${key}"`);
          return marketPrices[key];
        }
      }
    }
    
    // Last resort: try any series that exists
    const firstAvailableKey = seriesKeys.find(key => 
      marketPrices[key] && marketPrices[key].length > 0
    );
    
    if (firstAvailableKey) {
      console.log(`⚠️ Using fallback series key: "${firstAvailableKey}"`);
      return marketPrices[firstAvailableKey];
    }
    
    console.warn(`❌ No market price series found for ${state} ${profileType} ${contractType}`);
    return [];
  }

  /**
   * Generate fallback time series data
   */
  private generateFallbackTimeSeries(basePrice: number): TimeSeriesPoint[] {
    const timeSeries: TimeSeriesPoint[] = [];
    const startDate = new Date('2025-01-01');
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(i);
      
      timeSeries.push({
        time: date.toISOString().split('T')[0],
        price: basePrice + (Math.random() - 0.5) * 10, // Add some variation
        date: date,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        monthName: date.toLocaleString('default', { month: 'long' })
      });
    }
    
    return timeSeries;
  }

  /**
   * Get fallback time series when API fails
   */
  private getFallbackTimeSeries(contractType: string): { [key: string]: TimeSeriesPoint[] } {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA'];
    const result: { [key: string]: TimeSeriesPoint[] } = {};
    
    states.forEach(state => {
      const basePrice = contractType === 'Green' ? 45 : 80;
      const key = contractType === 'Green' ? `${state} - baseload - green` : state;
      result[key] = this.generateFallbackTimeSeries(basePrice);
    });
    
    return result;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Enhanced market price cache cleared');
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

// Enhanced convenience functions
export const fetchPriceCurves = (params?: PriceCurveParams) => 
  marketPriceService.fetchPriceCurveData(params);

export const getContractPrice = (request: ContractPriceRequest) => 
  marketPriceService.getContractMarketPrice(request);

export const clearPriceCache = () => 
  marketPriceService.clearCache();

// Enhanced example usage:
/*
// For flexible time resolution price curves:
const priceData = await fetchPriceCurves({
  curve: 'Aurora Jan 2025',
  state: 'QLD',
  profile: 'solar',
  type: 'Energy',
  timeResolution: '30min',
  startDate: '2025-01-01',
  endDate: '2025-12-31'
});

// For contract mark-to-market with time matching:
const contractPrice = await getContractPrice({
  state: 'QLD',
  contractType: 'Green',
  volumeShape: 'solar',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  timeResolution: 'monthly'
});
*/