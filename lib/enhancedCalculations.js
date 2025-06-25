// lib/enhancedCalculations.js
// FIXED: Solar/Wind volume and revenue calculations

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
      const totalQuarters = periods * 4 // FIXED: periods is in years, convert to quarters
      for (let i = 0; i < totalQuarters; i++) {
        const year = baseYear + Math.floor(i / 4)
        const quarter = (i % 4) + 1
        intervals.push(`${year}-Q${quarter}`)
      }
      break

    case 'monthly':
      const totalMonths = periods * 12 // FIXED: periods is in years, convert to months
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
 * FIXED: Enhanced asset revenue calculation with proper volume calculations
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
 * FIXED: Enhanced renewable asset revenue calculation with proper volume/revenue logic
 */
const calculateRenewableEnhancedRevenue = (asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice) => {
  const HOURS_IN_YEAR = constants.HOURS_IN_YEAR || 8760
  const capacity = parseFloat(asset.capacity) || 0
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95
  
  console.log(`Calculating renewable revenue for ${asset.name} (${asset.type}) - Period: ${timePeriod}`)
  
  // FIXED: Get capacity factor for this period with proper fallbacks
  const capacityFactor = getEnhancedCapacityFactorForPeriod(asset, periodInfo)
  console.log(`Capacity factor for ${asset.name}: ${capacityFactor}`)
  
  // FIXED: Calculate degradation properly
  const yearsSinceStart = periodInfo.year - assetStartYear
  const degradation = parseFloat(asset.annualDegradation) || 0.5
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart)
  console.log(`Degradation factor for year ${yearsSinceStart}: ${degradationFactor}`)
  
  // FIXED: Enhanced volume calculations with proper units (MWh throughout)
  const baseAnnualGeneration = capacity * HOURS_IN_YEAR * capacityFactor // MWh per year
  const basePeriodGeneration = baseAnnualGeneration * periodInfo.periodAdjustment // MWh for this period
  const degradedGeneration = basePeriodGeneration * degradationFactor // Apply degradation
  const adjustedVolume = degradedGeneration * (volumeLossAdjustment / 100) // Final MWh including losses
  
  console.log(`Volume calculations for ${asset.name} (all in MWh):`, {
    capacity: `${capacity} MW`,
    capacityFactor: `${(capacityFactor * 100).toFixed(1)}%`,
    hoursInPeriod: (HOURS_IN_YEAR * periodInfo.periodAdjustment).toFixed(0),
    baseAnnualGeneration: baseAnnualGeneration.toFixed(0),
    basePeriodGeneration: basePeriodGeneration.toFixed(0),
    degradedGeneration: degradedGeneration.toFixed(0),
    adjustedVolume: adjustedVolume.toFixed(0),
    periodAdjustment: periodInfo.periodAdjustment,
    volumeLossAdjustment: `${volumeLossAdjustment}%`
  })
  
  // FIXED: Process active contracts for this period with enhanced logic
  const activeContracts = (asset.contracts || []).filter(contract => 
    isContractActiveForPeriod(contract, periodInfo)
  )
  
  console.log(`Active contracts for ${asset.name} in ${timePeriod}:`, activeContracts.length)
  
  // FIXED: Calculate contract breakdown with enhanced processing
  const contractBreakdown = processEnhancedRenewableContracts(activeContracts, periodInfo.year, adjustedVolume)
  
  console.log(`Contract breakdown for ${asset.name}:`, contractBreakdown)
  
  // FIXED: Get merchant prices with enhanced escalation (prices should already include escalation)
  const merchantGreenPrice = getMerchantPrice(asset.type, 'green', asset.state, timePeriod) || 35
  const merchantEnergyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, timePeriod) || 65
  
  console.log(`Merchant prices for ${asset.name}:`, {
    green: merchantGreenPrice,
    energy: merchantEnergyPrice
  })
  
  // FIXED: Calculate merchant volumes and revenues properly
  const merchantGreenVolume = adjustedVolume * (100 - contractBreakdown.greenPercentage) / 100
  const merchantEnergyVolume = adjustedVolume * (100 - contractBreakdown.energyPercentage) / 100
  
  const merchantGreenRevenue = (merchantGreenVolume * merchantGreenPrice) / 1000000
  const merchantEnergyRevenue = (merchantEnergyVolume * merchantEnergyPrice) / 1000000
  
  console.log(`Revenue calculations for ${asset.name}:`, {
    merchantGreenVolume: merchantGreenVolume.toFixed(2),
    merchantEnergyVolume: merchantEnergyVolume.toFixed(2),
    merchantGreenRevenue: merchantGreenRevenue.toFixed(3),
    merchantEnergyRevenue: merchantEnergyRevenue.toFixed(3),
    contractedGreenRevenue: contractBreakdown.contractedGreenRevenue.toFixed(3),
    contractedEnergyRevenue: contractBreakdown.contractedEnergyRevenue.toFixed(3)
  })
  
  // FIXED: Apply scenario stress testing if enabled
  const stressedRevenue = applyEnhancedScenarioStress({
    contractedGreenRevenue: contractBreakdown.contractedGreenRevenue,
    contractedEnergyRevenue: contractBreakdown.contractedEnergyRevenue,
    merchantGreenRevenue,
    merchantEnergyRevenue
  }, constants.scenario, constants)
  
  const totalRevenue = stressedRevenue.contractedGreenRevenue + 
                      stressedRevenue.contractedEnergyRevenue + 
                      stressedRevenue.merchantGreenRevenue + 
                      stressedRevenue.merchantEnergyRevenue
  
  console.log(`Final revenue for ${asset.name}: $${totalRevenue.toFixed(3)}M`)
  
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
    
    // FIXED: Enhanced volume breakdown with all calculations (keeping MWh units)
    volume: {
      baseAnnualGeneration: round(baseAnnualGeneration, 0), // MWh/year
      basePeriodGeneration: round(basePeriodGeneration, 0), // MWh for period
      degradationFactor: round(degradationFactor, 4),
      degradedGeneration: round(degradedGeneration, 0), // MWh after degradation
      volumeLossAdjustment,
      adjustedVolume: round(adjustedVolume, 0), // Final MWh
      capacityFactor: round(capacityFactor, 4),
      
      // Contract volume breakdown (all in MWh)
      contractedGreenVolume: round(adjustedVolume * contractBreakdown.greenPercentage / 100, 0),
      contractedEnergyVolume: round(adjustedVolume * contractBreakdown.energyPercentage / 100, 0),
      merchantGreenVolume: round(merchantGreenVolume, 0),
      merchantEnergyVolume: round(merchantEnergyVolume, 0),
      
      // Volume efficiency metrics
      volumeEfficiency: round((adjustedVolume / basePeriodGeneration) * 100, 2),
      utilizationFactor: round((adjustedVolume / (capacity * (HOURS_IN_YEAR * periodInfo.periodAdjustment))) * 100, 2)
    },
    
    // FIXED: Enhanced price breakdown
    prices: {
      contractedGreenPrice: contractBreakdown.avgGreenPrice,
      contractedEnergyPrice: contractBreakdown.avgEnergyPrice,
      merchantGreenPrice: round(merchantGreenPrice, 2),
      merchantEnergyPrice: round(merchantEnergyPrice, 2),
      
      // Price efficiency metrics
      blendedPrice: adjustedVolume > 0 ? 
        ((totalRevenue * 1000000) / adjustedVolume) : 0,
      
      // Indexation factors
      greenIndexationFactor: contractBreakdown.greenIndexationFactor,
      energyIndexationFactor: contractBreakdown.energyIndexationFactor
    },
    
    // FIXED: Enhanced revenue breakdown
    revenue: {
      contractedGreenRevenue: round(stressedRevenue.contractedGreenRevenue, 3),
      contractedEnergyRevenue: round(stressedRevenue.contractedEnergyRevenue, 3),
      merchantGreenRevenue: round(stressedRevenue.merchantGreenRevenue, 3),
      merchantEnergyRevenue: round(stressedRevenue.merchantEnergyRevenue, 3),
      totalRevenue: round(totalRevenue, 3),
      
      // Revenue efficiency metrics
      revenuePerMW: capacity > 0 ? round(totalRevenue / capacity, 3) : 0,
      revenuePerMWh: adjustedVolume > 0 ? round((totalRevenue * 1000000) / adjustedVolume, 2) : 0
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
      total: round(totalRevenue, 3),
      contractedGreen: round(stressedRevenue.contractedGreenRevenue, 3),
      contractedEnergy: round(stressedRevenue.contractedEnergyRevenue, 3),
      merchantGreen: round(stressedRevenue.merchantGreenRevenue, 3),
      merchantEnergy: round(stressedRevenue.merchantEnergyRevenue, 3),
      greenPercentage: contractBreakdown.greenPercentage,
      EnergyPercentage: contractBreakdown.energyPercentage,
      annualGeneration: round(adjustedVolume, 2)
    }
  }
}

