// lib/enhancedProjectFinance.js
// UPDATED: Complete project finance calculations moved from frontend to backend

import { 
  DEFAULT_CAPEX_RATES, 
  DEFAULT_OPEX_RATES, 
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_TERMINAL_RATES,
  DEFAULT_ASSET_PERFORMANCE
} from '@/lib/default_constants'

/**
 * Calculate enhanced project finance metrics from timeseries data
 */
export const calculateEnhancedProjectFinance = async (assets, portfolioTimeSeries, constants) => {
  console.log('Starting enhanced project finance calculations...')
  
  try {
    // Initialize or get existing asset costs
    let assetCosts = constants.assetCosts
    if (!assetCosts) {
      assetCosts = initializeEnhancedProjectValues(assets)
      console.log('Initialized project finance values for', Object.keys(assetCosts).length, 'entities')
    }
    
    // Calculate individual asset finance
    const assetFinanceResults = {}
    
    for (const [assetKey, asset] of Object.entries(assets)) {
      console.log(`Calculating project finance for asset: ${asset.name}`)
      
      const assetCostData = assetCosts[asset.name]
      if (!assetCostData) {
        console.warn(`No cost data for asset ${asset.name}, skipping`)
        continue
      }
      
      const assetResult = await calculateAssetProjectFinance(
        asset, 
        assetCostData, 
        portfolioTimeSeries, 
        constants
      )
      
      assetFinanceResults[asset.name] = assetResult
    }
    
    // Calculate portfolio-level finance if multiple assets
    let portfolioFinanceResult = null
    if (Object.keys(assets).length >= 2 && assetCosts.portfolio) {
      console.log('Calculating portfolio-level project finance...')
      
      portfolioFinanceResult = await calculatePortfolioProjectFinance(
        assets,
        assetCosts.portfolio,
        portfolioTimeSeries,
        assetFinanceResults,
        constants
      )
    }
    
    console.log('Enhanced project finance calculations completed')
    
    return {
      assetFinance: assetFinanceResults,
      portfolioFinance: portfolioFinanceResult,
      calculationMetadata: {
        calculatedAt: new Date().toISOString(),
        assetCount: Object.keys(assetFinanceResults).length,
        hasPortfolioFinance: !!portfolioFinanceResult,
        dataVersion: '3.1'
      }
    }
    
  } catch (error) {
    console.error('Enhanced project finance calculation error:', error)
    throw error
  }
}

/**
 * Initialize enhanced project finance values - MOVED FROM FRONTEND
 */
export const initializeEnhancedProjectValues = (assets) => {
  const initialValues = Object.values(assets).reduce((acc, asset) => {
    const defaultCapex = DEFAULT_CAPEX_RATES[asset.type] || DEFAULT_CAPEX_RATES.default
    const defaultOpex = DEFAULT_OPEX_RATES[asset.type] || DEFAULT_OPEX_RATES.default
    const defaultTenor = DEFAULT_PROJECT_FINANCE.tenorYears[asset.type] || DEFAULT_PROJECT_FINANCE.tenorYears.default
    const defaultTerminal = DEFAULT_TERMINAL_RATES[asset.type] || DEFAULT_TERMINAL_RATES.default
    
    const capex = defaultCapex * (parseFloat(asset.capacity) || 100)
    const operatingCosts = defaultOpex * (parseFloat(asset.capacity) || 100)
    const terminalValue = defaultTerminal * (parseFloat(asset.capacity) || 100)

    return {
      ...acc,
      [asset.name]: {
        // Enhanced capital costs
        capex: Number(capex.toFixed(1)),
        operatingCosts: Number(operatingCosts.toFixed(2)),
        operatingCostEscalation: DEFAULT_PROJECT_FINANCE.opexEscalation,
        terminalValue: Number(terminalValue.toFixed(1)),
        
        // Enhanced debt structure
        maxGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100,
        targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract,
        targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant,
        interestRate: DEFAULT_PROJECT_FINANCE.interestRate / 100,
        tenorYears: defaultTenor,
        debtStructure: 'sculpting',
        
        // Enhanced construction timing
        equityTimingUpfront: true,
        constructionDuration: asset.constructionDuration || DEFAULT_ASSET_PERFORMANCE.constructionDuration[asset.type] || 12,
        
        // Enhanced calculated values
        calculatedGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100,
        debtAmount: 0,
        annualDebtService: 0,
        
        // Enhanced metadata
        assetId: asset.name.replace(/\s+/g, '_').toLowerCase(),
        lastUpdated: new Date().toISOString()
      }
    }
  }, {})

  // Portfolio-level enhanced parameters
  if (Object.keys(assets).length >= 2) {
    initialValues.portfolio = {
      maxGearing: (DEFAULT_PROJECT_FINANCE.maxGearing + 5) / 100,
      targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract - 0.05,
      targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant - 0.2,
      interestRate: (DEFAULT_PROJECT_FINANCE.interestRate - 0.5) / 100,
      tenorYears: DEFAULT_PROJECT_FINANCE.tenorYears.default,
      debtStructure: 'sculpting',
      equityTimingUpfront: true,
      constructionDuration: 18,
      lastUpdated: new Date().toISOString()
    }
  }

  return initialValues
}

