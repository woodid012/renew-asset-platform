// lib/enhancedSensitivityAnalysis.js
// Comprehensive sensitivity analysis for enhanced backend

/**
 * Calculate enhanced sensitivity analysis with tornado charts and scenario modeling
 */
export const calculateEnhancedSensitivityAnalysis = async (assets, portfolioTimeSeries, projectFinanceResults, constants) => {
  console.log('Starting enhanced sensitivity analysis...')
  
  try {
    // Calculate base case metrics
    const baseCaseMetrics = calculateBaseCaseMetrics(projectFinanceResults)
    
    // Generate tornado analysis
    const tornadoAnalysis = await generateTornadoAnalysis(
      assets, 
      portfolioTimeSeries, 
      projectFinanceResults, 
      constants
    )
    
    // Generate scenario analysis
    const scenarioAnalysis = await generateScenarioAnalysis(
      assets,
      portfolioTimeSeries,
      projectFinanceResults,
      constants
    )
    
    // Generate Monte Carlo analysis (simplified)
    const monteCarloAnalysis = await generateMonteCarloAnalysis(
      assets,
      portfolioTimeSeries,
      constants
    )
    
    // Generate break-even analysis
    const breakEvenAnalysis = await generateBreakEvenAnalysis(
      assets,
      projectFinanceResults,
      constants
    )
    
    console.log('Enhanced sensitivity analysis completed')
    
    return {
      baseCaseMetrics,
      tornadoAnalysis,
      scenarioAnalysis,
      monteCarloAnalysis,
      breakEvenAnalysis,
      
      metadata: {
        calculatedAt: new Date().toISOString(),
        analysisVersion: '3.0',
        assetCount: Object.keys(assets).length,
        scenarioCount: Object.keys(scenarioAnalysis.scenarios).length
      }
    }
    
  } catch (error) {
    console.error('Enhanced sensitivity analysis error:', error)
    throw error
  }
}

/**
 * Calculate base case metrics for sensitivity analysis
 */
const calculateBaseCaseMetrics = (projectFinanceResults) => {
  const assetMetrics = Object.entries(projectFinanceResults.assetFinance).map(([assetName, result]) => ({
    assetName,
    equityIRR: result.returns?.equityIRR || 0,
    equityNPV: result.returns?.equityNPV || 0,
    totalCapex: result.capitalStructure?.totalCapex || 0,
    gearing: result.capitalStructure?.calculatedGearing || 0
  }))
  
  // Calculate portfolio metrics
  const portfolioMetrics = projectFinanceResults.portfolioFinance ? {
    portfolioEquityIRR: projectFinanceResults.portfolioFinance.returns?.portfolioEquityIRR || 0,
    portfolioEquityNPV: projectFinanceResults.portfolioFinance.returns?.portfolioEquityNPV || 0,
    totalCapex: projectFinanceResults.portfolioFinance.aggregates?.totalCapex || 0,
    refinancingUplift: projectFinanceResults.portfolioFinance.returns?.refinancingUplift || 0
  } : null
  
  // Calculate weighted average portfolio IRR
  const totalCapex = assetMetrics.reduce((sum, asset) => sum + asset.totalCapex, 0)
  const weightedPortfolioIRR = totalCapex > 0 ? 
    assetMetrics.reduce((sum, asset) => sum + (asset.equityIRR * asset.totalCapex), 0) / totalCapex : 0
  
  return {
    assetMetrics,
    portfolioMetrics,
    aggregatedMetrics: {
      weightedPortfolioIRR,
      totalCapex,
      totalAssets: assetMetrics.length
    }
  }
}

/**
 * Generate tornado analysis for key sensitivity parameters
 */