/**
 * FIXED: Enhanced capacity factor calculation with proper quarterly/monthly support
 */
const getEnhancedCapacityFactorForPeriod = (asset, periodInfo) => {
  if (asset.type === 'storage') {
    return null // Storage doesn't use capacity factors
  }

  console.log(`Getting capacity factor for ${asset.name} - Period type: ${periodInfo.type}, Quarter: ${periodInfo.quarter}, Month: ${periodInfo.month}`)

  // FIXED: Enhanced quarterly capacity factor logic
  if (periodInfo.type === 'quarterly' && periodInfo.quarter) {
    const quarterKey = `qtrCapacityFactor_q${periodInfo.quarter}`
    const storedFactor = asset[quarterKey]
    
    console.log(`Looking for quarterly factor ${quarterKey}:`, storedFactor)
    
    if (storedFactor !== undefined && storedFactor !== '' && storedFactor !== null) {
      const factor = parseFloat(storedFactor) / 100
      console.log(`Using quarterly capacity factor: ${factor}`)
      return factor
    }
  }

  // FIXED: For monthly, use the quarter that contains this month
  if (periodInfo.type === 'monthly' && periodInfo.month) {
    const quarterForMonth = Math.ceil(periodInfo.month / 3)
    const quarterKey = `qtrCapacityFactor_q${quarterForMonth}`
    const storedFactor = asset[quarterKey]
    
    console.log(`Monthly period - using quarter ${quarterForMonth}, key ${quarterKey}:`, storedFactor)
    
    if (storedFactor !== undefined && storedFactor !== '' && storedFactor !== null) {
      const factor = parseFloat(storedFactor) / 100
      console.log(`Using monthly->quarterly capacity factor: ${factor}`)
      return factor
    }
  }

  // FIXED: Fallback to average of available quarterly factors
  const quarters = ['q1', 'q2', 'q3', 'q4']
  const availableFactors = []
  
  quarters.forEach(q => {
    const key = `qtrCapacityFactor_${q}`
    const value = asset[key]
    if (value !== undefined && value !== '' && value !== null) {
      availableFactors.push(parseFloat(value) / 100)
    }
  })

  console.log(`Available quarterly factors for ${asset.name}:`, availableFactors)

  if (availableFactors.length > 0) {
    const avgFactor = availableFactors.reduce((sum, f) => sum + f, 0) / availableFactors.length
    console.log(`Using average capacity factor: ${avgFactor}`)
    return avgFactor
  }

  // FIXED: Enhanced default capacity factors by technology and region
  const enhancedDefaultFactors = {
    solar: { 
      NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27, WA: 0.26, TAS: 0.23,
      // Add some backup mappings
      'New South Wales': 0.28, 'Victoria': 0.25, 'Queensland': 0.29, 
      'South Australia': 0.27, 'Western Australia': 0.26, 'Tasmania': 0.23
    },
    wind: { 
      NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40, WA: 0.37, TAS: 0.42,
      // Add some backup mappings
      'New South Wales': 0.35, 'Victoria': 0.38, 'Queensland': 0.32, 
      'South Australia': 0.40, 'Western Australia': 0.37, 'Tasmania': 0.42
    }
  }
  
  const defaultFactor = enhancedDefaultFactors[asset.type]?.[asset.state] || 
                       enhancedDefaultFactors[asset.type]?.[asset.state?.toUpperCase()] ||
                       (asset.type === 'solar' ? 0.25 : 0.35)
  
  console.log(`Using default capacity factor for ${asset.type} in ${asset.state}: ${defaultFactor}`)
  return defaultFactor
}

