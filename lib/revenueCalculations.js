// lib/revenueCalculations.js
// Updated to use configurable escalation settings from MerchantPriceProvider

/**
 * Apply price escalation to base price - REMOVED as now handled by MerchantPriceProvider
 * This function is deprecated - escalation is now applied in getMerchantPrice
 */
export const applyEscalation = (basePrice, year, constants) => {
  console.warn('applyEscalation is deprecated - escalation now handled by MerchantPriceProvider');
  return basePrice; // No escalation here anymore
};

/**
 * Calculate revenue for renewable assets (solar, wind)
 * @param {object} asset - Asset object
 * @param {string|number} timeInterval - Time interval (year, quarter, or month)
 * @param {number} year - Year for calculation
 * @param {number} quarter - Quarter (if applicable)
 * @param {number} assetStartYear - Asset start year
 * @param {object} constants - Constants object
 * @param {function} getMerchantPrice - Function to get merchant prices (now includes escalation)
 * @returns {object} Revenue breakdown
 */
export const calculateRenewablesRevenue = (asset, timeInterval, year, quarter, assetStartYear, constants, getMerchantPrice) => {
  const HOURS_IN_YEAR = constants.HOURS_IN_YEAR || 8760;
  let capacityFactor;
  
  // Use asset's quarterly capacity factors if quarter is specified
  if (quarter) {
    const quarterKey = `qtrCapacityFactor_q${quarter}`;
    const storedQuarterlyFactor = asset[quarterKey];
    
    if (storedQuarterlyFactor !== undefined && storedQuarterlyFactor !== '') {
      capacityFactor = parseFloat(storedQuarterlyFactor) / 100;
    } else {
      // Fallback to constants
      capacityFactor = constants.capacityFactors_qtr?.[asset.type]?.[asset.state]?.[`Q${quarter}`] || 
                       constants.capacityFactors?.[asset.type]?.[asset.state] || 0.25;
    }
  } else {
    // For annual calculations, use average or stored annual factor
    const quarters = ['q1', 'q2', 'q3', 'q4'];
    const availableFactors = quarters
      .map(q => asset[`qtrCapacityFactor_${q}`])
      .filter(factor => factor !== undefined && factor !== '')
      .map(factor => parseFloat(factor) / 100);

    if (availableFactors.length === 4) {
      capacityFactor = availableFactors.reduce((sum, factor) => sum + factor, 0) / 4;
    } else {
      // Default capacity factors by technology and state
      const defaultFactors = {
        solar: { NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27, WA: 0.26, TAS: 0.23 },
        wind: { NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40, WA: 0.37, TAS: 0.42 }
      };
      capacityFactor = defaultFactors[asset.type]?.[asset.state] || 0.25;
    }
  }

  const capacity = parseFloat(asset.capacity) || 0;
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;

  // Calculate period adjustment
  let periodAdjustment = 1; // Default for yearly
  if (timeInterval.toString().includes('-Q')) {
    periodAdjustment = 0.25; // Quarter
  } else if (timeInterval.toString().includes('/')) {
    periodAdjustment = 1/12; // Month
  }

  // Calculate degradation factor
  const yearsSinceStart = year - assetStartYear;
  const degradation = parseFloat(asset.annualDegradation) || 0.5;
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart);

  // Calculate generation
  const periodGeneration = capacity * volumeLossAdjustment / 100 * HOURS_IN_YEAR * 
                          capacityFactor * periodAdjustment * degradationFactor;

  // Process active contracts
  const activeContracts = (asset.contracts || []).filter(contract => {
    const startYear = new Date(contract.startDate).getFullYear();
    const endYear = new Date(contract.endDate).getFullYear();
    return year >= startYear && year <= endYear;
  });

  let contractedGreen = 0;
  let contractedEnergy = 0;
  let totalGreenPercentage = 0;
  let totalEnergyPercentage = 0;
  
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
    const years = year - new Date(contract.startDate).getFullYear();
    const indexation = parseFloat(contract.indexation) || 0;
    const indexationFactor = Math.pow(1 + indexation/100, years);

    if (contract.type === 'fixed') {
      // Fixed Revenue contract
      const annualRevenue = parseFloat(contract.strikePrice) || 0;
      const contractRevenue = annualRevenue * indexationFactor * periodAdjustment * degradationFactor;
      contractedEnergy += contractRevenue;
      totalEnergyPercentage += buyersPercentage;
      
    } else if (contract.type === 'bundled') {
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
        } else {
          greenPrice = floorValue / 2;
          energyPrice = floorValue / 2;
        }
      }

      const greenRevenue = (periodGeneration * buyersPercentage/100 * greenPrice) / 1000000;
      const energyRevenue = (periodGeneration * buyersPercentage/100 * energyPrice) / 1000000;
      
      contractedGreen += greenRevenue;
      contractedEnergy += energyRevenue;
      totalGreenPercentage += buyersPercentage;
      totalEnergyPercentage += buyersPercentage;

    } else {
      // Single product contracts (green or energy)
      let price = parseFloat(contract.strikePrice) || 0;
      price *= indexationFactor;
      
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue);
      }

      const contractRevenue = (periodGeneration * buyersPercentage/100 * price) / 1000000;
      
      if (contract.type === 'green') {
        contractedGreen += contractRevenue;
        totalGreenPercentage += buyersPercentage;
      } else if (contract.type === 'Energy') {
        contractedEnergy += contractRevenue;
        totalEnergyPercentage += buyersPercentage;
      }
    }
  });

  // Calculate merchant revenue
  const greenMerchantPercentage = Math.max(0, 100 - totalGreenPercentage);
  const energyMerchantPercentage = Math.max(0, 100 - totalEnergyPercentage);
  
  // Get merchant prices using the existing merchant price provider
  // Map asset type to profile names used in merchant price data
  const profileMap = {
    'solar': 'solar',
    'wind': 'wind',
    'storage': 'storage'
  };
  
  const profile = profileMap[asset.type] || asset.type;
  
  // Get merchant prices - escalation now applied within getMerchantPrice
  const merchantGreenPrice = getMerchantPrice(profile, 'green', asset.state, timeInterval) || 35;
  const merchantEnergyPrice = getMerchantPrice(profile, 'Energy', asset.state, timeInterval) || 65;
  
  const merchantGreen = (periodGeneration * greenMerchantPercentage/100 * merchantGreenPrice) / 1000000;
  const merchantEnergy = (periodGeneration * energyMerchantPercentage/100 * merchantEnergyPrice) / 1000000;

  return {
    total: contractedGreen + contractedEnergy + merchantGreen + merchantEnergy,
    contractedGreen,
    contractedEnergy,
    merchantGreen,
    merchantEnergy,
    greenPercentage: totalGreenPercentage,
    EnergyPercentage: totalEnergyPercentage,
    annualGeneration: periodGeneration
  };
};

