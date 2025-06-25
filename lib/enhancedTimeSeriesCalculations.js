// lib/enhancedTimeSeriesCalculations.js
// Enhanced time series calculations integrating with existing backend structure

/**
 * Generate flexible time intervals
 */
export const generateTimeIntervals = (intervalType, startYear, periods, customIntervals = null) => {
  if (intervalType === 'custom' && customIntervals) {
    return customIntervals;
  }

  const intervals = [];
  const baseYear = startYear || new Date().getFullYear();

  switch (intervalType) {
    case 'annual':
      for (let i = 0; i < periods; i++) {
        intervals.push(baseYear + i);
      }
      break;

    case 'quarterly':
      const totalQuarters = periods || 40; // ~10 years default
      for (let i = 0; i < totalQuarters; i++) {
        const year = baseYear + Math.floor(i / 4);
        const quarter = (i % 4) + 1;
        intervals.push(`${year}-Q${quarter}`);
      }
      break;

    case 'monthly':
      const totalMonths = periods || 120; // ~10 years default
      for (let i = 0; i < totalMonths; i++) {
        const year = baseYear + Math.floor(i / 12);
        const month = (i % 12) + 1;
        intervals.push(`${year}-${month.toString().padStart(2, '0')}`);
      }
      break;

    default:
      throw new Error(`Unsupported interval type: ${intervalType}`);
  }

  return intervals;
};

/**
 * Parse time period to extract components
 */
export const parsePeriod = (timePeriod) => {
  const periodStr = timePeriod.toString();
  
  if (periodStr.includes('-Q')) {
    // Quarterly: "2025-Q3"
    const [year, quarterStr] = periodStr.split('-Q');
    const quarter = parseInt(quarterStr);
    return {
      type: 'quarterly',
      year: parseInt(year),
      quarter,
      month: null,
      startDate: new Date(parseInt(year), (quarter - 1) * 3, 1),
      endDate: new Date(parseInt(year), quarter * 3, 0),
      periodAdjustment: 0.25
    };
  } else if (periodStr.includes('-')) {
    // Monthly: "2025-03"
    const [year, month] = periodStr.split('-');
    return {
      type: 'monthly',
      year: parseInt(year),
      quarter: Math.ceil(parseInt(month) / 3),
      month: parseInt(month),
      startDate: new Date(parseInt(year), parseInt(month) - 1, 1),
      endDate: new Date(parseInt(year), parseInt(month), 0),
      periodAdjustment: 1/12
    };
  } else {
    // Annual: "2025"
    const year = parseInt(periodStr);
    return {
      type: 'annual',
      year,
      quarter: null,
      month: null,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      periodAdjustment: 1.0
    };
  }
};

/**
 * Get capacity factor for a specific period
 */
export const getCapacityFactorForPeriod = (asset, periodInfo) => {
  if (asset.type === 'storage') {
    return null; // Storage doesn't use capacity factors
  }

  if (periodInfo.type === 'quarterly' && periodInfo.quarter) {
    // Use asset's quarterly capacity factors
    const quarterKey = `qtrCapacityFactor_q${periodInfo.quarter}`;
    const storedFactor = asset[quarterKey];
    
    if (storedFactor !== undefined && storedFactor !== '') {
      return parseFloat(storedFactor) / 100;
    }
  }

  // Fallback to average or default
  const quarters = ['q1', 'q2', 'q3', 'q4'];
  const availableFactors = quarters
    .map(q => asset[`qtrCapacityFactor_${q}`])
    .filter(factor => factor !== undefined && factor !== '')
    .map(factor => parseFloat(factor) / 100);

  if (availableFactors.length === 4) {
    if (periodInfo.type === 'monthly') {
      // For monthly, use the quarter that contains this month
      const quarterIndex = Math.ceil(periodInfo.month / 3) - 1;
      return availableFactors[quarterIndex] || (availableFactors.reduce((sum, f) => sum + f, 0) / 4);
    }
    return availableFactors.reduce((sum, f) => sum + f, 0) / 4;
  }

  // Default capacity factors by technology and state
  const defaultFactors = {
    solar: { NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27, WA: 0.26, TAS: 0.23 },
    wind: { NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40, WA: 0.37, TAS: 0.42 }
  };
  
  return defaultFactors[asset.type]?.[asset.state] || 0.25;
};

