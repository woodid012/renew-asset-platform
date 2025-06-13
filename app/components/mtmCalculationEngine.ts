// MtM Calculation Engine - Standalone calculation logic

export interface MtMTimeSeriesPoint {
  period: string;
  contractVolume: number;
  contractPrice: number;
  marketPrice: number;
  contractRevenue: number;
  marketValue: number;
  mtmPnL: number;
  cumulativeMtM: number;
}

export interface MtMCalculationResult {
  contractId: string;
  contractName: string;
  direction: 'buy' | 'sell';
  category: string;
  state: string;
  contractType: string;
  counterparty: string;
  timeSeriesData: MtMTimeSeriesPoint[];
  totalVolume: number;
  totalAbsVolume: number;
  weightedAvgContractPrice: number;
  weightedAvgMarketPrice: number;
  totalContractRevenue: number;
  totalMarketValue: number;
  totalMtMPnL: number;
  volumeDataSource: string;
  marketPriceProfile: string;
  periodsCalculated: number;
  firstPeriod: string;
  lastPeriod: string;
}

export interface Contract {
  _id?: string;
  name: string;
  type: 'retail' | 'wholesale' | 'offtake';
  category: string;
  state: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  annualVolume: number;
  strikePrice: number;
  unit: string;
  contractType?: string;
  direction: 'buy' | 'sell';
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  pricingType?: 'fixed' | 'escalation' | 'timeseries';
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  timeSeriesData?: Array<{ period: string; volume: number }>;
}

export interface MtMCalculationOptions {
  selectedYear: number;
  curve?: string; // Price curve name
  marketPrices?: { [state: string]: number[] }; // Optional override
  greenPrices?: { [state: string]: number[] }; // Optional override
  volumeShapes?: { [shape: string]: number[] }; // Optional override
}

// Price curve data interfaces
interface PriceCurvePoint {
  time: string;
  price: number;
  date: Date;
  year: number;
  month: number;
  monthName: string;
}

interface PriceCurveApiResponse {
  success: boolean;
  marketPrices: { [key: string]: PriceCurvePoint[] };
  metadata: {
    curve: string;
    profile: string;
    type: string;
    year: number | string;
    availableYears: number[];
    availableProfiles: string[];
    availableTypes: string[];
    availableStates: string[];
    recordCount: number;
    seriesCount: number;
  };
  cached?: boolean;
  query?: any;
}

export class StreamlinedMtMEngine {
  private marketPrices: { [state: string]: number[] };
  private greenPrices: { [state: string]: number[] };
  private volumeShapes: { [shape: string]: number[] };
  private months: string[];
  private priceCache: Map<string, { data: number[], timestamp: number }>;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize price cache
    this.priceCache = new Map();

    // Fallback prices (used when API fails)
    this.marketPrices = {
      NSW: [85.20, 78.50, 72.30, 69.80, 75.60, 82.40, 89.70, 91.20, 86.50, 79.30, 74.80, 81.60],
      VIC: [82.10, 76.20, 70.50, 67.90, 73.20, 79.80, 86.30, 88.50, 83.70, 76.80, 72.40, 78.90],
      QLD: [88.50, 81.70, 75.80, 73.20, 78.90, 85.60, 92.10, 94.30, 89.20, 82.40, 77.60, 84.80],
      SA: [91.20, 84.60, 78.30, 75.70, 81.50, 88.90, 95.80, 98.20, 92.60, 85.30, 80.10, 87.40],
      WA: [79.80, 73.50, 67.90, 65.40, 71.20, 77.60, 83.90, 86.10, 81.40, 74.70, 70.20, 76.50]
    };