/**
 * Calculate revenue for storage assets
 * @param {object} asset - Asset object
 * @param {string|number} timeInterval - Time interval
 * @param {number} year - Year for calculation
 * @param {number} assetStartYear - Asset start year
 * @param {function} getMerchantPrice - Function to get merchant prices (now includes escalation)
 * @param {object} constants - Constants object
 * @returns {object} Revenue breakdown
 */

export const calculateStorageRevenue = (asset, timeInterval, year, assetStartYear, getMerchantPrice, constants) => {
  const volume = parseFloat(asset.volume) || 0;  // Total storage volume in MWh (e.g., 291 MWh)
  const capacity = parseFloat(asset.capacity) || 0;  // Power capacity in MW (e.g., 111 MW)
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
  const DAYS_IN_YEAR = 365;
  const HOURS_IN_YEAR = 8760;
 
  let periodAdjustment = 1;
  if (timeInterval.toString().includes('-Q')) {
    periodAdjustment = 0.25; 
  } else if (timeInterval.toString().includes('/')) {
    periodAdjustment = 1/12; 
  }
 
  const yearsSinceStart = year - assetStartYear;
  const degradation = parseFloat(asset.annualDegradation) || 0.5;
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart);
 
  // UPDATED: Correct annual volume calculation
  // Annual Volume = Volume × (1 - Degradation) × 365 days
  const annualVolume = volume * degradationFactor * (volumeLossAdjustment/100) * DAYS_IN_YEAR;
  
  console.log(`Storage Revenue Calculation for ${asset.name}:
    - Volume: ${volume} MWh
    - Capacity: ${capacity} MW
    - Duration: ${(volume/capacity).toFixed(2)} hours
    - Degradation Factor: ${degradationFactor.toFixed(4)}
    - Volume Loss Adjustment: ${volumeLossAdjustment}%
    - Annual Volume: ${annualVolume.toFixed(0)} MWh/year`);
 
  const activeContracts = (asset.contracts || []).filter(contract => {
    const startYear = new Date(contract.startDate).getFullYear();
    const endYear = new Date(contract.endDate).getFullYear();
    return year >= startYear && year <= endYear;
  });
 
  let contractedRevenue = 0;
  let totalContractedPercentage = 0;
 
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
    const years = year - new Date(contract.startDate).getFullYear();
    const indexation = parseFloat(contract.indexation) || 0;
    const indexationFactor = Math.pow(1 + indexation/100, years);
 
    if (contract.type === 'fixed') {
      const annualRevenue = parseFloat(contract.strikePrice) || 0;
      contractedRevenue += (annualRevenue * indexationFactor * periodAdjustment * degradationFactor);
      totalContractedPercentage += buyersPercentage;
      
    } else if (contract.type === 'cfd') {
      const priceSpread = parseFloat(contract.strikePrice) || 0;
      const adjustedSpread = priceSpread * indexationFactor;
      
      // UPDATED: Use corrected annual volume
      const revenue = annualVolume * adjustedSpread * (buyersPercentage/100) * periodAdjustment;
      contractedRevenue += revenue / 1000000;  // Convert to $M
      totalContractedPercentage += buyersPercentage;
      
    } else if (contract.type === 'tolling') {
      const hourlyRate = parseFloat(contract.strikePrice) || 0;
      const adjustedRate = hourlyRate * indexationFactor;
      
      const revenue = capacity * HOURS_IN_YEAR * adjustedRate * degradationFactor * 
                     (volumeLossAdjustment/100);
      contractedRevenue += (revenue / 1000000) * periodAdjustment;
      totalContractedPercentage += buyersPercentage;
    }
  });
 
  const merchantPercentage = Math.max(0, 100 - totalContractedPercentage);
  let merchantRevenue = 0;
  
  if (merchantPercentage > 0) {
    // Calculate storage duration for interpolation
    const calculatedDuration = volume / capacity;  // e.g., 291/111 = 2.62 hours
    const standardDurations = [0.5, 1, 2, 4];
    
    let lowerDuration = standardDurations[0];
    let upperDuration = standardDurations[standardDurations.length - 1];
    let interpolationRatio = 0.5;
    
    // Find the correct interpolation range
    for (let i = 0; i < standardDurations.length - 1; i++) {
      if (calculatedDuration >= standardDurations[i] && calculatedDuration <= standardDurations[i + 1]) {
        lowerDuration = standardDurations[i];
        upperDuration = standardDurations[i + 1];
        interpolationRatio = (calculatedDuration - lowerDuration) / (upperDuration - lowerDuration);
        break;
      }
    }

    // Get prices using storage profile - escalation already applied within getMerchantPrice
    const lowerPrice = getMerchantPrice('storage', lowerDuration, asset.state, timeInterval) || 15;
    const upperPrice = getMerchantPrice('storage', upperDuration, asset.state, timeInterval) || 25;
    
    // Interpolate between the two duration prices
    const priceSpread = (lowerPrice * (1 - interpolationRatio)) + (upperPrice * interpolationRatio);
    
    console.log(`Storage Price Interpolation:
      - Duration: ${calculatedDuration.toFixed(2)} hours
      - Lower: ${lowerDuration}hr @ $${lowerPrice}/MWh
      - Upper: ${upperDuration}hr @ $${upperPrice}/MWh
      - Interpolation Ratio: ${interpolationRatio.toFixed(2)}
      - Final Price: $${priceSpread.toFixed(2)}/MWh`);
    
    // UPDATED: Use corrected annual volume for merchant revenue
    const revenue = annualVolume * priceSpread * (merchantPercentage/100) * periodAdjustment;
    merchantRevenue = revenue / 1000000;  // Convert to $M
    
    console.log(`Merchant Revenue Calculation:
      - Annual Volume: ${annualVolume.toFixed(0)} MWh
      - Price Spread: $${priceSpread.toFixed(2)}/MWh
      - Merchant %: ${merchantPercentage}%
      - Period Adjustment: ${periodAdjustment}
      - Revenue: $${merchantRevenue.toFixed(2)}M`);
  }
 
  return {
    total: contractedRevenue + merchantRevenue,
    contractedGreen: 0,
    contractedEnergy: contractedRevenue,
    merchantGreen: 0,
    merchantEnergy: merchantRevenue,
    greenPercentage: 0,
    EnergyPercentage: totalContractedPercentage,
    annualGeneration: annualVolume  // Now correctly calculated
  };
};
/**
 * Main function to calculate asset revenue
 * @param {object} asset - Asset object
 * @param {string|number} timeInterval - Time interval
 * @param {object} constants - Constants object
 * @param {function} getMerchantPrice - Function to get merchant prices (now includes escalation)
 * @returns {object} Revenue breakdown
 */
