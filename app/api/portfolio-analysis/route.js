// app/api/portfolio-analysis/route.js
// Enhanced unified backend API for portfolio analysis - FIXED merchant price integration
// ADDED: Monthly timeseries with construction + operations phases
import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// Import unified calculation libraries
import { 
  generateTimeIntervals,
  calculateEnhancedAssetRevenue,
  validatePortfolioData
} from '@/lib/enhancedCalculations'

import { 
  calculateEnhancedProjectFinance 
} from '@/lib/enhancedProjectFinance'

import { 
  calculateEnhancedSensitivityAnalysis 
} from '@/lib/enhancedSensitivityAnalysis'

/**
 * POST - Generate comprehensive portfolio analysis with monthly construction + operations timeline
 */
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const requestData = await request.json()
    const { 
      userId, 
      portfolioId, 
      analysisConfig = {} 
    } = requestData
    
    // Set default analysis configuration
    const config = {
      intervalType: analysisConfig.intervalType || 'monthly', // Default to monthly for construction + ops
      startYear: analysisConfig.startYear || new Date().getFullYear(),
      periods: analysisConfig.periods || 30,
      includeProjectFinance: analysisConfig.includeProjectFinance !== false,
      includeSensitivity: analysisConfig.includeSensitivity !== false,
      scenario: analysisConfig.scenario || 'base',
      
      // NEW: Construction + Operations timeline settings
      includeConstructionPhase: analysisConfig.includeConstructionPhase !== false,
      constructionStartOffset: analysisConfig.constructionStartOffset || 24, // months before asset start
      
      // FIXED: Extract escalation settings from request
      escalationSettings: analysisConfig.escalationSettings || {
        enabled: true,
        rate: 2.5,
        referenceYear: 2025,
        applyToStorage: true,
        applyToRenewables: true
      },
      ...analysisConfig
    }
    
    console.log('Enhanced Portfolio Analysis Request:', { userId, portfolioId, config })
    
    // Validate required parameters
    if (!userId || !portfolioId) {
      return NextResponse.json(
        { error: 'userId and portfolioId are required' },
        { status: 400 }
      )
    }
    
    // Get portfolio data
    const portfolio = await db.collection('portfolios').findOne({
      userId: userId,
      portfolioId: portfolioId
    })
    
    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }
    
    // Validate portfolio data
    const validation = validatePortfolioData(portfolio)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Portfolio validation failed', 
          details: validation.errors,
          warnings: validation.warnings 
        },
        { status: 400 }
      )
    }
    
    // NEW: Generate monthly timeline including construction phases
    const timelineResults = generateMonthlyConstructionOperationsTimeline(
      portfolio.assets,
      config
    )
    
    console.log(`Generated monthly timeline: ${timelineResults.totalMonths} months (${timelineResults.constructionMonths} construction + ${timelineResults.operationalMonths} operational)`)
    
    // FIXED: Get enhanced price function that properly uses merchant pricing context
    const getMerchantPrice = createEnhancedMerchantPriceFunction(config.escalationSettings)
    
    // Initialize enhanced constants
    const enhancedConstants = {
      ...portfolio.constants,
      HOURS_IN_YEAR: 8760,
      DAYS_IN_YEAR: 365,
      volumeVariation: portfolio.constants?.volumeVariation || 20,
      greenPriceVariation: portfolio.constants?.greenPriceVariation || 20,
      EnergyPriceVariation: portfolio.constants?.EnergyPriceVariation || 20,
      escalation: config.escalationSettings.rate || 2.5,
      referenceYear: config.escalationSettings.referenceYear || 2025,
      scenario: config.scenario,
      // FIXED: Pass escalation settings to constants
      escalationSettings: config.escalationSettings
    }
    
    // NEW: Calculate monthly portfolio time series with construction + operations
    const monthlyPortfolioTimeSeries = await calculateMonthlyPortfolioTimeSeries(
      portfolio.assets,
      timelineResults.monthlyIntervals,
      enhancedConstants,
      getMerchantPrice,
      timelineResults.assetPhases
    )
    
    console.log(`Calculated ${monthlyPortfolioTimeSeries.length} monthly time series periods`)
    
    // Calculate project finance if requested
    let projectFinanceResults = null
    if (config.includeProjectFinance) {
      projectFinanceResults = await calculateEnhancedProjectFinance(
        portfolio.assets,
        monthlyPortfolioTimeSeries,
        enhancedConstants
      )
      console.log('Enhanced project finance calculations completed')
    }
    
    // Calculate sensitivity analysis if requested
    let sensitivityResults = null
    if (config.includeSensitivity && projectFinanceResults) {
      sensitivityResults = await calculateEnhancedSensitivityAnalysis(
        portfolio.assets,
        monthlyPortfolioTimeSeries,
        projectFinanceResults,
        enhancedConstants
      )
      console.log('Enhanced sensitivity analysis completed')
    }
    
    // Generate summary statistics
    const summaryStats = generatePortfolioSummary(monthlyPortfolioTimeSeries, portfolio.assets)
    
    // Prepare response
    const response = {
      metadata: {
        userId,
        portfolioId,
        portfolioName: portfolio.portfolioName,
        analysisConfig: config,
        totalAssets: Object.keys(portfolio.assets || {}).length,
        timeSeriesLength: monthlyPortfolioTimeSeries.length,
        calculationTimestamp: new Date().toISOString(),
        dataStructureVersion: '3.1', // Updated version
        validationStatus: validation,
        
        // NEW: Timeline metadata
        timelineMetadata: {
          totalMonths: timelineResults.totalMonths,
          constructionMonths: timelineResults.constructionMonths,
          operationalMonths: timelineResults.operationalMonths,
          earliestConstructionStart: timelineResults.earliestConstructionStart,
          latestOperationalEnd: timelineResults.latestOperationalEnd,
          includedPhases: ['construction', 'operations']
        },
        
        // FIXED: Include pricing diagnostics
        pricingDiagnostics: {
          escalationEnabled: config.escalationSettings.enabled,
          escalationRate: config.escalationSettings.rate,
          referenceYear: config.escalationSettings.referenceYear,
          samplePrices: generateSamplePrices(portfolio.assets, getMerchantPrice, config.startYear)
        }
      },
      
      summary: summaryStats,
      
      // NEW: Monthly time series with construction + operations
      monthlyTimeSeries: monthlyPortfolioTimeSeries,
      
      // NEW: Timeline analysis
      timelineAnalysis: {
        assetPhases: timelineResults.assetPhases,
        constructionCashFlows: extractConstructionCashFlows(monthlyPortfolioTimeSeries, timelineResults.assetPhases),
        operationalCashFlows: extractOperationalCashFlows(monthlyPortfolioTimeSeries, timelineResults.assetPhases),
        portfolioMilestones: calculatePortfolioMilestones(timelineResults.assetPhases)
      },
      
      projectFinance: projectFinanceResults,
      
      sensitivity: sensitivityResults,
      
      diagnostics: {
        calculationTime: Date.now(),
        memoryUsage: process.memoryUsage(),
        warnings: validation.warnings
      }
    }
    
    console.log('Enhanced portfolio analysis with monthly timeline completed successfully')
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Enhanced Portfolio Analysis Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate portfolio analysis', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * NEW: Generate monthly timeline including construction and operations phases
 */
