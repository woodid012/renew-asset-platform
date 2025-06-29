'use client'

// ============================================================================
// SEGMENT 2: MONTHLY REVENUE CALCULATION ENGINE
// ============================================================================

/**
 * Monthly Revenue Calculation Engine
 * Handles detailed monthly revenue calculations with:
 * - Quarterly capacity factor variations
 * - Annual degradation
 * - Contract processing with indexation
 * - Merchant price integration
 * - Scenario stress testing
 */

// Get capacity factor for specific month
export const getMonthlyCapacityFactor = (asset, year, month) => {
  const quarter = Math.ceil(month / 3);
  const quarterKey = `qtrCapacityFactor_q${quarter}`;
  
  // Use asset's quarterly capacity factors if available
  if (asset[quarterKey] !== undefined && asset[quarterKey] !== '') {
    return parseFloat(asset[quarterKey]) / 100;
  }
  
  // Fallback to average or defaults
  const quarters = ['q1', 'q2', 'q3', 'q4'];
  const availableFactors = quarters
    .map(q => asset[`qtrCapacityFactor_${q}`])
    .filter(factor => factor !== undefined && factor !== '')
    .map(factor => parseFloat(factor) / 100);

  if (availableFactors.length > 0) {
    return availableFactors.reduce((sum, f) => sum + f, 0) / availableFactors.length;
  }

  // Technology and region defaults
  const defaultFactors = {
    solar: { NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27, WA: 0.26, TAS: 0.23 },
    wind: { NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40, WA: 0.37, TAS: 0.42 },
    storage: null // Storage doesn't use capacity factors
  };
  
  return defaultFactors[asset.type]?.[asset.state] || 
         (asset.type === 'solar' ? 0.25 : asset.type === 'wind' ? 0.35 : 0);
};

// Calculate monthly generation for renewable assets
export const calculateMonthlyGeneration = (asset, year, month, analysisStartYear, constants) => {
  const HOURS_IN_YEAR = constants.HOURS_IN_YEAR || 8760;
  const capacity = parseFloat(asset.capacity) || 0;
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
  
  // Get capacity factor for this month
  const capacityFactor = getMonthlyCapacityFactor(asset, year, month);
  
  // Calculate degradation factor
  const yearsSinceStart = year - analysisStartYear;
  const annualDegradation = parseFloat(asset.annualDegradation) || 0.5;
  const degradationFactor = Math.pow(1 - annualDegradation/100, yearsSinceStart);
  
  // Calculate hours in this specific month
  const hoursInMonth = new Date(year, month, 0).getDate() * 24;
  
  // Base generation for the month
  const baseMonthlyGeneration = capacity * hoursInMonth * capacityFactor; // MWh
  
  // Apply degradation and losses
  const adjustedGeneration = baseMonthlyGeneration * degradationFactor * (volumeLossAdjustment / 100);
  
  return {
    baseMonthlyGeneration,
    degradationFactor,
    capacityFactor,
    adjustedGeneration, // Final MWh for the month
    hoursInMonth,
    volumeLossAdjustment
  };
};

// Calculate monthly throughput for storage assets
export const calculateMonthlyStorageThroughput = (asset, year, month, analysisStartYear, constants) => {
  const volume = parseFloat(asset.volume) || 0; // Storage volume in MWh
  const capacity = parseFloat(asset.capacity) || 0; // Power capacity in MW
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
  const DAYS_IN_YEAR = 365;
  
  // Calculate degradation factor
  const yearsSinceStart = year - analysisStartYear;
  const annualDegradation = parseFloat(asset.annualDegradation) || 0.5;
  const degradationFactor = Math.pow(1 - annualDegradation/100, yearsSinceStart);
  
  // Calculate days in this specific month
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Monthly throughput calculation
  const baseDailyThroughput = volume; // MWh per day
  const baseMonthlyThroughput = baseDailyThroughput * daysInMonth;
  
  // Apply degradation and losses
  const adjustedThroughput = baseMonthlyThroughput * degradationFactor * (volumeLossAdjustment / 100);
  
  return {
    volume,
    capacity,
    duration: volume / capacity, // Storage duration in hours
    baseMonthlyThroughput,
    degradationFactor,
    adjustedThroughput, // Final MWh throughput for the month
    daysInMonth,
    volumeLossAdjustment
  };
};