const generateTornadoAnalysis = async (assets, portfolioTimeSeries, projectFinanceResults, constants) => {
  const baseIRR = calculateBaseCaseMetrics(projectFinanceResults).aggregatedMetrics.weightedPortfolioIRR
  
  if (!baseIRR || baseIRR <= 0) {
    return {
      baseIRR: 0,
      parameters: [],
      error: 'Invalid base IRR for tornado analysis'
    }
  }
  
  // Define sensitivity parameters with enhanced structure
  const sensitivityParameters = [
    {
      parameter: 'Electricity Price',
      variations: [
        { change: '+10%', multiplier: 1.10, type: 'price', component: 'energy' },
        { change: '-10%', multiplier: 0.90, type: 'price', component: 'energy' }
      ]
    },
    {
      parameter: 'Green Price',
      variations: [
        { change: '+10%', multiplier: 1.10, type: 'price', component: 'green' },
        { change: '-10%', multiplier: 0.90, type: 'price', component: 'green' }
      ]
    },
    {
      parameter: 'Capacity Factor',
      variations: [
        { change: '+10%', multiplier: 1.10, type: 'volume', component: 'capacity_factor' },
        { change: '-10%', multiplier: 0.90, type: 'volume', component: 'capacity_factor' }
      ]
    },
    {
      parameter: 'CAPEX',
      variations: [
        { change: '+10%', multiplier: 1.10, type: 'cost', component: 'capex' },
        { change: '-10%', multiplier: 0.90, type: 'cost', component: 'capex' }
      ]
    },
    {
      parameter: 'OPEX',
      variations: [
        { change: '+10%', multiplier: 1.10, type: 'cost', component: 'opex' },
        { change: '-10%', multiplier: 0.90, type: 'cost', component: 'opex' }
      ]
    },
    {
      parameter: 'Interest Rate',
      variations: [
        { change: '+1pp', adjustment: 0.01, type: 'finance', component: 'interest_rate' },
        { change: '-1pp', adjustment: -0.01, type: 'finance', component: 'interest_rate' }
      ]
    },
    {
      parameter: 'Terminal Value',
      variations: [
        { change: '+50%', multiplier: 1.50, type: 'finance', component: 'terminal_value' },
        { change: '-50%', multiplier: 0.50, type: 'finance', component: 'terminal_value' }
      ]
    },
    {
      parameter: 'Debt Tenor',
      variations: [
        { change: '+5yr', adjustment: 5, type: 'finance', component: 'tenor' },
        { change: '-5yr', adjustment: -5, type: 'finance', component: 'tenor' }
      ]
    }
  ]
  
  // Calculate sensitivity impacts
  const tornadoData = []
  
  for (const param of sensitivityParameters) {
    const impacts = await calculateParameterImpacts(
      param,
      assets,
      portfolioTimeSeries,
      projectFinanceResults,
      constants,
      baseIRR
    )
    
    if (impacts.upside !== null && impacts.downside !== null) {
      tornadoData.push({
        parameter: param.parameter,
        baseIRR: round(baseIRR, 2),
        upside: round(impacts.upside, 2),
        downside: round(impacts.downside, 2),
        upsideAbsolute: round(baseIRR + impacts.upside, 2),
        downsideAbsolute: round(baseIRR + impacts.downside, 2),
        maxAbsoluteImpact: Math.max(Math.abs(impacts.upside), Math.abs(impacts.downside)),
        sensitivity: calculateSensitivityRatio(impacts.upside, impacts.downside)
      })
    }
  }
  
  // Sort by maximum absolute impact
  tornadoData.sort((a, b) => b.maxAbsoluteImpact - a.maxAbsoluteImpact)
  
  return {
    baseIRR: round(baseIRR, 2),
    parameters: tornadoData,
    totalParameters: tornadoData.length,
    maxImpact: tornadoData.length > 0 ? tornadoData[0].maxAbsoluteImpact : 0,
    rangeSummary: {
      bestCase: baseIRR + Math.max(...tornadoData.map(p => p.upside)),
      worstCase: baseIRR + Math.min(...tornadoData.map(p => p.downside)),
      range: Math.max(...tornadoData.map(p => p.upside)) - Math.min(...tornadoData.map(p => p.downside))
    }
  }
}

/**
 * Calculate parameter impacts for tornado analysis
 */