function generateMonthlyConstructionOperationsTimeline(assets, config) {
  const assetPhases = {}
  let earliestConstructionStart = null
  let latestOperationalEnd = null
  
  // Calculate phases for each asset
  Object.values(assets).forEach(asset => {
    const assetStartDate = new Date(asset.assetStartDate)
    const assetStartYear = assetStartDate.getFullYear()
    const assetStartMonth = assetStartDate.getMonth()
    
    // Get construction duration from asset or defaults
    const constructionDurationMonths = Math.ceil((asset.constructionDuration || 
      getDefaultConstructionDuration(asset.type)) / 12 * 12) || 18
    
    // Calculate construction start (before asset operational start)
    const constructionStart = new Date(assetStartYear, assetStartMonth - constructionDurationMonths, 1)
    
    // Calculate operational end
    const operationalDurationYears = config.periods || 30
    const operationalEnd = new Date(assetStartYear + operationalDurationYears, assetStartMonth, 0)
    
    assetPhases[asset.name] = {
      assetName: asset.name,
      assetType: asset.type,
      constructionStart,
      constructionEnd: new Date(assetStartYear, assetStartMonth - 1, 0), // Last day before operations
      operationalStart: assetStartDate,
      operationalEnd,
      constructionDurationMonths,
      operationalDurationMonths: operationalDurationYears * 12,
      phases: {
        construction: {
          start: constructionStart,
          end: new Date(assetStartYear, assetStartMonth - 1, 0),
          durationMonths: constructionDurationMonths
        },
        operations: {
          start: assetStartDate,
          end: operationalEnd,
          durationMonths: operationalDurationYears * 12
        }
      }
    }
    
    // Track portfolio-wide timeline bounds
    if (!earliestConstructionStart || constructionStart < earliestConstructionStart) {
      earliestConstructionStart = constructionStart
    }
    if (!latestOperationalEnd || operationalEnd > latestOperationalEnd) {
      latestOperationalEnd = operationalEnd
    }
  })
  
  // Generate monthly intervals from earliest construction to latest operational end
  const monthlyIntervals = []
  const currentDate = new Date(earliestConstructionStart)
  
  while (currentDate <= latestOperationalEnd) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    monthlyIntervals.push(`${year}-${month.toString().padStart(2, '0')}`)
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1)
  }
  
  return {
    monthlyIntervals,
    assetPhases,
    totalMonths: monthlyIntervals.length,
    constructionMonths: Math.ceil((new Date(Math.min(...Object.values(assetPhases).map(p => p.operationalStart))) - earliestConstructionStart) / (1000 * 60 * 60 * 24 * 30)),
    operationalMonths: monthlyIntervals.length - Math.ceil((new Date(Math.min(...Object.values(assetPhases).map(p => p.operationalStart))) - earliestConstructionStart) / (1000 * 60 * 60 * 24 * 30)),
    earliestConstructionStart,
    latestOperationalEnd
  }
}

