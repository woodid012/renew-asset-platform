// app/api/portfolio-analysis/route.js
// FIXED: Construction date handling and date parsing issues
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
      intervalType: analysisConfig.intervalType || 'monthly',
      startYear: analysisConfig.startYear || new Date().getFullYear(),
      periods: analysisConfig.periods || 30,
      includeProjectFinance: analysisConfig.includeProjectFinance !== false,
      includeSensitivity: analysisConfig.includeSensitivity !== false,
      scenario: analysisConfig.scenario || 'base',
      
      // Construction + Operations timeline settings
      includeConstructionPhase: analysisConfig.includeConstructionPhase !== false,
      constructionStartOffset: analysisConfig.constructionStartOffset || 24, // months before asset start
      
      // Escalation settings
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
    
    // FIXED: Generate monthly timeline with proper date parsing
    const timelineResults = generateMonthlyConstructionOperationsTimeline(
      portfolio.assets,
      config
    )
    
    console.log(`Generated monthly timeline: ${timelineResults.totalMonths} months (${timelineResults.constructionMonths} construction + ${timelineResults.operationalMonths} operational)`)
    console.log('Asset phases:', Object.keys(timelineResults.assetPhases).map(assetName => ({
      asset: assetName,
      constructionStart: timelineResults.assetPhases[assetName].constructionStart.toISOString(),
      operationalStart: timelineResults.assetPhases[assetName].operationalStart.toISOString()
    })))
    
    // Get enhanced price function
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
      escalationSettings: config.escalationSettings
    }
    
    // FIXED: Calculate monthly portfolio time series with proper date handling
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
        dataStructureVersion: '3.1',
        validationStatus: validation,
        
        // Timeline metadata with detailed diagnostics
        timelineMetadata: {
          totalMonths: timelineResults.totalMonths,
          constructionMonths: timelineResults.constructionMonths,
          operationalMonths: timelineResults.operationalMonths,
          earliestConstructionStart: timelineResults.earliestConstructionStart?.toISOString(),
          latestOperationalEnd: timelineResults.latestOperationalEnd?.toISOString(),
          includedPhases: ['construction', 'operations'],
          assetDateDiagnostics: timelineResults.assetDateDiagnostics
        },
        
        // Pricing diagnostics
        pricingDiagnostics: {
          escalationEnabled: config.escalationSettings.enabled,
          escalationRate: config.escalationSettings.rate,
          referenceYear: config.escalationSettings.referenceYear,
          samplePrices: generateSamplePrices(portfolio.assets, getMerchantPrice, config.startYear)
        }
      },
      
      summary: summaryStats,
      
      // Monthly time series with construction + operations
      monthlyTimeSeries: monthlyPortfolioTimeSeries,
      
      // Timeline analysis
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
 * FIXED: Generate monthly timeline with proper date parsing and validation
 */