export const calculateAssetRevenue = (asset, timeInterval, constants, getMerchantPrice) => {
  if (typeof timeInterval === 'number') {
    timeInterval = timeInterval.toString();
  }
  
  let year, quarter;
  if (!timeInterval.includes('/') && !timeInterval.includes('-')) {
    year = parseInt(timeInterval);
  } else if (timeInterval.includes('-Q')) {
    const [yearStr, quarterStr] = timeInterval.split('-Q');
    year = parseInt(yearStr);
    quarter = parseInt(quarterStr);
  } else if (timeInterval.includes('/')) {
    year = parseInt(timeInterval.split('/')[2]);
  } else {
    throw new Error('Invalid time interval format');
  }

  const assetStartYear = new Date(asset.assetStartDate).getFullYear();
  
  // Return zero revenue if asset hasn't started
  if (year < assetStartYear) {
    return {
      total: 0,
      contractedGreen: 0,
      contractedEnergy: 0,
      merchantGreen: 0,
      merchantEnergy: 0,
      greenPercentage: 0,
      EnergyPercentage: 0,
      annualGeneration: 0
    };
  }
  
  // Route to appropriate calculation function
  if (asset.type === 'storage') {
    return calculateStorageRevenue(asset, timeInterval, year, assetStartYear, getMerchantPrice, constants);
  }

  return calculateRenewablesRevenue(asset, timeInterval, year, quarter, assetStartYear, constants, getMerchantPrice);
};

