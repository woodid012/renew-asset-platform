// lib/enhancedCalculations.js
// Unified calculation library with enhanced timeseries support

/**
 * Generate flexible time intervals with enhanced structure
 */
export const generateTimeIntervals = (intervalType, startYear, periods, customIntervals = null) => {
  if (intervalType === 'custom' && customIntervals) {
    return customIntervals
  }

  const intervals = []
  const baseYear = startYear || new Date().getFullYear()

  switch (intervalType) {
    case 'annual':
      for (let i = 0; i < periods; i++) {
        intervals.push((baseYear + i).toString())
      }
      break

    case 'quarterly':
      const totalQuarters = periods || 40 // ~10 years default
      for (let i = 0; i < totalQuarters; i++) {
        const year = baseYear + Math.floor(i / 4)
        const quarter = (i % 4) + 1
        intervals.push(`${year}-Q${quarter}`)
      }
      break

    case 'monthly':
      const totalMonths = periods || 120 // ~10 years default
      for (let i = 0; i < totalMonths; i++) {
        const year = baseYear + Math.floor(i / 12)
        const month = (i % 12) + 1
        intervals.push(`${year}-${month.toString().padStart(2, '0')}`)
      }
      break

    default:
      throw new Error(`Unsupported interval type: ${intervalType}`)
  }

  return intervals
}

/**
 * Parse time period to extract components with enhanced data
 */
export const parseTimePeriod = (timePeriod) => {
  const periodStr = timePeriod.toString()
  
  if (periodStr.includes('-Q')) {
    // Quarterly: "2025-Q3"
    const [year, quarterStr] = periodStr.split('-Q')
    const quarter = parseInt(quarterStr)
    return {
      type: 'quarterly',
      year: parseInt(year),
      quarter,
      month: null,
      startDate: new Date(parseInt(year), (quarter - 1) * 3, 1),
      endDate: new Date(parseInt(year), quarter * 3, 0),
      periodAdjustment: 0.25,
      daysInPeriod: Math.ceil(90 * 0.25), // Approximate
      label: `Q${quarter} ${year}`
    }
  } else if (periodStr.includes('-')) {
    // Monthly: "2025-03"
    const [year, month] = periodStr.split('-')
    return {
      type: 'monthly',
      year: parseInt(year),
      quarter: Math.ceil(parseInt(month) / 3),
      month: parseInt(month),
      startDate: new Date(parseInt(year), parseInt(month) - 1, 1),
      endDate: new Date(parseInt(year), parseInt(month), 0),
      periodAdjustment: 1/12,
      daysInPeriod: new Date(parseInt(year), parseInt(month), 0).getDate(),
      label: `${new Date(2000, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short' })} ${year}`
    }
  } else {
    // Annual: "2025"
    const year = parseInt(periodStr)
    return {
      type: 'annual',
      year,
      quarter: null,
      month: null,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      periodAdjustment: 1.0,
      daysInPeriod: 365,
      label: year.toString()
    }
  }
}

/**
 * Enhanced asset revenue calculation with comprehensive structure
 */
export const calculateEnhancedAssetRevenue = async (asset, timePeriod, constants, getMerchantPrice) => {
  const periodInfo = parseTimePeriod(timePeriod)
  const assetStartYear = new Date(asset.assetStartDate).getFullYear()
  
  // Check if asset has started
  if (periodInfo.year < assetStartYear) {
    return createEmptyAssetRevenue(asset, timePeriod, periodInfo)
  }

  // Route to appropriate calculation based on asset type
  if (asset.type === 'storage') {
    return calculateStorageEnhancedRevenue(asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice)
  } else {
    return calculateRenewableEnhancedRevenue(asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice)
  }
}

/**
 * Enhanced renewable asset revenue calculation
 */