    this.greenPrices = {
      NSW: [38, 35, 32, 30, 34, 37, 40, 42, 39, 36, 33, 37],
      VIC: [36, 33, 30, 28, 32, 35, 38, 40, 37, 34, 31, 35],
      QLD: [40, 37, 34, 32, 36, 39, 42, 44, 41, 38, 35, 39],
      SA: [42, 39, 36, 34, 38, 41, 44, 46, 43, 40, 37, 41],
      WA: [35, 32, 29, 27, 31, 34, 37, 39, 36, 33, 30, 34]
    };

    // Volume shapes for monthly distribution
    this.volumeShapes = {
      flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
      solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
      wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
      custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
    };

    this.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }

  /**
   * Fetch market prices from the price curve API
   */
  async fetchMarketPricesFromAPI(
    state: string, 
    contractType: string, 
    year: number, 
    curve: string = 'Aurora Jan 2025'
  ): Promise<number[]> {
    const cacheKey = `${state}-${contractType}-${year}-${curve}`;
    
    // Check cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`🚀 Using cached price data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // Determine profile based on contract type and volume shape
      const profile = contractType === 'Green' ? 'baseload' : 'baseload'; // You can enhance this logic
      const type = contractType === 'Green' ? 'Green' : 'Energy';
      
      const params = new URLSearchParams({
        curve: curve,
        state: state,
        profile: profile,
        type: type,
        year: year.toString()
      });

      console.log(`🔍 Fetching price data: /api/price-curves?${params}`);
      
      const response = await fetch(`/api/price-curves?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiResult: PriceCurveApiResponse = await response.json();
      
      if (apiResult.success && apiResult.marketPrices) {
        // Find the best matching price series
        const monthlyPrices = this.extractMonthlyPricesFromAPI(apiResult.marketPrices, state, type);
        
        if (monthlyPrices.length === 12) {
          // Cache the result
          this.priceCache.set(cacheKey, {
            data: monthlyPrices,
            timestamp: Date.now()
          });
          
          console.log(`✅ Successfully fetched ${type} prices for ${state} ${year}: Avg ${(monthlyPrices.reduce((a, b) => a + b, 0) / 12).toFixed(2)}/MWh`);
          return monthlyPrices;
        } else {
          console.warn(`⚠️ API returned incomplete price data for ${state} ${type} (${monthlyPrices.length}/12 months)`);
        }
      } else {
        console.warn(`⚠️ API call unsuccessful: ${apiResult.success ? 'No market prices data' : 'API error'}`);
      }
    } catch (error) {
      console.error(`❌ Error fetching price data for ${state} ${contractType}:`, error);
    }

    // Fallback to default prices
    console.log(`🔄 Using fallback prices for ${state} ${contractType}`);
    const fallbackPrices = contractType === 'Green' 
      ? this.greenPrices[state] || this.greenPrices.NSW
      : this.marketPrices[state] || this.marketPrices.NSW;
    
    return fallbackPrices;
  }

  /**
   * Extract monthly prices from API response
   */
  private extractMonthlyPricesFromAPI(
    marketPrices: { [key: string]: PriceCurvePoint[] }, 
    state: string, 
    type: string
  ): number[] {
    const seriesKeys = Object.keys(marketPrices);
    console.log(`🔍 Available price series:`, seriesKeys);
    
    // Try to find the best matching series
    const possibleKeys = [
      `${state} - baseload - ${type}`,
      `${state} - baseload`,
      `${state} - ${type.toLowerCase()}`,
      `${state}`,
      state,
      // Fallback to NSW if current state not found
      `NSW - baseload - ${type}`,
      `NSW - baseload`,
      `NSW - ${type.toLowerCase()}`,
      'NSW'
    ];
    
    let selectedSeries: PriceCurvePoint[] | null = null;
    let selectedKey = '';
    
    for (const key of possibleKeys) {
      if (marketPrices[key] && marketPrices[key].length > 0) {
        selectedSeries = marketPrices[key];
        selectedKey = key;
        break;
      }
    }
    
    if (!selectedSeries) {
      // Try first available series as last resort
      const firstKey = seriesKeys[0];
      if (firstKey && marketPrices[firstKey]) {
        selectedSeries = marketPrices[firstKey];
        selectedKey = firstKey;
        console.log(`⚠️ Using first available series as fallback: "${firstKey}"`);
      }
    }
    
    if (selectedSeries) {
      console.log(`✅ Found price series: "${selectedKey}" with ${selectedSeries.length} data points`);
      
      // Convert to 12-month array
      const monthlyPrices = new Array(12).fill(0);
      
      selectedSeries.forEach(point => {
        if (point.month >= 1 && point.month <= 12) {
          monthlyPrices[point.month - 1] = point.price;
        }
      });
      
      // Check if we have all 12 months
      const validMonths = monthlyPrices.filter(price => price > 0).length;
      if (validMonths === 12) {
        return monthlyPrices;
      } else {
        console.warn(`⚠️ Incomplete monthly data: ${validMonths}/12 months have valid prices`);
      }
    }
    
    console.warn(`❌ No suitable price series found for ${state} ${type}`);
    return [];
  }

  /**
   * Bulk fetch market prices for multiple contracts
   */
  async bulkFetchMarketPrices(contracts: Contract[], year: number, curve: string = 'Aurora Jan 2025'): Promise<void> {
    console.log(`🚀 Bulk fetching market prices for ${contracts.length} contracts, year ${year}`);
    
    // Get unique state/contractType combinations
    const uniqueCombinations = new Set<string>();
    contracts.forEach(contract => {
      const contractType = contract.contractType || 'Energy';
      uniqueCombinations.add(`${contract.state}-${contractType}`);
    });
    
    console.log(`📊 Need prices for ${uniqueCombinations.size} unique combinations:`, Array.from(uniqueCombinations));
    
    // Fetch all combinations in parallel
    const fetchPromises = Array.from(uniqueCombinations).map(async (combination) => {
      const [state, contractType] = combination.split('-');
      try {
        const prices = await this.fetchMarketPricesFromAPI(state, contractType, year, curve);
        
        // Update internal storage
        if (contractType === 'Green') {
          this.greenPrices[state] = prices;
        } else {
          this.marketPrices[state] = prices;
        }
        
        return { state, contractType, success: true, priceCount: prices.length };
      } catch (error) {
        console.error(`❌ Failed to fetch prices for ${combination}:`, error);
        return { state, contractType, success: false, error };
      }
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Log results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Bulk fetch completed: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      console.warn('⚠️ Some price fetches failed, using fallback data for those combinations');
    }
  }

  /**
   * Update market prices (legacy method, now optional)
   */
  setMarketPrices(prices: { [state: string]: number[] }): void {
    this.marketPrices = { ...this.marketPrices, ...prices };
  }

  /**
   * Update green certificate prices (legacy method, now optional)
   */
  setGreenPrices(prices: { [state: string]: number[] }): void {
    this.greenPrices = { ...this.greenPrices, ...prices };
  }

  /**
   * Update volume shapes
   */
  setVolumeShapes(shapes: { [shape: string]: number[] }): void {
    this.volumeShapes = { ...this.volumeShapes, ...shapes };
  }

  /**
   * Clear price cache
   */
  clearPriceCache(): void {
    this.priceCache.clear();
    console.log('🧹 Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.priceCache.size,
      keys: Array.from(this.priceCache.keys())
    };
  }

  /**
   * Calculate MtM for a single contract
   */
  calculateContractMtM(contract: Contract, options: MtMCalculationOptions): MtMCalculationResult {
    const timeSeriesData: MtMTimeSeriesPoint[] = [];
    let cumulativeMtM = 0;

    // Get market prices for the contract
    const marketPrices = contract.contractType === 'Green' 
      ? this.greenPrices[contract.state] || this.greenPrices.NSW
      : this.marketPrices[contract.state] || this.marketPrices.NSW;

    // Calculate monthly volumes
    const monthlyVolumes = this.calculateMonthlyVolumes(contract);

    // Calculate monthly MtM
    this.months.forEach((month, index) => {
      const period = `${options.selectedYear}-${(index + 1).toString().padStart(2, '0')}`;
      const volume = monthlyVolumes[index] || 0;
      
      // Skip periods with no volume
      if (volume === 0) return;
      
      // Calculate contract price for the period
      const contractPrice = this.getContractPriceForPeriod(contract, index, options.selectedYear);
      const marketPrice = marketPrices[index];
      
      const contractRevenue = volume * contractPrice;
      const marketValue = volume * marketPrice;

      // Calculate MtM based on direction
      let mtmPnL: number;
      if (contract.direction === 'sell') {
        // Sell: MtM = Contract Revenue - Market Value
        // Positive when contract price > market price
        mtmPnL = contractRevenue - marketValue;
      } else {
        // Buy: MtM = Market Value - Contract Revenue
        // Positive when market price > contract price
        mtmPnL = marketValue - contractRevenue;
      }

      cumulativeMtM += mtmPnL;

      timeSeriesData.push({
        period,
        contractVolume: volume,
        contractPrice,
        marketPrice,
        contractRevenue,
        marketValue,
        mtmPnL,
        cumulativeMtM
      });
    });

    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(timeSeriesData, contract);

    return {
      contractId: contract._id || contract.name,
      contractName: contract.name,
      direction: contract.direction,
      category: contract.category,
      state: contract.state,
      contractType: contract.contractType || 'Energy',
      counterparty: contract.counterparty,
      timeSeriesData,
      ...summary,
      volumeDataSource: contract.timeSeriesData ? 'time_series' : 'shape_based',
      marketPriceProfile: contract.volumeShape,
      periodsCalculated: timeSeriesData.length,
      firstPeriod: timeSeriesData[0]?.period || '',
      lastPeriod: timeSeriesData[timeSeriesData.length - 1]?.period || ''
    };
  }

  /**
   * Calculate MtM for multiple contracts
   */
  calculatePortfolioMtM(contracts: Contract[], options: MtMCalculationOptions): MtMCalculationResult[] {
    const activeContracts = contracts.filter(c => c.status === 'active');
    return activeContracts.map(contract => this.calculateContractMtM(contract, options));
  }

  /**
   * Calculate monthly volumes from contract data
   */
  private calculateMonthlyVolumes(contract: Contract): number[] {
    // Use time series data if available
    if (contract.timeSeriesData && contract.timeSeriesData.length > 0) {
      return contract.timeSeriesData.map(ts => ts.volume);
    }

    // Fall back to volume shape calculation
    const percentages = this.volumeShapes[contract.volumeShape] || this.volumeShapes.flat;
    return percentages.map(pct => (contract.annualVolume * pct) / 100);
  }

  /**
   * Get contract price for a specific period
   */
  private getContractPriceForPeriod(contract: Contract, monthIndex: number, year: number): number {
    // Handle escalation pricing
    if (contract.pricingType === 'escalation' && contract.escalationRate) {
      const monthsFromStart = monthIndex;
      const escalationFactor = Math.pow(1 + (contract.escalationRate / 100), monthsFromStart / 12);
      return contract.strikePrice * escalationFactor;
    }

    // Handle time series pricing
    if (contract.pricingType === 'timeseries' && contract.priceTimeSeries) {
      if (contract.priceInterval === 'monthly') {
        return contract.priceTimeSeries[monthIndex] || contract.strikePrice;
      } else if (contract.priceInterval === 'quarterly') {
        const quarterIndex = Math.floor(monthIndex / 3);
        return contract.priceTimeSeries[quarterIndex] || contract.strikePrice;
      } else if (contract.priceInterval === 'yearly') {
        return contract.priceTimeSeries[0] || contract.strikePrice;
      }
    }

    // Default to fixed price
    return contract.strikePrice;
  }

  /**
   * Calculate summary metrics from time series data
   */
  private calculateSummaryMetrics(timeSeriesData: MtMTimeSeriesPoint[], contract: Contract) {
    if (timeSeriesData.length === 0) {
      return {
        totalVolume: 0,
        totalAbsVolume: 0,
        weightedAvgContractPrice: 0,
        weightedAvgMarketPrice: 0,
        totalContractRevenue: 0,
        totalMarketValue: 0,
        totalMtMPnL: 0
      };
    }

    const totalAbsVolume = timeSeriesData.reduce((sum, point) => sum + Math.abs(point.contractVolume), 0);
    const totalContractRevenue = timeSeriesData.reduce((sum, point) => sum + point.contractRevenue, 0);
    const totalMarketValue = timeSeriesData.reduce((sum, point) => sum + point.marketValue, 0);
    const totalMtMPnL = timeSeriesData.reduce((sum, point) => sum + point.mtmPnL, 0);

    // Apply direction sign to volume
    const signedVolume = contract.direction === 'sell' ? -totalAbsVolume : totalAbsVolume;

    const weightedAvgContractPrice = totalAbsVolume > 0 ? totalContractRevenue / totalAbsVolume : 0;
    const weightedAvgMarketPrice = totalAbsVolume > 0 ? totalMarketValue / totalAbsVolume : 0;

    return {
      totalVolume: signedVolume,
      totalAbsVolume,
      weightedAvgContractPrice,
      weightedAvgMarketPrice,
      totalContractRevenue,
      totalMarketValue,
      totalMtMPnL
    };
  }

  /**
   * Calculate portfolio-level aggregated data for charting
   */
  calculatePortfolioAggregation(results: MtMCalculationResult[], year: number) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((month, index) => {
      const period = `${year}-${(index + 1).toString().padStart(2, '0')}`;
      
      let totalMtM = 0;
      let totalVolume = 0;
      let totalContractRevenue = 0;
      let totalMarketValue = 0;
      let cumulativeMtM = 0;

      results.forEach(result => {
        const periodData = result.timeSeriesData.find(p => p.period === period);
        if (periodData) {
          totalMtM += periodData.mtmPnL;
          totalVolume += Math.abs(periodData.contractVolume);
          totalContractRevenue += periodData.contractRevenue;
          totalMarketValue += periodData.marketValue;
          // Use the last cumulative value found
          cumulativeMtM = periodData.cumulativeMtM;
        }
      });

      return {
        month,
        period,
        totalMtM: Math.round(totalMtM),
        totalVolume: Math.round(totalVolume),
        totalContractRevenue: Math.round(totalContractRevenue),
        totalMarketValue: Math.round(totalMarketValue),
        cumulativeMtM: Math.round(cumulativeMtM),
        avgContractPrice: totalVolume > 0 ? totalContractRevenue / totalVolume : 0,
        avgMarketPrice: totalVolume > 0 ? totalMarketValue / totalVolume : 0
      };
    });
  }

  /**
   * Calculate portfolio summary statistics
   */
  calculatePortfolioStats(results: MtMCalculationResult[]) {
    const totalMtM = results.reduce((sum, result) => sum + result.totalMtMPnL, 0);
    const totalVolume = results.reduce((sum, result) => sum + Math.abs(result.totalVolume), 0);
    const totalRevenue = results.reduce((sum, result) => sum + result.totalContractRevenue, 0);
    const totalMarketValue = results.reduce((sum, result) => sum + result.totalMarketValue, 0);

    return {
      totalMtM,
      totalVolume,
      totalRevenue,
      totalMarketValue,
      avgContractPrice: totalVolume > 0 ? totalRevenue / totalVolume : 0,
      avgMarketPrice: totalVolume > 0 ? totalMarketValue / totalVolume : 0,
      contractCount: results.length
    };
  }
}

// Export singleton instance
export const streamlinedMtMEngine = new StreamlinedMtMEngine();