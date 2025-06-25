// lib/enhancedProjectFinance.js
// Unified project finance calculations for enhanced backend

import { 
  DEFAULT_CAPEX_RATES, 
  DEFAULT_OPEX_RATES, 
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_TERMINAL_RATES,
  DEFAULT_ASSET_PERFORMANCE
} from '@/lib/default_constants'

/**
 * Initialize project finance values for assets in enhanced format
 */
export const initializeEnhancedProjectValues = (assets) => {
  const initialValues = Object.values(assets).reduce((acc, asset) => {
    const defaultCapex = DEFAULT_CAPEX_RATES[asset.type] || DEFAULT_CAPEX_RATES.default
    const defaultOpex = DEFAULT_OPEX_RATES[asset.type] || DEFAULT_OPEX_RATES.default
    const defaultTenor = DEFAULT_PROJECT_FINANCE.tenorYears[asset.type] || DEFAULT_PROJECT_FINANCE.tenorYears.default
    const defaultTerminal = DEFAULT_TERMINAL_RATES[asset.type] || DEFAULT_TERMINAL_RATES.default
    
    const capex = defaultCapex * asset.capacity
    const operatingCosts = defaultOpex * asset.capacity
    const terminalValue = defaultTerminal * asset.capacity

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
        constructionDuration: DEFAULT_ASSET_PERFORMANCE.constructionDuration[asset.type] || 12,
        
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
        dataVersion: '3.0'
      }
    }
    
  } catch (error) {
    console.error('Enhanced project finance calculation error:', error)
    throw error
  }
}

/**
 * Calculate project finance for individual asset
 */
const calculateAssetProjectFinance = async (asset, assetCostData, portfolioTimeSeries, constants) => {
  const assetStartYear = new Date(asset.assetStartDate).getFullYear()
  
  // Extract asset-specific cash flows from timeseries
  const assetCashFlows = extractAssetCashFlows(asset.name, portfolioTimeSeries, assetStartYear)
  
  if (assetCashFlows.length === 0) {
    console.warn(`No cash flows found for asset ${asset.name}`)
    return createEmptyFinanceResult(asset, assetCostData)
  }
  
  // Calculate enhanced debt metrics
  const debtResults = calculateEnhancedDebtMetrics(
    assetCashFlows,
    assetCostData,
    constants
  )
  
  // Calculate enhanced equity cash flows
  const equityCashFlows = calculateEnhancedEquityCashFlows(
    assetCostData,
    debtResults,
    assetCashFlows,
    assetStartYear
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
      calculationDate: new Date().toISOString()
    },
    
    capitalStructure: {
      totalCapex: assetCostData.capex,
      calculatedGearing: debtResults.optimalGearing,
      debtAmount: debtResults.debtAmount,
      equityAmount: assetCostData.capex - debtResults.debtAmount,
      debtToEquityRatio: debtResults.debtAmount / (assetCostData.capex - debtResults.debtAmount)
    },
    
    debtAnalysis: {
      structure: assetCostData.debtStructure,
      interestRate: assetCostData.interestRate * 100,
      tenorYears: assetCostData.tenorYears,
      averageDebtService: debtResults.averageDebtService,
      minDSCR: debtResults.minDSCR,
      debtServiceByYear: debtResults.debtServiceByYear,
      fullyRepaid: debtResults.fullyRepaid
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
    
    // Enhanced cash flow analysis
    cashFlowAnalysis: assetCashFlows.map((cf, index) => ({
      year: cf.year,
      yearIndex: index,
      revenue: cf.revenue,
      opex: cf.opex,
      operatingCashFlow: cf.operatingCashFlow,
      debtService: debtResults.debtServiceByYear[index] || 0,
      equityCashFlow: cf.operatingCashFlow - (debtResults.debtServiceByYear[index] || 0),
      dscr: debtResults.debtServiceByYear[index] ? cf.operatingCashFlow / debtResults.debtServiceByYear[index] : null,
      terminalValue: index === assetCashFlows.length - 1 ? assetCostData.terminalValue : 0
    }))
  }
}

/**
 * Calculate portfolio-level project finance
 */