function generateMonthlyConstructionOperationsTimeline(assets, config) {
  const assetPhases = {}
  let earliestConstructionStart = null
  let latestOperationalEnd = null
  const assetDateDiagnostics = []
  
  // Calculate phases for each asset
  Object.values(assets).forEach(asset => {
    try {
      console.log(`Processing asset: ${asset.name}`)
      console.log(`Asset data:`, {
        name: asset.name,
        type: asset.type,
        assetStartDate: asset.assetStartDate,
        constructionDuration: asset.constructionDuration,
        constructionStart: asset.constructionStart
      })
      
      // FIXED: Robust date parsing for asset start date
      const assetStartDate = parseAssetStartDate(asset.assetStartDate)
      
      if (!assetStartDate || isNaN(assetStartDate.getTime())) {
        console.warn(`Invalid assetStartDate for asset ${asset.name}: ${asset.assetStartDate}`)
        assetDateDiagnostics.push({
          assetName: asset.name,
          originalDate: asset.assetStartDate,
          parsedDate: null,
          error: 'Invalid date format'
        })
        return // Skip this asset
      }
      
      console.log(`Parsed asset start date for ${asset.name}: ${assetStartDate.toISOString()}`)
      
      const assetStartYear = assetStartDate.getFullYear()
      const assetStartMonth = assetStartDate.getMonth()
      
      // Get construction duration from asset or defaults
      const constructionDurationMonths = getConstructionDurationMonths(asset)
      console.log(`Construction duration for ${asset.name}: ${constructionDurationMonths} months`)
      
      // FIXED: Calculate construction start (before asset operational start)
      // If asset has explicit constructionStart date, use that; otherwise calculate it
      let constructionStart
      if (asset.constructionStart) {
        constructionStart = parseAssetStartDate(asset.constructionStart)
        console.log(`Using explicit construction start for ${asset.name}: ${constructionStart?.toISOString()}`)
      } else {
        constructionStart = new Date(assetStartYear, assetStartMonth - constructionDurationMonths, 1)
        console.log(`Calculated construction start for ${asset.name}: ${constructionStart.toISOString()}`)
      }
      
      // Calculate operational end
      const operationalDurationYears = config.periods || 30
      const operationalEnd = new Date(assetStartYear + operationalDurationYears, assetStartMonth, 0)
      
      console.log(`Timeline for ${asset.name}:`, {
        constructionStart: constructionStart.toISOString(),
        operationalStart: assetStartDate.toISOString(),
        operationalEnd: operationalEnd.toISOString(),
        constructionDurationMonths,
        operationalDurationYears
      })
      
      // Store diagnostic information
      assetDateDiagnostics.push({
        assetName: asset.name,
        originalDate: asset.assetStartDate,
        originalConstructionStart: asset.constructionStart,
        parsedDate: assetStartDate.toISOString(),
        constructionStart: constructionStart.toISOString(),
        operationalStart: assetStartDate.toISOString(),
        operationalEnd: operationalEnd.toISOString(),
        constructionDurationMonths,
        error: null
      })
      
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
      
    } catch (error) {
      console.error(`Error processing dates for asset ${asset.name}:`, error)
      assetDateDiagnostics.push({
        assetName: asset.name,
        originalDate: asset.assetStartDate,
        parsedDate: null,
        error: error.message
      })
    }
  })
  
  // Validate that we have at least one valid asset
  if (Object.keys(assetPhases).length === 0) {
    throw new Error('No assets with valid dates found in portfolio')
  }
  
  if (!earliestConstructionStart || !latestOperationalEnd) {
    throw new Error('Unable to determine portfolio timeline bounds')
  }
  
  // FIXED: Generate monthly intervals from earliest construction to latest operational end
  const monthlyIntervals = []
  const currentDate = new Date(earliestConstructionStart)
  
  console.log(`Generating monthly intervals from ${earliestConstructionStart.toISOString()} to ${latestOperationalEnd.toISOString()}`)
  
  while (currentDate <= latestOperationalEnd) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    monthlyIntervals.push(`${year}-${month.toString().padStart(2, '0')}`)
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1)
  }
  
  // Calculate phase statistics
  const firstOperationalStart = Math.min(...Object.values(assetPhases).map(p => p.operationalStart.getTime()))
  const constructionMonths = Math.ceil((firstOperationalStart - earliestConstructionStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) // Average days per month
  const operationalMonths = monthlyIntervals.length - constructionMonths
  
  console.log(`Timeline generated: ${monthlyIntervals.length} total months, ${constructionMonths} construction, ${operationalMonths} operational`)
  
  return {
    monthlyIntervals,
    assetPhases,
    totalMonths: monthlyIntervals.length,
    constructionMonths,
    operationalMonths,
    earliestConstructionStart,
    latestOperationalEnd,
    assetDateDiagnostics
  }
}

/**
 * FIXED: Robust date parsing for asset start dates
 */