/**
 * Check if contract is active for a specific period
 */
export const isContractActiveForPeriod = (contract, periodInfo) => {
  if (!contract.startDate || !contract.endDate) {
    return false;
  }

  const contractStart = new Date(contract.startDate);
  const contractEnd = new Date(contract.endDate);
  
  return periodInfo.startDate >= contractStart && periodInfo.endDate <= contractEnd;
};

/**
 * Calculate enhanced asset revenue for a specific time period
 */
export const calculateEnhancedAssetRevenue = (asset, timePeriod, constants, getMerchantPrice) => {
  const periodInfo = parsePeriod(timePeriod);
  const assetStartYear = new Date(asset.assetStartDate).getFullYear();
  
  // Check if asset has started
  if (periodInfo.year < assetStartYear) {
    return createEmptyAssetRevenue(asset, timePeriod, periodInfo);
  }

  if (asset.type === 'storage') {
    return calculateStorageEnhancedRevenue(asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice);
  } else {
    return calculateRenewableEnhancedRevenue(asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice);
  }
};

/**
 * Calculate enhanced revenue for renewable assets
 */
const calculateRenewableEnhancedRevenue = (asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice) => {
  const HOURS_IN_YEAR = constants.HOURS_IN_YEAR || 8760;
  const capacity = parseFloat(asset.capacity) || 0;
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
  
  // Get capacity factor for this period
  const capacityFactor = getCapacityFactorForPeriod(asset, periodInfo);
  
  // Calculate degradation
  const yearsSinceStart = periodInfo.year - assetStartYear;
  const degradation = parseFloat(asset.annualDegradation) || 0.5;
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart);
  
  // Volume calculations
  const baseVolume = capacity * HOURS_IN_YEAR * capacityFactor * periodInfo.periodAdjustment / 1000; // MWh
  const adjustedVolume = baseVolume * degradationFactor * (volumeLossAdjustment / 100);
  
  // Process active contracts for this period
  const activeContracts = (asset.contracts || []).filter(contract => 
    isContractActiveForPeriod(contract, periodInfo)
  );
  
  // Calculate contract breakdown
  const contractBreakdown = processRenewableContracts(activeContracts, periodInfo.year, adjustedVolume);
  
  // Get merchant prices (already includes escalation from MerchantPriceProvider)
  const merchantGreenPrice = getMerchantPrice(asset.type, 'green', asset.state, timePeriod) || 35;
  const merchantEnergyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, timePeriod) || 65;
  
  // Calculate merchant volumes
  const merchantGreenVolume = adjustedVolume * (100 - contractBreakdown.greenPercentage) / 100;
  const merchantEnergyVolume = adjustedVolume * (100 - contractBreakdown.energyPercentage) / 100;
  
  // Calculate revenues
  const merchantGreenRevenue = (merchantGreenVolume * merchantGreenPrice) / 1000000;
  const merchantEnergyRevenue = (merchantEnergyVolume * merchantEnergyPrice) / 1000000;
  
  return {
    // Time dimension
    timeDimension: {
      interval: timePeriod,
      intervalType: periodInfo.type,
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: periodInfo.periodAdjustment
    },
    
    // Asset metadata
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: capacity,
      assetState: asset.state,
      assetStartYear
    },
    
    // Volume breakdown
    volume: {
      baseVolume: round(baseVolume, 2),
      degradationFactor: round(degradationFactor, 4),
      volumeLossAdjustment,
      adjustedVolume: round(adjustedVolume, 2),
      capacityFactor: round(capacityFactor, 4),
      
      // Contract volume breakdown
      contractedGreenVolume: round(adjustedVolume * contractBreakdown.greenPercentage / 100, 2),
      contractedEnergyVolume: round(adjustedVolume * contractBreakdown.energyPercentage / 100, 2),
      merchantGreenVolume: round(merchantGreenVolume, 2),
      merchantEnergyVolume: round(merchantEnergyVolume, 2)
    },
    
    // Price breakdown
    prices: {
      contractedGreenPrice: contractBreakdown.avgGreenPrice,
      contractedEnergyPrice: contractBreakdown.avgEnergyPrice,
      merchantGreenPrice,
      merchantEnergyPrice,
      
      // Indexation factors
      greenIndexationFactor: contractBreakdown.greenIndexationFactor,
      energyIndexationFactor: contractBreakdown.energyIndexationFactor
    },
    
    // Revenue breakdown
    revenue: {
      contractedGreenRevenue: round(contractBreakdown.contractedGreenRevenue, 2),
      contractedEnergyRevenue: round(contractBreakdown.contractedEnergyRevenue, 2),
      merchantGreenRevenue: round(merchantGreenRevenue, 2),
      merchantEnergyRevenue: round(merchantEnergyRevenue, 2),
      totalRevenue: round(
        contractBreakdown.contractedGreenRevenue + 
        contractBreakdown.contractedEnergyRevenue + 
        merchantGreenRevenue + 
        merchantEnergyRevenue, 2
      )
    },
    
    // Contract details
    contracts: {
      activeContracts: activeContracts.map(contract => ({
        contractId: contract.id || `contract-${Date.now()}`,
        counterparty: contract.counterparty,
        type: contract.type,
        buyersPercentage: contract.buyersPercentage,
        indexationFactor: Math.pow(1 + (parseFloat(contract.indexation) || 0)/100, 
          periodInfo.year - new Date(contract.startDate).getFullYear())
      })),
      greenPercentage: contractBreakdown.greenPercentage,
      energyPercentage: contractBreakdown.energyPercentage
    },
    
    // Legacy compatibility
    legacy: {
      total: round(
        contractBreakdown.contractedGreenRevenue + 
        contractBreakdown.contractedEnergyRevenue + 
        merchantGreenRevenue + 
        merchantEnergyRevenue, 2
      ),
      contractedGreen: round(contractBreakdown.contractedGreenRevenue, 2),
      contractedEnergy: round(contractBreakdown.contractedEnergyRevenue, 2),
      merchantGreen: round(merchantGreenRevenue, 2),
      merchantEnergy: round(merchantEnergyRevenue, 2),
      greenPercentage: contractBreakdown.greenPercentage,
      EnergyPercentage: contractBreakdown.energyPercentage,
      annualGeneration: round(adjustedVolume, 2)
    }
  };
};