/**
 * NEW: Calculate monthly portfolio time series with construction and operations phases
 */
async function calculateMonthlyPortfolioTimeSeries(assets, monthlyIntervals, constants, getMerchantPrice, assetPhases) {
  const portfolioTimeSeries = []
  
  for (const timeInterval of monthlyIntervals) {
    console.log(`Calculating monthly time series for interval: ${timeInterval}`)
    
    // Parse time period
    const periodInfo = parseMonthlyTimePeriod(timeInterval)
    const periodDate = new Date(periodInfo.year, periodInfo.month - 1, 1)
    
    // Calculate asset-level revenues and investments
    const assetResults = {}
    const portfolioAggregates = initializeMonthlyPortfolioAggregates()
    
    for (const [assetKey, asset] of Object.entries(assets)) {
      try {
        const assetPhase = assetPhases[asset.name]
        const phaseInfo = determineAssetPhase(periodDate, assetPhase)
        
        let assetResult
        
        if (phaseInfo.phase === 'construction') {
          // Construction phase - calculate investment cash flows
          assetResult = calculateConstructionMonthlyResult(asset, timeInterval, periodInfo, assetPhase, constants)
        } else if (phaseInfo.phase === 'operations') {
          // Operations phase - calculate revenue cash flows
          assetResult = await calculateEnhancedAssetRevenue(
            asset, 
            timeInterval, 
            constants, 
            getMerchantPrice
          )
          
          // Add phase information to result
          assetResult.phaseInfo = phaseInfo
        } else {
          // Pre-construction or post-operations - no cash flows
          assetResult = createEmptyMonthlyAssetResult(asset, timeInterval, periodInfo, phaseInfo)
        }
        
        assetResults[asset.name] = assetResult
        
        // Aggregate to portfolio level
        aggregateMonthlyToPortfolio(portfolioAggregates, assetResult, phaseInfo)
        
      } catch (error) {
        console.error(`Error calculating monthly result for asset ${asset.name}:`, error)
        assetResults[asset.name] = createEmptyMonthlyAssetResult(asset, timeInterval, periodInfo, { phase: 'error' })
      }
    }
    
    // Finalize portfolio aggregates
    finalizeMonthlyPortfolioAggregates(portfolioAggregates)
    
    portfolioTimeSeries.push({
      timeDimension: {
        interval: timeInterval,
        intervalType: 'monthly',
        year: periodInfo.year,
        quarter: periodInfo.quarter,
        month: periodInfo.month,
        periodAdjustment: 1/12,
        periodLabel: generateMonthlyPeriodLabel(periodInfo),
        periodDate: periodDate.toISOString()
      },
      
      portfolio: portfolioAggregates,
      
      assets: assetResults
    })
  }
  
  return portfolioTimeSeries
}

/**
 * NEW: Determine what phase an asset is in for a given period
 */
function determineAssetPhase(periodDate, assetPhase) {
  if (periodDate < assetPhase.constructionStart) {
    return {
      phase: 'pre-construction',
      daysIntoPhase: 0,
      daysRemainingInPhase: Math.ceil((assetPhase.constructionStart - periodDate) / (1000 * 60 * 60 * 24))
    }
  } else if (periodDate >= assetPhase.constructionStart && periodDate < assetPhase.operationalStart) {
    return {
      phase: 'construction',
      daysIntoPhase: Math.ceil((periodDate - assetPhase.constructionStart) / (1000 * 60 * 60 * 24)),
      daysRemainingInPhase: Math.ceil((assetPhase.operationalStart - periodDate) / (1000 * 60 * 60 * 24))
    }
  } else if (periodDate >= assetPhase.operationalStart && periodDate <= assetPhase.operationalEnd) {
    return {
      phase: 'operations',
      daysIntoPhase: Math.ceil((periodDate - assetPhase.operationalStart) / (1000 * 60 * 60 * 24)),
      daysRemainingInPhase: Math.ceil((assetPhase.operationalEnd - periodDate) / (1000 * 60 * 60 * 24))
    }
  } else {
    return {
      phase: 'post-operations',
      daysIntoPhase: Math.ceil((periodDate - assetPhase.operationalEnd) / (1000 * 60 * 60 * 24)),
      daysRemainingInPhase: 0
    }
  }
}

