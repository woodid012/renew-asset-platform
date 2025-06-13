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
   * Calculate Mark-to-Market for a single contract - now uses bulk fetching
   */
  async calculateContractMtM(
    contract: Contract, 
    options: MtMCalculationOptions
  ): Promise<MtMCalculationResult | null> {
    
    // Single contract calculation now uses the bulk method
    const results = await this.calculatePortfolioMtM([contract], options);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * Calculate MtM for multiple contracts - fetch all market data at once
   */
  async calculatePortfolioMtM(
    contracts: Contract[], 
    options: MtMCalculationOptions
  ): Promise<MtMCalculationResult[]> {
    
    console.log(`🚀 Starting portfolio MtM calculation for ${contracts.length} contracts`);
    
    const activeContracts = contracts.filter(c => c.status === 'active');
    
    // Step 1: Fetch all market price data at once
    console.log(`📊 Fetching all market price data for ${options.selectedYear}...`);
    const allMarketPrices = await this.fetchAllMarketPrices(activeContracts, options);
    
    if (Object.keys(allMarketPrices).length === 0) {
      console.error('❌ No market price data available for any contracts');
      return [];
    }
    
    console.log(`✅ Fetched market prices for ${Object.keys(allMarketPrices).length} price series`);
    
    // Step 2: Process all contracts using the cached market data
    const results: MtMCalculationResult[] = [];
    
    for (const contract of activeContracts) {
      const result = await this.calculateContractMtMWithCachedPrices(contract, options, allMarketPrices);
      if (result) {
        results.push(result);
      }
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
      console.log(`⚡ Using baseload profile for Energy contract: ${contract.name}`);
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
   * Fetch all market price data at once for the portfolio
   */
  private async fetchAllMarketPrices(
    contracts: Contract[], 
    options: MtMCalculationOptions
  ): Promise<{ [key: string]: number[] }> {
    
    // Get unique combinations of state/profile/type needed
    const uniquePriceSeries = new Set<string>();
    
    contracts.forEach(contract => {
      const profile = this.determineMarketPriceProfile(contract, options);
      const contractType = contract.contractType || 'Energy';
      const key = `${contract.state}-${profile}-${contractType}`;
      uniquePriceSeries.add(key);
    });
    
    console.log(`🔍 Need to fetch ${uniquePriceSeries.size} unique price series:`, Array.from(uniquePriceSeries));
    
    // Fetch all price data at once using the price curves API
    try {
      const queryParams = new URLSearchParams({
        curve: options.priceCurve || 'Aurora Jan 2025',
        year: options.selectedYear.toString(),
        state: 'all', // Get all states
        profile: 'all', // Get all profiles  
        type: 'Energy' // Start with Energy
      });
      
      console.log(`🌐 Fetching all Energy prices: /api/price-curves?${queryParams}`);
      const energyResponse = await fetch(`/api/price-curves?${queryParams}`);
      const energyData = await energyResponse.json();
      
      // Also fetch Green prices if needed
      const needsGreen = contracts.some(c => (c.contractType || 'Energy') === 'Green');
      let greenData = { success: false, marketPrices: {} };
      
      if (needsGreen) {
        const greenParams = new URLSearchParams({
          curve: options.priceCurve || 'Aurora Jan 2025',
          year: options.selectedYear.toString(),
          state: 'all',
          profile: 'all',
          type: 'Green'
        });
        
        console.log(`🟢 Fetching all Green prices: /api/price-curves?${greenParams}`);
        const greenResponse = await fetch(`/api/price-curves?${greenParams}`);
        greenData = await greenResponse.json();
      }
      
      // Combine and convert all price data
      const allMarketPrices: { [key: string]: number[] } = {};
      
      if (energyData.success && energyData.marketPrices) {
        Object.entries(energyData.marketPrices).forEach(([seriesKey, timeSeriesData]: [string, any]) => {
          if (Array.isArray(timeSeriesData)) {
            allMarketPrices[seriesKey] = this.convertToMonthlyArray(timeSeriesData);
          }
        });
      }
      
      if (greenData.success && greenData.marketPrices) {
        Object.entries(greenData.marketPrices).forEach(([seriesKey, timeSeriesData]: [string, any]) => {
          if (Array.isArray(timeSeriesData)) {
            allMarketPrices[seriesKey] = this.convertToMonthlyArray(timeSeriesData);
          }
        });
      }
      
      console.log(`✅ Fetched ${Object.keys(allMarketPrices).length} price series in total`);
      return allMarketPrices;
      
    } catch (error) {
      console.error('❌ Error fetching all market prices:', error);
      return {};
    }
  }

  /**
   * Convert time series data to 12-month array
   */
  private convertToMonthlyArray(timeSeriesData: any[]): number[] {
    const monthlyPrices = new Array(12).fill(0);
    
    timeSeriesData.forEach(point => {
      if (point.month >= 1 && point.month <= 12) {
        monthlyPrices[point.month - 1] = point.price || 0;
      }
    });
    
    return monthlyPrices;
  }

  /**
   * Calculate contract MtM using pre-fetched market prices
   */
  private async calculateContractMtMWithCachedPrices(
    contract: Contract,
    options: MtMCalculationOptions,
    allMarketPrices: { [key: string]: number[] }
  ): Promise<MtMCalculationResult | null> {
    
    try {
      console.log(`🧮 Calculating MtM for contract: ${contract.name}`);
      
      // Step 1: Generate time periods
      const periods = this.generateCalculationPeriods(contract, options);
      if (periods.length === 0) {
        console.warn(`⚠️ No valid periods found for contract: ${contract.name}`);
        return null;
      }
      
      // Step 2: Find the right market prices from cached data
      const marketPriceProfile = this.determineMarketPriceProfile(contract, options);
      const monthlyMarketPrices = this.findMarketPricesInCache(
        contract, 
        marketPriceProfile, 
        allMarketPrices
      );
      
      if (monthlyMarketPrices.length === 0) {
        console.error(`❌ No cached market price data found for ${contract.name}`);
        return null;
      }
      
      // Step 3: Calculate period-by-period MtM
      const timeSeriesData: MtMTimeSeriesPoint[] = [];
      let cumulativeMtM = 0;
      
      for (const period of periods) {
        const periodData = this.calculatePeriodMtM(
          contract, 
          period, 
          monthlyMarketPrices, 
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
        priceDataSource: 'Cached Market Prices',
        marketPriceProfile: marketPriceProfile,
        
        periodsCalculated: timeSeriesData.length,
        firstPeriod: periods[0],
        lastPeriod: periods[periods.length - 1],
        calculationDate: new Date()
      };
      
      console.log(`✅ MtM calculation completed for ${contract.name}: ${summary.totalMtMPnL.toLocaleString()}`);
      return result;
      
    } catch (error) {
      console.error(`🚨 Error calculating MtM for contract ${contract.name}:`, error);
      return null;
    }
  }

  /**
   * Find market prices for a contract in the cached data
   */
  private findMarketPricesInCache(
    contract: Contract,
    profile: string,
    allMarketPrices: { [key: string]: number[] }
  ): number[] {
    
    const contractType = contract.contractType || 'Energy';
    const seriesKeys = Object.keys(allMarketPrices);
    
    console.log(`🔍 Finding cached prices for ${contract.state} ${profile} ${contractType}`);
    
    if (contractType === 'Green') {
      // Green certificate price matching
      const greenKeys = [
        `${contract.state} - ${profile} - green`,
        `${contract.state} - baseload - green`,
        `${contract.state} - green`,
        `${contract.state}-green`,
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
        if (allMarketPrices[key] && allMarketPrices[key].length === 12) {
          console.log(`✅ Found cached Green prices: "${key}"`);
          return allMarketPrices[key];
        }
      }
    } else {
      // Energy price matching
      const energyKeys = [
        `${contract.state} - ${profile} - Energy`,
        `${contract.state} - ${profile}`,
        `${contract.state} - baseload - Energy`,
        `${contract.state} - baseload`,
        `${contract.state}`,
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
        if (allMarketPrices[key] && allMarketPrices[key].length === 12) {
          console.log(`✅ Found cached Energy prices: "${key}"`);
          return allMarketPrices[key];
        }
      }
    }
    
    console.warn(`❌ No cached prices found for ${contract.state} ${profile} ${contractType}`);
    console.log(`Available keys:`, seriesKeys);
    return [];
  }
  
  /**
   * Calculate MtM for a specific period (simplified)
   */
  private calculatePeriodMtM(
    contract: Contract,
    period: string,
    monthlyMarketPrices: number[],
    options: MtMCalculationOptions
  ): MtMTimeSeriesPoint | null {
    
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
    const marketPrice = monthlyMarketPrices[monthIndex];
    
    if (!marketPrice || marketPrice <= 0) {
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
}

// Export singleton instance
export const mtmCalculationEngine = new MtMCalculationEngine();