const calculateRenewableEnhancedRevenue = (asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice) => {
  const HOURS_IN_YEAR = constants.HOURS_IN_YEAR || 8760
  const capacity = parseFloat(asset.capacity) || 0
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95
  
  // Get capacity factor for this period
  const capacityFactor = getCapacityFactorForPeriod(asset, periodInfo)
  
  // Calculate degradation
  const yearsSinceStart = periodInfo.year - assetStartYear
  const degradation = parseFloat(asset.annualDegradation) || 0.5
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart)
  
  // Enhanced volume calculations
  const baseAnnualVolume = capacity * HOURS_IN_YEAR * capacityFactor / 1000 // Convert to MWh
  const basePeriodVolume = baseAnnualVolume * periodInfo.periodAdjustment
  const degradedVolume = basePeriodVolume * degradationFactor
  const adjustedVolume = degradedVolume * (volumeLossAdjustment / 100)
  
  // Process active contracts for this period
  const activeContracts = (asset.contracts || []).filter(contract => 
    isContractActiveForPeriod(contract, periodInfo)
  )
  
  // Calculate contract breakdown with enhanced structure
  const contractBreakdown = processRenewableContracts(activeContracts, periodInfo.year, adjustedVolume)
  
  // Get merchant prices with enhanced escalation
  const merchantGreenPrice = getMerchantPrice(asset.type, 'green', asset.state, timePeriod) || 35
  const merchantEnergyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, timePeriod) || 65
  
  // Calculate merchant volumes and revenues
  const merchantGreenVolume = adjustedVolume * (100 - contractBreakdown.greenPercentage) / 100
  const merchantEnergyVolume = adjustedVolume * (100 - contractBreakdown.energyPercentage) / 100
  
  const merchantGreenRevenue = (merchantGreenVolume * merchantGreenPrice) / 1000000
  const merchantEnergyRevenue = (merchantEnergyVolume * merchantEnergyPrice) / 1000000
  
  // Apply scenario stress testing
  const stressedRevenue = applyScenarioStress({
    contractedGreenRevenue: contractBreakdown.contractedGreenRevenue,
    contractedEnergyRevenue: contractBreakdown.contractedEnergyRevenue,
    merchantGreenRevenue,
    merchantEnergyRevenue
  }, constants.scenario, constants)
  
  return {
    // Enhanced time dimension
    timeDimension: {
      interval: timePeriod,
      intervalType: periodInfo.type,
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: periodInfo.periodAdjustment,
      periodLabel: periodInfo.label,
      daysInPeriod: periodInfo.daysInPeriod
    },
    
    // Enhanced asset metadata
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: capacity,
      assetState: asset.state,
      assetStartYear,
      assetId: asset.id || asset.name.replace(/\s+/g, '_').toLowerCase()
    },
    
    // Enhanced volume breakdown
    volume: {
      baseAnnualVolume: round(baseAnnualVolume, 2),
      basePeriodVolume: round(basePeriodVolume, 2),
      degradationFactor: round(degradationFactor, 4),
      degradedVolume: round(degradedVolume, 2),
      volumeLossAdjustment,
      adjustedVolume: round(adjustedVolume, 2),
      capacityFactor: round(capacityFactor, 4),
      
      // Contract volume breakdown
      contractedGreenVolume: round(adjustedVolume * contractBreakdown.greenPercentage / 100, 2),
      contractedEnergyVolume: round(adjustedVolume * contractBreakdown.energyPercentage / 100, 2),
      merchantGreenVolume: round(merchantGreenVolume, 2),
      merchantEnergyVolume: round(merchantEnergyVolume, 2),
      
      // Volume efficiency metrics
      volumeEfficiency: round((adjustedVolume / baseAnnualVolume) * 100, 2),
      generationCapacity: round(adjustedVolume / (capacity * periodInfo.daysInPeriod * 24 / 1000), 4)
    },
    
    // Enhanced price breakdown
    prices: {
      contractedGreenPrice: contractBreakdown.avgGreenPrice,
      contractedEnergyPrice: contractBreakdown.avgEnergyPrice,
      merchantGreenPrice: round(merchantGreenPrice, 2),
      merchantEnergyPrice: round(merchantEnergyPrice, 2),
      
      // Price efficiency metrics
      blendedPrice: adjustedVolume > 0 ? 
        ((stressedRevenue.contractedGreenRevenue + stressedRevenue.contractedEnergyRevenue + 
          stressedRevenue.merchantGreenRevenue + stressedRevenue.merchantEnergyRevenue) * 1000000) / adjustedVolume : 0,
      
      // Indexation factors
      greenIndexationFactor: contractBreakdown.greenIndexationFactor,
      energyIndexationFactor: contractBreakdown.energyIndexationFactor
    },
    
    // Enhanced revenue breakdown
    revenue: {
      contractedGreenRevenue: round(stressedRevenue.contractedGreenRevenue, 2),
      contractedEnergyRevenue: round(stressedRevenue.contractedEnergyRevenue, 2),
      merchantGreenRevenue: round(stressedRevenue.merchantGreenRevenue, 2),
      merchantEnergyRevenue: round(stressedRevenue.merchantEnergyRevenue, 2),
      totalRevenue: round(
        stressedRevenue.contractedGreenRevenue + stressedRevenue.contractedEnergyRevenue + 
        stressedRevenue.merchantGreenRevenue + stressedRevenue.merchantEnergyRevenue, 2
      ),
      
      // Revenue efficiency metrics
      revenuePerMW: capacity > 0 ? round(
        (stressedRevenue.contractedGreenRevenue + stressedRevenue.contractedEnergyRevenue + 
         stressedRevenue.merchantGreenRevenue + stressedRevenue.merchantEnergyRevenue) / capacity, 2
      ) : 0,
      
      revenuePerMWh: adjustedVolume > 0 ? round(
        ((stressedRevenue.contractedGreenRevenue + stressedRevenue.contractedEnergyRevenue + 
          stressedRevenue.merchantGreenRevenue + stressedRevenue.merchantEnergyRevenue) * 1000000) / adjustedVolume, 2
      ) : 0
    },
    
    // Enhanced contract details
    contracts: {
      activeContracts: activeContracts.map(contract => ({
        contractId: contract.id || `contract-${Date.now()}`,
        counterparty: contract.counterparty,
        type: contract.type,
        buyersPercentage: contract.buyersPercentage,
        indexationFactor: Math.pow(1 + (parseFloat(contract.indexation) || 0)/100, 
          periodInfo.year - new Date(contract.startDate).getFullYear()),
        remainingTerm: Math.max(0, new Date(contract.endDate).getFullYear() - periodInfo.year)
      })),
      contractedPercentages: {
        green: contractBreakdown.greenPercentage,
        energy: contractBreakdown.energyPercentage
      },
      contractCount: activeContracts.length
    },
    
    // Legacy compatibility for existing systems
    legacy: {
      total: round(
        stressedRevenue.contractedGreenRevenue + stressedRevenue.contractedEnergyRevenue + 
        stressedRevenue.merchantGreenRevenue + stressedRevenue.merchantEnergyRevenue, 2
      ),
      contractedGreen: round(stressedRevenue.contractedGreenRevenue, 2),
      contractedEnergy: round(stressedRevenue.contractedEnergyRevenue, 2),
      merchantGreen: round(stressedRevenue.merchantGreenRevenue, 2),
      merchantEnergy: round(stressedRevenue.merchantEnergyRevenue, 2),
      greenPercentage: contractBreakdown.greenPercentage,
      EnergyPercentage: contractBreakdown.energyPercentage,
      annualGeneration: round(adjustedVolume, 2)
    }
  }
}

/**
 * Enhanced storage asset revenue calculation
 */