// Process active contracts for a specific month
export const processMonthlyContracts = (asset, year, month, adjustedVolume) => {
  const periodDate = new Date(year, month - 1, 15); // Mid-month for contract checks
  
  // Filter active contracts for this period
  const activeContracts = (asset.contracts || []).filter(contract => {
    if (!contract.startDate || !contract.endDate) return false;
    
    const contractStart = new Date(contract.startDate);
    const contractEnd = new Date(contract.endDate);
    
    return periodDate >= contractStart && periodDate <= contractEnd;
  });
  
  // Initialize contract processing results
  let contractedGreenRevenue = 0;
  let contractedEnergyRevenue = 0;
  let totalGreenPercentage = 0;
  let totalEnergyPercentage = 0;
  let avgGreenPrice = 0;
  let avgEnergyPrice = 0;
  let greenPriceSum = 0;
  let energyPriceSum = 0;
  let greenContracts = 0;
  let energyContracts = 0;
  
  console.log(`Processing ${activeContracts.length} contracts for ${asset.name} in ${year}-${month.toString().padStart(2, '0')}`);
  
  activeContracts.forEach((contract, index) => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
    const years = year - new Date(contract.startDate).getFullYear();
    const indexation = parseFloat(contract.indexation) || 0;
    const indexationFactor = Math.pow(1 + indexation/100, years);
    
    console.log(`Contract ${index + 1}: ${contract.type}, ${buyersPercentage}%, indexation ${indexation}% over ${years} years = ${indexationFactor.toFixed(3)}x`);
    
    if (contract.type === 'bundled') {
      // Bundled green + energy contract
      let greenPrice = parseFloat(contract.greenPrice) || 0;
      let energyPrice = parseFloat(contract.EnergyPrice) || 0;
      
      // Apply indexation
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
      
      // Calculate revenues for this contract
      const contractVolume = adjustedVolume * buyersPercentage / 100;
      const greenRevenue = (contractVolume * greenPrice) / 1000000; // Convert to $M
      const energyRevenue = (contractVolume * energyPrice) / 1000000;
      
      contractedGreenRevenue += greenRevenue;
      contractedEnergyRevenue += energyRevenue;
      totalGreenPercentage += buyersPercentage;
      totalEnergyPercentage += buyersPercentage;
      
      greenPriceSum += greenPrice * buyersPercentage;
      energyPriceSum += energyPrice * buyersPercentage;
      greenContracts += buyersPercentage;
      energyContracts += buyersPercentage;
      
    } else if (contract.type === 'green') {
      // Green certificate only contract
      let price = parseFloat(contract.strikePrice) || 0;
      price *= indexationFactor;
      
      // Apply floor if exists
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue);
      }
      
      const contractVolume = adjustedVolume * buyersPercentage / 100;
      const revenue = (contractVolume * price) / 1000000;
      
      contractedGreenRevenue += revenue;
      totalGreenPercentage += buyersPercentage;
      greenPriceSum += price * buyersPercentage;
      greenContracts += buyersPercentage;
      
    } else if (contract.type === 'Energy' || contract.type === 'energy') {
      // Energy only contract
      let price = parseFloat(contract.strikePrice) || 0;
      price *= indexationFactor;
      
      // Apply floor if exists
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue);
      }
      
      const contractVolume = adjustedVolume * buyersPercentage / 100;
      const revenue = (contractVolume * price) / 1000000;
      
      contractedEnergyRevenue += revenue;
      totalEnergyPercentage += buyersPercentage;
      energyPriceSum += price * buyersPercentage;
      energyContracts += buyersPercentage;
      
    } else if (contract.type === 'fixed') {
      // Fixed revenue contract
      const annualRevenue = parseFloat(contract.strikePrice) || 0;
      const adjustedRevenue = annualRevenue * indexationFactor;
      const monthlyRevenue = adjustedRevenue / 12; // Spread equally across months
      
      contractedEnergyRevenue += monthlyRevenue / 1000000; // Convert to $M
      totalEnergyPercentage += buyersPercentage;
      
      // Fixed contracts don't have a $/MWh price, so don't include in averages
    }
  });
  
  // Calculate average prices
  avgGreenPrice = greenContracts > 0 ? greenPriceSum / greenContracts : 0;
  avgEnergyPrice = energyContracts > 0 ? energyPriceSum / energyContracts : 0;
  
  return {
    activeContracts: activeContracts.length,
    contractedGreenRevenue: Number(contractedGreenRevenue.toFixed(6)),
    contractedEnergyRevenue: Number(contractedEnergyRevenue.toFixed(6)),
    totalGreenPercentage: Math.min(totalGreenPercentage, 100),
    totalEnergyPercentage: Math.min(totalEnergyPercentage, 100),
    avgGreenPrice: Number(avgGreenPrice.toFixed(2)),
    avgEnergyPrice: Number(avgEnergyPrice.toFixed(2)),
    contractedGreenVolume: adjustedVolume * Math.min(totalGreenPercentage, 100) / 100,
    contractedEnergyVolume: adjustedVolume * Math.min(totalEnergyPercentage, 100) / 100
  };
};