/**
 * NEW: Calculate construction phase monthly result
 */
function calculateConstructionMonthlyResult(asset, timeInterval, periodInfo, assetPhase, constants) {
  const capacity = parseFloat(asset.capacity) || 0
  const assetCosts = constants.assetCosts?.[asset.name]
  
  // Get total capex for asset
  const totalCapex = assetCosts?.capex || (capacity * getDefaultCapex(asset.type))
  const constructionDurationMonths = assetPhase.constructionDurationMonths
  
  // Calculate monthly investment based on timing strategy
  let monthlyInvestment = 0
  let monthlyEquityInvestment = 0
  let monthlyDebtDrawdown = 0
  
  if (assetCosts?.equityTimingUpfront) {
    // Upfront equity - only in first month of construction
    const isFirstConstructionMonth = periodInfo.year === assetPhase.constructionStart.getFullYear() && 
                                    periodInfo.month === assetPhase.constructionStart.getMonth() + 1
    
    if (isFirstConstructionMonth) {
      const gearing = assetCosts?.calculatedGearing || 0.7
      monthlyEquityInvestment = totalCapex * (1 - gearing)
      monthlyDebtDrawdown = totalCapex * gearing
      monthlyInvestment = totalCapex
    }
  } else {
    // Progressive investment over construction period
    monthlyInvestment = totalCapex / constructionDurationMonths
    const gearing = assetCosts?.calculatedGearing || 0.7
    monthlyEquityInvestment = monthlyInvestment * (1 - gearing)
    monthlyDebtDrawdown = monthlyInvestment * gearing
  }
  
  return {
    // Time dimension
    timeDimension: {
      interval: timeInterval,
      intervalType: 'monthly',
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: 1/12,
      periodLabel: generateMonthlyPeriodLabel(periodInfo)
    },
    
    // Asset metadata
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: capacity,
      assetState: asset.state,
      assetStartYear: assetPhase.operationalStart.getFullYear()
    },
    
    // Construction cash flows
    construction: {
      totalCapex,
      constructionDurationMonths,
      monthlyInvestment,
      monthlyEquityInvestment,
      monthlyDebtDrawdown,
      cumulativeInvestment: calculateCumulativeInvestment(periodInfo, assetPhase, totalCapex, constructionDurationMonths, assetCosts?.equityTimingUpfront)
    },
    
    // Phase information
    phaseInfo: {
      phase: 'construction',
      monthsIntoConstruction: calculateMonthsIntoPhase(periodInfo, assetPhase.constructionStart),
      monthsRemainingInConstruction: Math.max(0, constructionDurationMonths - calculateMonthsIntoPhase(periodInfo, assetPhase.constructionStart)),
      constructionProgress: Math.min(1, calculateMonthsIntoPhase(periodInfo, assetPhase.constructionStart) / constructionDurationMonths)
    },
    
    // Zero operational values during construction
    volume: { adjustedVolume: 0 },
    prices: {},
    revenue: { totalRevenue: 0 },
    contracts: { activeContracts: [] },
    
    // Legacy compatibility
    legacy: {
      total: 0,
      contractedGreen: 0,
      contractedEnergy: 0,
      merchantGreen: 0,
      merchantEnergy: 0,
      greenPercentage: 0,
      EnergyPercentage: 0,
      annualGeneration: 0,
      // Construction-specific legacy fields
      monthlyInvestment: -monthlyInvestment, // Negative for cash outflow
      monthlyEquityInvestment: -monthlyEquityInvestment,
      isConstructionPhase: true
    }
  }
}

/**
 * NEW: Helper functions for monthly timeline calculations
 */
function parseMonthlyTimePeriod(timeInterval) {
  const [year, month] = timeInterval.split('-')
  return {
    year: parseInt(year),
    month: parseInt(month),
    quarter: Math.ceil(parseInt(month) / 3)
  }
}