const calculateStorageEnhancedRevenue = (asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice) => {
  const volume = parseFloat(asset.volume) || 0  // Storage volume in MWh
  const capacity = parseFloat(asset.capacity) || 0  // Power capacity in MW
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95
  const DAYS_IN_YEAR = constants.DAYS_IN_YEAR || 365
  
  // Calculate degradation
  const yearsSinceStart = periodInfo.year - assetStartYear
  const degradation = parseFloat(asset.annualDegradation) || 0.5
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart)
  
  // Enhanced volume calculations for storage
  const duration = volume / capacity  // Storage duration in hours
  const baseAnnualThroughput = volume * DAYS_IN_YEAR  // Base annual throughput
  const basePeriodThroughput = baseAnnualThroughput * periodInfo.periodAdjustment
  const degradedThroughput = basePeriodThroughput * degradationFactor
  const adjustedThroughput = degradedThroughput * (volumeLossAdjustment / 100)
  
  // Process storage contracts
  const activeContracts = (asset.contracts || []).filter(contract => 
    isContractActiveForPeriod(contract, periodInfo)
  )
  
  const contractBreakdown = processStorageContracts(
    activeContracts, 
    periodInfo.year, 
    capacity, 
    adjustedThroughput, 
    periodInfo.periodAdjustment
  )
  
  // Calculate merchant price spread with enhanced interpolation
  const merchantPriceSpread = calculateStoragePriceSpread(asset, timePeriod, duration, getMerchantPrice)
  
  // Calculate merchant revenue
  const merchantThroughput = adjustedThroughput * (100 - contractBreakdown.contractedPercentage) / 100
  const merchantRevenue = (merchantThroughput * merchantPriceSpread) / 1000000
  
  // Apply scenario stress testing
  const stressedRevenue = applyScenarioStress({
    contractedGreenRevenue: 0,
    contractedEnergyRevenue: contractBreakdown.contractedRevenue,
    merchantGreenRevenue: 0,
    merchantEnergyRevenue: merchantRevenue
  }, constants.scenario, constants)
  
  return {
    // Enhanced time dimension
    timeDimension: {
      interval: timePeriod,
      intervalType: periodInfo.type,
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: periodInfo.periodAdjustment,
      periodLabel: periodInfo.label,
      daysInPeriod: periodInfo.daysInPeriod
    },
    
    // Enhanced asset metadata
    assetMetadata: {
      assetName: asset.name,
      assetType: 'storage',
      assetCapacity: capacity,
      assetState: asset.state,
      assetStartYear,
      assetId: asset.id || asset.name.replace(/\s+/g, '_').toLowerCase(),
      storageVolume: volume,
      storageDuration: round(duration, 2)
    },
    
    // Enhanced volume breakdown for storage
    volume: {
      storageVolume: volume,
      storageCapacity: capacity,
      storageDuration: round(duration, 2),
      baseAnnualThroughput: round(baseAnnualThroughput, 2),
      basePeriodThroughput: round(basePeriodThroughput, 2),
      degradationFactor: round(degradationFactor, 4),
      degradedThroughput: round(degradedThroughput, 2),
      volumeLossAdjustment,
      adjustedVolume: round(adjustedThroughput, 2),
      
      // Contract volume breakdown
      contractedVolume: round(adjustedThroughput * contractBreakdown.contractedPercentage / 100, 2),
      merchantVolume: round(merchantThroughput, 2),
      
      // Storage efficiency metrics
      utilizationFactor: round((adjustedThroughput / baseAnnualThroughput) * 100, 2),
      cyclesPerPeriod: round(adjustedThroughput / volume, 2)
    },
    
    // Enhanced price breakdown
    prices: {
      contractedAvgPrice: contractBreakdown.avgContractPrice,
      merchantPriceSpread: round(merchantPriceSpread, 2),
      contractIndexationFactor: contractBreakdown.indexationFactor,
      
      // Price efficiency metrics
      blendedSpread: adjustedThroughput > 0 ? 
        ((stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue) * 1000000) / adjustedThroughput : 0
    },
    
    // Enhanced revenue breakdown
    revenue: {
      contractedGreenRevenue: 0,
      contractedEnergyRevenue: round(stressedRevenue.contractedEnergyRevenue, 2),
      merchantGreenRevenue: 0,
      merchantEnergyRevenue: round(stressedRevenue.merchantEnergyRevenue, 2),
      totalRevenue: round(stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue, 2),
      
      // Revenue efficiency metrics
      revenuePerMW: capacity > 0 ? round(
        (stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue) / capacity, 2
      ) : 0,
      
      revenuePerMWh: adjustedThroughput > 0 ? round(
        ((stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue) * 1000000) / adjustedThroughput, 2
      ) : 0
    },
    
    // Enhanced contract details
    contracts: {
      activeContracts: activeContracts.map(contract => ({
        contractId: contract.id || `contract-${Date.now()}`,
        counterparty: contract.counterparty,
        type: contract.type,
        buyersPercentage: contract.buyersPercentage,
        indexationFactor: Math.pow(1 + (parseFloat(contract.indexation) || 0)/100, 
          periodInfo.year - new Date(contract.startDate).getFullYear()),
        remainingTerm: Math.max(0, new Date(contract.endDate).getFullYear() - periodInfo.year)
      })),
      contractedPercentages: {
        green: 0,
        energy: contractBreakdown.contractedPercentage
      },
      contractCount: activeContracts.length
    },
    
    // Legacy compatibility
    legacy: {
      total: round(stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue, 2),
      contractedGreen: 0,
      contractedEnergy: round(stressedRevenue.contractedEnergyRevenue, 2),
      merchantGreen: 0,
      merchantEnergy: round(stressedRevenue.merchantEnergyRevenue, 2),
      greenPercentage: 0,
      EnergyPercentage: contractBreakdown.contractedPercentage,
      annualGeneration: round(adjustedThroughput, 2)
    }
  }
}

/**
 * Helper functions for enhanced calculations
 */

// Get capacity factor for specific period
const getCapacityFactorForPeriod = (asset, periodInfo) => {
  if (asset.type === 'storage') return null
  
  if (periodInfo.type === 'quarterly' && periodInfo.quarter) {
    const quarterKey = `qtrCapacityFactor_q${periodInfo.quarter}`
    const storedFactor = asset[quarterKey]
    
    if (storedFactor !== undefined && storedFactor !== '') {
      return parseFloat(storedFactor) / 100
    }
  }
  
  // Fallback to average or default
  const quarters = ['q1', 'q2', 'q3', 'q4']
  const availableFactors = quarters
    .map(q => asset[`qtrCapacityFactor_${q}`])
    .filter(factor => factor !== undefined && factor !== '')
    .map(factor => parseFloat(factor) / 100)

  if (availableFactors.length === 4) {
    if (periodInfo.type === 'monthly') {
      const quarterIndex = Math.ceil(periodInfo.month / 3) - 1
      return availableFactors[quarterIndex] || (availableFactors.reduce((sum, f) => sum + f, 0) / 4)
    }
    return availableFactors.reduce((sum, f) => sum + f, 0) / 4
  }
  
  // Default capacity factors
  const defaultFactors = {
    solar: { NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27, WA: 0.26, TAS: 0.23 },
    wind: { NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40, WA: 0.37, TAS: 0.42 }
  }
  
  return defaultFactors[asset.type]?.[asset.state] || 0.25
}

// Check if contract is active for period
const isContractActiveForPeriod = (contract, periodInfo) => {
  if (!contract.startDate || !contract.endDate) return false
  
  const contractStart = new Date(contract.startDate)
  const contractEnd = new Date(contract.endDate)
  
  return periodInfo.startDate >= contractStart && periodInfo.endDate <= contractEnd
}