const calculatePortfolioProjectFinance = async (assets, portfolioCostData, portfolioTimeSeries, assetFinanceResults, constants) => {
  // Calculate portfolio aggregates
  const portfolioAggregates = calculatePortfolioAggregates(assetFinanceResults)
  
  // Portfolio refinancing analysis
  const portfolioStartYear = Math.max(...Object.values(assets).map(asset => 
    new Date(asset.assetStartDate).getFullYear()
  ))
  
  // Extract portfolio cash flows
  const portfolioCashFlows = portfolioTimeSeries
    .filter(period => period.timeDimension.year >= portfolioStartYear)
    .map(period => ({
      year: period.timeDimension.year,
      revenue: period.portfolio.totalRevenue,
      operatingCashFlow: period.portfolio.totalRevenue * 0.85, // Assume 15% OPEX
      contractedPercentage: period.portfolio.contractedPercentage
    }))
  
  // Calculate portfolio debt metrics
  const portfolioDebtResults = calculateEnhancedDebtMetrics(
    portfolioCashFlows,
    portfolioCostData,
    constants
  )
  
  // Calculate portfolio equity cash flows
  const portfolioEquityCashFlows = calculateEnhancedEquityCashFlows(
    { ...portfolioCostData, capex: portfolioAggregates.totalCapex },
    portfolioDebtResults,
    portfolioCashFlows,
    portfolioStartYear
  )
  
  // Calculate portfolio financial metrics
  const portfolioFinancialMetrics = calculateEnhancedFinancialMetrics(
    portfolioEquityCashFlows,
    { ...portfolioCostData, capex: portfolioAggregates.totalCapex },
    portfolioDebtResults
  )
  
  return {
    portfolioMetadata: {
      portfolioStartYear,
      totalAssets: Object.keys(assets).length,
      refinancingStrategy: 'portfolio_level',
      calculationDate: new Date().toISOString()
    },
    
    aggregates: portfolioAggregates,
    
    capitalStructure: {
      totalCapex: portfolioAggregates.totalCapex,
      calculatedGearing: portfolioDebtResults.optimalGearing,
      portfolioDebtAmount: portfolioDebtResults.debtAmount,
      portfolioEquityAmount: portfolioAggregates.totalCapex - portfolioDebtResults.debtAmount,
      individualDebtAmount: portfolioAggregates.totalIndividualDebt
    },
    
    debtAnalysis: {
      structure: portfolioCostData.debtStructure,
      interestRate: portfolioCostData.interestRate * 100,
      tenorYears: portfolioCostData.tenorYears,
      averageDebtService: portfolioDebtResults.averageDebtService,
      minDSCR: portfolioDebtResults.minDSCR,
      refinancingBenefit: portfolioAggregates.totalIndividualDebt - portfolioDebtResults.debtAmount
    },
    
    returns: {
      portfolioEquityIRR: portfolioFinancialMetrics.equityIRR,
      portfolioEquityNPV: portfolioFinancialMetrics.equityNPV,
      weightedAverageAssetIRR: calculateWeightedAverageIRR(assetFinanceResults),
      refinancingUplift: portfolioFinancialMetrics.equityIRR - calculateWeightedAverageIRR(assetFinanceResults)
    },
    
    cashFlowAnalysis: portfolioCashFlows.map((cf, index) => ({
      year: cf.year,
      yearIndex: index,
      portfolioRevenue: cf.revenue,
      portfolioOperatingCF: cf.operatingCashFlow,
      portfolioDebtService: portfolioDebtResults.debtServiceByYear[index] || 0,
      portfolioEquityCF: cf.operatingCashFlow - (portfolioDebtResults.debtServiceByYear[index] || 0),
      portfolioDSCR: portfolioDebtResults.debtServiceByYear[index] ? 
        cf.operatingCashFlow / portfolioDebtResults.debtServiceByYear[index] : null
    }))
  }
}

/**
 * Calculate enhanced debt metrics with auto-solving
 */
