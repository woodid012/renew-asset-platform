import { Contract } from '@/app/types';
import { marketPriceService, ContractPriceRequest } from './marketPriceService';

export interface MtMTimeSeriesPoint {
  period: string; // YYYY-MM format
  contractVolume: number; // MWh for this period
  contractPrice: number; // $/MWh for this period
  marketPrice: number; // $/MWh for this period
  contractRevenue: number; // contractVolume * contractPrice
  marketValue: number; // contractVolume * marketPrice
  mtmPnL: number; // Based on direction
  cumulativeMtM: number; // Running total
}

export interface MtMCalculationResult {
  contractId: string;
  contractName: string;
  direction: 'buy' | 'sell';
  category: string;
  state: string;
  contractType: string;
  counterparty: string;
  yearType: 'CY' | 'FY';
  
  // Time series data
  timeSeriesData: MtMTimeSeriesPoint[];
  
  // Summary metrics
  totalVolume: number; // Net signed volume
  totalAbsVolume: number; // Absolute volume
  weightedAvgContractPrice: number;
  weightedAvgMarketPrice: number;
  totalContractRevenue: number;
  totalMarketValue: number;
  totalMtMPnL: number;
  
  // Data source information
  volumeDataSource: 'time_series' | 'shape_based';
  priceDataSource: string;
  marketPriceProfile: string;
  
  // Calculation metadata
  periodsCalculated: number;
  firstPeriod: string;
  lastPeriod: string;
  calculationDate: Date;
}

export interface MtMCalculationOptions {
  selectedYear: number;
  yearType: 'CY' | 'FY';
  priceCurve?: string;
  includeForecast?: boolean;
  marketPriceProfile?: 'auto' | 'baseload' | 'solar' | 'wind';
}

export class MtMCalculationEngine {
  
  /**
   * Calculate Mark-to-Market for a single contract
   */
  async calculateContractMtM(
    contract: Contract, 
    options: MtMCalculationOptions
  ): Promise<MtMCalculationResult | null> {
    
    try {
      console.log(`🧮 Starting MtM calculation for contract: ${contract.name}`);
      
      // Step 1: Generate time periods for the calculation
      const periods = this.generateCalculationPeriods(contract, options);
      if (periods.length === 0) {
        console.warn(`⚠️ No valid periods found for contract: ${contract.name}`);
        return null;
      }
      
      // Step 2: Get market price data from the service
      const marketPriceProfile = this.determineMarketPriceProfile(contract, options);
      const marketPriceData = await this.getMarketPriceData(contract, marketPriceProfile, options);
      
      if (!marketPriceData.success) {
        console.error(`❌ Failed to get market price data for ${contract.name}: ${marketPriceData.error}`);
        return null;
      }
      
      // Step 3: Calculate period-by-period MtM
      const timeSeriesData: MtMTimeSeriesPoint[] = [];
      let cumulativeMtM = 0;
      
      for (const period of periods) {
        const periodData = await this.calculatePeriodMtM(
          contract, 
          period, 
          marketPriceData.marketPrice, 
          options
        );
        
        if (periodData) {
          cumulativeMtM += periodData.mtmPnL;
          periodData.cumulativeMtM = cumulativeMtM;
          timeSeriesData.push(periodData);
        }
      }
      
      // Step 4: Calculate summary metrics
      const summary = this.calculateSummaryMetrics(timeSeriesData, contract);
      
      // Step 5: Build the final result
      const result: MtMCalculationResult = {
        contractId: contract._id || contract.name,
        contractName: contract.name,
        direction: contract.direction || 'buy',
        category: contract.category,
        state: contract.state,
        contractType: contract.contractType || 'Energy',
        counterparty: contract.counterparty,
        yearType: options.yearType,
        
        timeSeriesData,
        
        totalVolume: summary.totalVolume,
        totalAbsVolume: summary.totalAbsVolume,
        weightedAvgContractPrice: summary.weightedAvgContractPrice,
        weightedAvgMarketPrice: summary.weightedAvgMarketPrice,
        totalContractRevenue: summary.totalContractRevenue,
        totalMarketValue: summary.totalMarketValue,
        totalMtMPnL: summary.totalMtMPnL,
        
        volumeDataSource: contract.timeSeriesData ? 'time_series' : 'shape_based',
        priceDataSource: marketPriceData.dataSource,
        marketPriceProfile: marketPriceData.priceProfile,
        
        periodsCalculated: timeSeriesData.length,
        firstPeriod: periods[0],
        lastPeriod: periods[periods.length - 1],
        calculationDate: new Date()
      };
      
      console.log(`✅ MtM calculation completed for ${contract.name}: $${summary.totalMtMPnL.toLocaleString()}`);
      return result;
      
    } catch (error) {
      console.error(`🚨 Error calculating MtM for contract ${contract.name}:`, error);
      return null;
    }
  }
  