/**
 * FIXED: Enhanced renewable contracts processing with proper revenue calculations
 */
const processEnhancedRenewableContracts = (activeContracts, year, adjustedVolume) => {
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
  
  console.log(`Processing ${activeContracts.length} contracts for year ${year}, volume ${adjustedVolume.toFixed(2)} MWh`)
  
  activeContracts.forEach((contract, index) => {
    const buyersPercentage = parseFloat(contract.buyersPercentage) || 0
    const years = year - new Date(contract.startDate).getFullYear()
    const indexation = parseFloat(contract.indexation) || 0
    const indexationFactor = Math.pow(1 + indexation/100, years)
    
    console.log(`Contract ${index + 1}: ${contract.type}, ${buyersPercentage}%, indexation: ${indexation}% over ${years} years = ${indexationFactor.toFixed(3)}x`)
    
    if (contract.type === 'bundled') {
      let greenPrice = parseFloat(contract.greenPrice) || 0
      let energyPrice = parseFloat(contract.EnergyPrice) || 0
      
      // Apply indexation
      greenPrice *= indexationFactor
      energyPrice *= indexationFactor
      
      console.log(`Bundled contract - Green: $${greenPrice.toFixed(2)}, Energy: $${energyPrice.toFixed(2)}`)
      
      // FIXED: Apply floor if exists
      if (contract.hasFloor && (greenPrice + energyPrice) < parseFloat(contract.floorValue)) {
        const total = greenPrice + energyPrice
        const floorValue = parseFloat(contract.floorValue)
        console.log(`Applying floor: ${total.toFixed(2)} -> ${floorValue.toFixed(2)}`)
        if (total > 0) {
          greenPrice = (greenPrice / total) * floorValue
          energyPrice = (energyPrice / total) * floorValue
        }
      }
      
      // FIXED: Calculate revenues properly
      const contractVolume = adjustedVolume * buyersPercentage / 100
      const greenRevenue = (contractVolume * greenPrice) / 1000000 // Convert to $M
      const energyRevenue = (contractVolume * energyPrice) / 1000000 // Convert to $M
      
      console.log(`Bundled revenues - Green: $${greenRevenue.toFixed(3)}M, Energy: $${energyRevenue.toFixed(3)}M`)
      
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
      
      console.log(`Green contract - Price: $${price.toFixed(2)}`)
      
      // FIXED: Apply floor if exists
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue)
        console.log(`Applied green floor: $${price.toFixed(2)}`)
      }
      
      const contractVolume = adjustedVolume * buyersPercentage / 100
      const revenue = (contractVolume * price) / 1000000 // Convert to $M
      
      console.log(`Green revenue: $${revenue.toFixed(3)}M`)
      
      contractedGreenRevenue += revenue
      greenPercentage += buyersPercentage
      totalGreenPrice += price * buyersPercentage
      greenContracts += buyersPercentage
      greenIndexationSum += indexationFactor * buyersPercentage
      
    } else if (contract.type === 'Energy') {
      let price = parseFloat(contract.strikePrice) || 0
      price *= indexationFactor
      
      console.log(`Energy contract - Price: $${price.toFixed(2)}`)
      
      // FIXED: Apply floor if exists
      if (contract.hasFloor && price < parseFloat(contract.floorValue)) {
        price = parseFloat(contract.floorValue)
        console.log(`Applied energy floor: $${price.toFixed(2)}`)
      }
      
      const contractVolume = adjustedVolume * buyersPercentage / 100
      const revenue = (contractVolume * price) / 1000000 // Convert to $M
      
      console.log(`Energy revenue: $${revenue.toFixed(3)}M`)
      
      contractedEnergyRevenue += revenue
      energyPercentage += buyersPercentage
      totalEnergyPrice += price * buyersPercentage
      energyContracts += buyersPercentage
      energyIndexationSum += indexationFactor * buyersPercentage
    }
  })
  
  const result = {
    greenPercentage: Math.min(greenPercentage, 100),
    energyPercentage: Math.min(energyPercentage, 100),
    avgGreenPrice: greenContracts > 0 ? totalGreenPrice / greenContracts : 0,
    avgEnergyPrice: energyContracts > 0 ? totalEnergyPrice / energyContracts : 0,
    greenIndexationFactor: greenContracts > 0 ? greenIndexationSum / greenContracts : 1,
    energyIndexationFactor: energyContracts > 0 ? energyIndexationSum / energyContracts : 1,
    contractedGreenRevenue,
    contractedEnergyRevenue
  }
  
  console.log('Contract breakdown result:', result)
  return result
}

