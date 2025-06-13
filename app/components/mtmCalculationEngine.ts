// MtM Calculation Engine - Updated with Load Weighted Price (LWP) Support

export interface MtMTimeSeriesPoint {
  period: string;
  contractVolume: number;
  contractPrice: number;
  marketPrice: number;
  lwpPercentage: number; // NEW: LWP percentage (default 100%)
  lwpPrice: number; // NEW: Load Weighted Price (Market Price × LWP%)
  contractRevenue: number;
  marketValue: number;
  lwpValue: number; // NEW: LWP Value (Volume × LWP Price)
  mtmPnL: number; // NOW: Uses LWP instead of Market Price
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
  weightedAvgLWPPrice: number; // NEW: Average LWP Price
  totalContractRevenue: number;
  totalMarketValue: number;
  totalLWPValue: number; // NEW: Total LWP Value
  totalMtMPnL: number; // NOW: Based on LWP
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
  
  // NEW: LWP Configuration
  lwpPercentage?: number; // Default LWP percentage (default: 100%)
  lwpTimeSeries?: number[]; // Future: Monthly LWP percentages
  lwpInterval?: 'monthly' | 'quarterly' | 'yearly'; // Future: LWP interval
}

export interface MtMCalculationOptions {
  selectedYear: number;
  curve?: string;
  scenario?: string;
}

// Price curve data interfaces
interface PriceCurvePoint {
  time: string;
  price: number;
  date: Date;
  year: number;
  month: number;
  monthName: string;
  state: string;
  type: string;
  financialYear: number;
  calendarYear: number;
  scenario: string;
  period: string;
  curve: string;
}

interface PriceCurveApiResponse {
  success: boolean;
  marketPrices: { [key: string]: PriceCurvePoint[] };
  totalRecords: number;
  seriesCount: number;
  availableStates: string[];
  availableTypes: string[];
  availableScenarios: string[];
  financialYears: number[];
  dateRange: {
    start: string;
    end: string;
  } | null;
  message: string;
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

    // Initialize empty price arrays
    this.marketPrices = {};
    this.greenPrices = {};

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
   * NEW: Get LWP percentage for a specific period
   */
  private getLWPPercentageForPeriod(contract: Contract, monthIndex: number): number {
    // Future: Use lwpTimeSeries if available
    if (contract.lwpTimeSeries && contract.lwpTimeSeries.length > 0) {
      if (contract.lwpInterval === 'monthly') {
        return contract.lwpTimeSeries[monthIndex] || (contract.lwpPercentage || 100);
      } else if (contract.lwpInterval === 'quarterly') {
        const quarterIndex = Math.floor(monthIndex / 3);
        return contract.lwpTimeSeries[quarterIndex] || (contract.lwpPercentage || 100);
      } else if (contract.lwpInterval === 'yearly') {
        return contract.lwpTimeSeries[0] || (contract.lwpPercentage || 100);
      }
    }

    // Default: Use single LWP percentage or 100%
    return contract.lwpPercentage || 100;
  }

  /**
   * NEW: Calculate Load Weighted Price
   */
  private calculateLWP(marketPrice: number, lwpPercentage: number): number {
    return marketPrice * (lwpPercentage / 100);
  }