/**
 * Apply stress scenarios to base revenue
 * @param {object} baseRevenue - Base revenue object
 * @param {string} scenario - Scenario type
 * @param {object} constants - Constants object
 * @returns {object} Stressed revenue
 */
export const calculateStressRevenue = (baseRevenue, scenario, constants) => {
  const volumeVar = constants.volumeVariation || 20;
  const greenVar = constants.greenPriceVariation || 20;
  const energyVar = constants.EnergyPriceVariation || 20;

  switch (scenario) {
    case 'worst':
      return {
        ...baseRevenue,
        merchantGreen: baseRevenue.merchantGreen * (1 - volumeVar/100) * (1 - greenVar/100),
        merchantEnergy: baseRevenue.merchantEnergy * (1 - volumeVar/100) * (1 - energyVar/100),
        contractedGreen: baseRevenue.contractedGreen * (1 - volumeVar/100),
        contractedEnergy: baseRevenue.contractedEnergy * (1 - volumeVar/100),
      };
    case 'volume':
      return {
        ...baseRevenue,
        merchantGreen: baseRevenue.merchantGreen * (1 - volumeVar/100),
        merchantEnergy: baseRevenue.merchantEnergy * (1 - volumeVar/100),
        contractedGreen: baseRevenue.contractedGreen * (1 - volumeVar/100),
        contractedEnergy: baseRevenue.contractedEnergy * (1 - volumeVar/100),
      };
    case 'price':
      return {
        ...baseRevenue,
        merchantGreen: baseRevenue.merchantGreen * (1 - greenVar/100),
        merchantEnergy: baseRevenue.merchantEnergy * (1 - energyVar/100),
        contractedGreen: baseRevenue.contractedGreen,
        contractedEnergy: baseRevenue.contractedEnergy,
      };
    default:
      return baseRevenue;
  }
};