const calculateEnhancedDebtMetrics = (cashFlows, costData, constants) => {
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
  const optimalDebtResult = solveOptimalDebt(
    cashFlows.slice(0, tenorYears),
    capex,
    maxGearing,
    interestRate,
    targetDSCRs
  )
  
  return {
    optimalGearing: optimalDebtResult.gearing,
    debtAmount: optimalDebtResult.debtAmount,
    averageDebtService: optimalDebtResult.averageDebtService,
    minDSCR: optimalDebtResult.minDSCR,
    debtServiceByYear: optimalDebtResult.debtServiceByYear,
    fullyRepaid: optimalDebtResult.fullyRepaid,
    iterations: optimalDebtResult.iterations
  }
}

/**
 * Solve for optimal debt using enhanced binary search
 */
const solveOptimalDebt = (cashFlows, capex, maxGearing, interestRate, targetDSCRs) => {
  const maxDebtAmount = capex * maxGearing
  
  let lowerBound = 0
  let upperBound = maxDebtAmount
  let bestResult = null
  
  const tolerance = 0.001 // $1k precision
  const maxIterations = 100
  let iterations = 0
  
  while (iterations < maxIterations && (upperBound - lowerBound) > tolerance) {
    const currentDebt = (lowerBound + upperBound) / 2
    
    const schedule = calculateDebtSchedule(currentDebt, cashFlows, interestRate, targetDSCRs)
    
    if (schedule.fullyRepaid && schedule.minDSCR >= Math.min(...targetDSCRs) * 0.95) {
      lowerBound = currentDebt
      bestResult = {
        debtAmount: currentDebt,
        gearing: currentDebt / capex,
        averageDebtService: schedule.averageDebtService,
        minDSCR: schedule.minDSCR,
        debtServiceByYear: schedule.debtService,
        fullyRepaid: schedule.fullyRepaid,
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
    const schedule = calculateDebtSchedule(conservativeDebt, cashFlows, interestRate, targetDSCRs)
    
    bestResult = {
      debtAmount: conservativeDebt,
      gearing: conservativeDebt / capex,
      averageDebtService: schedule.averageDebtService,
      minDSCR: schedule.minDSCR,
      debtServiceByYear: schedule.debtService,
      fullyRepaid: schedule.fullyRepaid,
      iterations
    }
  }
  
  return bestResult
}

/**
 * Calculate debt schedule with enhanced sculpting
 */
const calculateDebtSchedule = (debtAmount, cashFlows, interestRate, targetDSCRs) => {
  const tenorYears = cashFlows.length
  const debtBalance = Array(tenorYears + 1).fill(0)
  const interestPayments = Array(tenorYears).fill(0)
  const principalPayments = Array(tenorYears).fill(0)
  const debtService = Array(tenorYears).fill(0)
  const dscrValues = Array(tenorYears).fill(0)
  
  debtBalance[0] = debtAmount
  
  for (let i = 0; i < tenorYears; i++) {
    if (debtBalance[i] <= 0) break
    
    interestPayments[i] = debtBalance[i] * interestRate
    
    const operatingCashFlow = cashFlows[i].operatingCashFlow || 0
    const targetDSCR = targetDSCRs[i] || 1.5
    const maxDebtService = operatingCashFlow / targetDSCR
    
    principalPayments[i] = Math.min(
      Math.max(0, maxDebtService - interestPayments[i]),
      debtBalance[i]
    )
    
    debtService[i] = interestPayments[i] + principalPayments[i]
    dscrValues[i] = debtService[i] > 0 ? operatingCashFlow / debtService[i] : null
    
    debtBalance[i + 1] = Math.max(0, debtBalance[i] - principalPayments[i])
  }
  
  const fullyRepaid = debtBalance[tenorYears] < 0.001
  const averageDebtService = debtService.reduce((sum, ds) => sum + ds, 0) / tenorYears
  const minDSCR = Math.min(...dscrValues.filter(d => d !== null && isFinite(d)))
  
  return {
    debtBalance,
    interestPayments,
    principalPayments,
    debtService,
    dscrValues,
    fullyRepaid,
    averageDebtService,
    minDSCR
  }
}

/**
 * Calculate enhanced equity cash flows with construction timing
 */
const calculateEnhancedEquityCashFlows = (costData, debtResults, operationalCashFlows, assetStartYear) => {
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
    const equityCF = cf.operatingCashFlow - debtServiceThisYear
    
    // Add terminal value in final year
    if (index === operationalCashFlows.length - 1 && costData.terminalValue) {
      equityCashFlows.push(equityCF + costData.terminalValue)
    } else {
      equityCashFlows.push(equityCF)
    }
  })
  
  return equityCashFlows
}