// Process storage-specific contracts
export const processMonthlyStorageContracts = (asset, year, month, adjustedThroughput, capacity) => {
  const periodDate = new Date(year, month - 1, 15);
  
  const activeContracts = (asset.contracts || []).filter(contract => {
    if (!contract.startDate || !contract.endDate) return false;
    
    const contractStart = new Date(contract.startDate);
    const contractEnd = new Date(contract.endDate);
    
    return periodDate >= contractStart && periodDate <= contractEnd;
  });
  
  let contractedRevenue = 0;
  let totalContractedPercentage = 0;
  let avgContractPrice = 0;
  let priceSum = 0;
  let contracts = 0;
  
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
    const years = year - new Date(contract.startDate).getFullYear();
    const indexation = parseFloat(contract.indexation) || 0;
    const indexationFactor = Math.pow(1 + indexation/100, years);
    
    if (contract.type === 'cfd') {
      // Contract for Difference - $/MWh spread
      const priceSpread = parseFloat(contract.strikePrice) || 0;
      const adjustedSpread = priceSpread * indexationFactor;
      
      const revenue = adjustedThroughput * adjustedSpread * (buyersPercentage/100);
      contractedRevenue += revenue / 1000000; // Convert to $M
      
      priceSum += adjustedSpread * buyersPercentage;
      contracts += buyersPercentage;
      
    } else if (contract.type === 'tolling') {
      // Tolling agreement - $/MW/h
      const hourlyRate = parseFloat(contract.strikePrice) || 0;
      const adjustedRate = hourlyRate * indexationFactor;
      
      const hoursInMonth = new Date(year, month, 0).getDate() * 24;
      const revenue = capacity * hoursInMonth * adjustedRate * (buyersPercentage/100);
      contractedRevenue += revenue / 1000000;
      
      priceSum += adjustedRate * buyersPercentage;
      contracts += buyersPercentage;
      
    } else if (contract.type === 'fixed') {
      // Fixed revenue contract
      const annualRevenue = parseFloat(contract.strikePrice) || 0;
      const adjustedRevenue = annualRevenue * indexationFactor;
      const monthlyRevenue = adjustedRevenue / 12;
      
      contractedRevenue += monthlyRevenue / 1000000;
    }
    
    totalContractedPercentage += buyersPercentage;
  });
  
  avgContractPrice = contracts > 0 ? priceSum / contracts : 0;
  
  return {
    activeContracts: activeContracts.length,
    contractedRevenue: Number(contractedRevenue.toFixed(6)),
    totalContractedPercentage: Math.min(totalContractedPercentage, 100),
    avgContractPrice: Number(avgContractPrice.toFixed(2)),
    contractedVolume: adjustedThroughput * Math.min(totalContractedPercentage, 100) / 100
  };
};

// Calculate merchant revenue for renewable assets
export const calculateMonthlyMerchantRevenue = (asset, year, month, contractBreakdown, adjustedVolume, getMerchantPrice) => {
  // Calculate merchant volumes
  const merchantGreenVolume = adjustedVolume * (100 - contractBreakdown.totalGreenPercentage) / 100;
  const merchantEnergyVolume = adjustedVolume * (100 - contractBreakdown.totalEnergyPercentage) / 100;
  
  // Create time interval string for merchant price lookup
  const timeInterval = `${year}-${month.toString().padStart(2, '0')}`;
  
  // Get merchant prices (escalation already applied by MerchantPriceProvider)
  const merchantGreenPrice = getMerchantPrice(asset.type, 'green', asset.state, timeInterval) || 35;
  const merchantEnergyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, timeInterval) || 65;
  
  // Calculate revenues
  const merchantGreenRevenue = (merchantGreenVolume * merchantGreenPrice) / 1000000; // Convert to $M
  const merchantEnergyRevenue = (merchantEnergyVolume * merchantEnergyPrice) / 1000000;
  
  return {
    merchantGreenVolume: Number(merchantGreenVolume.toFixed(2)),
    merchantEnergyVolume: Number(merchantEnergyVolume.toFixed(2)),
    merchantGreenPrice: Number(merchantGreenPrice.toFixed(2)),
    merchantEnergyPrice: Number(merchantEnergyPrice.toFixed(2)),
    merchantGreenRevenue: Number(merchantGreenRevenue.toFixed(6)),
    merchantEnergyRevenue: Number(merchantEnergyRevenue.toFixed(6))
  };
};