/**
 * Calculate enhanced revenue for storage assets
 */
const calculateStorageEnhancedRevenue = (asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice) => {
  const volume = parseFloat(asset.volume) || 0;  // Storage volume in MWh
  const capacity = parseFloat(asset.capacity) || 0;  // Power capacity in MW
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
  const DAYS_IN_YEAR = 365;
  
  // Calculate degradation
  const yearsSinceStart = periodInfo.year - assetStartYear;
  const degradation = parseFloat(asset.annualDegradation) || 0.5;
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart);
  
  // Volume calculations for storage
  const baseAnnualVolume = volume * DAYS_IN_YEAR; // Base throughput
  const basePeriodVolume = baseAnnualVolume * periodInfo.periodAdjustment;
  const adjustedVolume = basePeriodVolume * degradationFactor * (volumeLossAdjustment / 100);
  
  // Process storage contracts
  const activeContracts = (asset.contracts || []).filter(contract => 
    isContractActiveForPeriod(contract, periodInfo)
  );
  
  const contractBreakdown = processStorageContracts(activeContracts, periodInfo.year, capacity, adjustedVolume, periodInfo.periodAdjustment);
  
  // Calculate merchant price spread
  const duration = volume / capacity;
  const merchantPriceSpread = calculateStoragePriceSpread(asset, timePeriod, duration, getMerchantPrice);
  
  // Calculate merchant revenue
  const merchantVolume = adjustedVolume * (100 - contractBreakdown.contractedPercentage) / 100;
  const merchantRevenue = (merchantVolume * merchantPriceSpread) / 1000000;
  
  return {
    // Time dimension
    timeDimension: {
      interval: timePeriod,
      intervalType: periodInfo.type,
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: periodInfo.periodAdjustment
    },
    
    // Asset metadata
    assetMetadata: {
      assetName: asset.name,
      assetType: 'storage',
      assetCapacity: capacity,
      assetState: asset.state,
      assetStartYear,
      storageVolume: volume,
      storageDuration: round(duration, 2)
    },
    
    // Volume breakdown
    volume: {
      baseAnnualVolume: round(baseAnnualVolume, 2),
      basePeriodVolume: round(basePeriodVolume, 2),
      degradationFactor: round(degradationFactor, 4),
      volumeLossAdjustment,
      adjustedVolume: round(adjustedVolume, 2),
      
      // Contract volume breakdown
      contractedVolume: round(adjustedVolume * contractBreakdown.contractedPercentage / 100, 2),
      merchantVolume: round(merchantVolume, 2)
    },
    
    // Price breakdown
    prices: {
      contractedAvgPrice: contractBreakdown.avgContractPrice,
      merchantPriceSpread,
      contractIndexationFactor: contractBreakdown.indexationFactor
    },
    
    // Revenue breakdown
    revenue: {
      contractedRevenue: round(contractBreakdown.contractedRevenue, 2),
      merchantRevenue: round(merchantRevenue, 2),
      totalRevenue: round(contractBreakdown.contractedRevenue + merchantRevenue, 2)
    },
    
    // Contract details
    contracts: {
      activeContracts: activeContracts.map(contract => ({
        contractId: contract.id || `contract-${Date.now()}`,
        counterparty: contract.counterparty,
        type: contract.type,
        buyersPercentage: contract.buyersPercentage,
        indexationFactor: Math.pow(1 + (parseFloat(contract.indexation) || 0)/100, 
          periodInfo.year - new Date(contract.startDate).getFullYear())
      })),
      contractedPercentage: contractBreakdown.contractedPercentage
    },
    
    // Legacy compatibility
    legacy: {
      total: round(contractBreakdown.contractedRevenue + merchantRevenue, 2),
      contractedGreen: 0,
      contractedEnergy: round(contractBreakdown.contractedRevenue, 2),
      merchantGreen: 0,
      merchantEnergy: round(merchantRevenue, 2),
      greenPercentage: 0,
      EnergyPercentage: contractBreakdown.contractedPercentage,
      annualGeneration: round(adjustedVolume, 2)
    }
  };
};