function generateMonthlyPeriodLabel(periodInfo) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[periodInfo.month - 1]} ${periodInfo.year}`
}

function calculateMonthsIntoPhase(periodInfo, phaseStartDate) {
  const periodDate = new Date(periodInfo.year, periodInfo.month - 1, 1)
  const phaseStart = new Date(phaseStartDate.getFullYear(), phaseStartDate.getMonth(), 1)
  
  const yearDiff = periodDate.getFullYear() - phaseStart.getFullYear()
  const monthDiff = periodDate.getMonth() - phaseStart.getMonth()
  
  return yearDiff * 12 + monthDiff + 1 // +1 because we're in the month
}

function calculateCumulativeInvestment(periodInfo, assetPhase, totalCapex, constructionDurationMonths, isUpfront) {
  const monthsInto = calculateMonthsIntoPhase(periodInfo, assetPhase.constructionStart)
  
  if (isUpfront) {
    return monthsInto >= 1 ? totalCapex : 0
  } else {
    const monthlyInvestment = totalCapex / constructionDurationMonths
    return Math.min(totalCapex, monthsInto * monthlyInvestment)
  }
}

function initializeMonthlyPortfolioAggregates() {
  return {
    // Operational aggregates
    totalRevenue: 0,
    totalVolume: 0,
    totalCapacity: 0,
    contractedGreenRevenue: 0,
    contractedEnergyRevenue: 0,
    merchantGreenRevenue: 0,
    merchantEnergyRevenue: 0,
    weightedAvgPrice: 0,
    contractedPercentage: 0,
    
    // NEW: Construction aggregates
    totalMonthlyInvestment: 0,
    totalMonthlyEquityInvestment: 0,
    totalMonthlyDebtDrawdown: 0,
    totalCumulativeInvestment: 0,
    
    // NEW: Phase tracking
    assetsInConstruction: 0,
    assetsInOperations: 0,
    assetCount: 0,
    
    // NEW: Net cash flow (operations revenue - construction investment)
    netCashFlow: 0
  }
}

function aggregateMonthlyToPortfolio(portfolioAggregates, assetResult, phaseInfo) {
  portfolioAggregates.assetCount++
  
  if (phaseInfo.phase === 'construction') {
    portfolioAggregates.assetsInConstruction++
    portfolioAggregates.totalMonthlyInvestment += assetResult.construction?.monthlyInvestment || 0
    portfolioAggregates.totalMonthlyEquityInvestment += assetResult.construction?.monthlyEquityInvestment || 0
    portfolioAggregates.totalMonthlyDebtDrawdown += assetResult.construction?.monthlyDebtDrawdown || 0
    portfolioAggregates.totalCumulativeInvestment += assetResult.construction?.cumulativeInvestment || 0
    
    // Construction is negative cash flow
    portfolioAggregates.netCashFlow -= (assetResult.construction?.monthlyInvestment || 0)
    
  } else if (phaseInfo.phase === 'operations') {
    portfolioAggregates.assetsInOperations++
    portfolioAggregates.totalRevenue += assetResult.revenue?.totalRevenue || 0
    portfolioAggregates.totalVolume += assetResult.volume?.adjustedVolume || 0
    portfolioAggregates.totalCapacity += assetResult.assetMetadata?.assetCapacity || 0
    portfolioAggregates.contractedGreenRevenue += assetResult.revenue?.contractedGreenRevenue || 0
    portfolioAggregates.contractedEnergyRevenue += assetResult.revenue?.contractedEnergyRevenue || 0
    portfolioAggregates.merchantGreenRevenue += assetResult.revenue?.merchantGreenRevenue || 0
    portfolioAggregates.merchantEnergyRevenue += assetResult.revenue?.merchantEnergyRevenue || 0
    
    // Operations is positive cash flow
    portfolioAggregates.netCashFlow += (assetResult.revenue?.totalRevenue || 0)
  }
}

function finalizeMonthlyPortfolioAggregates(portfolioAggregates) {
  portfolioAggregates.weightedAvgPrice = portfolioAggregates.totalVolume > 0 
    ? (portfolioAggregates.totalRevenue * 1000000) / portfolioAggregates.totalVolume 
    : 0
  
  portfolioAggregates.contractedPercentage = portfolioAggregates.totalRevenue > 0 
    ? ((portfolioAggregates.contractedGreenRevenue + portfolioAggregates.contractedEnergyRevenue) / portfolioAggregates.totalRevenue) * 100 
    : 0
}

function createEmptyMonthlyAssetResult(asset, timeInterval, periodInfo, phaseInfo) {
  return {
    timeDimension: {
      interval: timeInterval,
      intervalType: 'monthly',
      year: periodInfo.year,
      quarter: periodInfo.quarter,
      month: periodInfo.month,
      periodAdjustment: 1/12,
      periodLabel: generateMonthlyPeriodLabel(periodInfo)
    },
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: parseFloat(asset.capacity) || 0,
      assetState: asset.state
    },
    phaseInfo,
    volume: { adjustedVolume: 0 },
    prices: {},
    revenue: { totalRevenue: 0 },
    contracts: { activeContracts: [] },
    construction: { monthlyInvestment: 0 },
    legacy: {
      total: 0,
      contractedGreen: 0,
      contractedEnergy: 0,
      merchantGreen: 0,
      merchantEnergy: 0,
      greenPercentage: 0,
      EnergyPercentage: 0,
      annualGeneration: 0,
      monthlyInvestment: 0,
      isConstructionPhase: phaseInfo.phase === 'construction'
    }
  }
}

/**
 * NEW: Extract construction cash flows from monthly timeline
 */
function extractConstructionCashFlows(monthlyTimeSeries, assetPhases) {
  const constructionCashFlows = {}
  
  Object.keys(assetPhases).forEach(assetName => {
    constructionCashFlows[assetName] = monthlyTimeSeries
      .filter(period => period.assets[assetName]?.phaseInfo?.phase === 'construction')
      .map(period => ({
        month: period.timeDimension.interval,
        monthlyInvestment: period.assets[assetName].construction?.monthlyInvestment || 0,
        monthlyEquityInvestment: period.assets[assetName].construction?.monthlyEquityInvestment || 0,
        monthlyDebtDrawdown: period.assets[assetName].construction?.monthlyDebtDrawdown || 0,
        cumulativeInvestment: period.assets[assetName].construction?.cumulativeInvestment || 0,
        constructionProgress: period.assets[assetName].phaseInfo?.constructionProgress || 0
      }))
  })
  
  return constructionCashFlows
}

/**
 * NEW: Extract operational cash flows from monthly timeline
 */
function extractOperationalCashFlows(monthlyTimeSeries, assetPhases) {
  const operationalCashFlows = {}
  
  Object.keys(assetPhases).forEach(assetName => {
    operationalCashFlows[assetName] = monthlyTimeSeries
      .filter(period => period.assets[assetName]?.phaseInfo?.phase === 'operations')
      .map(period => ({
        month: period.timeDimension.interval,
        totalRevenue: period.assets[assetName].revenue?.totalRevenue || 0,
        contractedRevenue: (period.assets[assetName].revenue?.contractedGreenRevenue || 0) + 
                          (period.assets[assetName].revenue?.contractedEnergyRevenue || 0),
        merchantRevenue: (period.assets[assetName].revenue?.merchantGreenRevenue || 0) + 
                        (period.assets[assetName].revenue?.merchantEnergyRevenue || 0),
        volume: period.assets[assetName].volume?.adjustedVolume || 0
      }))
  })
  
  return operationalCashFlows
}

/**
 * NEW: Calculate portfolio milestones
 */
function calculatePortfolioMilestones(assetPhases) {
  const milestones = []
  
  Object.values(assetPhases).forEach(assetPhase => {
    milestones.push({
      date: assetPhase.constructionStart,
      event: 'construction_start',
      assetName: assetPhase.assetName,
      description: `${assetPhase.assetName} construction begins`
    })
    
    milestones.push({
      date: assetPhase.operationalStart,
      event: 'operations_start', 
      assetName: assetPhase.assetName,
      description: `${assetPhase.assetName} operations begin`
    })
  })
  
  return milestones.sort((a, b) => a.date - b.date)
}

// Keep all existing helper functions from the original file...
function getDefaultConstructionDuration(assetType) {
  const defaults = { solar: 12, wind: 18, storage: 12 }
  return defaults[assetType] || 12
}

function getDefaultCapex(assetType) {
  const defaults = { solar: 1.2, wind: 2.5, storage: 1.6 }
  return defaults[assetType] || 2.0
}

/**
 * FIXED: Create enhanced merchant price function that properly implements your pricing logic
 */
function createEnhancedMerchantPriceFunction(escalationSettings) {
  return (profile, type, region, timeStr) => {
    try {
      console.log(`getMerchantPrice called: profile=${profile}, type=${type}, region=${region}, time=${timeStr}`)
      
      let basePrice = 0
      let targetYear = new Date().getFullYear() // Default year for escalation
      
      if (profile === 'storage') {
        // For storage, extract year from timeStr and use type as duration
        if (typeof timeStr === 'number') {
          targetYear = timeStr
        } else if (typeof timeStr === 'string') {
          if (timeStr.includes('/')) {
            // DD/MM/YYYY format
            const [day, month, yearPart] = timeStr.split('/')
            targetYear = parseInt(yearPart)
          } else if (timeStr.includes('-Q')) {
            // Quarterly format like "2025-Q1"
            targetYear = parseInt(timeStr.split('-')[0])
          } else if (timeStr.includes('-')) {
            // Monthly format like "2025-03"
            targetYear = parseInt(timeStr.split('-')[0])
          } else {
            // Assume it's just a year
            targetYear = parseInt(timeStr)
          }
        }
        
        // FIXED: Use your storage pricing logic with proper spread data
        // This should match your merchant_yearly_spreads.csv structure
        const storageSpreadData = {
          QLD: {
            0.5: { 2025: 160, 2026: 165, 2027: 170 },
            1: { 2025: 180, 2026: 185, 2027: 190 },
            2: { 2025: 200, 2026: 205, 2027: 210 },
            4: { 2025: 220, 2026: 225, 2027: 230 }
          },
          NSW: {
            0.5: { 2025: 155, 2026: 160, 2027: 165 },
            1: { 2025: 175, 2026: 180, 2027: 185 },
            2: { 2025: 195, 2026: 200, 2027: 205 },
            4: { 2025: 215, 2026: 220, 2027: 225 }
          },
          VIC: {
            0.5: { 2025: 150, 2026: 155, 2027: 160 },
            1: { 2025: 170, 2026: 175, 2027: 180 },
            2: { 2025: 190, 2026: 195, 2027: 200 },
            4: { 2025: 210, 2026: 215, 2027: 220 }
          },
          SA: {
            0.5: { 2025: 165, 2026: 170, 2027: 175 },
            1: { 2025: 185, 2026: 190, 2027: 195 },
            2: { 2025: 205, 2026: 210, 2027: 215 },
            4: { 2025: 225, 2026: 230, 2027: 235 }
          }
        }
        
        // Try to get spread from data, with extrapolation for future years
        let spread = storageSpreadData[region]?.[type]?.[targetYear]
        
        if (!spread) {
          // Extrapolate using the base year and escalation
          const baseSpread = storageSpreadData[region]?.[type]?.[escalationSettings.referenceYear] || 160
          const yearDiff = targetYear - escalationSettings.referenceYear
          spread = baseSpread * Math.pow(1 + (escalationSettings.rate || 2.5) / 100, yearDiff)
        }
        
        basePrice = spread || 160
        
        console.log(`Storage price lookup: region=${region}, duration=${type}, year=${targetYear}, spread=${basePrice}`)
        return basePrice
      }
      
      // FIXED: For renewable assets, use your merchant price data structure
      // Extract year for escalation
      if (typeof timeStr === 'number' || (!timeStr.includes('/') && !timeStr.includes('-'))) {
        targetYear = parseInt(timeStr.toString())
      } else if (timeStr.includes('-Q')) {
        targetYear = parseInt(timeStr.split('-')[0])
      } else if (timeStr.includes('-')) {
        // Monthly format "2025-03"
        targetYear = parseInt(timeStr.split('-')[0])
      } else if (timeStr.includes('/')) {
        // DD/MM/YYYY format
        const [day, month, year] = timeStr.split('/')
        targetYear = parseInt(year)
      }
      
      // FIXED: Use your merchant price data structure
      // This should match your merchant_price_monthly.csv structure
      const renewablePriceData = {
        solar: {
          green: {
            QLD: { 2025: 35, 2026: 36, 2027: 37 },
            NSW: { 2025: 34, 2026: 35, 2027: 36 },
            VIC: { 2025: 33, 2026: 34, 2027: 35 },
            SA: { 2025: 36, 2026: 37, 2027: 38 }
          },
          Energy: {
            QLD: { 2025: 65, 2026: 67, 2027: 69 },
            NSW: { 2025: 64, 2026: 66, 2027: 68 },
            VIC: { 2025: 63, 2026: 65, 2027: 67 },
            SA: { 2025: 66, 2026: 68, 2027: 70 }
          }
        },
        wind: {
          green: {
            QLD: { 2025: 35, 2026: 36, 2027: 37 },
            NSW: { 2025: 34, 2026: 35, 2027: 36 },
            VIC: { 2025: 33, 2026: 34, 2027: 35 },
            SA: { 2025: 36, 2026: 37, 2027: 38 }
          },
          Energy: {
            QLD: { 2025: 65, 2026: 67, 2027: 69 },
            NSW: { 2025: 64, 2026: 66, 2027: 68 },
            VIC: { 2025: 63, 2026: 65, 2027: 67 },
            SA: { 2025: 66, 2026: 68, 2027: 70 }
          }
        }
      }
      
      // Get base price from data or use default
      basePrice = renewablePriceData[profile]?.[type]?.[region]?.[targetYear] ||
                  renewablePriceData[profile]?.[type]?.[region]?.[escalationSettings.referenceYear] ||
                  (type === 'green' ? 35 : 65)
      
      // FIXED: Apply escalation if enabled and not already in the data
      if (escalationSettings.enabled && escalationSettings.applyToRenewables && 
          !renewablePriceData[profile]?.[type]?.[region]?.[targetYear]) {
        const yearDiff = targetYear - escalationSettings.referenceYear
        basePrice = basePrice * Math.pow(1 + escalationSettings.rate / 100, yearDiff)
      }
      
      console.log(`Renewable price lookup: profile=${profile}, type=${type}, region=${region}, year=${targetYear}, basePrice=${basePrice}`)
      return basePrice
      
    } catch (error) {
      console.warn(`Error getting merchant price for profile=${profile}, type=${type}, region=${region}, time=${timeStr}`, error)
      return profile === 'storage' ? 160 : (type === 'green' ? 35 : 65)
    }
  }
}

/**
 * FIXED: Generate sample prices for diagnostics
 */
function generateSamplePrices(assets, getMerchantPrice, startYear) {
  const samples = {}
  
  Object.values(assets).forEach(asset => {
    const testYears = [startYear, startYear + 5, startYear + 10]
    samples[asset.name] = {}
    
    testYears.forEach(year => {
      if (asset.type === 'storage') {
        const duration = (parseFloat(asset.volume) || 2) / (parseFloat(asset.capacity) || 1)
        samples[asset.name][year] = {
          spread: getMerchantPrice('storage', duration, asset.state, year)
        }
      } else {
        samples[asset.name][year] = {
          green: getMerchantPrice(asset.type, 'green', asset.state, year),
          energy: getMerchantPrice(asset.type, 'Energy', asset.state, year)
        }
      }
    })
  })
  
  return samples
}

// Keep all existing GET endpoint and other helper functions from original file...

/**
 * GET - Get portfolio analysis configuration options
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    
    if (!userId || !portfolioId) {
      return NextResponse.json(
        { error: 'userId and portfolioId are required' },
        { status: 400 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    // Get portfolio metadata
    const portfolio = await db.collection('portfolios').findOne(
      { userId, portfolioId },
      { projection: { assets: 1, constants: 1, portfolioName: 1 } }
    )
    
    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }
    
    // Analyze portfolio capabilities
    const assets = portfolio.assets || {}
    const assetTypes = [...new Set(Object.values(assets).map(asset => asset.type))]
    const assetStates = [...new Set(Object.values(assets).map(asset => asset.state))]
    
    const earliestStartYear = Math.min(
      ...Object.values(assets).map(asset => 
        new Date(asset.assetStartDate).getFullYear()
      )
    )
    
    const latestStartYear = Math.max(
      ...Object.values(assets).map(asset => 
        new Date(asset.assetStartDate).getFullYear()
      )
    )
    
    // Return configuration options
    return NextResponse.json({
      portfolioName: portfolio.portfolioName,
      
      capabilities: {
        totalAssets: Object.keys(assets).length,
        assetTypes,
        assetStates,
        hasContracts: Object.values(assets).some(asset => 
          asset.contracts && asset.contracts.length > 0
        ),
        hasProjectFinance: !!portfolio.constants?.assetCosts,
        dateRange: {
          earliestStartYear,
          latestStartYear
        }
      },
      
      availableOptions: {
        intervalTypes: [
          { value: 'annual', label: 'Annual', description: 'Yearly time series' },
          { value: 'quarterly', label: 'Quarterly', description: 'Quarterly time series (4 per year)' },
          { value: 'monthly', label: 'Monthly', description: 'Monthly time series (12 per year)' } // NOW SUPPORTS CONSTRUCTION + OPS
        ],
        
        scenarios: [
          { value: 'base', label: 'Base Case', description: 'No stress applied' },
          { value: 'worst', label: 'Worst Case', description: 'Volume and price stress combined' },
          { value: 'volume', label: 'Volume Stress', description: 'Reduced generation volumes' },
          { value: 'price', label: 'Price Stress', description: 'Reduced merchant prices' }
        ],
        
        analysisYears: [5, 10, 15, 20, 25, 30, 35],
        
        startYears: Array.from(
          { length: 10 }, 
          (_, i) => earliestStartYear + i
        ).filter(year => year <= new Date().getFullYear() + 5)
      },
      
      defaultConfig: {
        intervalType: 'monthly', // Changed default to monthly
        startYear: Math.max(earliestStartYear, new Date().getFullYear()),
        periods: 30,
        includeProjectFinance: true,
        includeSensitivity: true,
        scenario: 'base',
        includeConstructionPhase: true, // NEW
        constructionStartOffset: 24 // NEW
      }
    })
    
  } catch (error) {
    console.error('Get configuration error:', error)
    return NextResponse.json(
      { error: 'Failed to get configuration options' },
      { status: 500 }
    )
  }
}

// Keep all other existing helper functions...
function generatePortfolioSummary(portfolioTimeSeries, assets) {
  if (portfolioTimeSeries.length === 0) {
    return {
      totalAssets: Object.keys(assets).length,
      totalCapacity: 0,
      averageAnnualRevenue: 0,
      totalProjectedRevenue: 0,
      averageContractedPercentage: 0,
      averageMerchantPercentage: 0
    }
  }
  
  const totalCapacity = Object.values(assets).reduce((sum, asset) => 
    sum + (parseFloat(asset.capacity) || 0), 0
  )
  
  const totalProjectedRevenue = portfolioTimeSeries.reduce((sum, period) => 
    sum + period.portfolio.totalRevenue, 0
  )
  
  const averageContractedPercentage = portfolioTimeSeries.reduce((sum, period) => 
    sum + period.portfolio.contractedPercentage, 0
  ) / portfolioTimeSeries.length
  
  return {
    totalAssets: Object.keys(assets).length,
    totalCapacity,
    averageAnnualRevenue: totalProjectedRevenue / portfolioTimeSeries.length,
    totalProjectedRevenue,
    averageContractedPercentage,
    averageMerchantPercentage: 100 - averageContractedPercentage
  }
}