/**
 * Generate portfolio revenue data for multiple time intervals
 * @param {object} assets - Assets object
 * @param {array} timeIntervals - Array of time intervals
 * @param {object} constants - Constants object
 * @param {function} getMerchantPrice - Function to get merchant prices (now includes escalation)
 * @returns {array} Portfolio revenue data
 */
export const generatePortfolioData = (assets, timeIntervals, constants, getMerchantPrice) => {
  return timeIntervals.map(timeInterval => {
    const periodData = {
      timeInterval,
      assets: {}
    };

    Object.values(assets).forEach(asset => {
      const assetRevenue = calculateAssetRevenue(asset, timeInterval, constants, getMerchantPrice);
      periodData.assets[asset.name] = assetRevenue;
    });

    return periodData;
  });
};

/**
 * Process portfolio data for visualization and analysis
 * @param {array} portfolioData - Portfolio data array
 * @param {object} assets - Assets object
 * @param {object} visibleAssets - Visible assets filter
 * @returns {array} Processed portfolio data
 */
export const processPortfolioData = (portfolioData, assets, visibleAssets) => {
  return portfolioData.map(periodData => {
    const processedPeriodData = {
      timeInterval: periodData.timeInterval,
      total: 0,
      contractedGreen: 0,
      contractedEnergy: 0,
      merchantGreen: 0,
      merchantEnergy: 0,
      totalGeneration: 0,
      weightedGreenPercentage: 0,
      weightedEnergyPercentage: 0
    };

    // Variables to track total volumes for proper weighting
    let totalRenewableGeneration = 0;
    let totalStorageGeneration = 0;

    // First pass to collect total generation
    Object.entries(periodData.assets).forEach(([assetName, assetData]) => {
      if (visibleAssets[assetName]) {
        const asset = Object.values(assets).find(a => a.name === assetName);
        
        if (asset.type === 'storage') {
          totalStorageGeneration += assetData.annualGeneration;
        } else {
          totalRenewableGeneration += assetData.annualGeneration;
        }
      }
    });

    const totalGeneration = totalRenewableGeneration + totalStorageGeneration;

    // Second pass to process data
    Object.entries(periodData.assets).forEach(([assetName, assetData]) => {
      if (visibleAssets[assetName]) {
        const asset = Object.values(assets).find(a => a.name === assetName);

        processedPeriodData.total += Number((assetData.contractedGreen + assetData.contractedEnergy + 
          assetData.merchantGreen + assetData.merchantEnergy).toFixed(2));

        processedPeriodData.contractedGreen += Number(assetData.contractedGreen.toFixed(2));
        processedPeriodData.contractedEnergy += Number(assetData.contractedEnergy.toFixed(2));
        processedPeriodData.merchantGreen += Number(assetData.merchantGreen.toFixed(2));
        processedPeriodData.merchantEnergy += Number(assetData.merchantEnergy.toFixed(2));

        processedPeriodData.totalGeneration += parseFloat(asset.capacity) || 0;
        
        processedPeriodData[`${assetName} Contracted Green`] = Number(assetData.contractedGreen.toFixed(2));
        processedPeriodData[`${assetName} Contracted Energy`] = Number(assetData.contractedEnergy.toFixed(2));
        processedPeriodData[`${assetName} Merchant Green`] = Number(assetData.merchantGreen.toFixed(2));
        processedPeriodData[`${assetName} Merchant Energy`] = Number(assetData.merchantEnergy.toFixed(2));
      }
    });
    
    // Calculate weighted percentages
    if (totalGeneration > 0) {
      if (Object.keys(periodData.assets).length === 1) {
        // Single asset - use direct percentages
        const assetData = Object.values(periodData.assets)[0];
        processedPeriodData.weightedGreenPercentage = assetData.greenPercentage || 0;
        processedPeriodData.weightedEnergyPercentage = assetData.EnergyPercentage || 0;
      } else {
        // Multi-asset portfolio - do proper weighting
        let weightedGreenPercentage = 0;
        let weightedEnergyPercentage = 0;
        
        // Only include green-capable assets in green percentage calculation
        const totalGreenCapableGeneration = totalRenewableGeneration;
        
        if (totalGreenCapableGeneration > 0) {
          Object.entries(periodData.assets)
            .filter(([assetName]) => {
              if (!visibleAssets[assetName]) return false;
              const asset = Object.values(assets).find(a => a.name === assetName);
              return asset.type !== 'storage';
            })
            .forEach(([_, assetData]) => {
              weightedGreenPercentage += (assetData.greenPercentage * assetData.annualGeneration / totalGreenCapableGeneration);
            });
        }
        
        // Calculate energy percentage from both renewables and storage
        Object.entries(periodData.assets)
          .filter(([assetName]) => visibleAssets[assetName])
          .forEach(([assetName, assetData]) => {
            const asset = Object.values(assets).find(a => a.name === assetName);
            weightedEnergyPercentage += (assetData.EnergyPercentage * assetData.annualGeneration / totalGeneration);
          });
        
        processedPeriodData.weightedGreenPercentage = weightedGreenPercentage;
        processedPeriodData.weightedEnergyPercentage = weightedEnergyPercentage;
      }
    }

    return processedPeriodData;
  });
};