  /**
   * Calculate MtM for multiple contracts
   */
  async calculatePortfolioMtM(
    contracts: Contract[], 
    options: MtMCalculationOptions
  ): Promise<MtMCalculationResult[]> {
    
    console.log(`🚀 Starting portfolio MtM calculation for ${contracts.length} contracts`);
    
    const results: MtMCalculationResult[] = [];
    const activeContracts = contracts.filter(c => c.status === 'active');
    
    // Process contracts in parallel with some concurrency control
    const batchSize = 5;
    for (let i = 0; i < activeContracts.length; i += batchSize) {
      const batch = activeContracts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(contract => 
        this.calculateContractMtM(contract, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Add successful calculations to results
      batchResults.forEach(result => {
        if (result) {
          results.push(result);
        }
      });
      
      console.log(`📊 Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activeContracts.length/batchSize)}`);
    }
    
    console.log(`✅ Portfolio MtM calculation completed: ${results.length}/${activeContracts.length} contracts processed`);
    return results;
  }
  
  /**
   * Generate calculation periods based on contract and options
   */
  private generateCalculationPeriods(contract: Contract, options: MtMCalculationOptions): string[] {
    const periods: string[] = [];
    
    // If contract has time series data, use those periods
    if (contract.timeSeriesData && contract.timeSeriesData.length > 0) {
      const relevantPeriods = contract.timeSeriesData
        .filter(ts => {
          const [year] = ts.period.split('-').map(Number);
          return year === options.selectedYear;
        })
        .map(ts => ts.period)
        .sort();
      
      return relevantPeriods;
    }
    
    // Generate periods based on contract dates and year type
    if (!contract.startDate || !contract.endDate) {
      console.warn(`⚠️ Contract ${contract.name} missing start/end dates`);
      return [];
    }
    
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    
    // Generate monthly periods for the selected year
    let periodStart: Date;
    let periodEnd: Date;
    
    if (options.yearType === 'FY') {
      // Financial year: July to June
      periodStart = new Date(options.selectedYear - 1, 6, 1); // July 1st of previous year
      periodEnd = new Date(options.selectedYear, 5, 30); // June 30th of selected year
    } else {
      // Calendar year: January to December  
      periodStart = new Date(options.selectedYear, 0, 1); // January 1st
      periodEnd = new Date(options.selectedYear, 11, 31); // December 31st
    }
    
    // Only include periods that overlap with contract duration
    const contractStart = new Date(Math.max(startDate.getTime(), periodStart.getTime()));
    const contractEnd = new Date(Math.min(endDate.getTime(), periodEnd.getTime()));
    
    if (contractStart > contractEnd) {
      return []; // No overlap
    }
    
    // Generate monthly periods
    const current = new Date(contractStart.getFullYear(), contractStart.getMonth(), 1);
    const end = new Date(contractEnd.getFullYear(), contractEnd.getMonth(), 1);
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = (current.getMonth() + 1).toString().padStart(2, '0');
      periods.push(`${year}-${month}`);
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return periods;
  }
  
  /**
   * Determine the appropriate market price profile for a contract
   */
  private determineMarketPriceProfile(contract: Contract, options: MtMCalculationOptions): string {
    if (options.marketPriceProfile && options.marketPriceProfile !== 'auto') {
      return options.marketPriceProfile;
    }
    
    // For Energy contracts: Only use solar/wind profiles for actual Solar/Wind Offtake contracts
    if ((contract.contractType || 'Energy') === 'Energy') {
      const category = contract.category.toLowerCase();
      const volumeShape = contract.volumeShape.toLowerCase();
      
      // Only use solar profile for Solar Offtake contracts
      if (category.includes('solar') && category.includes('offtake')) {
        console.log(`🌞 Using solar profile for Solar Offtake contract: ${contract.name}`);
        return 'solar';
      }
      
      // Only use wind profile for Wind Offtake contracts
      if (category.includes('wind') && category.includes('offtake')) {
        console.log(`💨 Using wind profile for Wind Offtake contract: ${contract.name}`);
        return 'wind';
      }
      
      // Default to baseload for all other Energy contracts
      console.log(`⚡ Using baseload profile for Energy contract: ${contract.name} (category: ${contract.category})`);
      return 'baseload';
    }
    
    // For Green certificates: Use profile based on volume shape
    if (contract.contractType === 'Green') {
      const volumeShape = contract.volumeShape.toLowerCase();
      if (volumeShape.includes('solar')) {
        console.log(`🟢🌞 Using solar profile for Green certificate contract: ${contract.name}`);
        return 'solar';
      } else if (volumeShape.includes('wind')) {
        console.log(`🟢💨 Using wind profile for Green certificate contract: ${contract.name}`);
        return 'wind';
      } else {
        console.log(`🟢⚡ Using baseload profile for Green certificate contract: ${contract.name}`);
        return 'baseload';
      }
    }
    
    // Default fallback
    console.log(`📊 Using baseload profile as fallback for contract: ${contract.name}`);
    return 'baseload';
  }
  
  /**
   * Get market price data using the market price service
   */
  private async getMarketPriceData(contract: Contract, profile: string, options: MtMCalculationOptions) {
    try {
      console.log(`🔍 Getting market price data for contract ${contract.name}:`, {
        state: contract.state,
        contractType: contract.contractType || 'Energy',
        volumeShape: contract.volumeShape,
        profile: profile,
        year: options.selectedYear,
        curve: options.priceCurve || 'Aurora Jan 2025'
      });

      const request: ContractPriceRequest = {
        state: contract.state,
        contractType: (contract.contractType || 'Energy') as 'Energy' | 'Green',
        volumeShape: contract.volumeShape,
        year: options.selectedYear,
        curve: options.priceCurve || 'Aurora Jan 2025',
        profile: profile
      };
      
      const result = await marketPriceService.getContractMarketPrice(request);
      
      if (!result.success) {
        console.error(`❌ Market price service failed for ${contract.name}:`, result.error);
        
        // Try direct API call as fallback
        console.log(`🔄 Attempting direct API fallback for ${contract.name}`);
        const fallbackResult = await this.getMarketPriceDataDirect(contract, profile, options);
        return fallbackResult;
      }
      
      console.log(`✅ Market price data retrieved for ${contract.name}: ${result.marketPrice.length} data points`);
      return result;
      
    } catch (error) {
      console.error(`🚨 Error getting market price data for ${contract.name}:`, error);
      
      // Try direct API call as fallback
      console.log(`🔄 Attempting direct API fallback after error for ${contract.name}`);
      return await this.getMarketPriceDataDirect(contract, profile, options);
    }
  }

  /**
   * Direct API call fallback for market price data
   */
  private async getMarketPriceDataDirect(contract: Contract, profile: string, options: MtMCalculationOptions) {
    try {
      // Build query parameters exactly like your working URL
      const queryParams = new URLSearchParams({
        type: contract.contractType || 'Energy', // Use original type, not converted
        profile: profile,
        year: options.selectedYear.toString(),
        curve: options.priceCurve || 'Aurora Jan 2025'
      });
      
      const apiUrl = `/api/price-curves?${queryParams.toString()}`;
      console.log(`🌐 Direct API call: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response');
      }
      
      // Convert the price curves response to the expected format
      const stateKey = this.findBestStateKey(data.marketPrices, contract.state, contract.contractType || 'Energy', profile);
      const marketPrice = data.marketPrices[stateKey] || [];
      
      if (marketPrice.length === 0) {
        throw new Error(`No market price data found for ${contract.state}`);
      }
      
      // Calculate average price
      const validPrices = marketPrice.filter(price => price > 0);
      const averagePrice = validPrices.length > 0 
        ? validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length 
        : 0;
      
      console.log(`✅ Direct API success for ${contract.name}: Found ${marketPrice.length} prices, avg: ${averagePrice.toFixed(2)}`);
      
      return {
        success: true,
        marketPrice,
        averagePrice,
        priceProfile: profile,
        dataSource: 'Direct API Call'
      };
      
    } catch (error) {
      console.error(`❌ Direct API call failed for ${contract.name}:`, error);
      
      // Final fallback to hardcoded prices
      const fallbackPrice = (contract.contractType || 'Energy') === 'Green' ? 45 : 80;
      const fallbackPrices = Array(12).fill(fallbackPrice);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Direct API call failed',
        marketPrice: fallbackPrices,
        averagePrice: fallbackPrice,
        priceProfile: 'fallback',
        dataSource: 'Fallback Data'
      };
    }
  }

  /**
   * Find the best state key from available market price keys
   */
  private findBestStateKey(marketPrices: { [key: string]: number[] }, state: string, contractType: string, profile: string): string {
    const keys = Object.keys(marketPrices);
    console.log(`🔍 Finding best state key for ${state} ${contractType} ${profile} from:`, keys);
    
    // Handle Green certificates
    if (contractType === 'Green') {
      const greenKeys = [
        `${state} - ${profile} - green`,
        `${state} - baseload - green`,
        `${state} - green`,
        `${state}-green`,
        // Try other states
        ...['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(s => `${s} - baseload - green`),
        // Generic green keys
        ...keys.filter(key => key.toLowerCase().includes('green'))
      ];
      
      for (const key of greenKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Green key: "${key}"`);
          return key;
        }
      }
    } else {
      // Handle Energy prices
      const energyKeys = [
        `${state} - ${profile} - Energy`,
        `${state} - ${profile} - energy`,
        `${state} - ${profile}`,
        `${state} - baseload - Energy`,
        `${state} - baseload`,
        `${state}`,
        // Try other states
        ...['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(s => `${s} - baseload - Energy`)
      ];
      
      for (const key of energyKeys) {
        if (marketPrices[key] && marketPrices[key].length > 0) {
          console.log(`✅ Found Energy key: "${key}"`);
          return key;
        }
      }
    }
    
    // Last resort: first available key
    const firstKey = keys.find(key => marketPrices[key] && marketPrices[key].length > 0);
    if (firstKey) {
      console.log(`⚠️ Using fallback key: "${firstKey}"`);
      return firstKey;
    }
    
    console.warn(`❌ No suitable key found for ${state} ${contractType} ${profile}`);
    return keys[0] || '';
  }
  
  /**
   * Calculate MtM for a specific period
   */
  private async calculatePeriodMtM(
    contract: Contract,
    period: string,
    marketPrices: number[],
    options: MtMCalculationOptions
  ): Promise<MtMTimeSeriesPoint | null> {
    
    // Get volume for this period
    const volume = this.getVolumeForPeriod(contract, period, options);
    if (volume === 0) {
      return null; // Skip periods with no volume
    }
    
    // Get contract price for this period
    const contractPrice = this.getContractPriceForPeriod(contract, period, options);
    
    // Get market price for this period
    const [year, month] = period.split('-').map(Number);
    const monthIndex = month - 1; // Convert to 0-based index
    const marketPrice = marketPrices[monthIndex] || marketPrices[0] || 0;
    
    if (marketPrice <= 0) {
      console.warn(`⚠️ No market price data for period ${period}`);
      return null;
    }
    
    // Calculate values
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
    
    return {
      period,
      contractVolume: volume,
      contractPrice,
      marketPrice,
      contractRevenue,
      marketValue,
      mtmPnL,
      cumulativeMtM: 0 // Will be set by caller
    };
  }
  
  /**
   * Get volume for a specific period
   */
  private getVolumeForPeriod(contract: Contract, period: string, options: MtMCalculationOptions): number {
    // Check if contract has time series volume data
    if (contract.timeSeriesData && contract.timeSeriesData.length > 0) {
      const timeSeriesEntry = contract.timeSeriesData.find(ts => ts.period === period);
      if (timeSeriesEntry) {
        return timeSeriesEntry.volume;
      }
    }
    
    // Fall back to shape-based calculation
    const [year, month] = period.split('-').map(Number);
    const monthIndex = month - 1;
    
    // Calculate monthly volume from annual volume and shape
    const monthlyVolumes = this.calculateMonthlyVolumesFromShape(contract);
    return monthlyVolumes[monthIndex] || 0;
  }
  
  /**
   * Calculate monthly volumes from volume shape and annual volume
   */
  private calculateMonthlyVolumesFromShape(contract: Contract): number[] {
    const volumeShapes = {
      flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
      solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
      wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
      custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
    };
    
    const percentages = volumeShapes[contract.volumeShape] || volumeShapes.flat;
    return percentages.map(pct => (contract.annualVolume * pct) / 100);
  }
  
  /**
   * Get contract price for a specific period
   */
  private getContractPriceForPeriod(contract: Contract, period: string, options: MtMCalculationOptions): number {
    const [year, month] = period.split('-').map(Number);
    const monthIndex = month - 1;
    
    // Handle time series pricing
    if (contract.pricingType === 'timeseries' && contract.priceTimeSeries && contract.priceTimeSeries.length > 0) {
      if (contract.priceInterval === 'monthly') {
        return contract.priceTimeSeries[monthIndex] || contract.strikePrice;
      } else if (contract.priceInterval === 'quarterly') {
        const quarterIndex = Math.floor(monthIndex / 3);
        return contract.priceTimeSeries[quarterIndex] || contract.strikePrice;
      } else if (contract.priceInterval === 'yearly') {
        return contract.priceTimeSeries[0] || contract.strikePrice;
      }
    }
    
    // Handle escalation pricing
    if (contract.pricingType === 'escalation' && contract.escalationRate && contract.referenceDate) {
      const refYear = new Date(contract.referenceDate).getFullYear();
      const yearsDiff = year - refYear;
      const monthsFromRef = yearsDiff * 12 + monthIndex;
      const escalationFactor = Math.pow(1 + (contract.escalationRate / 100), monthsFromRef / 12);
      return contract.strikePrice * escalationFactor;
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
    
    const totalVolume = timeSeriesData.reduce((sum, point) => sum + point.contractVolume, 0);
    const totalAbsVolume = Math.abs(totalVolume);
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
}

// Export singleton instance
export const mtmCalculationEngine = new MtMCalculationEngine();