/**
 * Calculate project finance for individual asset - MOVED FROM FRONTEND
 */
const calculateAssetProjectFinance = async (asset, assetCostData, portfolioTimeSeries, constants) => {
  const assetStartDate = new Date(asset.assetStartDate)
  const assetStartYear = assetStartDate.getFullYear()
  const assetStartMonth = assetStartDate.getMonth() + 1 // 1-12
  
  // Extract asset-specific cash flows from timeseries
  const assetCashFlows = extractAssetCashFlows(asset.name, portfolioTimeSeries, assetStartYear)
  
  if (assetCashFlows.length === 0) {
    console.warn(`No cash flows found for asset ${asset.name}`)
    return createEmptyFinanceResult(asset, assetCostData)
  }
  
  // Calculate enhanced debt metrics with partial period logic
  const debtResults = calculateEnhancedDebtMetrics(
    assetCashFlows,
    assetCostData,
    constants,
    assetStartMonth
  )
  
  // Calculate enhanced equity cash flows with construction timeline
  const equityCashFlows = calculateEnhancedEquityCashFlows(
    assetCostData,
    debtResults,
    assetCashFlows,
    assetStartYear,
    assetStartMonth
  )
  
  // Calculate enhanced financial metrics
  const financialMetrics = calculateEnhancedFinancialMetrics(
    equityCashFlows,
    assetCostData,
    debtResults
  )
  
  return {
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: parseFloat(asset.capacity) || 0,
      assetStartYear,
      assetStartMonth,
      calculationDate: new Date().toISOString()
    },
    
    capitalStructure: {
      totalCapex: assetCostData.capex,
      calculatedGearing: debtResults.optimalGearing,
      debtAmount: debtResults.debtAmount,
      equityAmount: assetCostData.capex - debtResults.debtAmount,
      debtToEquityRatio: debtResults.debtAmount / Math.max(assetCostData.capex - debtResults.debtAmount, 0.001)
    },
    
    debtAnalysis: {
      structure: assetCostData.debtStructure,
      interestRate: assetCostData.interestRate * 100,
      tenorYears: assetCostData.tenorYears,
      averageDebtService: debtResults.averageDebtService,
      minDSCR: debtResults.minDSCR,
      debtServiceByYear: debtResults.debtServiceByYear,
      debtServiceByQuarter: debtResults.debtServiceByQuarter || [],
      fullyRepaid: debtResults.fullyRepaid,
      gracePeriods: debtResults.gracePeriods || []
    },
    
    equityAnalysis: {
      timingStructure: assetCostData.equityTimingUpfront ? 'upfront' : 'progressive',
      constructionDuration: assetCostData.constructionDuration,
      equityCashFlows: equityCashFlows,
      totalEquityInvestment: assetCostData.capex - debtResults.debtAmount,
      totalEquityReturns: equityCashFlows.slice(1).reduce((sum, cf) => sum + Math.max(0, cf), 0)
    },
    
    returns: {
      equityIRR: financialMetrics.equityIRR,
      equityNPV: financialMetrics.equityNPV,
      projectIRR: financialMetrics.projectIRR,
      paybackPeriod: financialMetrics.paybackPeriod,
      averageROE: financialMetrics.averageROE
    },
    
    operatingMetrics: {
      totalRevenue: assetCashFlows.reduce((sum, cf) => sum + cf.revenue, 0),
      totalOpex: assetCashFlows.reduce((sum, cf) => sum + Math.abs(cf.opex), 0),
      averageEBITDA: assetCashFlows.reduce((sum, cf) => sum + cf.operatingCashFlow, 0) / assetCashFlows.length,
      terminalValue: assetCostData.terminalValue
    },
    
    // Enhanced cash flow analysis with quarterly detail
    cashFlowAnalysis: assetCashFlows.map((cf, index) => ({
      year: cf.year,
      yearIndex: index,
      revenue: cf.revenue,
      opex: cf.opex,
      operatingCashFlow: cf.operatingCashFlow,
      debtService: debtResults.debtServiceByYear[index] || 0,
      equityCashFlow: cf.operatingCashFlow - (debtResults.debtServiceByYear[index] || 0),
      dscr: debtResults.debtServiceByYear[index] ? cf.operatingCashFlow / Math.abs(debtResults.debtServiceByYear[index]) : null,
      terminalValue: index === assetCashFlows.length - 1 ? assetCostData.terminalValue : 0,
      
      // Quarterly breakdown if available
      quarterlyDetail: debtResults.debtServiceByQuarter ? 
        debtResults.debtServiceByQuarter.filter(q => q.year === cf.year) : []
    }))
  }
}