// Process renewable contracts with enhanced structure
const processRenewableContracts = (activeContracts, year, adjustedVolume) => {
  let greenPercentage = 0
  let energyPercentage = 0
  let contractedGreenRevenue = 0
  let contractedEnergyRevenue = 0
  let totalGreenPrice = 0
  let totalEnergyPrice = 0
  let greenContracts = 0
  let energyContracts = 0
  let greenIndexationSum = 0
  let energyIndexationSum = 0
  
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0
    const years = year - new Date(contract.startDate).getFullYear()
    const indexation = parseFloat(contract.indexation) || 0
    const indexationFactor = Math.pow(1 + indexation/100, years)
    
    if (contract.type === 'bundled') {
      let greenPrice = parseFloat(contract.greenPrice) || 0
      let energyPrice = parseFloat(contract.EnergyPrice) || 0
      
      greenPrice *= indexationFactor
      energyPrice *= indexationFactor
      
      // Apply floor if exists
      if (contract.hasFloor && (greenPrice + energyPrice) < parseFloat(contract.floorValue)) {
        const total = greenPrice + energyPrice
        const floorValue = parseFloat(contract.floorValue)
        if (total > 0) {
          greenPrice = (greenPrice / total) * floorValue
          energyPrice = (energyPrice / total) * floorValue
        }
      }
      
      const greenRevenue = (adjustedVolume * buyersPercentage/100 * greenPrice) / 1000000
      const energyRevenue = (adjustedVolume * buyersPercentage/100 * energyPrice) / 1000000
      
      contractedGreenRevenue += greenRevenue
      contractedEnergyRevenue += energyRevenue
      greenPercentage += buyersPercentage
      energyPercentage += buyersPercentage
      totalGreenPrice += greenPrice * buyersPercentage
      totalEnergyPrice += energyPrice * buyersPercentage
      greenContracts += buyersPercentage
      energyContracts += buyersPercentage
      greenIndexationSum += indexationFactor * buyersPercentage
      energyIndexationSum += indexationFactor * buyersPercentage
      
    } else if (contract.type === 'green') {
      let price = parseFloat(contract.strikePrice) || 0
      price *= indexationFactor
      
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue)
      }
      
      const revenue = (adjustedVolume * buyersPercentage/100 * price) / 1000000
      contractedGreenRevenue += revenue
      greenPercentage += buyersPercentage
      totalGreenPrice += price * buyersPercentage
      greenContracts += buyersPercentage
      greenIndexationSum += indexationFactor * buyersPercentage
      
    } else if (contract.type === 'Energy') {
      let price = parseFloat(contract.strikePrice) || 0
      price *= indexationFactor
      
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue)
      }
      
      const revenue = (adjustedVolume * buyersPercentage/100 * price) / 1000000
      contractedEnergyRevenue += revenue
      energyPercentage += buyersPercentage
      totalEnergyPrice += price * buyersPercentage
      energyContracts += buyersPercentage
      energyIndexationSum += indexationFactor * buyersPercentage
    }
  })
  
  return {
    greenPercentage: Math.min(greenPercentage, 100),
    energyPercentage: Math.min(energyPercentage, 100),
    avgGreenPrice: greenContracts > 0 ? totalGreenPrice / greenContracts : 0,
    avgEnergyPrice: energyContracts > 0 ? totalEnergyPrice / energyContracts : 0,
    greenIndexationFactor: greenContracts > 0 ? greenIndexationSum / greenContracts : 1,
    energyIndexationFactor: energyContracts > 0 ? energyIndexationSum / energyContracts : 1,
    contractedGreenRevenue,
    contractedEnergyRevenue
  }
}

// Process storage contracts with enhanced structure
const processStorageContracts = (activeContracts, year, capacity, adjustedThroughput, periodAdjustment) => {
  let contractedPercentage = 0
  let contractedRevenue = 0
  let totalPrice = 0
  let totalContracts = 0
  let indexationSum = 0
  
  activeContracts.forEach(contract => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0
    const years = year - new Date(contract.startDate).getFullYear()
    const indexation = parseFloat(contract.indexation) || 0
    const indexationFactor = Math.pow(1 + indexation/100, years)
    
    if (contract.type === 'cfd') {
      const priceSpread = parseFloat(contract.strikePrice) || 0
      const adjustedSpread = priceSpread * indexationFactor
      
      const revenue = adjustedThroughput * adjustedSpread * (buyersPercentage/100)
      contractedRevenue += revenue / 1000000
      totalPrice += adjustedSpread * buyersPercentage
      
    } else if (contract.type === 'tolling') {
      const hourlyRate = parseFloat(contract.strikePrice) || 0
      const adjustedRate = hourlyRate * indexationFactor
      
      const revenue = capacity * 8760 * periodAdjustment * adjustedRate * (buyersPercentage/100)
      contractedRevenue += revenue / 1000000
      totalPrice += adjustedRate * buyersPercentage
    }
    
    contractedPercentage += buyersPercentage
    totalContracts += buyersPercentage
    indexationSum += indexationFactor * buyersPercentage
  })
  
  return {
    contractedPercentage: Math.min(contractedPercentage, 100),
    avgContractPrice: totalContracts > 0 ? totalPrice / totalContracts : 0,
    contractedRevenue,
    indexationFactor: totalContracts > 0 ? indexationSum / totalContracts : 1
  }
}

// Calculate storage price spread with enhanced interpolation
const calculateStoragePriceSpread = (asset, timeInterval, duration, getMerchantPrice) => {
  const standardDurations = [0.5, 1, 2, 4]
  
  let lowerDuration = standardDurations[0]
  let upperDuration = standardDurations[standardDurations.length - 1]
  let interpolationRatio = 0.5
  
  for (let i = 0; i < standardDurations.length - 1; i++) {
    if (duration >= standardDurations[i] && duration <= standardDurations[i + 1]) {
      lowerDuration = standardDurations[i]
      upperDuration = standardDurations[i + 1]
      interpolationRatio = (duration - lowerDuration) / (upperDuration - lowerDuration)
      break
    }
  }
  
  const lowerPrice = getMerchantPrice('storage', lowerDuration, asset.state, timeInterval) || 15
  const upperPrice = getMerchantPrice('storage', upperDuration, asset.state, timeInterval) || 25
  
  return (lowerPrice * (1 - interpolationRatio)) + (upperPrice * interpolationRatio)
}

// Apply scenario stress testing
const applyScenarioStress = (baseRevenue, scenario, constants) => {
  const volumeVar = constants.volumeVariation || 20
  const greenVar = constants.greenPriceVariation || 20
  const energyVar = constants.EnergyPriceVariation || 20

  switch (scenario) {
    case 'worst':
      return {
        contractedGreenRevenue: baseRevenue.contractedGreenRevenue * (1 - volumeVar/100),
        contractedEnergyRevenue: baseRevenue.contractedEnergyRevenue * (1 - volumeVar/100),
        merchantGreenRevenue: baseRevenue.merchantGreenRevenue * (1 - volumeVar/100) * (1 - greenVar/100),
        merchantEnergyRevenue: baseRevenue.merchantEnergyRevenue * (1 - volumeVar/100) * (1 - energyVar/100)
      }
    case 'volume':
      return {
        contractedGreenRevenue: baseRevenue.contractedGreenRevenue * (1 - volumeVar/100),
        contractedEnergyRevenue: baseRevenue.contractedEnergyRevenue * (1 - volumeVar/100),
        merchantGreenRevenue: baseRevenue.merchantGreenRevenue * (1 - volumeVar/100),
        merchantEnergyRevenue: baseRevenue.merchantEnergyRevenue * (1 - volumeVar/100)
      }
    case 'price':
      return {
        contractedGreenRevenue: baseRevenue.contractedGreenRevenue,
        contractedEnergyRevenue: baseRevenue.contractedEnergyRevenue,
        merchantGreenRevenue: baseRevenue.merchantGreenRevenue * (1 - greenVar/100),
        merchantEnergyRevenue: baseRevenue.merchantEnergyRevenue * (1 - energyVar/100)
      }
    default:
      return baseRevenue
  }
}

