import { calculateAssetRevenue } from './RevCalculations';

export const DEFAULT_COSTS = {
  solar: {
    fixedCostBase: 5.0,    // Base fixed cost for a 100MW solar farm
    fixedCostScale: 0.75,   // Scale factor (less than 1 for economies of scale)
    terminalValue: 15,      // $15M default terminal value for 100MW
  },
  wind: {
    fixedCostBase: 10.0,    // Base fixed cost for a 100MW wind farm
    fixedCostScale: 0.75,   // Scale factor
    terminalValue: 20,      // $20M default terminal value for 100MW
  },
  battery: {
    fixedCostBase: 5,    // Base fixed cost for a 100MW battery
    fixedCostScale: 0.75,   // Scale factor
    terminalValue: 10,      // $10M default terminal value for 100MW
  },
  default: {
    fixedCostBase: 5,    // Base fixed cost for a 100MW asset
    fixedCostScale: 0.75,   // Scale factor
    terminalValue: 15,      // $15M default terminal value for 100MW
  }
};

export const DEFAULT_VALUES = {
  discountRates: {
    contract: 0.08,
    merchant: 0.10,
  },
  costEscalation: 2.5,
  baseCapacity: 100  // Reference capacity for base costs (MW)
};

export const calculateStressRevenue = (baseRevenue, scenario, constants) => {
  const volumeVar = constants.volumeVariation || 0;
  const greenVar = constants.greenPriceVariation || 0;
  const EnergyVar = constants.EnergyPriceVariation || 0;

  switch (scenario) {
    case 'worst':
      return {
        ...baseRevenue,
        merchantGreen: baseRevenue.merchantGreen * (1 - volumeVar/100) * (1 - greenVar/100),
        merchantEnergy: baseRevenue.merchantEnergy * (1 - volumeVar/100) * (1 - EnergyVar/100),
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
        merchantEnergy: baseRevenue.merchantEnergy * (1 - EnergyVar/100),
        contractedGreen: baseRevenue.contractedGreen,
        contractedEnergy: baseRevenue.contractedEnergy,
      };
    default:
      return baseRevenue;
  }
};

export const calculateFixedCost = (baseFixedCost, capacity, baseCapacity, scaleFactor) => {
  // Scale fixed costs using power law with scale factor
  return baseFixedCost * Math.pow(capacity / baseCapacity, scaleFactor);
};

// Note: This function can be removed as initialization is now handled in PortfolioContext
export const initializeAssetCosts = (assets) => {
  return Object.values(assets).reduce((acc, asset) => {
    const defaultCosts = DEFAULT_COSTS[asset.type] || DEFAULT_COSTS.default;
    const scaledFixedCost = calculateFixedCost(
      defaultCosts.fixedCostBase,
      asset.capacity,
      DEFAULT_VALUES.baseCapacity,
      defaultCosts.fixedCostScale
    );

    return {
      ...acc,
      [asset.name]: {
        operatingCosts: Number(scaledFixedCost.toFixed(2)),
        operatingCostEscalation: Number(DEFAULT_VALUES.costEscalation.toFixed(2)),
        terminalValue: Number((defaultCosts.terminalValue * 
                      (asset.capacity / DEFAULT_VALUES.baseCapacity)).toFixed(2))
      }
    };
  }, {});
};

export const calculateNPVData = (
  assets,
  assetCosts,
  discountRates,
  constants,
  getMerchantPrice,
  selectedRevenueCase,
  selectedAsset = 'Total'
) => {
  // Find the earliest start date
  const startDates = Object.values(assets).map(asset => new Date(asset.assetStartDate).getFullYear());
  const firstStartYear = Math.min(...startDates);
  
  const lastEndYear = Math.max(...Object.values(assets).map(asset => 
    new Date(asset.assetStartDate).getFullYear() + (asset.assetLife || 30)
  ));
  const evaluationPeriod = lastEndYear - firstStartYear;
  
  const npvData = Array.from({ length: evaluationPeriod }, (_, yearIndex) => {
    let totalContractRevenue = 0;
    let totalMerchantRevenue = 0;
    let totalFixedCosts = 0;
    let totalTerminalValue = 0;
    
    // Filter assets based on selection
    const filteredAssets = selectedAsset === 'Total' 
      ? Object.values(assets)
      : Object.values(assets).filter(asset => asset.name === selectedAsset);
    
    const year = yearIndex + firstStartYear; // Start from asset start year

    filteredAssets.forEach(asset => {
      // Check if asset has started operations and is within its life
      const assetStartYear = new Date(asset.assetStartDate).getFullYear();
      const assetEndYear = assetStartYear + (asset.assetLife || 30);
      
      // Stop calculations exactly at asset end of life
      if (year >= assetStartYear && year < assetEndYear) {
        // Calculate partial year factor for first year
        let partialYearFactor = 1;
        if (year === assetStartYear) {
          const startDate = new Date(asset.assetStartDate);
          const startMonth = startDate.getMonth();
          partialYearFactor = (4 - Math.floor(startMonth / 3)) / 4;
        }

        const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
        const stressedRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
        
        totalContractRevenue += (stressedRevenue.contractedGreen + stressedRevenue.contractedEnergy) * partialYearFactor;
        totalMerchantRevenue += (stressedRevenue.merchantGreen + stressedRevenue.merchantEnergy) * partialYearFactor;

        // Updated to use unified operating cost fields
        const operatingCostInflation = Math.pow(1 + (assetCosts[asset.name]?.operatingCostEscalation || 2.5)/100, yearIndex);
        totalFixedCosts += (assetCosts[asset.name]?.operatingCosts || 0) * operatingCostInflation * partialYearFactor;
        
        // Add terminal value at end of asset life
        if (year === (assetEndYear - 1)) {
          totalTerminalValue += (assetCosts[asset.name]?.terminalValue || 0);
        }
      }
    });

    const totalRevenue = totalContractRevenue + totalMerchantRevenue;
    const netCashFlow = totalRevenue - totalFixedCosts;
    
    // Calculate weighted discount rate
    const contractWeight = totalRevenue ? totalContractRevenue / totalRevenue : 0.5;
    const merchantWeight = totalRevenue ? totalMerchantRevenue / totalRevenue : 0.5;
    const weightedDiscountRate = (discountRates.contract * contractWeight) + 
                               (discountRates.merchant * merchantWeight);
    
    const presentValue = (netCashFlow + totalTerminalValue) / Math.pow(1 + weightedDiscountRate, yearIndex + 1);

    return {
      year,
      contractRevenue: totalContractRevenue,
      merchantRevenue: totalMerchantRevenue,
      totalRevenue,
      fixedCosts: totalFixedCosts,
      totalCosts: totalFixedCosts,
      terminalValue: totalTerminalValue,
      netCashFlow,
      presentValue
    };
  });

  const totalNPV = npvData.reduce((sum, year) => sum + year.presentValue, 0);

  return { npvData, totalNPV };
};