/**
 * MOVED FROM FRONTEND: Calculate debt metrics with proper partial period handling
 */
const calculateEnhancedDebtMetrics = (cashFlows, costData, constants, assetStartMonth) => {
  const tenorYears = costData.tenorYears || 15
  const maxGearing = costData.maxGearing || 0.7
  const interestRate = costData.interestRate || 0.06
  const capex = costData.capex || 100
  
  // Calculate target DSCRs for each year based on revenue mix
  const targetDSCRs = cashFlows.slice(0, tenorYears).map(cf => {
    const contractedPercentage = cf.contractedPercentage || 50
    const merchantPercentage = 100 - contractedPercentage
    
    return (contractedPercentage/100 * costData.targetDSCRContract) + 
           (merchantPercentage/100 * costData.targetDSCRMerchant)
  })
  
  // Solve for optimal gearing using binary search
  const optimalDebtResult = solveOptimalDebtWithPartialPeriods(
    cashFlows.slice(0, tenorYears),
    capex,
    maxGearing,
    interestRate,
    targetDSCRs,
    assetStartMonth
  )
  
  return {
    optimalGearing: optimalDebtResult.gearing,
    debtAmount: optimalDebtResult.debtAmount,
    averageDebtService: optimalDebtResult.averageDebtService,
    minDSCR: optimalDebtResult.minDSCR,
    debtServiceByYear: optimalDebtResult.debtServiceByYear,
    debtServiceByQuarter: optimalDebtResult.debtServiceByQuarter || [],
    fullyRepaid: optimalDebtResult.fullyRepaid,
    gracePeriods: optimalDebtResult.gracePeriods || [],
    iterations: optimalDebtResult.iterations
  }
}

/**
 * MOVED FROM FRONTEND: Solve for optimal debt with partial period grace logic
 */
