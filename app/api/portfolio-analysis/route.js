// app/api/portfolio-analysis/route.js
// Enhanced unified backend API for portfolio analysis
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
 * POST - Generate comprehensive portfolio analysis
 * Body: {
 *   userId: string,
 *   portfolioId: string,
 *   analysisConfig: {
 *     intervalType: 'annual' | 'quarterly' | 'monthly',
 *     startYear: number,
 *     periods: number,
 *     includeProjectFinance: boolean,
 *     includeSensitivity: boolean,
 *     scenario: 'base' | 'worst' | 'volume' | 'price'
 *   }
 * }
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
      intervalType: analysisConfig.intervalType || 'annual',
      startYear: analysisConfig.startYear || new Date().getFullYear(),
      periods: analysisConfig.periods || 30,
      includeProjectFinance: analysisConfig.includeProjectFinance !== false,
      includeSensitivity: analysisConfig.includeSensitivity !== false,
      scenario: analysisConfig.scenario || 'base',
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
    
    // Generate time intervals
    const timeIntervals = generateTimeIntervals(
      config.intervalType, 
      config.startYear, 
      config.periods
    )
    
    console.log(`Generated ${timeIntervals.length} time intervals`)
    
    // Get enhanced price function
    const getMerchantPrice = createEnhancedPriceFunction()
    
    // Initialize enhanced constants
    const enhancedConstants = {
      ...portfolio.constants,
      HOURS_IN_YEAR: 8760,
      DAYS_IN_YEAR: 365,
      volumeVariation: portfolio.constants?.volumeVariation || 20,
      greenPriceVariation: portfolio.constants?.greenPriceVariation || 20,
      EnergyPriceVariation: portfolio.constants?.EnergyPriceVariation || 20,
      escalation: 2.5,
      referenceYear: 2025,
      scenario: config.scenario
    }
    
    // Calculate enhanced time series
    const portfolioTimeSeries = await calculateEnhancedPortfolioTimeSeries(
      portfolio.assets,
      timeIntervals,
      enhancedConstants,
      getMerchantPrice
    )
    
    console.log(`Calculated ${portfolioTimeSeries.length} time series periods`)
    
    // Calculate project finance if requested
    let projectFinanceResults = null
    if (config.includeProjectFinance) {
      projectFinanceResults = await calculateEnhancedProjectFinance(
        portfolio.assets,
        portfolioTimeSeries,
        enhancedConstants
      )
      console.log('Enhanced project finance calculations completed')
    }
    
    // Calculate sensitivity analysis if requested
    let sensitivityResults = null
    if (config.includeSensitivity && projectFinanceResults) {
      sensitivityResults = await calculateEnhancedSensitivityAnalysis(
        portfolio.assets,
        portfolioTimeSeries,
        projectFinanceResults,
        enhancedConstants
      )
      console.log('Enhanced sensitivity analysis completed')
    }
    
    // Generate summary statistics
    const summaryStats = generatePortfolioSummary(portfolioTimeSeries, portfolio.assets)
    
    // Prepare response
    const response = {
      metadata: {
        userId,
        portfolioId,
        portfolioName: portfolio.portfolioName,
        analysisConfig: config,
        totalAssets: Object.keys(portfolio.assets || {}).length,
        timeSeriesLength: portfolioTimeSeries.length,
        calculationTimestamp: new Date().toISOString(),
        dataStructureVersion: '3.0',
        validationStatus: validation
      },
      
      summary: summaryStats,
      
      timeSeries: portfolioTimeSeries,
      
      projectFinance: projectFinanceResults,
      
      sensitivity: sensitivityResults,
      
      diagnostics: {
        calculationTime: Date.now(),
        memoryUsage: process.memoryUsage(),
        warnings: validation.warnings
      }
    }
    
    console.log('Enhanced portfolio analysis completed successfully')
    
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
          { value: 'monthly', label: 'Monthly', description: 'Monthly time series (12 per year)' }
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
        intervalType: 'annual',
        startYear: Math.max(earliestStartYear, new Date().getFullYear()),
        periods: 30,
        includeProjectFinance: true,
        includeSensitivity: true,
        scenario: 'base'
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

/**
 * Calculate enhanced portfolio time series
 */
async function calculateEnhancedPortfolioTimeSeries(assets, timeIntervals, constants, getMerchantPrice) {
  const portfolioTimeSeries = []
  
  for (const timeInterval of timeIntervals) {
    console.log(`Calculating time series for interval: ${timeInterval}`)
    
    // Parse time period
    const periodInfo = parseTimePeriod(timeInterval)
    
    // Calculate asset-level revenues
    const assetResults = {}
    const portfolioAggregates = initializePortfolioAggregates()
    
    for (const [assetKey, asset] of Object.entries(assets)) {
      try {
        const assetRevenue = await calculateEnhancedAssetRevenue(
          asset, 
          timeInterval, 
          constants, 
          getMerchantPrice
        )
        
        assetResults[asset.name] = assetRevenue
        
        // Aggregate to portfolio level
        aggregateToPortfolio(portfolioAggregates, assetRevenue)
        
      } catch (error) {
        console.error(`Error calculating revenue for asset ${asset.name}:`, error)
        assetResults[asset.name] = createEmptyAssetResult(asset, timeInterval)
      }
    }
    
    // Finalize portfolio aggregates
    finalizePortfolioAggregates(portfolioAggregates)
    
    portfolioTimeSeries.push({
      timeDimension: {
        interval: timeInterval,
        intervalType: periodInfo.type,
        year: periodInfo.year,
        quarter: periodInfo.quarter,
        month: periodInfo.month,
        periodAdjustment: periodInfo.periodAdjustment,
        periodLabel: generatePeriodLabel(periodInfo)
      },
      
      portfolio: portfolioAggregates,
      
      assets: assetResults
    })
  }
  
  return portfolioTimeSeries
}