/**
 * FIXED: Enhanced scenario stress testing
 */
const applyEnhancedScenarioStress = (baseRevenue, scenario, constants) => {
  if (!scenario || scenario === 'base') {
    return baseRevenue
  }
  
  const volumeVar = (constants.volumeVariation || 20) / 100
  const greenVar = (constants.greenPriceVariation || 20) / 100
  const energyVar = (constants.EnergyPriceVariation || 20) / 100

  console.log(`Applying ${scenario} stress scenario:`, { volumeVar, greenVar, energyVar })

  switch (scenario) {
    case 'worst':
      return {
        contractedGreenRevenue: baseRevenue.contractedGreenRevenue * (1 - volumeVar),
        contractedEnergyRevenue: baseRevenue.contractedEnergyRevenue * (1 - volumeVar),
        merchantGreenRevenue: baseRevenue.merchantGreenRevenue * (1 - volumeVar) * (1 - greenVar),
        merchantEnergyRevenue: baseRevenue.merchantEnergyRevenue * (1 - volumeVar) * (1 - energyVar)
      }
    case 'volume':
      return {
        contractedGreenRevenue: baseRevenue.contractedGreenRevenue * (1 - volumeVar),
        contractedEnergyRevenue: baseRevenue.contractedEnergyRevenue * (1 - volumeVar),
        merchantGreenRevenue: baseRevenue.merchantGreenRevenue * (1 - volumeVar),
        merchantEnergyRevenue: baseRevenue.merchantEnergyRevenue * (1 - volumeVar)
      }
    case 'price':
      return {
        contractedGreenRevenue: baseRevenue.contractedGreenRevenue,
        contractedEnergyRevenue: baseRevenue.contractedEnergyRevenue,
        merchantGreenRevenue: baseRevenue.merchantGreenRevenue * (1 - greenVar),
        merchantEnergyRevenue: baseRevenue.merchantEnergyRevenue * (1 - energyVar)
      }
    default:
      return baseRevenue
  }
}