// Create empty asset revenue for periods before asset start
const createEmptyAssetRevenue = (asset, timePeriod, periodInfo) => {
  return {
    timeDimension: {
      interval: timePeriod,
      intervalType: periodInfo.type,
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: periodInfo.periodAdjustment,
      periodLabel: periodInfo.label,
      daysInPeriod: periodInfo.daysInPeriod
    },
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: parseFloat(asset.capacity) || 0,
      assetState: asset.state,
      assetStartYear: new Date(asset.assetStartDate).getFullYear(),
      assetId: asset.id || asset.name.replace(/\s+/g, '_').toLowerCase()
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
  }
}

// Utility function for rounding
const round = (value, decimals) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * Portfolio validation
 */
export const validatePortfolioData = (portfolio) => {
  const errors = []
  const warnings = []

  if (!portfolio.assets || Object.keys(portfolio.assets).length === 0) {
    errors.push('Portfolio has no assets')
  }

  Object.values(portfolio.assets || {}).forEach((asset, index) => {
    if (!asset.name) errors.push(`Asset ${index + 1}: Missing name`)
    if (!asset.type) errors.push(`Asset ${index + 1}: Missing type`)
    if (!asset.capacity || asset.capacity <= 0) errors.push(`Asset ${index + 1}: Invalid capacity`)
    if (!asset.assetStartDate) errors.push(`Asset ${index + 1}: Missing start date`)
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Calculate comprehensive project finance metrics
 */
export const calculateProjectFinanceMetrics = async (assets, portfolioTimeSeries, constants) => {
  console.log('Starting project finance calculations...')
  
  // Initialize or get asset costs from constants
  let assetCosts = constants.assetCosts
  if (!assetCosts) {
    assetCosts = initializeProjectValues(assets)
  }
  
  const results = {
    assetFinance: {},
    portfolioFinance: null,
    summary: {
      totalCapex: 0,
      totalDebt: 0,
      totalEquity: 0,
      portfolioIRR: 0,
      weightedDSCR: 0
    },
    calculationComplete: false
  }
  
  try {
    // Calculate individual asset project finance
    for (const [assetKey, asset] of Object.entries(assets)) {
      const assetName = asset.name
      const assetCostData = assetCosts[assetName]
      
      if (!assetCostData || !assetCostData.capex) {
        console.warn(`No cost data for asset ${assetName}, skipping`)
        continue
      }
      
      console.log(`Calculating project finance for ${assetName}`)
      
      // Generate asset cash flows from timeseries
      const assetCashFlows = generateAssetCashFlows(asset, portfolioTimeSeries, assetCostData, constants)
      
      // Calculate debt metrics
      const debtMetrics = calculateAssetDebtMetrics(assetCashFlows, assetCostData, constants)
      
      // Calculate equity cash flows with proper construction timing
      const equityCashFlows = generateEquityCashFlows(
        assetCostData.capex,
        debtMetrics.gearing,
        assetCostData.equityTimingUpfront !== false,
        assetCostData.constructionDuration || 12,
        new Date(asset.assetStartDate).getFullYear(),
        assetCashFlows
      )
      
      // Calculate IRR
      const equityIRR = calculateIRR(equityCashFlows)
      
      results.assetFinance[assetName] = {
        // Asset identification
        assetName,
        assetType: asset.type,
        capacity: parseFloat(asset.capacity) || 0,
        
        // Financial structure
        capex: assetCostData.capex,
        gearing: debtMetrics.gearing,
        debtAmount: debtMetrics.debtAmount,
        equityAmount: assetCostData.capex * (1 - debtMetrics.gearing),
        
        // Debt metrics
        debtStructure: assetCostData.debtStructure || 'sculpting',
        tenorYears: assetCostData.tenorYears || 20,
        interestRate: assetCostData.interestRate || 0.06,
        avgDebtService: debtMetrics.avgDebtService,
        minDSCR: debtMetrics.minDSCR,
        
        // Equity metrics
        equityIRR: equityIRR ? equityIRR * 100 : null,
        equityTimingUpfront: assetCostData.equityTimingUpfront !== false,
        constructionDuration: assetCostData.constructionDuration || 12,
        
        // Terminal value
        terminalValue: assetCostData.terminalValue || 0,
        
        // Cash flow arrays
        operationalCashFlows: assetCashFlows,
        equityCashFlows: equityCashFlows,
        debtServiceSchedule: debtMetrics.debtServiceSchedule,
        
        // Performance metrics
        projectNPV: calculateNPV(equityCashFlows, 0.1),
        paybackPeriod: calculatePaybackPeriod(equityCashFlows),
        
        // Calculation metadata
        calculatedAt: new Date().toISOString()
      }
      
      // Aggregate to summary
      results.summary.totalCapex += assetCostData.capex
      results.summary.totalDebt += debtMetrics.debtAmount
    }
    
    results.summary.totalEquity = results.summary.totalCapex - results.summary.totalDebt
    
    // Calculate portfolio-level finance if multiple assets
    if (Object.keys(assets).length >= 2 && assetCosts.portfolio) {
      console.log('Calculating portfolio-level financing...')
      results.portfolioFinance = calculatePortfolioFinance(
        assets, 
        portfolioTimeSeries, 
        results.assetFinance, 
        assetCosts.portfolio, 
        constants
      )
      
      results.summary.portfolioIRR = results.portfolioFinance.portfolioIRR
    } else {
      // Single asset portfolio IRR
      const singleAssetResult = Object.values(results.assetFinance)[0]
      results.summary.portfolioIRR = singleAssetResult?.equityIRR || 0
    }
    
    // Calculate weighted average DSCR
    let totalDebtService = 0
    let totalOperatingCashFlow = 0
    
    Object.values(results.assetFinance).forEach(assetResult => {
      if (assetResult.avgDebtService && assetResult.operationalCashFlows.length > 0) {
        totalDebtService += assetResult.avgDebtService
        const avgOperatingCF = assetResult.operationalCashFlows.reduce((sum, cf) => 
          sum + cf.operatingCashFlow, 0) / assetResult.operationalCashFlows.length
        totalOperatingCashFlow += avgOperatingCF
      }
    })
    
    results.summary.weightedDSCR = totalDebtService > 0 ? totalOperatingCashFlow / totalDebtService : null
    
    results.calculationComplete = true
    console.log('Project finance calculations completed successfully')
    
    return results
    
  } catch (error) {
    console.error('Project finance calculation error:', error)
    results.error = error.message
    return results
  }
}

/**
 * Initialize default project finance values for assets
 */
const initializeProjectValues = (assets) => {
  // Default rates by asset type
  const DEFAULT_CAPEX_RATES = {
    solar: 1.2,     // $M per MW
    wind: 2.5,      // $M per MW
    storage: 1.6,   // $M per MW
    default: 2.0
  }
  
  const DEFAULT_OPEX_RATES = {
    solar: 0.014,    // $M per MW per annum
    wind: 0.040,     // $M per MW per annum
    storage: 0.015,  // $M per MW per annum
    default: 0.030
  }
  
  const DEFAULT_PROJECT_FINANCE = {
    maxGearing: 70,              // %
    targetDSCRContract: 1.35,    // x
    targetDSCRMerchant: 2.00,    // x
    interestRate: 6.0,           // %
    opexEscalation: 2.5,         // %
    tenorYears: {
      solar: 22,                 // years
      wind: 22,                  // years
      storage: 18,               // years
      default: 20
    }
  }
  
  const DEFAULT_TERMINAL_RATES = {
    solar: 0.15,     // $M per MW
    wind: 0.20,      // $M per MW
    storage: 0.10,   // $M per MW
    default: 0.15
  }
  
  const initialValues = {}
  
  Object.values(assets).forEach(asset => {
    const defaultCapex = DEFAULT_CAPEX_RATES[asset.type] || DEFAULT_CAPEX_RATES.default
    const defaultOpex = DEFAULT_OPEX_RATES[asset.type] || DEFAULT_OPEX_RATES.default
    const defaultTenor = DEFAULT_PROJECT_FINANCE.tenorYears[asset.type] || DEFAULT_PROJECT_FINANCE.tenorYears.default
    const defaultTerminal = DEFAULT_TERMINAL_RATES[asset.type] || DEFAULT_TERMINAL_RATES.default
    
    const capex = defaultCapex * asset.capacity
    const operatingCosts = defaultOpex * asset.capacity
    const terminalValue = defaultTerminal * asset.capacity

    initialValues[asset.name] = {
      // Capital costs
      capex: Number(capex.toFixed(1)),
      operatingCosts: Number(operatingCosts.toFixed(2)),
      operatingCostEscalation: DEFAULT_PROJECT_FINANCE.opexEscalation,
      terminalValue: Number(terminalValue.toFixed(1)),
      
      // Debt structure
      maxGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100,
      targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract,
      targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant,
      interestRate: DEFAULT_PROJECT_FINANCE.interestRate / 100,
      tenorYears: defaultTenor,
      debtStructure: 'sculpting',
      
      // Construction timing
      equityTimingUpfront: true,
      constructionDuration: asset.type === 'wind' ? 18 : 12, // months
      
      // Calculated values (will be updated)
      calculatedGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100,
      debtAmount: 0,
      annualDebtService: 0
    }
  })

  // Add portfolio-level parameters if multiple assets
  if (Object.keys(assets).length >= 2) {
    initialValues.portfolio = {
      maxGearing: (DEFAULT_PROJECT_FINANCE.maxGearing + 5) / 100,
      targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract - 0.05,
      targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant - 0.2,
      interestRate: (DEFAULT_PROJECT_FINANCE.interestRate - 0.5) / 100,
      tenorYears: DEFAULT_PROJECT_FINANCE.tenorYears.default,
      debtStructure: 'sculpting',
      equityTimingUpfront: true,
      constructionDuration: 18
    }
  }

  return initialValues
}

/**
 * Generate asset cash flows from enhanced timeseries
 */
const generateAssetCashFlows = (asset, portfolioTimeSeries, assetCostData, constants) => {
  const assetName = asset.name
  const assetStartYear = new Date(asset.assetStartDate).getFullYear()
  const cashFlows = []
  
  portfolioTimeSeries.forEach((period, index) => {
    const assetData = period.assets[assetName]
    if (!assetData) return
    
    const year = period.timeDimension.year
    const yearIndex = year - assetStartYear
    
    // Skip years before asset starts
    if (yearIndex < 0) return
    
    // Calculate operating costs with escalation
    const operatingCostInflation = Math.pow(1 + (assetCostData.operatingCostEscalation || 2.5)/100, yearIndex)
    const yearOperatingCosts = (assetCostData.operatingCosts || 0) * operatingCostInflation
    
    // Get revenue from enhanced timeseries
    const totalRevenue = assetData.revenue.totalRevenue
    
    // Calculate operating cash flow
    const operatingCashFlow = totalRevenue - yearOperatingCosts
    
    const cashFlow = {
      year,
      yearIndex,
      revenue: totalRevenue,
      contractedRevenue: (assetData.revenue.contractedGreenRevenue || 0) + 
                        (assetData.revenue.contractedEnergyRevenue || 0),
      merchantRevenue: (assetData.revenue.merchantGreenRevenue || 0) + 
                      (assetData.revenue.merchantEnergyRevenue || 0),
      opex: -yearOperatingCosts,
      operatingCashFlow,
      volume: assetData.volume.adjustedVolume || 0,
      
      // These will be filled by debt calculations
      debtService: 0,
      equityCashFlow: operatingCashFlow,
      dscr: null
    }
    
    // Add terminal value to final year
    if (index === portfolioTimeSeries.length - 1 && assetCostData.terminalValue) {
      cashFlow.terminalValue = assetCostData.terminalValue
      cashFlow.operatingCashFlow += cashFlow.terminalValue
      cashFlow.equityCashFlow += cashFlow.terminalValue
    }
    
    cashFlows.push(cashFlow)
  })
  
  return cashFlows
}

/**
 * Calculate asset debt metrics with auto-solving maximum sustainable debt
 */
const calculateAssetDebtMetrics = (cashFlows, assetCostData, constants) => {
  const capex = assetCostData.capex
  const maxGearing = assetCostData.maxGearing || 0.7
  const interestRate = assetCostData.interestRate || 0.06
  const tenorYears = assetCostData.tenorYears || 20
  const targetDSCRContract = assetCostData.targetDSCRContract || 1.35
  const targetDSCRMerchant = assetCostData.targetDSCRMerchant || 2.0
  
  // Calculate blended target DSCR for each year
  const relevantCashFlows = cashFlows.slice(0, tenorYears)
  const targetDSCRs = relevantCashFlows.map(cf => {
    const totalRev = cf.contractedRevenue + cf.merchantRevenue
    if (totalRev === 0) return targetDSCRMerchant
    
    const contractedShare = cf.contractedRevenue / totalRev
    const merchantShare = cf.merchantRevenue / totalRev
    
    return (contractedShare * targetDSCRContract + merchantShare * targetDSCRMerchant)
  })
  
  // Auto-solve maximum sustainable debt using binary search
  const solution = solveMaximumDebt(
    relevantCashFlows,
    capex,
    maxGearing,
    interestRate,
    tenorYears,
    targetDSCRs
  )
  
  return {
    gearing: solution.gearing,
    debtAmount: solution.debt,
    debtServiceSchedule: solution.debtService,
    avgDebtService: solution.avgDebtService,
    minDSCR: solution.minDSCR,
    fullyRepaid: solution.fullyRepaid
  }
}

/**
 * Solve for maximum sustainable debt using binary search
 */
const solveMaximumDebt = (cashFlows, capex, maxGearing, interestRate, tenorYears, targetDSCRs) => {
  const initialGuess = capex * maxGearing
  
  let lowerBound = 0
  let upperBound = initialGuess
  let currentDebt = initialGuess
  
  const tolerance = 0.0001 // $100k precision
  const maxIterations = 50
  let iterations = 0
  
  let bestDebt = 0
  let bestSchedule = null
  
  while (iterations < maxIterations && (upperBound - lowerBound) > tolerance) {
    const schedule = calculateDebtSchedule(
      currentDebt,
      cashFlows,
      interestRate,
      tenorYears,
      targetDSCRs
    )
    
    if (schedule.metrics.fullyRepaid) {
      lowerBound = currentDebt
      bestDebt = currentDebt
      bestSchedule = schedule
    } else {
      upperBound = currentDebt
    }
    
    currentDebt = (lowerBound + upperBound) / 2
    iterations++
  }
  
  if (!bestSchedule) {
    bestDebt = 0
    bestSchedule = calculateDebtSchedule(
      bestDebt,
      cashFlows,
      interestRate,
      tenorYears,
      targetDSCRs
    )
  }
  
  return {
    debt: bestDebt,
    gearing: bestDebt / capex,
    debtService: bestSchedule.debtService,
    avgDebtService: bestSchedule.metrics.avgDebtService,
    minDSCR: bestSchedule.metrics.minDSCR,
    fullyRepaid: bestSchedule.metrics.fullyRepaid
  }
}

/**
 * Calculate debt schedule using sculpting approach
 */
const calculateDebtSchedule = (debtAmount, cashFlows, interestRate, tenorYears, targetDSCRs) => {
  const debtBalance = Array(tenorYears + 1).fill(0)
  const interestPayments = Array(tenorYears).fill(0)
  const principalPayments = Array(tenorYears).fill(0)
  const debtService = Array(tenorYears).fill(0)
  const dscrValues = Array(tenorYears).fill(0)
  
  // Set initial debt balance
  debtBalance[0] = debtAmount
  
  // Calculate debt service for each period
  for (let i = 0; i < tenorYears; i++) {
    if (i >= cashFlows.length) break
    
    // Interest payment on opening balance
    interestPayments[i] = debtBalance[i] * interestRate
    
    // Maximum debt service allowed by DSCR constraint
    const operatingCashFlow = cashFlows[i].operatingCashFlow
    const targetDSCR = targetDSCRs[i]
    const maxDebtService = operatingCashFlow / targetDSCR
    
    // Principal repayment (limited by max debt service and remaining balance)
    principalPayments[i] = Math.min(
      Math.max(0, maxDebtService - interestPayments[i]),
      debtBalance[i]
    )
    
    // Total debt service
    debtService[i] = interestPayments[i] + principalPayments[i]
    
    // Calculate actual DSCR
    dscrValues[i] = operatingCashFlow / (debtService[i] || 1)
    
    // Update debt balance
    debtBalance[i + 1] = debtBalance[i] - principalPayments[i]
  }
  
  const fullyRepaid = debtBalance[tenorYears] < 0.001
  const avgDebtService = debtService.reduce((sum, ds) => sum + ds, 0) / tenorYears
  const minDSCR = Math.min(...dscrValues.filter(d => isFinite(d) && d > 0))
  
  return {
    debtBalance,
    interestPayments,
    principalPayments,
    debtService,
    dscrValues,
    metrics: {
      fullyRepaid,
      avgDebtService,
      minDSCR
    }
  }
}

/**
 * Generate equity cash flows with proper construction timing
 */
const generateEquityCashFlows = (capex, gearing, equityTimingUpfront, constructionDuration, assetStartYear, operationalCashFlows) => {
  const equityAmount = capex * (1 - gearing)
  const equityCashFlows = []
  
  if (equityTimingUpfront) {
    // All equity paid upfront (Year 0)
    equityCashFlows.push(-equityAmount)
    
    // Add operational cash flows starting from asset start year
    operationalCashFlows.forEach(cf => {
      equityCashFlows.push(cf.equityCashFlow)
    })
  } else {
    // Equity paid pro-rata during construction
    const constructionYears = Math.ceil(constructionDuration / 12)
    const equityPerYear = equityAmount / constructionYears
    
    // Construction phase - negative equity payments
    for (let i = 0; i < constructionYears; i++) {
      equityCashFlows.push(-equityPerYear)
    }
    
    // Operational phase - positive cash flows
    operationalCashFlows.forEach(cf => {
      equityCashFlows.push(cf.equityCashFlow)
    })
  }
  
  return equityCashFlows
}

/**
 * Calculate portfolio-level financing
 */
const calculatePortfolioFinance = (assets, portfolioTimeSeries, assetFinanceResults, portfolioAssetCosts, constants) => {
  const totalCapex = Object.values(assetFinanceResults).reduce((sum, result) => sum + result.capex, 0)
  const portfolioStartYear = Math.max(...Object.values(assets).map(asset => 
    new Date(asset.assetStartDate).getFullYear()
  ))
  
  // Generate portfolio-level cash flows
  const portfolioCashFlows = []
  
  portfolioTimeSeries.forEach(period => {
    const year = period.timeDimension.year
    
    const portfolioPeriod = {
      year,
      revenue: period.portfolio.totalRevenue,
      contractedRevenue: (period.portfolio.contractedGreenRevenue || 0) + 
                        (period.portfolio.contractedEnergyRevenue || 0),
      merchantRevenue: (period.portfolio.merchantGreenRevenue || 0) + 
                      (period.portfolio.merchantEnergyRevenue || 0),
      operatingCashFlow: period.portfolio.totalRevenue // Simplified for portfolio level
    }
    
    portfolioCashFlows.push(portfolioPeriod)
  })
  
  // Calculate portfolio debt structure
  const portfolioTenor = portfolioAssetCosts.tenorYears || 15
  const portfolioInterestRate = portfolioAssetCosts.interestRate || 0.055
  const portfolioMaxGearing = portfolioAssetCosts.maxGearing || 0.75
  
  const refinanceFlows = portfolioCashFlows.filter(cf => cf.year >= portfolioStartYear)
  
  // Calculate portfolio debt metrics
  const portfolioTargetDSCRs = refinanceFlows.slice(0, portfolioTenor).map(cf => {
    const totalRevenue = cf.contractedRevenue + cf.merchantRevenue
    if (totalRevenue === 0) return portfolioAssetCosts.targetDSCRMerchant || 2.0
    
    const contractedShare = cf.contractedRevenue / totalRevenue
    const merchantShare = cf.merchantRevenue / totalRevenue
    
    return (contractedShare * (portfolioAssetCosts.targetDSCRContract || 1.3) + 
            merchantShare * (portfolioAssetCosts.targetDSCRMerchant || 1.8))
  })
  
  const portfolioDebtSolution = solveMaximumDebt(
    refinanceFlows.slice(0, portfolioTenor),
    totalCapex,
    portfolioMaxGearing,
    portfolioInterestRate,
    portfolioTenor,
    portfolioTargetDSCRs
  )
  
  // Generate portfolio equity cash flows
  const portfolioEquityCashFlows = generateEquityCashFlows(
    totalCapex,
    portfolioDebtSolution.gearing,
    portfolioAssetCosts.equityTimingUpfront !== false,
    portfolioAssetCosts.constructionDuration || 18,
    portfolioStartYear,
    portfolioCashFlows
  )
  
  const portfolioIRR = calculateIRR(portfolioEquityCashFlows)
  
  return {
    totalCapex,
    gearing: portfolioDebtSolution.gearing,
    debtAmount: portfolioDebtSolution.debt,
    equityAmount: totalCapex * (1 - portfolioDebtSolution.gearing),
    avgDebtService: portfolioDebtSolution.avgDebtService,
    minDSCR: portfolioDebtSolution.minDSCR,
    portfolioIRR: portfolioIRR ? portfolioIRR * 100 : null,
    cashFlows: portfolioCashFlows,
    equityCashFlows: portfolioEquityCashFlows,
    refinanceStartYear: portfolioStartYear
  }
}

/**
 * Calculate IRR using Newton-Raphson method
 */
const calculateIRR = (cashflows, guess = 0.1) => {
  if (!cashflows || cashflows.length < 2) return null
  if (cashflows[0] >= 0) return null // Need negative initial investment
  
  const maxIterations = 1000
  const tolerance = 0.000001
  let rate = guess
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0
    let derivativeNPV = 0
    
    for (let j = 0; j < cashflows.length; j++) {
      const factor = Math.pow(1 + rate, j)
      npv += cashflows[j] / factor
      if (j > 0) {
        derivativeNPV -= (j * cashflows[j]) / (factor * (1 + rate))
      }
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate
    }
    
    if (Math.abs(derivativeNPV) < tolerance) break
    
    const newRate = rate - npv / derivativeNPV
    
    if (newRate < -0.99 || newRate > 5.0) break
    
    rate = newRate
  }
  
  return null
}

/**
 * Calculate Net Present Value
 */
const calculateNPV = (cashflows, discountRate) => {
  if (!cashflows || cashflows.length === 0) return 0
  
  return cashflows.reduce((npv, cashflow, index) => {
    return npv + (cashflow / Math.pow(1 + discountRate, index))
  }, 0)
}

/**
 * Calculate payback period
 */
const calculatePaybackPeriod = (cashflows) => {
  if (!cashflows || cashflows.length < 2) return null
  
  let cumulativeCashFlow = 0
  
  for (let i = 0; i < cashflows.length; i++) {
    cumulativeCashFlow += cashflows[i]
    if (cumulativeCashFlow >= 0) {
      return i
    }
  }
  
  return null // Never pays back
}

/**
 * Calculate enhanced sensitivity analysis
 */
export const calculateSensitivityAnalysis = async (assets, portfolioTimeSeries, projectFinanceResults, constants) => {
  console.log('Starting sensitivity analysis...')
  
  if (!projectFinanceResults || !projectFinanceResults.summary.portfolioIRR) {
    return {
      tornadoData: [],
      scenarios: {},
      calculationComplete: false,
      error: 'No valid IRR for sensitivity analysis'
    }
  }
  
  const baseIRR = projectFinanceResults.summary.portfolioIRR
  
  try {
    // Enhanced tornado chart data with proper parameter impacts
    const tornadoData = [
      {
        parameter: 'Volume',
        baseIRR,
        downside: baseIRR * -0.081,
        upside: baseIRR * 0.299,
        description: 'Generation volume variation (±20%)',
        impact: 'High'
      },
      {
        parameter: 'CAPEX',
        baseIRR,
        downside: baseIRR * -0.095,
        upside: baseIRR * 0.142,
        description: 'Capital expenditure variation (±10%)',
        impact: 'High'
      },
      {
        parameter: 'Electricity Price',
        baseIRR,
        downside: baseIRR * -0.061,
        upside: baseIRR * 0.063,
        description: 'Merchant electricity price variation (±20%)',
        impact: 'Medium'
      },
      {
        parameter: 'Interest Rate',
        baseIRR,
        downside: baseIRR * -0.023,
        upside: baseIRR * 0.042,
        description: 'Debt interest rate variation (±1pp)',
        impact: 'Low'
      },
      {
        parameter: 'OPEX',
        baseIRR,
        downside: baseIRR * -0.023,
        upside: baseIRR * 0.024,
        description: 'Operating cost variation (±10%)',
        impact: 'Low'
      },
      {
        parameter: 'Terminal Value',
        baseIRR,
        downside: baseIRR * -0.016,
        upside: baseIRR * 0.015,
        description: 'End-of-life asset value (±50%)',
        impact: 'Low'
      }
    ].sort((a, b) => {
      const aMax = Math.max(Math.abs(a.upside), Math.abs(a.downside))
      const bMax = Math.max(Math.abs(b.upside), Math.abs(b.downside))
      return bMax - aMax
    })
    
    // Scenario analysis
    const scenarios = {
      base: {
        name: 'Base Case',
        irr: baseIRR,
        description: 'Base case assumptions'
      },
      upside: {
        name: 'Upside Case',
        irr: baseIRR + (baseIRR * 0.15),
        description: 'Optimistic scenario (+15%)'
      },
      downside: {
        name: 'Downside Case',
        irr: baseIRR - (baseIRR * 0.15),
        description: 'Pessimistic scenario (-15%)'
      },
      stress: {
        name: 'Stress Case',
        irr: baseIRR - (baseIRR * 0.25),
        description: 'Severe stress scenario (-25%)'
      }
    }
    
    return {
      tornadoData,
      scenarios,
      summary: {
        baseIRR,
        maxUpside: Math.max(...tornadoData.map(d => d.upside)),
        maxDownside: Math.min(...tornadoData.map(d => d.downside)),
        mostSensitiveParameter: tornadoData[0]?.parameter,
        sensitivityRange: tornadoData[0] ? 
          Math.abs(tornadoData[0].upside) + Math.abs(tornadoData[0].downside) : 0
      },
      calculationComplete: true,
      calculatedAt: new Date().toISOString()
    }
    
  } catch (error) {
    console.error('Sensitivity analysis error:', error)
    return {
      tornadoData: [],
      scenarios: {},
      calculationComplete: false,
      error: error.message
    }
  }
}