const solveOptimalDebtWithPartialPeriods = (cashFlows, capex, maxGearing, interestRate, targetDSCRs, assetStartMonth) => {
  const maxDebtAmount = capex * maxGearing
  
  let lowerBound = 0
  let upperBound = maxDebtAmount
  let bestResult = null
  
  const tolerance = 0.001 // $1k precision
  const maxIterations = 100
  let iterations = 0
  
  while (iterations < maxIterations && (upperBound - lowerBound) > tolerance) {
    const currentDebt = (lowerBound + upperBound) / 2
    
    const schedule = calculateDebtScheduleWithPartialPeriods(
      currentDebt, 
      cashFlows, 
      interestRate, 
      targetDSCRs, 
      assetStartMonth
    )
    
    if (schedule.fullyRepaid && schedule.minDSCR >= Math.min(...targetDSCRs) * 0.95) {
      lowerBound = currentDebt
      bestResult = {
        debtAmount: currentDebt,
        gearing: currentDebt / capex,
        averageDebtService: schedule.averageDebtService,
        minDSCR: schedule.minDSCR,
        debtServiceByYear: schedule.debtServiceByYear,
        debtServiceByQuarter: schedule.debtServiceByQuarter || [],
        fullyRepaid: schedule.fullyRepaid,
        gracePeriods: schedule.gracePeriods || [],
        iterations
      }
    } else {
      upperBound = currentDebt
    }
    
    iterations++
  }
  
  if (!bestResult) {
    // Fallback to conservative debt
    const conservativeDebt = maxDebtAmount * 0.5
    const schedule = calculateDebtScheduleWithPartialPeriods(
      conservativeDebt, 
      cashFlows, 
      interestRate, 
      targetDSCRs, 
      assetStartMonth
    )
    
    bestResult = {
      debtAmount: conservativeDebt,
      gearing: conservativeDebt / capex,
      averageDebtService: schedule.averageDebtService,
      minDSCR: schedule.minDSCR,
      debtServiceByYear: schedule.debtServiceByYear,
      debtServiceByQuarter: schedule.debtServiceByQuarter || [],
      fullyRepaid: schedule.fullyRepaid,
      gracePeriods: schedule.gracePeriods || [],
      iterations
    }
  }
  
  return bestResult
}

/**
 * MOVED FROM FRONTEND: Calculate debt schedule with partial period grace logic
 */
const calculateDebtScheduleWithPartialPeriods = (debtAmount, cashFlows, interestRate, targetDSCRs, assetStartMonth) => {
  const tenorYears = cashFlows.length
  const quarterlyRate = interestRate / 4
  
  // Initialize tracking arrays
  const debtBalance = Array(tenorYears + 1).fill(0)
  const debtServiceByYear = Array(tenorYears).fill(0)
  const debtServiceByQuarter = []
  const dscrValues = Array(tenorYears).fill(0)
  const gracePeriods = []
  
  debtBalance[0] = debtAmount
  
  for (let yearIndex = 0; yearIndex < tenorYears; yearIndex++) {
    const currentYear = cashFlows[yearIndex].year
    const operatingCashFlow = cashFlows[yearIndex].operatingCashFlow || 0
    const targetDSCR = targetDSCRs[yearIndex] || 1.5
    
    let yearlyDebtService = 0
    
    // Process each quarter
    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterCashFlow = operatingCashFlow / 4
      const quarterIndex = yearIndex * 4 + (quarter - 1)
      
      // Check if this is a partial first quarter
      const isFirstYear = yearIndex === 0
      const isPartialQuarter = isFirstYear && shouldApplyGracePeriod(assetStartMonth, quarter)
      
      let quarterlyDebtService = 0
      let quarterlyInterest = 0
      let quarterlyPrincipal = 0
      
      if (debtBalance[yearIndex] > 0 && !isPartialQuarter) {
        // Calculate normal debt service
        quarterlyInterest = debtBalance[yearIndex] * quarterlyRate
        
        const maxQuarterlyDebtService = quarterCashFlow / targetDSCR
        quarterlyPrincipal = Math.min(
          Math.max(0, maxQuarterlyDebtService - quarterlyInterest),
          debtBalance[yearIndex]
        )
        
        quarterlyDebtService = quarterlyInterest + quarterlyPrincipal
        
        // Update balance (simplified)
        debtBalance[yearIndex] = Math.max(0, debtBalance[yearIndex] - quarterlyPrincipal)
      } else if (isPartialQuarter) {
        // Grace period
        gracePeriods.push({
          year: currentYear,
          quarter: quarter,
          reason: 'partial_first_quarter',
          assetStartMonth: assetStartMonth
        })
      }
      
      // Store quarterly detail
      debtServiceByQuarter.push({
        year: currentYear,
        quarter: quarter,
        quarterIndex: quarterIndex,
        quarterlyDebtService: quarterlyDebtService,
        quarterlyInterest: quarterlyInterest,
        quarterlyPrincipal: quarterlyPrincipal,
        isGracePeriod: isPartialQuarter,
        quarterCashFlow: quarterCashFlow,
        remainingBalance: debtBalance[yearIndex]
      })
      
      yearlyDebtService += quarterlyDebtService
    }
    
    debtServiceByYear[yearIndex] = yearlyDebtService
    dscrValues[yearIndex] = yearlyDebtService > 0 ? operatingCashFlow / yearlyDebtService : null
    
    // Set balance for next year
    if (yearIndex < tenorYears - 1) {
      debtBalance[yearIndex + 1] = debtBalance[yearIndex]
    }
  }
  
  const fullyRepaid = debtBalance[tenorYears] < 0.001
  const averageDebtService = debtServiceByYear.reduce((sum, ds) => sum + ds, 0) / tenorYears
  const minDSCR = Math.min(...dscrValues.filter(d => d !== null && isFinite(d)))
  
  return {
    debtBalance,
    debtServiceByYear,
    debtServiceByQuarter,
    dscrValues,
    fullyRepaid,
    averageDebtService,
    minDSCR,
    gracePeriods
  }
}