/**
 * Calculate portfolio summary metrics
 * @param {array} portfolioData - Portfolio data array
 * @param {object} assets - Assets object
 * @returns {object} Summary metrics
 */
export const calculatePortfolioSummary = (portfolioData, assets) => {
  if (!portfolioData || portfolioData.length === 0) {
    return {
      totalRevenue: 0,
      averageRevenue: 0,
      contractedPercentage: 0,
      merchantPercentage: 0,
      totalCapacity: 0,
      assetCount: 0
    };
  }

  const totalRevenue = portfolioData.reduce((sum, period) => {
    return sum + Object.values(period.assets).reduce((periodSum, asset) => {
      return periodSum + asset.total;
    }, 0);
  }, 0);

  const totalContracted = portfolioData.reduce((sum, period) => {
    return sum + Object.values(period.assets).reduce((periodSum, asset) => {
      return periodSum + asset.contractedGreen + asset.contractedEnergy;
    }, 0);
  }, 0);

  const totalMerchant = portfolioData.reduce((sum, period) => {
    return sum + Object.values(period.assets).reduce((periodSum, asset) => {
      return periodSum + asset.merchantGreen + asset.merchantEnergy;
    }, 0);
  }, 0);

  const totalCapacity = Object.values(assets).reduce((sum, asset) => {
    return sum + (parseFloat(asset.capacity) || 0);
  }, 0);

  return {
    totalRevenue,
    averageRevenue: totalRevenue / portfolioData.length,
    contractedPercentage: totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0,
    merchantPercentage: totalRevenue > 0 ? (totalMerchant / totalRevenue) * 100 : 0,
    totalCapacity,
    assetCount: Object.keys(assets).length
  };
};

/**
 * Helper function to get extended merchant price with fallback
 * @param {function} getMerchantPrice - Base merchant price function (now includes escalation)
 * @param {string} profile - Asset profile
 * @param {string} type - Price type
 * @param {string} state - State
 * @param {string} timeStr - Time string
 * @param {object} constants - Constants for escalation (DEPRECATED - now handled by MerchantPriceProvider)
 * @returns {number} Price with fallback
 */
export const getExtendedMerchantPrice = (getMerchantPrice, profile, type, state, timeStr, constants) => {
  const price = getMerchantPrice(profile, type, state, timeStr);
  
  // If price exists, return it (already escalated by getMerchantPrice)
  if (price !== undefined && price !== null && price !== 0) {
    return price;
  }
  
  // Fallback logic - search backwards for valid prices
  const date = new Date(timeStr);
  const targetYear = date.getFullYear();
  const month = date.getMonth() + 1;
  let yearToTry = targetYear;
  let validPrices = [];
  
  // Keep trying previous years until we find 2 valid prices
  while (yearToTry > targetYear - 10 && validPrices.length < 2) {
    yearToTry--;
    const previousTimeStr = `1/${month.toString().padStart(2, '0')}/${yearToTry}`;
    const previousPrice = getMerchantPrice(profile, type, state, previousTimeStr);
    
    if (previousPrice !== undefined && previousPrice !== null && previousPrice !== 0) {
      validPrices.push({
        year: yearToTry,
        price: previousPrice
      });
    }
  }
  
  // If we found at least one price, use the most recent one (already escalated)
  if (validPrices.length > 0) {
    const mostRecent = validPrices.reduce((newest, current) => 
      current.year > newest.year ? current : newest
    );
    return mostRecent.price;
  }
  
  // Default fallback prices by technology and type
  const defaultPrices = {
    solar: { green: 35, Energy: 65 },
    wind: { green: 35, Energy: 65 },
    storage: { Energy: 80, 0.5: 15, 1: 20, 2: 25, 4: 35 }
  };
  
  return defaultPrices[profile]?.[type] || 50;
};