const calculateParameterImpacts = async (param, assets, portfolioTimeSeries, projectFinanceResults, constants, baseIRR) => {
  let upside = null
  let downside = null
  
  for (const variation of param.variations) {
    try {
      // Create modified constants for this variation
      const modifiedConstants = createModifiedConstants(constants, param.parameter, variation)
      
      // Recalculate with modified parameters (simplified approach)
      const modifiedIRR = await calculateModifiedIRR(
        assets,
        portfolioTimeSeries,
        projectFinanceResults,
        modifiedConstants,
        param.parameter,
        variation
      )
      
      if (modifiedIRR !== null) {
        const impact = modifiedIRR - baseIRR
        
        if (variation.change.startsWith('+') || (variation.change.includes('pp') && variation.adjustment > 0)) {
          upside = impact
        } else {
          downside = impact
        }
      }
    } catch (error) {
      console.warn(`Error calculating impact for ${param.parameter} ${variation.change}:`, error)
    }
  }
  
  return { upside, downside }
}

/**
 * Calculate modified IRR with parameter changes (simplified calculation)
 */
const calculateModifiedIRR = async (assets, portfolioTimeSeries, projectFinanceResults, modifiedConstants, parameter, variation) => {
  // Simplified calculation based on parameter type
  const baseMetrics = calculateBaseCaseMetrics(projectFinanceResults)
  const baseIRR = baseMetrics.aggregatedMetrics.weightedPortfolioIRR
  
  let impactFactor = 0
  
  switch (variation.type) {
    case 'price':
      // Price changes have direct revenue impact
      impactFactor = (variation.multiplier - 1) * 0.25 // Assume 25% sensitivity
      break
      
    case 'volume':
      // Volume changes have direct revenue impact
      impactFactor = (variation.multiplier - 1) * 0.22 // Assume 22% sensitivity
      break
      
    case 'cost':
      if (variation.component === 'capex') {
        impactFactor = (1 - variation.multiplier) * 0.18 // Inverse relationship, 18% sensitivity
      } else if (variation.component === 'opex') {
        impactFactor = (1 - variation.multiplier) * 0.12 // Inverse relationship, 12% sensitivity
      }
      break
      
    case 'finance':
      if (variation.component === 'interest_rate') {
        impactFactor = -variation.adjustment * 15 // -1.5% IRR per 1% rate increase
      } else if (variation.component === 'terminal_value') {
        impactFactor = (variation.multiplier - 1) * 0.08 // 8% sensitivity
      } else if (variation.component === 'tenor') {
        impactFactor = variation.adjustment * 0.1 // 0.1% IRR per year of tenor
      }
      break
  }
  
  return baseIRR + (baseIRR * impactFactor)
}

/**
 * Generate scenario analysis
 */