function parseAssetStartDate(dateInput) {
  if (!dateInput) {
    console.warn('No date input provided')
    return null
  }
  
  console.log(`Parsing date input: "${dateInput}" (type: ${typeof dateInput})`)
  
  // If it's already a Date object
  if (dateInput instanceof Date) {
    console.log(`Date object provided: ${dateInput.toISOString()}`)
    return dateInput
  }
  
  // If it's a string, try multiple parsing strategies
  if (typeof dateInput === 'string') {
    // Try ISO format first (YYYY-MM-DD)
    if (dateInput.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = new Date(dateInput)
      console.log(`ISO format parsed: ${parsed.toISOString()}`)
      return parsed
    }
    
    // Try DD/MM/YYYY format (your format: 1/3/2024, 1/8/2025)
    if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [day, month, year] = dateInput.split('/')
      const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      console.log(`DD/MM/YYYY format parsed: ${day}/${month}/${year} -> ${parsed.toISOString()}`)
      return parsed
    }
    
    // Try D/M/YYYY format (single digits without leading zeros)
    if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = dateInput.split('/')
      // For ambiguous formats like 1/3/2024, assume DD/MM/YYYY based on your example
      const day = parseInt(parts[0])
      const month = parseInt(parts[1])
      const year = parseInt(parts[2])
      
      // Validate day/month ranges to determine format
      if (day <= 12 && month <= 12) {
        // Ambiguous - use your preferred format (DD/MM/YYYY based on 1/3/2024 = 1st March)
        const parsed = new Date(year, month - 1, day)
        console.log(`Ambiguous date assumed DD/MM: ${day}/${month}/${year} -> ${parsed.toISOString()}`)
        return parsed
      } else if (day > 12) {
        // Must be DD/MM/YYYY
        const parsed = new Date(year, month - 1, day)
        console.log(`DD/MM/YYYY format: ${day}/${month}/${year} -> ${parsed.toISOString()}`)
        return parsed
      } else if (month > 12) {
        // Must be MM/DD/YYYY
        const parsed = new Date(year, day - 1, month)
        console.log(`MM/DD/YYYY format: ${month}/${day}/${year} -> ${parsed.toISOString()}`)
        return parsed
      }
    }
    
    // Try general Date parsing as fallback
    const parsed = new Date(dateInput)
    if (!isNaN(parsed.getTime())) {
      console.log(`General parsing successful: ${parsed.toISOString()}`)
      return parsed
    }
  }
  
  // If it's a number (timestamp)
  if (typeof dateInput === 'number') {
    const parsed = new Date(dateInput)
    console.log(`Timestamp parsed: ${parsed.toISOString()}`)
    return parsed
  }
  
  console.warn(`Unable to parse date: "${dateInput}"`)
  return null
}

/**
 * FIXED: Get construction duration with proper defaults and field checking
 */
function getConstructionDurationMonths(asset) {
  console.log(`Getting construction duration for ${asset.name}:`, {
    constructionDuration: asset.constructionDuration,
    type: asset.type
  })
  
  // Check if asset has constructionDuration specified
  if (asset.constructionDuration && !isNaN(asset.constructionDuration)) {
    const duration = parseFloat(asset.constructionDuration)
    console.log(`Asset has constructionDuration: ${duration}`)
    
    // If it's in years, convert to months; if it's already months, use as is
    if (duration > 0 && duration <= 5) {
      // Assume it's in years if it's a small number
      const months = Math.ceil(duration * 12)
      console.log(`Interpreted as years, converted to months: ${months}`)
      return months
    } else if (duration > 5 && duration <= 60) {
      // Assume it's already in months
      const months = Math.ceil(duration)
      console.log(`Interpreted as months: ${months}`)
      return months
    }
  }
  
  // Check for explicit construction period fields that might be in your data
  if (asset.constructionPeriod) {
    const period = parseFloat(asset.constructionPeriod)
    if (!isNaN(period)) {
      console.log(`Using constructionPeriod: ${period} months`)
      return Math.ceil(period)
    }
  }
  
  if (asset.constructionMonths) {
    const months = parseFloat(asset.constructionMonths)
    if (!isNaN(months)) {
      console.log(`Using constructionMonths: ${months}`)
      return Math.ceil(months)
    }
  }
  
  // Use defaults based on asset type
  const defaultDurations = {
    'solar': 12,    // 12 months
    'wind': 18,     // 18 months  
    'storage': 12,  // 12 months
    'battery': 12,  // 12 months
    'hydro': 24,    // 24 months
    'gas': 18       // 18 months
  }
  
  const defaultDuration = defaultDurations[asset.type?.toLowerCase()] || 18
  console.log(`Using default duration for ${asset.type}: ${defaultDuration} months`)
  return defaultDuration
}