/**
 * MOVED FROM FRONTEND: Determine if grace period should apply
 */
const shouldApplyGracePeriod = (assetStartMonth, quarter) => {
  const quarterMonths = {
    1: [1, 2, 3],    // Q1: Jan, Feb, Mar
    2: [4, 5, 6],    // Q2: Apr, May, Jun  
    3: [7, 8, 9],    // Q3: Jul, Aug, Sep
    4: [10, 11, 12]  // Q4: Oct, Nov, Dec
  }
  
  const startQuarter = Object.keys(quarterMonths).find(q => 
    quarterMonths[q].includes(assetStartMonth)
  )
  
  if (!startQuarter) return false
  
  const startQuarterNum = parseInt(startQuarter)
  const monthIndexInQuarter = quarterMonths[startQuarter].indexOf(assetStartMonth)
  
  if (quarter === startQuarterNum && monthIndexInQuarter > 0) {
    return true
  }
  
  return false
}

/**
 * MOVED FROM FRONTEND: Calculate IRR using Newton-Raphson method
 */
export const calculateIRR = (cashflows, guess = 0.1) => {
  if (!cashflows || cashflows.length < 2) {
    console.log('IRR calculation: Invalid cash flows array', { length: cashflows?.length })
    return null
  }
  
  if (cashflows[0] >= 0) {
    console.warn('IRR calculation: First cash flow should be negative (initial investment)', { firstCF: cashflows[0] })
    return null
  }
  
  const hasPositiveFlows = cashflows.slice(1).some(cf => cf > 0)
  if (!hasPositiveFlows) {
    console.warn('IRR calculation: No positive cash flows found')
    return null
  }
  
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
    
    if (Math.abs(derivativeNPV) < tolerance) {
      break
    }
    
    const newRate = rate - npv / derivativeNPV
    
    if (newRate < -0.99 || newRate > 5.0) {
      break
    }
    
    rate = newRate
  }
  
  return null
}

/**
 * MOVED FROM FRONTEND: Calculate sensitivity analysis
 */