/**
 * Process renewable asset contracts
 */
const processRenewableContracts = (activeContracts, year, adjustedVolume) => {
  let greenPercentage = 0;
  let energyPercentage = 0;
  let contractedGreenRevenue = 0;
  let contractedEnergyRevenue = 0;
  let totalGreenPrice = 0;
  let totalEnergyPrice = 0;
  let greenContracts = 0;
  let energyContracts = 0;
  let greenIndexationSum = 0;
  let energyIndexationSum = 0;
  
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
    const years = year - new Date(contract.startDate).getFullYear();
    const indexation = parseFloat(contract.indexation) || 0;
    const indexationFactor = Math.pow(1 + indexation/100, years);
    
    if (contract.type === 'bundled') {
      let greenPrice = parseFloat(contract.greenPrice) || 0;
      let energyPrice = parseFloat(contract.EnergyPrice) || 0;
      
      greenPrice *= indexationFactor;
      energyPrice *= indexationFactor;
      
      // Apply floor if exists
      if (contract.hasFloor && (greenPrice + energyPrice) < parseFloat(contract.floorValue)) {
        const total = greenPrice + energyPrice;
        const floorValue = parseFloat(contract.floorValue);
        if (total > 0) {
          greenPrice = (greenPrice / total) * floorValue;
          energyPrice = (energyPrice / total) * floorValue;
        }
      }
      
      const greenRevenue = (adjustedVolume * buyersPercentage/100 * greenPrice) / 1000000;
      const energyRevenue = (adjustedVolume * buyersPercentage/100 * energyPrice) / 1000000;
      
      contractedGreenRevenue += greenRevenue;
      contractedEnergyRevenue += energyRevenue;
      greenPercentage += buyersPercentage;
      energyPercentage += buyersPercentage;
      totalGreenPrice += greenPrice * buyersPercentage;
      totalEnergyPrice += energyPrice * buyersPercentage;
      greenContracts += buyersPercentage;
      energyContracts += buyersPercentage;
      greenIndexationSum += indexationFactor * buyersPercentage;
      energyIndexationSum += indexationFactor * buyersPercentage;
      
    } else if (contract.type === 'green') {
      let price = parseFloat(contract.strikePrice) || 0;
      price *= indexationFactor;
      
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue);
      }
      
      const revenue = (adjustedVolume * buyersPercentage/100 * price) / 1000000;
      contractedGreenRevenue += revenue;
      greenPercentage += buyersPercentage;
      totalGreenPrice += price * buyersPercentage;
      greenContracts += buyersPercentage;
      greenIndexationSum += indexationFactor * buyersPercentage;
      
    } else if (contract.type === 'Energy') {
      let price = parseFloat(contract.strikePrice) || 0;
      price *= indexationFactor;
      
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue);
      }
      
      const revenue = (adjustedVolume * buyersPercentage/100 * price) / 1000000;
      contractedEnergyRevenue += revenue;
      energyPercentage += buyersPercentage;
      totalEnergyPrice += price * buyersPercentage;
      energyContracts += buyersPercentage;
      energyIndexationSum += indexationFactor * buyersPercentage;
    }
  });
  
  return {
    greenPercentage: Math.min(greenPercentage, 100),
    energyPercentage: Math.min(energyPercentage, 100),
    avgGreenPrice: greenContracts > 0 ? totalGreenPrice / greenContracts : 0,
    avgEnergyPrice: energyContracts > 0 ? totalEnergyPrice / energyContracts : 0,
    greenIndexationFactor: greenContracts > 0 ? greenIndexationSum / greenContracts : 1,
    energyIndexationFactor: energyContracts > 0 ? energyIndexationSum / energyContracts : 1,
    contractedGreenRevenue,
    contractedEnergyRevenue
  };
};