/**
 * Validate asset configuration for revenue calculations
 * @param {object} asset - Asset object
 * @returns {object} Validation result
 */
export const validateAssetForRevenue = (asset) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!asset.name) errors.push('Asset name is required');
  if (!asset.type) errors.push('Asset type is required');
  if (!asset.capacity || asset.capacity <= 0) errors.push('Valid capacity is required');
  if (!asset.assetStartDate) errors.push('Asset start date is required');

  // Type-specific validations
  if (asset.type === 'storage') {
    if (!asset.volume || asset.volume <= 0) {
      warnings.push('Storage volume should be specified');
    }
  }

  // Contract validations
  if (asset.contracts && asset.contracts.length > 0) {
    asset.contracts.forEach((contract, index) => {
      if (!contract.startDate) warnings.push(`Contract ${index + 1}: Start date missing`);
      if (!contract.endDate) warnings.push(`Contract ${index + 1}: End date missing`);
      if (!contract.strikePrice && !contract.EnergyPrice && !contract.greenPrice) {
        warnings.push(`Contract ${index + 1}: No pricing specified`);
      }
    });
  } else {
    warnings.push('No contracts specified - will rely on merchant revenue only');
  }

  // Capacity factor warnings
  if (asset.type !== 'storage') {
    const hasQuarterlyFactors = ['q1', 'q2', 'q3', 'q4'].some(q => 
      asset[`qtrCapacityFactor_${q}`] !== undefined && asset[`qtrCapacityFactor_${q}`] !== ''
    );
    
    if (!hasQuarterlyFactors) {
      warnings.push('No quarterly capacity factors specified - will use defaults');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Format revenue data for export
 * @param {array} portfolioData - Portfolio data array
 * @param {object} assets - Assets object
 * @param {string} format - Export format ('csv', 'json')
 * @returns {string} Formatted data
 */
export const formatRevenueDataForExport = (portfolioData, assets, format = 'csv') => {
  if (format === 'json') {
    return JSON.stringify({
      metadata: {
        exportDate: new Date().toISOString(),
        assetCount: Object.keys(assets).length,
        periodCount: portfolioData.length
      },
      assets: assets,
      revenueData: portfolioData
    }, null, 2);
  }

  // CSV format
  const headers = ['Period', 'Total Revenue', 'Contracted Green', 'Contracted Energy', 'Merchant Green', 'Merchant Energy'];
  
  // Add asset-specific columns
  Object.values(assets).forEach(asset => {
    headers.push(`${asset.name} Total`, `${asset.name} Contracted`, `${asset.name} Merchant`);
  });

  const rows = [headers.join(',')];

  portfolioData.forEach(period => {
    const row = [
      period.timeInterval,
      Object.values(period.assets).reduce((sum, asset) => sum + asset.total, 0).toFixed(2),
      Object.values(period.assets).reduce((sum, asset) => sum + asset.contractedGreen, 0).toFixed(2),
      Object.values(period.assets).reduce((sum, asset) => sum + asset.contractedEnergy, 0).toFixed(2),
      Object.values(period.assets).reduce((sum, asset) => sum + asset.merchantGreen, 0).toFixed(2),
      Object.values(period.assets).reduce((sum, asset) => sum + asset.merchantEnergy, 0).toFixed(2)
    ];

    // Add asset-specific data
    Object.values(assets).forEach(asset => {
      const assetData = period.assets[asset.name] || { total: 0, contractedGreen: 0, contractedEnergy: 0, merchantGreen: 0, merchantEnergy: 0 };
      row.push(
        assetData.total.toFixed(2),
        (assetData.contractedGreen + assetData.contractedEnergy).toFixed(2),
        (assetData.merchantGreen + assetData.merchantEnergy).toFixed(2)
      );
    });

    rows.push(row.join(','));
  });

  return rows.join('\n');
};