/**
 * Calculate enhanced financial metrics
 */
const calculateEnhancedFinancialMetrics = (equityCashFlows, costData, debtResults) => {
  const equityIRR = calculateIRR(equityCashFlows)
  const equityNPV = calculateNPV(equityCashFlows, 0.12) // Assume 12% discount rate
  
  // Calculate project IRR (ungeared)
  const totalInvestment = costData.capex
  const projectCashFlows = [-totalInvestment, ...equityCashFlows.slice(1).map((cf, index) => {
    return cf + (debtResults.debtServiceByYear[index] || 0)
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

/**
 * Enhanced IRR calculation with better convergence
 */
const calculateIRR = (cashflows, guess = 0.1) => {
  if (!cashflows || cashflows.length < 2) return null
  if (cashflows[0] >= 0) return null
  
  const hasPositiveFlows = cashflows.slice(1).some(cf => cf > 0)
  if (!hasPositiveFlows) return null
  
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
    
    if (Math.abs(npv) < tolerance) return rate
    if (Math.abs(derivativeNPV) < tolerance) break
    
    const newRate = rate - npv / derivativeNPV
    if (newRate < -0.99 || newRate > 5.0) break
    
    rate = newRate
  }
  
  return null
}

/**
 * Calculate NPV
 */
const calculateNPV = (cashflows, discountRate) => {
  return cashflows.reduce((npv, cf, index) => {
    return npv + cf / Math.pow(1 + discountRate, index)
  }, 0)
}

/**
 * Calculate payback period
 */
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

/**
 * Helper functions
 */

const extractAssetCashFlows = (assetName, portfolioTimeSeries, assetStartYear) => {
  return portfolioTimeSeries
    .filter(period => period.timeDimension.year >= assetStartYear)
    .map(period => {
      const assetData = period.assets[assetName]
      if (!assetData) return null
      
      return {
        year: period.timeDimension.year,
        revenue: assetData.revenue.totalRevenue,
        opex: -0.15 * assetData.revenue.totalRevenue, // Assume 15% OPEX
        operatingCashFlow: assetData.revenue.totalRevenue * 0.85,
        contractedPercentage: assetData.contracts.contractedPercentages?.green + 
                            assetData.contracts.contractedPercentages?.energy || 0
      }
    })
    .filter(cf => cf !== null)
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

const calculatePortfolioAggregates = (assetFinanceResults) => {
  const aggregates = {
    totalCapex: 0,
    totalDebt: 0,
    totalEquity: 0,
    totalIndividualDebt: 0,
    weightedAverageGearing: 0,
    assetCount: 0
  }
  
  Object.values(assetFinanceResults).forEach(result => {
    if (result.capitalStructure) {
      aggregates.totalCapex += result.capitalStructure.totalCapex || 0
      aggregates.totalDebt += result.capitalStructure.debtAmount || 0
      aggregates.totalEquity += result.capitalStructure.equityAmount || 0
      aggregates.totalIndividualDebt += result.capitalStructure.debtAmount || 0
      aggregates.assetCount++
    }
  })
  
  aggregates.weightedAverageGearing = aggregates.totalCapex > 0 ? 
    aggregates.totalDebt / aggregates.totalCapex : 0
  
  return aggregates
}

const calculateWeightedAverageIRR = (assetFinanceResults) => {
  let totalCapex = 0
  let weightedIRR = 0
  
  Object.values(assetFinanceResults).forEach(result => {
    const capex = result.capitalStructure?.totalCapex || 0
    const irr = result.returns?.equityIRR || 0
    
    totalCapex += capex
    weightedIRR += capex * irr
  })
  
  return totalCapex > 0 ? weightedIRR / totalCapex : 0
}