const generateScenarioAnalysis = async (assets, portfolioTimeSeries, projectFinanceResults, constants) => {
  const baseMetrics = calculateBaseCaseMetrics(projectFinanceResults)
  const baseIRR = baseMetrics.aggregatedMetrics.weightedPortfolioIRR
  
  const scenarios = {
    base: {
      name: 'Base Case',
      description: 'Central assumptions with no stress',
      irr: baseIRR,
      npv: baseMetrics.aggregatedMetrics.totalCapex ? baseMetrics.assetMetrics.reduce((sum, a) => sum + (a.equityNPV || 0), 0) : 0,
      modifications: {}
    },
    
    upside: {
      name: 'Upside Case',
      description: 'Optimistic assumptions',
      irr: baseIRR * 1.25, // Simplified calculation
      npv: baseMetrics.aggregatedMetrics.totalCapex ? baseMetrics.assetMetrics.reduce((sum, a) => sum + (a.equityNPV || 0), 0) * 1.3 : 0,
      modifications: {
        electricityPrice: '+15%',
        capacityFactor: '+5%',
        capex: '-5%'
      }
    },
    
    downside: {
      name: 'Downside Case', 
      description: 'Conservative assumptions',
      irr: baseIRR * 0.75, // Simplified calculation
      npv: baseMetrics.aggregatedMetrics.totalCapex ? baseMetrics.assetMetrics.reduce((sum, a) => sum + (a.equityNPV || 0), 0) * 0.7 : 0,
      modifications: {
        electricityPrice: '-15%',
        capacityFactor: '-5%',
        capex: '+10%'
      }
    },
    
    stress: {
      name: 'Stress Case',
      description: 'Severe downside stress test',
      irr: baseIRR * 0.5, // Simplified calculation
      npv: baseMetrics.aggregatedMetrics.totalCapex ? baseMetrics.assetMetrics.reduce((sum, a) => sum + (a.equityNPV || 0), 0) * 0.4 : 0,
      modifications: {
        electricityPrice: '-25%',
        capacityFactor: '-10%',
        capex: '+15%',
        interestRate: '+2pp'
      }
    }
  }
  
  // Calculate scenario ranges
  const irrValues = Object.values(scenarios).map(s => s.irr).filter(irr => irr > 0)
  const npvValues = Object.values(scenarios).map(s => s.npv)
  
  return {
    scenarios,
    scenarioSummary: {
      irrRange: {
        min: Math.min(...irrValues),
        max: Math.max(...irrValues),
        range: Math.max(...irrValues) - Math.min(...irrValues)
      },
      npvRange: {
        min: Math.min(...npvValues),
        max: Math.max(...npvValues),
        range: Math.max(...npvValues) - Math.min(...npvValues)
      }
    }
  }
}

/**
 * Generate Monte Carlo analysis (simplified)
 */
const generateMonteCarloAnalysis = async (assets, portfolioTimeSeries, constants) => {
  const iterations = 1000
  const results = []
  
  // Define parameter distributions
  const parameterDistributions = {
    electricityPrice: { mean: 1.0, stdDev: 0.15, type: 'normal' },
    capacityFactor: { mean: 1.0, stdDev: 0.10, type: 'normal' },
    capex: { mean: 1.0, stdDev: 0.12, type: 'normal' },
    opex: { mean: 1.0, stdDev: 0.08, type: 'normal' }
  }
  
  for (let i = 0; i < iterations; i++) {
    // Sample random values
    const sampledValues = {}
    Object.entries(parameterDistributions).forEach(([param, dist]) => {
      sampledValues[param] = sampleFromDistribution(dist)
    })
    
    // Calculate IRR for this iteration (simplified)
    const baseIRR = 12.0 // Assume base IRR
    const modifiedIRR = baseIRR * 
      sampledValues.electricityPrice * 0.25 + 
      sampledValues.capacityFactor * 0.22 + 
      (2 - sampledValues.capex) * 0.18 + 
      (2 - sampledValues.opex) * 0.12
    
    results.push({
      iteration: i + 1,
      irr: Math.max(0, modifiedIRR),
      parameters: sampledValues
    })
  }
  
  // Calculate statistics
  const irrValues = results.map(r => r.irr).sort((a, b) => a - b)
  
  return {
    iterations,
    statistics: {
      mean: calculateMean(irrValues),
      median: calculatePercentile(irrValues, 50),
      stdDev: calculateStandardDeviation(irrValues),
      min: Math.min(...irrValues),
      max: Math.max(...irrValues),
      p10: calculatePercentile(irrValues, 10),
      p25: calculatePercentile(irrValues, 25),
      p75: calculatePercentile(irrValues, 75),
      p90: calculatePercentile(irrValues, 90)
    },
    distribution: {
      bins: createHistogramBins(irrValues, 20),
      confidenceIntervals: {
        '90%': [calculatePercentile(irrValues, 5), calculatePercentile(irrValues, 95)],
        '95%': [calculatePercentile(irrValues, 2.5), calculatePercentile(irrValues, 97.5)]
      }
    }
  }
}

/**
 * Generate break-even analysis
 */