export const calculateSensitivityAnalysis = (baseIRR, analysisYears = 30) => {
  if (!baseIRR || baseIRR <= 0) {
    return []
  }

  const scenarios = [
    // Electricity Price impacts
    { parameter: 'Electricity Price', change: '+10%', impact: baseIRR * 0.28 },
    { parameter: 'Electricity Price', change: '-10%', impact: baseIRR * -0.28 },
    
    // Capacity Factor impacts
    { parameter: 'Capacity Factor', change: '+10%', impact: baseIRR * 0.22 },
    { parameter: 'Capacity Factor', change: '-10%', impact: baseIRR * -0.22 },
    
    // CAPEX impacts
    { parameter: 'CAPEX', change: '+10%', impact: baseIRR * -0.18 },
    { parameter: 'CAPEX', change: '-10%', impact: baseIRR * 0.18 },
    
    // OPEX impacts
    { parameter: 'OPEX', change: '+10%', impact: baseIRR * -0.12 },
    { parameter: 'OPEX', change: '-10%', impact: baseIRR * 0.12 },
    
    // Contract Price impacts
    { parameter: 'Contract Price', change: '+10%', impact: baseIRR * 0.20 },
    { parameter: 'Contract Price', change: '-10%', impact: baseIRR * -0.20 },
    
    // Interest Rate impacts
    { parameter: 'Interest Rate', change: '+1pp', impact: baseIRR * -0.15 },
    { parameter: 'Interest Rate', change: '-1pp', impact: baseIRR * 0.15 },
    
    // Terminal Value impacts
    { parameter: 'Terminal Value', change: '+50%', impact: baseIRR * 0.08 },
    { parameter: 'Terminal Value', change: '-50%', impact: baseIRR * -0.08 }
  ]

  // Group by parameter
  const groupedScenarios = {}
  scenarios.forEach(scenario => {
    if (!groupedScenarios[scenario.parameter]) {
      groupedScenarios[scenario.parameter] = []
    }
    groupedScenarios[scenario.parameter].push(scenario)
  })

  // Create tornado data
  const tornadoData = Object.entries(groupedScenarios)
    .map(([parameter, paramScenarios]) => {
      const upside = paramScenarios.find(s => s.impact > 0)?.impact || 0
      const downside = paramScenarios.find(s => s.impact < 0)?.impact || 0
      const maxAbsImpact = Math.max(Math.abs(upside), Math.abs(downside))
      
      return {
        parameter,
        upside: Number(upside.toFixed(2)),
        downside: Number(downside.toFixed(2)),
        maxAbsImpact,
        baseIRR: Number(baseIRR.toFixed(2))
      }
    })
    .filter(item => item.maxAbsImpact > 0)
    .sort((a, b) => b.maxAbsImpact - a.maxAbsImpact)

  return tornadoData
}

// Helper functions continued...

const calculatePortfolioProjectFinance = async (assets, portfolioCostData, portfolioTimeSeries, assetFinanceResults, constants) => {
  // Portfolio refinancing implementation
  const portfolioStartYear = Math.max(...Object.values(assets).map(asset => 
    new Date(asset.assetStartDate).getFullYear()
  ))

  const totalCapex = Object.values(assetFinanceResults).reduce((sum, result) => 
    sum + (result.capitalStructure?.totalCapex || 0), 0
  )

  return {
    portfolioMetadata: {
      totalCapex,
      portfolioStartYear,
      refinancingEnabled: true
    },
    returns: {
      portfolioEquityIRR: calculatePortfolioIRR(assetFinanceResults),
      refinancingUplift: 0 // Placeholder
    },
    aggregates: {
      totalCapex,
      totalDebt: totalCapex * (portfolioCostData.maxGearing || 0.7),
      totalEquity: totalCapex * (1 - (portfolioCostData.maxGearing || 0.7))
    }
  }
}

const calculatePortfolioIRR = (assetFinanceResults) => {
  const assetIRRs = Object.values(assetFinanceResults)
    .map(result => result.returns?.equityIRR || 0)
    .filter(irr => irr > 0)
  
  return assetIRRs.length > 0 ? 
    assetIRRs.reduce((sum, irr) => sum + irr, 0) / assetIRRs.length : 0
}