/**
 * Process storage contracts
 */
const processStorageContracts = (activeContracts, year, capacity, adjustedVolume, periodAdjustment) => {
  let contractedPercentage = 0;
  let contractedRevenue = 0;
  let totalPrice = 0;
  let totalContracts = 0;
  let indexationSum = 0;
  
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
    const years = year - new Date(contract.startDate).getFullYear();
    const indexation = parseFloat(contract.indexation) || 0;
    const indexationFactor = Math.pow(1 + indexation/100, years);
    
    if (contract.type === 'cfd') {
      const priceSpread = parseFloat(contract.strikePrice) || 0;
      const adjustedSpread = priceSpread * indexationFactor;
      
      const revenue = adjustedVolume * adjustedSpread * (buyersPercentage/100);
      contractedRevenue += revenue / 1000000;  // Convert to $M
      totalPrice += adjustedSpread * buyersPercentage;
      
    } else if (contract.type === 'tolling') {
      const hourlyRate = parseFloat(contract.strikePrice) || 0;
      const adjustedRate = hourlyRate * indexationFactor;
      
      const revenue = capacity * 8760 * periodAdjustment * adjustedRate * (buyersPercentage/100);
      contractedRevenue += revenue / 1000000;
      totalPrice += adjustedRate * buyersPercentage;
    }
    
    contractedPercentage += buyersPercentage;
    totalContracts += buyersPercentage;
    indexationSum += indexationFactor * buyersPercentage;
  });
  
  return {
    contractedPercentage: Math.min(contractedPercentage, 100),
    avgContractPrice: totalContracts > 0 ? totalPrice / totalContracts : 0,
    contractedRevenue,
    indexationFactor: totalContracts > 0 ? indexationSum / totalContracts : 1
  };
};

/**
 * Calculate storage price spread with interpolation
 */
const calculateStoragePriceSpread = (asset, timeInterval, duration, getMerchantPrice) => {
  const standardDurations = [0.5, 1, 2, 4];
  
  let lowerDuration = standardDurations[0];
  let upperDuration = standardDurations[standardDurations.length - 1];
  let interpolationRatio = 0.5;
  
  for (let i = 0; i < standardDurations.length - 1; i++) {
    if (duration >= standardDurations[i] && duration <= standardDurations[i + 1]) {
      lowerDuration = standardDurations[i];
      upperDuration = standardDurations[i + 1];
      interpolationRatio = (duration - lowerDuration) / (upperDuration - lowerDuration);
      break;
    }
  }
  
  const lowerPrice = getMerchantPrice('storage', lowerDuration, asset.state, timeInterval) || 15;
  const upperPrice = getMerchantPrice('storage', upperDuration, asset.state, timeInterval) || 25;
  
  return (lowerPrice * (1 - interpolationRatio)) + (upperPrice * interpolationRatio);
};