// Calculate merchant revenue for storage assets
export const calculateMonthlyStorageMerchantRevenue = (asset, year, month, contractBreakdown, adjustedThroughput, getMerchantPrice) => {
  const merchantVolume = adjustedThroughput * (100 - contractBreakdown.totalContractedPercentage) / 100;
  
  if (merchantVolume <= 0) {
    return {
      merchantVolume: 0,
      merchantPriceSpread: 0,
      merchantRevenue: 0
    };
  }
  
  // Calculate storage duration for price interpolation
  const volume = parseFloat(asset.volume) || 0;
  const capacity = parseFloat(asset.capacity) || 0;
  const duration = volume / capacity;
  
  // Create time interval for price lookup
  const timeInterval = `${year}-${month.toString().padStart(2, '0')}`;
  
  // Interpolate between standard durations
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
  
  // Get prices for interpolation (escalation already applied)
  const lowerPrice = getMerchantPrice('storage', lowerDuration, asset.state, timeInterval) || 15;
  const upperPrice = getMerchantPrice('storage', upperDuration, asset.state, timeInterval) || 25;
  
  // Interpolate price spread
  const merchantPriceSpread = (lowerPrice * (1 - interpolationRatio)) + (upperPrice * interpolationRatio);
  
  // Calculate revenue
  const merchantRevenue = (merchantVolume * merchantPriceSpread) / 1000000;
  
  return {
    merchantVolume: Number(merchantVolume.toFixed(2)),
    merchantPriceSpread: Number(merchantPriceSpread.toFixed(2)),
    merchantRevenue: Number(merchantRevenue.toFixed(6)),
    duration: Number(duration.toFixed(2)),
    interpolationRatio: Number(interpolationRatio.toFixed(3))
  };
};

// Apply scenario stress to monthly revenue
export const applyMonthlyScenarioStress = (baseRevenue, scenario, constants) => {
  if (!scenario || scenario === 'base') {
    return { ...baseRevenue };
  }
  
  const volumeVar = (constants.volumeVariation || 20) / 100;
  const greenVar = (constants.greenPriceVariation || 20) / 100;
  const energyVar = (constants.EnergyPriceVariation || 20) / 100;
  
  let stressedRevenue = { ...baseRevenue };
  
  switch (scenario) {
    case 'worst':
      stressedRevenue.contractedGreenRevenue *= (1 - volumeVar);
      stressedRevenue.contractedEnergyRevenue *= (1 - volumeVar);
      stressedRevenue.merchantGreenRevenue *= (1 - volumeVar) * (1 - greenVar);
      stressedRevenue.merchantEnergyRevenue *= (1 - volumeVar) * (1 - energyVar);
      break;
      
    case 'volume':
      stressedRevenue.contractedGreenRevenue *= (1 - volumeVar);
      stressedRevenue.contractedEnergyRevenue *= (1 - volumeVar);
      stressedRevenue.merchantGreenRevenue *= (1 - volumeVar);
      stressedRevenue.merchantEnergyRevenue *= (1 - volumeVar);
      break;
      
    case 'price':
      stressedRevenue.merchantGreenRevenue *= (1 - greenVar);
      stressedRevenue.merchantEnergyRevenue *= (1 - energyVar);
      break;
      
    case 'upside':
      stressedRevenue.contractedGreenRevenue *= (1 + volumeVar * 0.5);
      stressedRevenue.contractedEnergyRevenue *= (1 + volumeVar * 0.5);
      stressedRevenue.merchantGreenRevenue *= (1 + volumeVar * 0.5) * (1 + greenVar * 0.5);
      stressedRevenue.merchantEnergyRevenue *= (1 + volumeVar * 0.5) * (1 + energyVar * 0.5);
      break;
      
    case 'downside':
      stressedRevenue.contractedGreenRevenue *= (1 - volumeVar * 0.5);
      stressedRevenue.contractedEnergyRevenue *= (1 - volumeVar * 0.5);
      stressedRevenue.merchantGreenRevenue *= (1 - volumeVar * 0.5) * (1 - greenVar * 0.5);
      stressedRevenue.merchantEnergyRevenue *= (1 - volumeVar * 0.5) * (1 - energyVar * 0.5);
      break;
      
    case 'stress':
      stressedRevenue.contractedGreenRevenue *= (1 - volumeVar * 1.5);
      stressedRevenue.contractedEnergyRevenue *= (1 - volumeVar * 1.5);
      stressedRevenue.merchantGreenRevenue *= (1 - volumeVar * 1.5) * (1 - greenVar * 1.5);
      stressedRevenue.merchantEnergyRevenue *= (1 - volumeVar * 1.5) * (1 - energyVar * 1.5);
      break;
  }
  
  // Ensure no negative revenues
  Object.keys(stressedRevenue).forEach(key => {
    if (typeof stressedRevenue[key] === 'number') {
      stressedRevenue[key] = Math.max(0, stressedRevenue[key]);
    }
  });
  
  return stressedRevenue;
};