  /**
   * Fetch market prices from the new price curves API
   */
  async fetchMarketPricesFromAPI(
    state: string, 
    contractType: string, 
    year: number, 
    curve: string = 'Aurora Jan 2025 Intervals',
    scenario: string = 'Central'
  ): Promise<number[]> {
    const cacheKey = `${state}-${contractType}-${year}-${curve}-${scenario}`;
    
    // Check cache first
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`🚀 Using cached price data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // For Green contracts, use 'Green' as the state
      const apiState = contractType === 'Green' ? 'Green' : state;
      const apiType = contractType === 'Green' ? 'Green' : 'Energy';
      
      const params = new URLSearchParams({
        state: apiState,
        type: apiType,
        year: year.toString(),
        scenario: scenario,
        curve: curve
      });

      console.log(`🔍 Fetching price data: /api/price-curves?${params} (Original state: ${state}, Contract type: ${contractType})`);
      
      const response = await fetch(`/api/price-curves?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiResult: PriceCurveApiResponse = await response.json();
      
      if (apiResult.success && apiResult.marketPrices) {
        // Extract monthly prices from API response
        const monthlyPrices = this.extractMonthlyPricesFromAPI(apiResult.marketPrices, apiState, apiType);
        
        if (monthlyPrices.length === 12) {
          // Cache the result
          this.priceCache.set(cacheKey, {
            data: monthlyPrices,
            timestamp: Date.now()
          });
          
          const avgPrice = monthlyPrices.reduce((a, b) => a + b, 0) / 12;
          console.log(`✅ Successfully fetched ${apiType} prices for ${apiState} ${year}: Avg ${avgPrice.toFixed(2)}/MWh`);
          return monthlyPrices;
        } else {
          throw new Error(`Incomplete price data: ${monthlyPrices.length}/12 months`);
        }
      } else {
        throw new Error('API call unsuccessful or no market prices data');
      }
    } catch (error) {
      console.error(`❌ Error fetching price data for ${state} ${contractType}:`, error);
      throw error;
    }
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
      `${state}-${type}`,
      `${state}-Energy`, // Fallback for Energy type
      state // Simple state key
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
    
    if (!selectedSeries && seriesKeys.length > 0) {
      // Use first available series as last resort
      const firstKey = seriesKeys[0];
      selectedSeries = marketPrices[firstKey];
      selectedKey = firstKey;
      console.log(`⚠️ Using first available series as fallback: "${firstKey}"`);
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
      
      // Check if we have all 12 months with valid prices
      const validMonths = monthlyPrices.filter(price => price > 0).length;
      if (validMonths === 12) {
        return monthlyPrices;
      } else {
        console.warn(`⚠️ Incomplete monthly data: ${validMonths}/12 months have valid prices`);
        // Fill missing months with available average if we have some data
        if (validMonths > 0) {
          const avgPrice = monthlyPrices.filter(p => p > 0).reduce((a, b) => a + b, 0) / validMonths;
          return monthlyPrices.map(price => price > 0 ? price : avgPrice);
        }
      }
    }
    