const extractAssetCashFlows = (assetName, portfolioTimeSeries, assetStartYear) => {
  return portfolioTimeSeries
    .filter(period => period.timeDimension.year >= assetStartYear)
    .map(period => {
      const assetData = period.assets[assetName]
      if (!assetData) return null
      
      const revenue = assetData.revenue?.totalRevenue || 0
      const opex = revenue * 0.15 // Assume 15% OPEX
      
      return {
        year: period.timeDimension.year,
        revenue: revenue,
        opex: -opex,
        operatingCashFlow: revenue - opex,
        contractedPercentage: (assetData.contracts?.contractedPercentages?.green || 0) + 
                            (assetData.contracts?.contractedPercentages?.energy || 0)
      }
    })
    .filter(cf => cf !== null)
}

const calculateEnhancedEquityCashFlows = (costData, debtResults, operationalCashFlows, assetStartYear, assetStartMonth) => {
  const equityAmount = costData.capex - debtResults.debtAmount
  const equityCashFlows = []
  
  if (costData.equityTimingUpfront) {
    // Upfront equity investment
    equityCashFlows.push(-equityAmount)
  } else {
    // Progressive equity during construction
    const constructionYears = Math.ceil((costData.constructionDuration || 12) / 12)
    const equityPerYear = equityAmount / constructionYears
    
    for (let i = 0; i < constructionYears; i++) {
      equityCashFlows.push(-equityPerYear)
    }
  }
  
  // Add operational cash flows
  operationalCashFlows.forEach((cf, index) => {
    const debtServiceThisYear = debtResults.debtServiceByYear[index] || 0
    const equityCF = cf.operatingCashFlow - Math.abs(debtServiceThisYear)
    
    // Add terminal value in final year
    if (index === operationalCashFlows.length - 1 && costData.terminalValue) {
      equityCashFlows.push(equityCF + costData.terminalValue)
    } else {
      equityCashFlows.push(equityCF)
    }
  })
  
  return equityCashFlows
}

const calculateEnhancedFinancialMetrics = (equityCashFlows, costData, debtResults) => {
  const equityIRR = calculateIRR(equityCashFlows)
  const equityNPV = calculateNPV(equityCashFlows, 0.12)
  
  // Calculate project IRR (ungeared)
  const totalInvestment = costData.capex
  const projectCashFlows = [-totalInvestment, ...equityCashFlows.slice(1).map((cf, index) => {
    return cf + Math.abs(debtResults.debtServiceByYear[index] || 0)
  })]
  const projectIRR = calculateIRR(projectCashFlows)
  
  // Calculate payback period
  const paybackPeriod = calculatePaybackPeriod(equityCashFlows)
  
  // Calculate average return on equity
  const equityAmount = costData.capex - debtResults.debtAmount
  const totalEquityReturns = equityCashFlows.slice(1).reduce((sum, cf) => sum + Math.max(0, cf), 0)
  const averageROE = equityAmount > 0 ? (totalEquityReturns / equityAmount) / equityCashFlows.length * 100 : 0
  
  return {
    equityIRR: equityIRR ? equityIRR * 100 : null,
    equityNPV,
    projectIRR: projectIRR ? projectIRR * 100 : null,
    paybackPeriod,
    averageROE
  }
}

const calculateNPV = (cashflows, discountRate) => {
  return cashflows.reduce((npv, cf, index) => {
    return npv + cf / Math.pow(1 + discountRate, index)
  }, 0)
}

const calculatePaybackPeriod = (cashflows) => {
  let cumulativeCF = 0
  
  for (let i = 0; i < cashflows.length; i++) {
    cumulativeCF += cashflows[i]
    if (cumulativeCF > 0) {
      return i
    }
  }
  
  return null
}

const createEmptyFinanceResult = (asset, assetCostData) => {
  return {
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: parseFloat(asset.capacity) || 0,
      error: 'No cash flows available'
    },
    capitalStructure: { totalCapex: assetCostData.capex },
    debtAnalysis: {},
    equityAnalysis: {},
    returns: {},
    operatingMetrics: {},
    cashFlowAnalysis: []
  }
}