/**
 * Parse time period string into components
 */
function parseTimePeriod(timeInterval) {
  const periodStr = timeInterval.toString()
  
  if (periodStr.includes('-Q')) {
    // Quarterly: "2025-Q3"
    const [year, quarterStr] = periodStr.split('-Q')
    const quarter = parseInt(quarterStr)
    return {
      type: 'quarterly',
      year: parseInt(year),
      quarter,
      month: null,
      periodAdjustment: 0.25
    }
  } else if (periodStr.includes('-')) {
    // Monthly: "2025-03"
    const [year, month] = periodStr.split('-')
    return {
      type: 'monthly',
      year: parseInt(year),
      quarter: Math.ceil(parseInt(month) / 3),
      month: parseInt(month),
      periodAdjustment: 1/12
    }
  } else {
    // Annual: "2025"
    const year = parseInt(periodStr)
    return {
      type: 'annual',
      year,
      quarter: null,
      month: null,
      periodAdjustment: 1.0
    }
  }
}

/**
 * Generate human-readable period label
 */
function generatePeriodLabel(periodInfo) {
  if (periodInfo.type === 'quarterly') {
    return `Q${periodInfo.quarter} ${periodInfo.year}`
  } else if (periodInfo.type === 'monthly') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[periodInfo.month - 1]} ${periodInfo.year}`
  } else {
    return periodInfo.year.toString()
  }
}

/**
 * Initialize portfolio aggregates structure
 */
function initializePortfolioAggregates() {
  return {
    totalRevenue: 0,
    totalVolume: 0,
    totalCapacity: 0,
    contractedGreenRevenue: 0,
    contractedEnergyRevenue: 0,
    merchantGreenRevenue: 0,
    merchantEnergyRevenue: 0,
    weightedAvgPrice: 0,
    contractedPercentage: 0,
    assetCount: 0
  }
}

/**
 * Aggregate asset results to portfolio level
 */
function aggregateToPortfolio(portfolioAggregates, assetRevenue) {
  portfolioAggregates.totalRevenue += assetRevenue.revenue.totalRevenue
  portfolioAggregates.totalVolume += assetRevenue.volume.adjustedVolume || 0
  portfolioAggregates.totalCapacity += assetRevenue.assetMetadata.assetCapacity
  portfolioAggregates.contractedGreenRevenue += assetRevenue.revenue.contractedGreenRevenue || 0
  portfolioAggregates.contractedEnergyRevenue += assetRevenue.revenue.contractedEnergyRevenue || 0
  portfolioAggregates.merchantGreenRevenue += assetRevenue.revenue.merchantGreenRevenue || 0
  portfolioAggregates.merchantEnergyRevenue += assetRevenue.revenue.merchantEnergyRevenue || 0
  portfolioAggregates.assetCount++
}

/**
 * Finalize portfolio aggregates with calculated fields
 */
function finalizePortfolioAggregates(portfolioAggregates) {
  // Calculate weighted average price
  portfolioAggregates.weightedAvgPrice = portfolioAggregates.totalVolume > 0 
    ? (portfolioAggregates.totalRevenue * 1000000) / portfolioAggregates.totalVolume 
    : 0
  
  // Calculate contracted percentage
  portfolioAggregates.contractedPercentage = portfolioAggregates.totalRevenue > 0 
    ? ((portfolioAggregates.contractedGreenRevenue + portfolioAggregates.contractedEnergyRevenue) / portfolioAggregates.totalRevenue) * 100 
    : 0
}

/**
 * Generate portfolio summary statistics
 */
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

/**
 * Create enhanced price function with escalation
 */
function createEnhancedPriceFunction() {
  return (profile, type, state, timeInterval) => {
    // Enhanced price logic will be implemented here
    // For now, return basic prices with escalation
    const baseYear = 2025
    const escalationRate = 0.025
    
    // Extract year from timeInterval
    let year = baseYear
    const timeStr = timeInterval.toString()
    
    if (timeStr.includes('-Q')) {
      year = parseInt(timeStr.split('-Q')[0])
    } else if (timeStr.includes('-')) {
      year = parseInt(timeStr.split('-')[0])
    } else {
      year = parseInt(timeStr)
    }
    
    // Base prices
    const basePrices = {
      solar: { green: 35, Energy: 65 },
      wind: { green: 35, Energy: 65 },
      storage: { 0.5: 15, 1: 20, 2: 25, 4: 35, Energy: 80 }
    }
    
    const basePrice = basePrices[profile]?.[type] || 50
    
    // Apply escalation
    const escalationFactor = Math.pow(1 + escalationRate, year - baseYear)
    
    return basePrice * escalationFactor
  }
}

/**
 * Create empty asset result for error cases
 */
function createEmptyAssetResult(asset, timeInterval) {
  return {
    timeDimension: {
      interval: timeInterval,
      intervalType: 'annual',
      year: new Date().getFullYear(),
      quarter: null,
      month: null,
      periodAdjustment: 1.0
    },
    assetMetadata: {
      assetName: asset.name,
      assetType: asset.type,
      assetCapacity: parseFloat(asset.capacity) || 0,
      assetState: asset.state
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