// Main function to calculate monthly revenue for any asset type
export const calculateMonthlyAssetRevenue = (asset, year, month, analysisStartYear, constants, getMerchantPrice, scenario = 'base') => {
  console.log(`Calculating monthly revenue for ${asset.name} - ${year}-${month.toString().padStart(2, '0')}`);
  
  let baseRevenue = {
    contractedGreenRevenue: 0,
    contractedEnergyRevenue: 0,
    merchantGreenRevenue: 0,
    merchantEnergyRevenue: 0,
    totalRevenue: 0,
    adjustedVolume: 0,
    contractBreakdown: {},
    merchantBreakdown: {},
    generationData: {}
  };
  
  if (asset.type === 'storage') {
    // Storage asset calculation
    const throughputData = calculateMonthlyStorageThroughput(asset, year, month, analysisStartYear, constants);
    const contractBreakdown = processMonthlyStorageContracts(asset, year, month, throughputData.adjustedThroughput, throughputData.capacity);
    const merchantBreakdown = calculateMonthlyStorageMerchantRevenue(asset, year, month, contractBreakdown, throughputData.adjustedThroughput, getMerchantPrice);
    
    baseRevenue = {
      contractedGreenRevenue: 0, // Storage doesn't generate green certificates
      contractedEnergyRevenue: contractBreakdown.contractedRevenue,
      merchantGreenRevenue: 0,
      merchantEnergyRevenue: merchantBreakdown.merchantRevenue,
      totalRevenue: contractBreakdown.contractedRevenue + merchantBreakdown.merchantRevenue,
      adjustedVolume: throughputData.adjustedThroughput,
      contractBreakdown,
      merchantBreakdown,
      throughputData
    };
    
  } else {
    // Renewable asset calculation (solar, wind)
    const generationData = calculateMonthlyGeneration(asset, year, month, analysisStartYear, constants);
    const contractBreakdown = processMonthlyContracts(asset, year, month, generationData.adjustedGeneration);
    const merchantBreakdown = calculateMonthlyMerchantRevenue(asset, year, month, contractBreakdown, generationData.adjustedGeneration, getMerchantPrice);
    
    baseRevenue = {
      contractedGreenRevenue: contractBreakdown.contractedGreenRevenue,
      contractedEnergyRevenue: contractBreakdown.contractedEnergyRevenue,
      merchantGreenRevenue: merchantBreakdown.merchantGreenRevenue,
      merchantEnergyRevenue: merchantBreakdown.merchantEnergyRevenue,
      totalRevenue: contractBreakdown.contractedGreenRevenue + contractBreakdown.contractedEnergyRevenue +
                   merchantBreakdown.merchantGreenRevenue + merchantBreakdown.merchantEnergyRevenue,
      adjustedVolume: generationData.adjustedGeneration,
      contractBreakdown,
      merchantBreakdown,
      generationData
    };
  }
  
  // Apply scenario stress
  const stressedRevenue = applyMonthlyScenarioStress(baseRevenue, scenario, constants);
  
  // Recalculate total
  stressedRevenue.totalRevenue = stressedRevenue.contractedGreenRevenue + 
                                stressedRevenue.contractedEnergyRevenue +
                                stressedRevenue.merchantGreenRevenue + 
                                stressedRevenue.merchantEnergyRevenue;
  
  console.log(`Monthly revenue calculated: $${stressedRevenue.totalRevenue.toFixed(3)}M`);
  
  return stressedRevenue;
};