/**
 * Check if contract is active for period - ENHANCED
 */
const isContractActiveForPeriod = (contract, periodInfo) => {
  if (!contract.startDate || !contract.endDate) {
    console.log('Contract missing start/end dates:', contract)
    return false
  }
  
  const contractStart = new Date(contract.startDate)
  const contractEnd = new Date(contract.endDate)
  
  const isActive = periodInfo.startDate >= contractStart && periodInfo.endDate <= contractEnd
  
  console.log(`Contract ${contract.counterparty || 'Unknown'} active check:`, {
    contractStart: contractStart.toISOString().split('T')[0],
    contractEnd: contractEnd.toISOString().split('T')[0],
    periodStart: periodInfo.startDate.toISOString().split('T')[0],
    periodEnd: periodInfo.endDate.toISOString().split('T')[0],
    isActive
  })
  
  return isActive
}

// Keep existing storage calculation function (unchanged)
const calculateStorageEnhancedRevenue = (asset, timePeriod, periodInfo, assetStartYear, constants, getMerchantPrice) => {
  // Your existing storage calculation logic remains the same
  const volume = parseFloat(asset.volume) || 0
  const capacity = parseFloat(asset.capacity) || 0
  const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95
  const DAYS_IN_YEAR = constants.DAYS_IN_YEAR || 365
  
  const yearsSinceStart = periodInfo.year - assetStartYear
  const degradation = parseFloat(asset.annualDegradation) || 0.5
  const degradationFactor = Math.pow(1 - degradation/100, yearsSinceStart)
  
  const duration = volume / capacity
  const baseAnnualThroughput = volume * DAYS_IN_YEAR
  const basePeriodThroughput = baseAnnualThroughput * periodInfo.periodAdjustment
  const degradedThroughput = basePeriodThroughput * degradationFactor
  const adjustedThroughput = degradedThroughput * (volumeLossAdjustment / 100)
  
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
  
  const merchantPriceSpread = calculateStoragePriceSpread(asset, timePeriod, duration, getMerchantPrice)
  const merchantThroughput = adjustedThroughput * (100 - contractBreakdown.contractedPercentage) / 100
  const merchantRevenue = (merchantThroughput * merchantPriceSpread) / 1000000
  
  const stressedRevenue = applyEnhancedScenarioStress({
    contractedGreenRevenue: 0,
    contractedEnergyRevenue: contractBreakdown.contractedRevenue,
    merchantGreenRevenue: 0,
    merchantEnergyRevenue: merchantRevenue
  }, constants.scenario, constants)
  
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
      assetType: 'storage',
      assetCapacity: capacity,
      assetState: asset.state,
      assetStartYear,
      assetId: asset.id || asset.name.replace(/\s+/g, '_').toLowerCase(),
      storageVolume: volume,
      storageDuration: round(duration, 2)
    },
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
      contractedVolume: round(adjustedThroughput * contractBreakdown.contractedPercentage / 100, 2),
      merchantVolume: round(merchantThroughput, 2),
      utilizationFactor: round((adjustedThroughput / baseAnnualThroughput) * 100, 2),
      cyclesPerPeriod: round(adjustedThroughput / volume, 2)
    },
    prices: {
      contractedAvgPrice: contractBreakdown.avgContractPrice,
      merchantPriceSpread: round(merchantPriceSpread, 2),
      contractIndexationFactor: contractBreakdown.indexationFactor,
      blendedSpread: adjustedThroughput > 0 ? 
        ((stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue) * 1000000) / adjustedThroughput : 0
    },
    revenue: {
      contractedGreenRevenue: 0,
      contractedEnergyRevenue: round(stressedRevenue.contractedEnergyRevenue, 2),
      merchantGreenRevenue: 0,
      merchantEnergyRevenue: round(stressedRevenue.merchantEnergyRevenue, 2),
      totalRevenue: round(stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue, 2),
      revenuePerMW: capacity > 0 ? round(
        (stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue) / capacity, 2
      ) : 0,
      revenuePerMWh: adjustedThroughput > 0 ? round(
        ((stressedRevenue.contractedEnergyRevenue + stressedRevenue.merchantEnergyRevenue) * 1000000) / adjustedThroughput, 2
      ) : 0
    },
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

// Keep existing helper functions
const processStorageContracts = (activeContracts, year, capacity, adjustedVolume, periodAdjustment) => {
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
      
      const revenue = adjustedVolume * adjustedSpread * (buyersPercentage/100)
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

const round = (value, decimals) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

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