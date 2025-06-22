// Consolidated Revenue Calculations
// Combines renewables, storage, and main revenue calculation logic

export const applyEscalation = (basePrice, year, constants) => {
  if (!basePrice || !constants.referenceYear || !constants.escalation) return basePrice;
  const yearDiff = year - constants.referenceYear;
  return basePrice * Math.pow(1 + constants.escalation / 100, yearDiff);
};

export const calculateRenewablesRevenue = (asset, timeInterval, year, quarter, assetStartYear, constants, getMerchantPrice) => {
  const HOURS_IN_YEAR = constants.HOURS_IN_YEAR;
  let capacityFactor;
  
  // Use asset's quarterly capacity factors if quarter is specified
  if (quarter) {
    // Try to get the asset's stored quarterly capacity factor
    const quarterKey = `qualrtyCapacityFactor_q${quarter}`;
    const storedQuarterlyFactor = asset[quarterKey];
    
    if (storedQuarterlyFactor !== undefined && storedQuarterlyFactor !== '') {
      // Convert from percentage to decimal
      capacityFactor = parseFloat(storedQuarterlyFactor) / 100;
    } else {
      // Fallback to constants if asset doesn't have the quarterly factor
      capacityFactor = constants.capacityFactors_qtr[asset.type]?.[asset.state]?.[`Q${quarter}`] || 
                       constants.capacityFactors[asset.type]?.[asset.state] || 0;
    }
  } else {
    // For annual calculations, average the quarterly factors if available
    const quarters = ['q1', 'q2', 'q3', 'q4'];
    const availableFactors = quarters
      .map(q => asset[`qualrtyCapacityFactor_${q}`])
      .filter(factor => factor !== undefined && factor !== '')
      .map(factor => parseFloat(factor) / 100);

    if (availableFactors.length === 4) {
      // If we have all quarterly factors, use their average
      capacityFactor = availableFactors.reduce((sum, factor) => sum + factor, 0) / 4;
    } else {
      // Fallback to constants if we don't have all quarterly factors
      capacityFactor = constants.capacityFactors[asset.type]?.[asset.state] || 0;
    }
  }

  const capacity = parseFloat(asset.capacity) || 0;
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;

  // Calculate period-adjusted generation
  let periodAdjustment = 1; // Default for yearly
  if (timeInterval.includes('-Q')) {
    periodAdjustment = 0.25; // Quarter is 1/4 of a year
  } else if (timeInterval.includes('/')) {
    periodAdjustment = 1/12; // Month is 1/12 of a year
  }

  // Calculate degradation factor based on years since start
  const yearsSinceStart = year - assetStartYear;
  const degradation = parseFloat(asset.annualDegradation) || constants.annualDegradation[asset.type] || 0;
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart);

  // Calculate generation with degradation factor
  const periodGeneration = capacity * volumeLossAdjustment / 100 * HOURS_IN_YEAR * capacityFactor * periodAdjustment * degradationFactor;

  // Process active contracts
  const activeContracts = asset.contracts.filter(contract => {
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
      // Fixed Revenue contract - directly use the annual revenue in $M
      // For fixed revenue, ignore buyers percentage as it's a fixed amount
      const annualRevenue = parseFloat(contract.strikePrice) || 0;
      const contractRevenue = annualRevenue * indexationFactor * periodAdjustment * degradationFactor;
      
      // Allocate all fixed revenue to Energy component
      contractedGreen += 0;
      contractedEnergy += contractRevenue;
      totalGreenPercentage += 0;  // No green percentage for fixed revenue
      totalEnergyPercentage += buyersPercentage;
    } else if (contract.type === 'bundled') {
      let greenPrice = parseFloat(contract.greenPrice) || 0;
      let EnergyPrice = parseFloat(contract.EnergyPrice) || 0;
      
      greenPrice *= indexationFactor;
      EnergyPrice *= indexationFactor;

      if (contract.hasFloor && (greenPrice + EnergyPrice) < parseFloat(contract.floorValue)) {
        const total = greenPrice + EnergyPrice;
        const floorValue = parseFloat(contract.floorValue);
        if (total > 0) {
          greenPrice = (greenPrice / total) * floorValue;
          EnergyPrice = (EnergyPrice / total) * floorValue;
        } else {
          greenPrice = floorValue / 2;
          EnergyPrice = floorValue / 2;
        }
      }

      const greenRevenue = (periodGeneration * buyersPercentage/100 * greenPrice) / 1000000;
      const EnergyRevenue = (periodGeneration * buyersPercentage/100 * EnergyPrice) / 1000000;
      
      contractedGreen += greenRevenue;
      contractedEnergy += EnergyRevenue;
      totalGreenPercentage += buyersPercentage;
      totalEnergyPercentage += buyersPercentage;

    } else {
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
  const EnergyMerchantPercentage = Math.max(0, 100 - totalEnergyPercentage);
  
  // Get merchant prices for the specific time interval and apply escalation
  const merchantGreenPrice = applyEscalation(getMerchantPrice(asset.type, 'green', asset.state, timeInterval) || 0, year, constants);
  const merchantEnergyPrice = applyEscalation(getMerchantPrice(asset.type, 'Energy', asset.state, timeInterval) || 0, year, constants);
  
  // Calculate merchant revenues with period-adjusted generation
  const merchantGreen = (periodGeneration * greenMerchantPercentage/100 * merchantGreenPrice) / 1000000;
  const merchantEnergy = (periodGeneration * EnergyMerchantPercentage/100 * merchantEnergyPrice) / 1000000;

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

export const calculateStorageRevenue = (asset, timeInterval, year, assetStartYear, getMerchantPrice, constants) => {
  const dailyVolume = parseFloat(asset.volume) || 0;
  const annualVolume = dailyVolume * 365;
  const capacity = parseFloat(asset.capacity) || 0;
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
  const DAYS_IN_YEAR = 365;
  const HOURS_IN_YEAR = 8760;
 
  let periodAdjustment = 1;
  if (timeInterval.includes('-Q')) {
    periodAdjustment = 0.25; 
  } else if (timeInterval.includes('/')) {
    periodAdjustment = 1/12; 
  }
 
  const yearsSinceStart = year - assetStartYear;
  const degradation = parseFloat(asset.annualDegradation) || 0;
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart);
 
  const activeContracts = asset.contracts.filter(contract => {
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
      
      const revenue = dailyVolume * 1 * DAYS_IN_YEAR * adjustedSpread * degradationFactor * (volumeLossAdjustment/100) * (buyersPercentage/100);
      contractedRevenue += revenue / 1000000;
      totalContractedPercentage += buyersPercentage;
    } else if (contract.type === 'tolling') {
      const hourlyRate = parseFloat(contract.strikePrice) || 0;
      const adjustedRate = hourlyRate * indexationFactor;
      
      const revenue = capacity * HOURS_IN_YEAR * adjustedRate;
      contractedRevenue += (revenue / 1000000) * periodAdjustment;
      totalContractedPercentage += buyersPercentage;
    }
  });
 
  const merchantPercentage = Math.max(0, 100 - totalContractedPercentage);
  let merchantRevenue = 0;
  
  if (merchantPercentage > 0) {
    
    const calculatedDuration = dailyVolume / capacity;
    const standardDurations = [0.5, 1, 2, 4];
    
    // Find the two closest durations for interpolation
    let lowerDuration = standardDurations[0];
    let upperDuration = standardDurations[standardDurations.length - 1];
    let interpolationRatio = 0.5;
    
    for (let i = 0; i < standardDurations.length - 1; i++) {
      if (calculatedDuration >= standardDurations[i] && calculatedDuration <= standardDurations[i + 1]) {
        lowerDuration = standardDurations[i];
        upperDuration = standardDurations[i + 1];
        interpolationRatio = (calculatedDuration - lowerDuration) / (upperDuration - lowerDuration);
        break;
      }
    }

    // Get standard duration prices and apply escalation
    const lowerPrice = getMerchantPrice('storage', lowerDuration, asset.state, year);
    const upperPrice = getMerchantPrice('storage', upperDuration, asset.state, year);
    
    // Apply escalation to both prices before interpolation
    const escalatedLowerPrice = applyEscalation(lowerPrice, year, constants);
    const escalatedUpperPrice = applyEscalation(upperPrice, year, constants);
    
    // Interpolate between the escalated prices
    const priceSpread = (escalatedLowerPrice * (1 - interpolationRatio)) + (escalatedUpperPrice * interpolationRatio);
    
    const revenue = dailyVolume * 1 * DAYS_IN_YEAR * priceSpread * degradationFactor * (volumeLossAdjustment/100) * (merchantPercentage/100);
    merchantRevenue = revenue / 1000000;
  }
 
  return {
    total: contractedRevenue + merchantRevenue,
    contractedGreen: 0,
    contractedEnergy: contractedRevenue,
    merchantGreen: 0,
    merchantEnergy: merchantRevenue,
    greenPercentage: 0,
    EnergyPercentage: totalContractedPercentage,
    annualGeneration: annualVolume * degradationFactor * (volumeLossAdjustment/100)
  };
};

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
  
  // Function to get merchant price with fallback to average of last 2 years
  const getExtendedMerchantPrice = (profile, type, state, timeStr) => {
    const price = getMerchantPrice(profile, type, state, timeStr);
    
    // If price exists, return it
    if (price !== undefined && price !== null && price !== 0) {
      return price;
    }
    
    // If no price, search backwards for last 2 valid prices
    const date = new Date(timeStr);
    const targetYear = date.getFullYear();
    const month = date.getMonth() + 1;
    let yearToTry = targetYear;
    let validPrices = [];
    
    // Keep trying previous years until we find 2 valid prices
    while (yearToTry > targetYear - 10 && validPrices.length < 2) { // Limit to 10 years back
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
    
    // If we found at least one price
    if (validPrices.length > 0) {
      // Calculate average price (if only one price found, it will be used as is)
      const avgPrice = validPrices.reduce((sum, p) => sum + p.price, 0) / validPrices.length;
      // Use the most recent year for calculating escalation
      const mostRecentYear = Math.max(...validPrices.map(p => p.year));
      const yearDiff = targetYear - mostRecentYear;
      return avgPrice * Math.pow(1 + (constants?.escalation || 0) / 100, yearDiff);
    }
    
    return 0; // Return 0 if no valid prices found within 10 years
  };

  if (asset.type === 'storage') {
    return calculateStorageRevenue(asset, timeInterval, year, assetStartYear, getMerchantPrice, constants);
  }

  return calculateRenewablesRevenue(asset, timeInterval, year, quarter, assetStartYear, constants, getExtendedMerchantPrice);
};

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
        const isStorage = asset.type === 'storage';

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
    
    // Calculate weighted percentages with both storage and renewables
    if (totalGeneration > 0) {
      // For single asset or simple portfolios - just use direct contract percentages
      // This preserves the 100% contracted display when appropriate
      if (Object.keys(periodData.assets).length === 1) {
        const assetData = Object.values(periodData.assets)[0];
        processedPeriodData.weightedGreenPercentage = assetData.greenPercentage || 0;
        processedPeriodData.weightedEnergyPercentage = assetData.EnergyPercentage || 0;
      }
      // For multi-asset portfolios - do proper weighting
      else {
        // Initial values
        let weightedGreenPercentage = 0;
        let weightedEnergyPercentage = 0;
        
        // Only include green-capable assets in the denominator for green percentage
        const totalGreenCapableGeneration = totalRenewableGeneration;
        
        // Add contribution from renewable assets to green percentage
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
            
            // For storage assets, use EnergyPercentage directly
            if (asset.type === 'storage') {
              weightedEnergyPercentage += (assetData.EnergyPercentage * assetData.annualGeneration / totalGeneration);
            } 
            // For non-storage assets, use their energy percentage contribution
            else {
              weightedEnergyPercentage += (assetData.EnergyPercentage * assetData.annualGeneration / totalGeneration);
            }
          });
        
        processedPeriodData.weightedGreenPercentage = weightedGreenPercentage;
        processedPeriodData.weightedEnergyPercentage = weightedEnergyPercentage;
      }
    }

    return processedPeriodData;
  });
};

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