/**
 * FIXED: Calculate monthly portfolio time series with proper phase detection
 */
async function calculateMonthlyPortfolioTimeSeries(assets, monthlyIntervals, constants, getMerchantPrice, assetPhases) {
  const portfolioTimeSeries = []
  
  for (const timeInterval of monthlyIntervals) {
    console.log(`Calculating monthly time series for interval: ${timeInterval}`)
    
    // Parse time period
    const periodInfo = parseMonthlyTimePeriod(timeInterval)
    const periodDate = new Date(periodInfo.year, periodInfo.month - 1, 15) // Use mid-month for calculations
    
    // Calculate asset-level revenues and investments
    const assetResults = {}
    const portfolioAggregates = initializeMonthlyPortfolioAggregates()
    
    for (const [assetKey, asset] of Object.entries(assets)) {
      try {
        const assetPhase = assetPhases[asset.name]
        
        if (!assetPhase) {
          console.warn(`No phase information found for asset ${asset.name}`)
          assetResults[asset.name] = createEmptyMonthlyAssetResult(asset, timeInterval, periodInfo, { phase: 'error' })
          continue
        }
        
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
 * FIXED: Determine what phase an asset is in for a given period
 */
function determineAssetPhase(periodDate, assetPhase) {
  const periodTime = periodDate.getTime()
  const constructionStartTime = assetPhase.constructionStart.getTime()
  const operationalStartTime = assetPhase.operationalStart.getTime()
  const operationalEndTime = assetPhase.operationalEnd.getTime()
  
  if (periodTime < constructionStartTime) {
    return {
      phase: 'pre-construction',
      daysIntoPhase: 0,
      daysRemainingInPhase: Math.ceil((constructionStartTime - periodTime) / (1000 * 60 * 60 * 24))
    }
  } else if (periodTime >= constructionStartTime && periodTime < operationalStartTime) {
    return {
      phase: 'construction',
      daysIntoPhase: Math.ceil((periodTime - constructionStartTime) / (1000 * 60 * 60 * 24)),
      daysRemainingInPhase: Math.ceil((operationalStartTime - periodTime) / (1000 * 60 * 60 * 24))
    }
  } else if (periodTime >= operationalStartTime && periodTime <= operationalEndTime) {
    return {
      phase: 'operations',
      daysIntoPhase: Math.ceil((periodTime - operationalStartTime) / (1000 * 60 * 60 * 24)),
      daysRemainingInPhase: Math.ceil((operationalEndTime - periodTime) / (1000 * 60 * 60 * 24))
    }
  } else {
    return {
      phase: 'post-operations',
      daysIntoPhase: Math.ceil((periodTime - operationalEndTime) / (1000 * 60 * 60 * 24)),
      daysRemainingInPhase: 0
    }
  }
}

/**
 * FIXED: Calculate construction phase monthly result with proper investment timing
 */
function calculateConstructionMonthlyResult(asset, timeInterval, periodInfo, assetPhase, constants) {
  const capacity = parseFloat(asset.capacity) || 0
  const assetCosts = constants.assetCosts?.[asset.name]
  
  // Get total capex for asset
  const totalCapex = assetCosts?.capex || (capacity * getDefaultCapex(asset.type))
  const constructionDurationMonths = assetPhase.constructionDurationMonths
  
  // FIXED: Calculate monthly investment based on timing strategy and current month
  let monthlyInvestment = 0
  let monthlyEquityInvestment = 0
  let monthlyDebtDrawdown = 0
  
  // Determine current month in construction timeline
  const monthsIntoConstruction = calculateMonthsIntoPhase(periodInfo, assetPhase.constructionStart)
  
  if (assetCosts?.equityTimingUpfront) {
    // Upfront equity - only in first month of construction
    if (monthsIntoConstruction === 1) {
      const gearing = assetCosts?.calculatedGearing || 0.7
      monthlyEquityInvestment = totalCapex * (1 - gearing)
      monthlyDebtDrawdown = totalCapex * gearing
      monthlyInvestment = totalCapex
    }
  } else {
    // Progressive investment over construction period
    if (monthsIntoConstruction >= 1 && monthsIntoConstruction <= constructionDurationMonths) {
      monthlyInvestment = totalCapex / constructionDurationMonths
      const gearing = assetCosts?.calculatedGearing || 0.7
      monthlyEquityInvestment = monthlyInvestment * (1 - gearing)
      monthlyDebtDrawdown = monthlyInvestment * gearing
    }
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
      monthsIntoConstruction: monthsIntoConstruction,
      monthsRemainingInConstruction: Math.max(0, constructionDurationMonths - monthsIntoConstruction),
      constructionProgress: Math.min(1, monthsIntoConstruction / constructionDurationMonths)
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

// Helper functions - keeping all existing ones and adding the missing ones

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
    return Math.min(totalCapex, Math.max(0, monthsInto) * monthlyInvestment)
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
    
    // Construction aggregates
    totalMonthlyInvestment: 0,
    totalMonthlyEquityInvestment: 0,
    totalMonthlyDebtDrawdown: 0,
    totalCumulativeInvestment: 0,
    
    // Phase tracking
    assetsInConstruction: 0,
    assetsInOperations: 0,
    assetCount: 0,
    
    // Net cash flow (operations revenue - construction investment)
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

function getDefaultCapex(assetType) {
  const defaults = { solar: 1.2, wind: 2.5, storage: 1.6, battery: 1.6 }
  return defaults[assetType?.toLowerCase()] || 2.0
}

function createEnhancedMerchantPriceFunction(escalationSettings) {
  return (profile, type, region, timeStr) => {
    try {
      console.log(`getMerchantPrice called: profile=${profile}, type=${type}, region=${region}, time=${timeStr}`)
      
      let basePrice = 0
      let targetYear = new Date().getFullYear()
      
      // Extract year from timeStr
      if (typeof timeStr === 'number') {
        targetYear = timeStr
      } else if (typeof timeStr === 'string') {
        if (timeStr.includes('/')) {
          const [day, month, yearPart] = timeStr.split('/')
          targetYear = parseInt(yearPart)
        } else if (timeStr.includes('-Q')) {
          targetYear = parseInt(timeStr.split('-')[0])
        } else if (timeStr.includes('-')) {
          targetYear = parseInt(timeStr.split('-')[0])
        } else {
          targetYear = parseInt(timeStr)
        }
      }
      
      if (profile === 'storage') {
        const storageSpreadData = {
          QLD: { 0.5: 160, 1: 180, 2: 200, 4: 220 },
          NSW: { 0.5: 155, 1: 175, 2: 195, 4: 215 },
          VIC: { 0.5: 150, 1: 170, 2: 190, 4: 210 },
          SA: { 0.5: 165, 1: 185, 2: 205, 4: 225 }
        }
        
        basePrice = storageSpreadData[region]?.[type] || 160
        
        if (escalationSettings.enabled && escalationSettings.applyToStorage) {
          const yearDiff = targetYear - escalationSettings.referenceYear
          basePrice = basePrice * Math.pow(1 + escalationSettings.rate / 100, yearDiff)
        }
        
        return basePrice
      }
      
      // Renewable prices
      const renewablePriceData = {
        solar: { green: 35, Energy: 65 },
        wind: { green: 35, Energy: 65 }
      }
      
      basePrice = renewablePriceData[profile]?.[type] || (type === 'green' ? 35 : 65)
      
      if (escalationSettings.enabled && escalationSettings.applyToRenewables) {
        const yearDiff = targetYear - escalationSettings.referenceYear
        basePrice = basePrice * Math.pow(1 + escalationSettings.rate / 100, yearDiff)
      }
      
      return basePrice
      
    } catch (error) {
      console.warn(`Error getting merchant price`, error)
      return profile === 'storage' ? 160 : (type === 'green' ? 35 : 65)
    }
  }
}

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

// Keep the existing GET endpoint
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
          { value: 'monthly', label: 'Monthly', description: 'Monthly time series with construction + operations' }
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
        intervalType: 'monthly',
        startYear: Math.max(earliestStartYear, new Date().getFullYear()),
        periods: 30,
        includeProjectFinance: true,
        includeSensitivity: true,
        scenario: 'base',
        includeConstructionPhase: true,
        constructionStartOffset: 24
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