/**
 * Create empty asset revenue for periods before asset start
 */
const createEmptyAssetRevenue = (asset, timePeriod, periodInfo) => {
  const emptyStructure = {
    timeDimension: {
      interval: timePeriod,
      intervalType: periodInfo.type,
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: periodInfo.periodAdjustment
    },
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: parseFloat(asset.capacity) || 0,
      assetState: asset.state,
      assetStartYear: new Date(asset.assetStartDate).getFullYear()
    },
    volume: { adjustedVolume: 0 },
    prices: {},
    revenue: { totalRevenue: 0 },
    contracts: { activeContracts: [] },
    legacy: {
      total: 0,
      contractedGreen: 0,
      contractedEnergy: 0,
      merchantGreen: 0,
      merchantEnergy: 0,
      greenPercentage: 0,
      EnergyPercentage: 0,
      annualGeneration: 0
    }
  };
  
  return emptyStructure;
};

/**
 * Utility function for rounding
 */
const round = (value, decimals) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Generate enhanced portfolio time series
 */
export const generateEnhancedPortfolioTimeSeries = (assets, timeIntervals, constants, getMerchantPrice) => {
  const portfolioTimeSeries = [];
  
  timeIntervals.forEach(timeInterval => {
    const periodInfo = parsePeriod(timeInterval);
    
    // Calculate portfolio-level aggregates
    const portfolioAggregates = {
      totalRevenue: 0,
      totalVolume: 0,
      totalCapacity: 0,
      contractedGreenRevenue: 0,
      contractedEnergyRevenue: 0,
      merchantGreenRevenue: 0,
      merchantEnergyRevenue: 0,
      weightedAvgPrice: 0
    };
    
    // Calculate asset-level data
    const assetData = {};
    
    Object.values(assets).forEach(asset => {
      const assetRevenue = calculateEnhancedAssetRevenue(asset, timeInterval, constants, getMerchantPrice);
      assetData[asset.name] = assetRevenue;
      
      // Aggregate to portfolio level
      portfolioAggregates.totalRevenue += assetRevenue.revenue.totalRevenue;
      portfolioAggregates.totalVolume += assetRevenue.volume.adjustedVolume || 0;
      portfolioAggregates.totalCapacity += assetRevenue.assetMetadata.assetCapacity;
      portfolioAggregates.contractedGreenRevenue += assetRevenue.revenue.contractedGreenRevenue || 0;
      portfolioAggregates.contractedEnergyRevenue += assetRevenue.revenue.contractedEnergyRevenue || 0;
      portfolioAggregates.merchantGreenRevenue += assetRevenue.revenue.merchantGreenRevenue || 0;
      portfolioAggregates.merchantEnergyRevenue += assetRevenue.revenue.merchantEnergyRevenue || 0;
    });
    
    // Calculate weighted averages
    portfolioAggregates.weightedAvgPrice = portfolioAggregates.totalVolume > 0 
      ? (portfolioAggregates.totalRevenue * 1000000) / portfolioAggregates.totalVolume 
      : 0;
    
    portfolioAggregates.contractedPercentage = portfolioAggregates.totalRevenue > 0 
      ? ((portfolioAggregates.contractedGreenRevenue + portfolioAggregates.contractedEnergyRevenue) / portfolioAggregates.totalRevenue) * 100 
      : 0;
    
    portfolioTimeSeries.push({
      timeDimension: {
        interval: timeInterval,
        intervalType: periodInfo.type,
        year: periodInfo.year,
        quarter: periodInfo.quarter,
        month: periodInfo.month,
        periodAdjustment: periodInfo.periodAdjustment
      },
      portfolio: portfolioAggregates,
      assets: assetData
    });
  });
  
  return portfolioTimeSeries;
};