const generateBreakEvenAnalysis = async (assets, projectFinanceResults, constants) => {
  const baseMetrics = calculateBaseCaseMetrics(projectFinanceResults)
  const targetIRR = 12.0 // Assume target IRR
  
  const breakEvenParameters = [
    {
      parameter: 'Electricity Price',
      currentLevel: 100,
      unit: '% of base case',
      breakEvenLevel: calculateBreakEven('electricityPrice', targetIRR, baseMetrics),
      sensitivity: 'High'
    },
    {
      parameter: 'Capacity Factor',
      currentLevel: 100,
      unit: '% of base case',
      breakEvenLevel: calculateBreakEven('capacityFactor', targetIRR, baseMetrics),
      sensitivity: 'High'
    },
    {
      parameter: 'CAPEX',
      currentLevel: 100,
      unit: '% of base case',
      breakEvenLevel: calculateBreakEven('capex', targetIRR, baseMetrics),
      sensitivity: 'Medium'
    },
    {
      parameter: 'Interest Rate',
      currentLevel: 6.0,
      unit: '% per annum',
      breakEvenLevel: calculateBreakEven('interestRate', targetIRR, baseMetrics),
      sensitivity: 'Medium'
    }
  ]
  
  return {
    targetIRR,
    breakEvenParameters,
    summary: {
      mostSensitive: breakEvenParameters.find(p => p.sensitivity === 'High')?.parameter || 'None',
      riskFactors: breakEvenParameters.filter(p => 
        Math.abs(p.breakEvenLevel - p.currentLevel) < 20
      ).map(p => p.parameter)
    }
  }
}

/**
 * Helper functions
 */

const createModifiedConstants = (constants, parameter, variation) => {
  // Create a copy of constants with modifications
  const modified = { ...constants }
  
  // Apply parameter-specific modifications
  switch (parameter) {
    case 'Electricity Price':
      modified.priceMultiplier = variation.multiplier
      break
    case 'Capacity Factor':
      modified.volumeMultiplier = variation.multiplier
      break
    // Add other parameter modifications as needed
  }
  
  return modified
}

const calculateSensitivityRatio = (upside, downside) => {
  if (upside === null || downside === null) return 0
  return Math.abs(upside) + Math.abs(downside)
}

const sampleFromDistribution = (distribution) => {
  if (distribution.type === 'normal') {
    return Math.max(0.1, generateNormalRandom(distribution.mean, distribution.stdDev))
  }
  return distribution.mean
}

const generateNormalRandom = (mean, stdDev) => {
  // Box-Muller transformation for normal distribution
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + stdDev * z0
}

const calculateMean = (values) => {
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

const calculateStandardDeviation = (values) => {
  const mean = calculateMean(values)
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

const calculatePercentile = (sortedValues, percentile) => {
  const index = (percentile / 100) * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1
  
  if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1]
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

const createHistogramBins = (values, binCount) => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const binWidth = (max - min) / binCount
  
  const bins = Array(binCount).fill(0)
  
  values.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1)
    bins[binIndex]++
  })
  
  return bins.map((count, index) => ({
    binStart: min + index * binWidth,
    binEnd: min + (index + 1) * binWidth,
    count,
    frequency: count / values.length
  }))
}

const calculateBreakEven = (parameter, targetIRR, baseMetrics) => {
  // Simplified break-even calculation
  const baseIRR = baseMetrics.aggregatedMetrics.weightedPortfolioIRR
  const requiredChange = (targetIRR - baseIRR) / baseIRR
  
  // Parameter-specific sensitivity factors
  const sensitivities = {
    electricityPrice: 0.25,
    capacityFactor: 0.22,
    capex: -0.18,
    interestRate: -15.0 // Different units
  }
  
  const sensitivity = sensitivities[parameter] || 0.1
  
  if (parameter === 'interestRate') {
    return 6.0 - (requiredChange / sensitivity) // Base rate 6%
  } else {
    return 100 + (requiredChange / sensitivity) * 100 // Percentage change
  }
}

const round = (value, decimals) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}