    throw new Error(`No suitable price series found for ${state} ${type}`);
  }

  /**
   * Bulk fetch market prices for multiple contracts
   */
  async bulkFetchMarketPrices(
    contracts: Contract[], 
    year: number, 
    curve: string = 'Aurora Jan 2025 Intervals',
    scenario: string = 'Central'
  ): Promise<void> {
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
        const prices = await this.fetchMarketPricesFromAPI(state, contractType, year, curve, scenario);
        
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
      const failedCombinations = results.filter(r => !r.success).map(r => `${r.state}-${r.contractType}`);
      throw new Error(`Failed to fetch prices for: ${failedCombinations.join(', ')}`);
    }
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
   * Calculate MtM for a single contract - UPDATED with LWP
   */
  async calculateContractMtM(contract: Contract, options: MtMCalculationOptions): Promise<MtMCalculationResult> {
    const timeSeriesData: MtMTimeSeriesPoint[] = [];
    let cumulativeMtM = 0;

    // Fetch market prices for the contract
    const contractType = contract.contractType || 'Energy';
    const curve = options.curve || 'Aurora Jan 2025 Intervals';
    const scenario = options.scenario || 'Central';

    let marketPrices: number[];
    try {
      marketPrices = await this.fetchMarketPricesFromAPI(
        contract.state, 
        contractType, 
        options.selectedYear, 
        curve, 
        scenario
      );
    } catch (error) {
      console.error(`Failed to fetch prices for contract ${contract.name}:`, error);
      throw new Error(`Cannot calculate MtM: Failed to fetch market prices for ${contract.state} ${contractType}`);
    }

    // Calculate monthly volumes
    const monthlyVolumes = this.calculateMonthlyVolumes(contract);

    // Calculate monthly MtM with LWP
    this.months.forEach((month, index) => {
      const period = `${options.selectedYear}-${(index + 1).toString().padStart(2, '0')}`;
      const volume = monthlyVolumes[index] || 0;
      
      // Skip periods with no volume
      if (volume === 0) return;
      
      // Calculate contract price for the period
      const contractPrice = this.getContractPriceForPeriod(contract, index, options.selectedYear);
      const marketPrice = marketPrices[index];
      
      // NEW: Calculate LWP
      const lwpPercentage = this.getLWPPercentageForPeriod(contract, index);
      const lwpPrice = this.calculateLWP(marketPrice, lwpPercentage);
      
      const contractRevenue = volume * contractPrice;
      const marketValue = volume * marketPrice;
      const lwpValue = volume * lwpPrice; // NEW: LWP Value

      // Calculate MtM based on direction - NOW USING LWP
      let mtmPnL: number;
      if (contract.direction === 'sell') {
        // Sell: MtM = Contract Revenue - LWP Value
        // Positive when contract price > LWP price
        mtmPnL = contractRevenue - lwpValue;
      } else {
        // Buy: MtM = LWP Value - Contract Revenue
        // Positive when LWP price > contract price
        mtmPnL = lwpValue - contractRevenue;
      }

      cumulativeMtM += mtmPnL;

      timeSeriesData.push({
        period,
        contractVolume: volume,
        contractPrice,
        marketPrice,
        lwpPercentage, // NEW
        lwpPrice, // NEW
        contractRevenue,
        marketValue,
        lwpValue, // NEW
        mtmPnL, // NOW: Based on LWP
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
      contractType: contractType,
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
  async calculatePortfolioMtM(contracts: Contract[], options: MtMCalculationOptions): Promise<MtMCalculationResult[]> {
    const activeContracts = contracts.filter(c => c.status === 'active');
    
    // Bulk fetch all required market prices first
    try {
      await this.bulkFetchMarketPrices(
        activeContracts, 
        options.selectedYear, 
        options.curve, 
        options.scenario
      );
    } catch (error) {
      console.error('Failed to bulk fetch market prices:', error);
      throw error;
    }

    // Calculate MtM for each contract
    const results: MtMCalculationResult[] = [];
    for (const contract of activeContracts) {
      try {
        const result = await this.calculateContractMtM(contract, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to calculate MtM for contract ${contract.name}:`, error);
        // Continue with other contracts instead of failing entirely
      }
    }

    return results;
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
   * Calculate summary metrics from time series data - UPDATED with LWP
   */
  private calculateSummaryMetrics(timeSeriesData: MtMTimeSeriesPoint[], contract: Contract) {
    if (timeSeriesData.length === 0) {
      return {
        totalVolume: 0,
        totalAbsVolume: 0,
        weightedAvgContractPrice: 0,
        weightedAvgMarketPrice: 0,
        weightedAvgLWPPrice: 0, // NEW
        totalContractRevenue: 0,
        totalMarketValue: 0,
        totalLWPValue: 0, // NEW
        totalMtMPnL: 0
      };
    }

    const totalAbsVolume = timeSeriesData.reduce((sum, point) => sum + Math.abs(point.contractVolume), 0);
    const totalContractRevenue = timeSeriesData.reduce((sum, point) => sum + point.contractRevenue, 0);
    const totalMarketValue = timeSeriesData.reduce((sum, point) => sum + point.marketValue, 0);
    const totalLWPValue = timeSeriesData.reduce((sum, point) => sum + point.lwpValue, 0); // NEW
    const totalMtMPnL = timeSeriesData.reduce((sum, point) => sum + point.mtmPnL, 0);

    // Apply direction sign to volume
    const signedVolume = contract.direction === 'sell' ? -totalAbsVolume : totalAbsVolume;

    const weightedAvgContractPrice = totalAbsVolume > 0 ? totalContractRevenue / totalAbsVolume : 0;
    const weightedAvgMarketPrice = totalAbsVolume > 0 ? totalMarketValue / totalAbsVolume : 0;
    const weightedAvgLWPPrice = totalAbsVolume > 0 ? totalLWPValue / totalAbsVolume : 0; // NEW

    return {
      totalVolume: signedVolume,
      totalAbsVolume,
      weightedAvgContractPrice,
      weightedAvgMarketPrice,
      weightedAvgLWPPrice, // NEW
      totalContractRevenue,
      totalMarketValue,
      totalLWPValue, // NEW
      totalMtMPnL
    };
  }

  /**
   * Calculate portfolio-level aggregated data for charting - UPDATED with LWP
   */
  calculatePortfolioAggregation(results: MtMCalculationResult[], year: number) {
    // Safety check: ensure results is an array
    if (!Array.isArray(results) || results.length === 0) {
      console.warn('⚠️ calculatePortfolioAggregation: results is not an array or is empty', results);
      return [];
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return months.map((month, index) => {
      const period = `${year}-${(index + 1).toString().padStart(2, '0')}`;
      
      let totalMtM = 0;
      let totalVolume = 0;
      let totalContractRevenue = 0;
      let totalMarketValue = 0;
      let totalLWPValue = 0; // NEW
      let cumulativeMtM = 0;

      results.forEach(result => {
        // Safety check: ensure result has timeSeriesData
        if (!result || !Array.isArray(result.timeSeriesData)) {
          console.warn('⚠️ Invalid result or timeSeriesData:', result);
          return;
        }

        const periodData = result.timeSeriesData.find(p => p.period === period);
        if (periodData) {
          totalMtM += periodData.mtmPnL;
          totalVolume += Math.abs(periodData.contractVolume);
          totalContractRevenue += periodData.contractRevenue;
          totalMarketValue += periodData.marketValue;
          totalLWPValue += periodData.lwpValue; // NEW
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
        totalLWPValue: Math.round(totalLWPValue), // NEW
        cumulativeMtM: Math.round(cumulativeMtM),
        avgContractPrice: totalVolume > 0 ? totalContractRevenue / totalVolume : 0,
        avgMarketPrice: totalVolume > 0 ? totalMarketValue / totalVolume : 0,
        avgLWPPrice: totalVolume > 0 ? totalLWPValue / totalVolume : 0 // NEW
      };
    });
  }

  /**
   * Calculate portfolio summary statistics - UPDATED with LWP
   */
  calculatePortfolioStats(results: MtMCalculationResult[]) {
    // Safety check: ensure results is an array
    if (!Array.isArray(results) || results.length === 0) {
      console.warn('⚠️ calculatePortfolioStats: results is not an array or is empty', results);
      return {
        totalMtM: 0,
        totalVolume: 0,
        totalRevenue: 0,
        totalMarketValue: 0,
        totalLWPValue: 0, // NEW
        avgContractPrice: 0,
        avgMarketPrice: 0,
        avgLWPPrice: 0, // NEW
        contractCount: 0
      };
    }

    const totalMtM = results.reduce((sum, result) => {
      return sum + (result?.totalMtMPnL || 0);
    }, 0);
    
    const totalVolume = results.reduce((sum, result) => {
      return sum + Math.abs(result?.totalVolume || 0);
    }, 0);
    
    const totalRevenue = results.reduce((sum, result) => {
      return sum + (result?.totalContractRevenue || 0);
    }, 0);
    
    const totalMarketValue = results.reduce((sum, result) => {
      return sum + (result?.totalMarketValue || 0);
    }, 0);
    
    const totalLWPValue = results.reduce((sum, result) => { // NEW
      return sum + (result?.totalLWPValue || 0);
    }, 0);

    return {
      totalMtM,
      totalVolume,
      totalRevenue,
      totalMarketValue,
      totalLWPValue, // NEW
      avgContractPrice: totalVolume > 0 ? totalRevenue / totalVolume : 0,
      avgMarketPrice: totalVolume > 0 ? totalMarketValue / totalVolume : 0,
      avgLWPPrice: totalVolume > 0 ? totalLWPValue / totalVolume : 0, // NEW
      contractCount: results.length
    };
  }
}

// Export singleton instance
export const streamlinedMtMEngine = new StreamlinedMtMEngine();