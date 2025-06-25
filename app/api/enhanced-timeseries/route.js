// app/api/enhanced-timeseries/route.js - Updated to use centralized backend processing
import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// Enhanced time series with centralized backend processing
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    const assetName = searchParams.get('assetName') // Optional - for single asset
    
    // Time series parameters
    const intervalType = searchParams.get('intervalType') || 'annual'
    const startYear = parseInt(searchParams.get('startYear')) || new Date().getFullYear()
    const periods = parseInt(searchParams.get('periods')) || 30
    const customIntervals = searchParams.get('customIntervals') ? 
      searchParams.get('customIntervals').split(',') : null
    
    // Analysis parameters
    const revenueCase = searchParams.get('revenueCase') || 'base'
    const format = searchParams.get('format') || 'json'
    const includeLegacy = searchParams.get('includeLegacy') !== 'false'
    const includeProjectFinance = searchParams.get('includeProjectFinance') === 'true'
    const useEnhancedCalculations = searchParams.get('useEnhanced') !== 'false'
    
    // Validation
    if (!userId || !portfolioId) {
      return NextResponse.json(
        { error: 'userId and portfolioId are required' },
        { status: 400 }
      )
    }
    
    // Validate interval type
    const validIntervalTypes = ['annual', 'quarterly', 'monthly', 'custom']
    if (!validIntervalTypes.includes(intervalType)) {
      return NextResponse.json(
        { error: `Invalid intervalType. Must be one of: ${validIntervalTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Use centralized revenue calculation API
    if (useEnhancedCalculations) {
      return await callEnhancedRevenueAPI({
        userId, 
        portfolioId, 
        assetName,
        intervalType,
        startYear,
        periods,
        customIntervals,
        revenueCase,
        format,
        includeLegacy,
        includeProjectFinance
      })
    } else {
      // Fallback to legacy processing for backward compatibility
      return await legacyTimeSeriesProcessing({
        userId,
        portfolioId,
        assetName,
        intervalType,
        startYear,
        periods,
        customIntervals,
        revenueCase,
        format,
        includeLegacy,
        includeProjectFinance
      })
    }
    
  } catch (error) {
    console.error('Enhanced time series API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate enhanced time series data', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const requestData = await request.json()
    const { 
      action = 'generate',
      userId, 
      portfolioId, 
      scenarioName = 'custom',
      intervalType = 'annual',
      timeIntervals,
      assetModifications = {},
      constantsOverride = {},
      priceOverrides = {},
      stressScenario = null,
      useEnhancedCalculations = true
    } = requestData
    
    if (!userId || !portfolioId) {
      return NextResponse.json(
        { error: 'userId and portfolioId are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'generate':
        if (useEnhancedCalculations) {
          return await generateEnhancedCustomScenario(requestData)
        } else {
          return await generateLegacyCustomScenario(requestData)
        }
      
      case 'stress-test':
        return await runStressTestAPI(requestData)
      
      case 'compare-scenarios':
        return await compareScenarios(requestData)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Enhanced time series POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process enhanced time series request', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Call the enhanced revenue calculation API
 */
async function callEnhancedRevenueAPI({
  userId, portfolioId, assetName, intervalType, startYear, periods, 
  customIntervals, revenueCase, format, includeLegacy, includeProjectFinance
}) {
  try {
    // Build query parameters for revenue calculation API
    const queryParams = new URLSearchParams({
      action: assetName ? 'asset' : 'calculate',
      userId,
      portfolioId,
      intervalType,
      startYear: startYear.toString(),
      periods: periods.toString(),
      revenueCase,
      format,
      includeProjectFinance: includeProjectFinance.toString()
    })

    if (assetName) {
      queryParams.set('assetName', assetName)
    }

    if (customIntervals) {
      queryParams.set('customIntervals', customIntervals.join(','))
    }

    // Make internal API call to revenue calculations
    const revenueResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/revenue-calculations?${queryParams}`)
    
    if (!revenueResponse.ok) {
      throw new Error(`Revenue calculation failed: ${revenueResponse.statusText}`)
    }

    const revenueData = await revenueResponse.json()

    // Transform to enhanced time series format if needed
    const enhancedTimeSeries = transformToEnhancedFormat(revenueData, includeLegacy)

    return NextResponse.json(enhancedTimeSeries)

  } catch (error) {
    console.error('Error calling enhanced revenue API:', error)
    throw error
  }
}

/**
 * Transform revenue calculation results to enhanced time series format
 */
function transformToEnhancedFormat(revenueData, includeLegacy) {
  const transformed = {
    metadata: {
      ...revenueData.metadata,
      dataStructureVersion: '2.0-enhanced',
      includeLegacy,
      transformedAt: new Date().toISOString()
    },
    
    summary: revenueData.summary,
    
    timeSeries: revenueData.timeSeries || []
  }

  // Add legacy compatibility layer if requested
  if (includeLegacy && revenueData.timeSeries) {
    transformed.timeSeries = revenueData.timeSeries.map(period => ({
      ...period,
      
      // Add legacy fields for backward compatibility
      timeInterval: period.timeDimension?.interval,
      total: period.portfolio?.totalRevenue || 0,
      contractedGreen: period.portfolio?.contractedGreenRevenue || 0,
      contractedEnergy: period.portfolio?.contractedEnergyRevenue || 0,
      merchantGreen: period.portfolio?.merchantGreenRevenue || 0,
      merchantEnergy: period.portfolio?.merchantEnergyRevenue || 0,
      
      // Legacy asset format
      legacyAssets: Object.entries(period.assets || {}).reduce((acc, [assetName, assetData]) => {
        acc[assetName] = {
          total: assetData.revenue?.totalRevenue || 0,
          contractedGreen: assetData.revenue?.contractedGreenRevenue || 0,
          contractedEnergy: assetData.revenue?.contractedEnergyRevenue || 0,
          merchantGreen: assetData.revenue?.merchantGreenRevenue || 0,
          merchantEnergy: assetData.revenue?.merchantEnergyRevenue || 0,
          greenPercentage: assetData.contracts?.greenPercentage || 0,
          EnergyPercentage: assetData.contracts?.energyPercentage || 0,
          annualGeneration: assetData.volume?.adjustedVolume || 0
        }
        return acc
      }, {})
    }))
  }

  return transformed
}

/**
 * Generate enhanced custom scenario using new backend
 */
async function generateEnhancedCustomScenario(requestData) {
  try {
    const {
      userId, portfolioId, scenarioName, assetModifications, 
      constantsOverride, priceOverrides, stressScenario, timeIntervals
    } = requestData

    // Get portfolio data
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
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

    // Apply asset modifications
    let modifiedAssets = { ...portfolio.assets }
    Object.keys(assetModifications).forEach(assetName => {
      if (modifiedAssets[assetName]) {
        modifiedAssets[assetName] = {
          ...modifiedAssets[assetName],
          ...assetModifications[assetName]
        }
      }
    })

    // Apply constants override
    const modifiedConstants = {
      ...portfolio.constants,
      ...constantsOverride,
      HOURS_IN_YEAR: 8760
    }

    // Call revenue calculations API with custom data
    const revenueResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/revenue-calculations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'custom-portfolio',
        userId,
        portfolioId,
        assets: modifiedAssets,
        constants: modifiedConstants,
        timeIntervals,
        revenueCase: stressScenario || 'base',
        escalationSettings: priceOverrides
      })
    })

    if (!revenueResponse.ok) {
      throw new Error(`Custom scenario calculation failed: ${revenueResponse.statusText}`)
    }

    const revenueData = await revenueResponse.json()

    const response = {
      metadata: {
        ...revenueData.metadata,
        scenarioName,
        hasAssetModifications: Object.keys(assetModifications).length > 0,
        hasConstantsOverride: Object.keys(constantsOverride).length > 0,
        hasPriceOverrides: Object.keys(priceOverrides).length > 0,
        stressScenario,
        generatedAt: new Date().toISOString()
      },
      
      scenario: {
        name: scenarioName,
        description: stressScenario ? `Stress scenario: ${stressScenario}` : 'Custom scenario',
        modifications: {
          assets: assetModifications,
          constants: constantsOverride,
          prices: priceOverrides
        }
      },
      
      summary: revenueData.summary,
      timeSeries: revenueData.timeSeries
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error generating enhanced custom scenario:', error)
    throw error
  }
}

/**
 * Run stress test using enhanced backend
 */
async function runStressTestAPI(requestData) {
  try {
    const { userId, portfolioId, stressScenarios = ['base', 'worst', 'volume', 'price'] } = requestData

    // Get portfolio data
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
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

    // Call stress test API
    const stressResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/revenue-calculations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'stress-test',
        userId,
        portfolioId,
        assets: portfolio.assets,
        constants: portfolio.constants,
        timeIntervals: generateDefaultTimeIntervals(),
        stressScenarios
      })
    })

    if (!stressResponse.ok) {
      throw new Error(`Stress test calculation failed: ${stressResponse.statusText}`)
    }

    const stressData = await stressResponse.json()

    return NextResponse.json({
      metadata: {
        userId,
        portfolioId,
        stressScenarios,
        generatedAt: new Date().toISOString(),
        calculationType: 'stress-test'
      },
      results: stressData.results
    })

  } catch (error) {
    console.error('Error running stress test:', error)
    throw error
  }
}

/**
 * Compare multiple scenarios
 */
async function compareScenarios(requestData) {
  try {
    const { 
      userId, 
      portfolioId, 
      scenarios = ['base', 'worst'],
      intervalType = 'annual',
      periods = 10
    } = requestData

    // Call batch revenue calculation
    const batchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/revenue-calculations?action=batch&userId=${userId}&portfolioId=${portfolioId}&scenarios=${scenarios.join(',')}&intervalType=${intervalType}&periods=${periods}`)

    if (!batchResponse.ok) {
      throw new Error(`Batch scenario calculation failed: ${batchResponse.statusText}`)
    }

    const batchData = await batchResponse.json()

    // Calculate comparison metrics
    const comparison = calculateScenarioComparison(batchData.batchResults)

    return NextResponse.json({
      metadata: {
        userId,
        portfolioId,
        scenarios,
        intervalType,
        periods,
        generatedAt: new Date().toISOString(),
        calculationType: 'scenario-comparison'
      },
      scenarios: batchData.batchResults,
      comparison
    })

  } catch (error) {
    console.error('Error comparing scenarios:', error)
    throw error
  }
}

/**
 * Calculate comparison metrics between scenarios
 */
function calculateScenarioComparison(scenarioResults) {
  const scenarios = Object.keys(scenarioResults)
  const comparison = {
    baselineScenario: 'base',
    relativeDifferences: {},
    riskMetrics: {}
  }

  const baseline = scenarioResults['base']
  if (!baseline || baseline.error) {
    comparison.baselineScenario = scenarios[0]
  }

  const baselineRevenue = scenarioResults[comparison.baselineScenario]?.summary?.totalRevenue || 0

  scenarios.forEach(scenario => {
    const scenarioData = scenarioResults[scenario]
    
    if (!scenarioData || scenarioData.error) {
      comparison.relativeDifferences[scenario] = { error: 'Calculation failed' }
      return
    }

    const scenarioRevenue = scenarioData.summary?.totalRevenue || 0
    const difference = scenarioRevenue - baselineRevenue
    const percentDifference = baselineRevenue > 0 ? (difference / baselineRevenue) * 100 : 0

    comparison.relativeDifferences[scenario] = {
      absoluteDifference: difference,
      percentDifference,
      totalRevenue: scenarioRevenue,
      riskRating: getRiskRating(percentDifference)
    }

    // Calculate volatility if time series data available
    if (scenarioData.timeSeries) {
      const revenues = scenarioData.timeSeries.map(t => t.portfolio?.totalRevenue || 0)
      comparison.riskMetrics[scenario] = {
        volatility: calculateVolatility(revenues),
        minRevenue: Math.min(...revenues),
        maxRevenue: Math.max(...revenues),
        coefficientOfVariation: calculateCoefficientOfVariation(revenues)
      }
    }
  })

  return comparison
}

/**
 * Get risk rating based on percentage difference from baseline
 */
function getRiskRating(percentDifference) {
  if (percentDifference >= -5) return 'Low'
  if (percentDifference >= -15) return 'Medium'
  if (percentDifference >= -30) return 'High'
  return 'Very High'
}

/**
 * Calculate coefficient of variation
 */
function calculateCoefficientOfVariation(values) {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  return mean > 0 ? (stdDev / mean) * 100 : 0
}

/**
 * Calculate volatility (standard deviation)
 */
function calculateVolatility(values) {
  if (values.length < 2) return 0
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  
  return Math.sqrt(variance)
}

/**
 * Generate default time intervals
 */
function generateDefaultTimeIntervals() {
  const startYear = new Date().getFullYear()
  const intervals = []
  
  for (let i = 0; i < 30; i++) {
    intervals.push(startYear + i)
  }
  
  return intervals
}

/**
 * Legacy time series processing for backward compatibility
 */
async function legacyTimeSeriesProcessing({
  userId, portfolioId, assetName, intervalType, startYear, periods, 
  customIntervals, revenueCase, format, includeLegacy, includeProjectFinance
}) {
  try {
    // Import legacy calculations
    const { 
      generateTimeIntervals,
      generateEnhancedPortfolioTimeSeries
    } = await import('@/lib/enhancedTimeSeriesCalculations')

    const client = await clientPromise
    const db = client.db('energy_contracts')
    
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

    const assets = portfolio.assets || {}
    const constants = {
      ...portfolio.constants,
      HOURS_IN_YEAR: 8760,
      volumeVariation: portfolio.constants?.volumeVariation || 20,
      greenPriceVariation: portfolio.constants?.greenPriceVariation || 20,
      EnergyPriceVariation: portfolio.constants?.EnergyPriceVariation || 20,
      escalation: 2.5,
      referenceYear: 2025
    }

    // Filter assets if specific asset requested
    let filteredAssets = assets
    if (assetName) {
      const asset = Object.values(assets).find(a => a.name === assetName)
      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        )
      }
      filteredAssets = { [assetName]: asset }
    }

    // Simple merchant price function for legacy compatibility
    const getMerchantPrice = (profile, type, state, timeInterval) => {
      const defaultPrices = {
        solar: { green: 35, Energy: 65 },
        wind: { green: 35, Energy: 65 },
        storage: { 
          0.5: 15, 1: 20, 2: 25, 4: 35,
          Energy: 80 
        }
      }
      
      let year = new Date().getFullYear()
      if (typeof timeInterval === 'string') {
        if (timeInterval.includes('-Q')) {
          year = parseInt(timeInterval.split('-Q')[0])
        } else if (timeInterval.includes('-')) {
          year = parseInt(timeInterval.split('-')[0])
        } else {
          year = parseInt(timeInterval)
        }
      } else {
        year = parseInt(timeInterval.toString())
      }
      
      // Apply escalation
      const escalationRate = constants.escalation / 100 || 0.025
      const referenceYear = constants.referenceYear || 2025
      const escalationFactor = Math.pow(1 + escalationRate, year - referenceYear)
      
      const basePrice = defaultPrices[profile]?.[type] || 50
      return basePrice * escalationFactor
    }

    // Generate time intervals
    const timeIntervals = generateTimeIntervals(intervalType, startYear, periods, customIntervals)
    
    // Generate enhanced time series data
    const portfolioTimeSeries = generateEnhancedPortfolioTimeSeries(
      filteredAssets, 
      timeIntervals, 
      constants, 
      getMerchantPrice
    )

    // Handle CSV export
    if (format === 'csv') {
      const csvData = generateLegacyCSV(portfolioTimeSeries, assetName, includeLegacy)
      
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="legacy-timeseries-${portfolioId}-${intervalType}.csv"`
        }
      })
    }

    // Prepare JSON response
    const response = {
      metadata: {
        userId,
        portfolioId,
        assetName: assetName || null,
        intervalType,
        startYear,
        periods: timeIntervals.length,
        totalAssets: Object.keys(filteredAssets).length,
        includeLegacy,
        includeProjectFinance,
        generatedAt: new Date().toISOString(),
        dataStructureVersion: '1.0-legacy',
        calculationMethod: 'legacy'
      },
      
      summary: {
        totalCapacity: Object.values(filteredAssets).reduce((sum, asset) => 
          sum + (parseFloat(asset.capacity) || 0), 0),
        averageRevenue: portfolioTimeSeries.length > 0 ? 
          portfolioTimeSeries.reduce((sum, period) => sum + period.portfolio.totalRevenue, 0) / portfolioTimeSeries.length : 0,
        totalProjectedRevenue: portfolioTimeSeries.reduce((sum, period) => sum + period.portfolio.totalRevenue, 0),
        contractedPercentage: portfolioTimeSeries.length > 0 ?
          portfolioTimeSeries.reduce((sum, period) => sum + period.portfolio.contractedPercentage, 0) / portfolioTimeSeries.length : 0
      },
      
      timeSeries: portfolioTimeSeries
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Legacy time series processing error:', error)
    throw error
  }
}

/**
 * Generate CSV from legacy time series data
 */
function generateLegacyCSV(portfolioTimeSeries, singleAsset = null, includeLegacy = true) {
  if (singleAsset) {
    const headers = [
      'time_period', 'interval_type', 'year', 'quarter', 'month',
      'asset_name', 'asset_type', 'capacity_mw',
      'total_revenue_m', 'contracted_green_m', 'contracted_energy_m', 
      'merchant_green_m', 'merchant_energy_m',
      'generation_mwh'
    ]
    
    const rows = [headers.join(',')]
    
    portfolioTimeSeries.forEach(period => {
      const asset = Object.values(period.assets)[0]
      if (asset) {
        const row = [
          period.timeDimension.interval,
          period.timeDimension.intervalType,
          period.timeDimension.year,
          period.timeDimension.quarter || '',
          period.timeDimension.month || '',
          asset.assetMetadata.assetName,
          asset.assetMetadata.assetType,
          asset.assetMetadata.assetCapacity,
          asset.revenue.totalRevenue || 0,
          asset.revenue.contractedGreenRevenue || 0,
          asset.revenue.contractedEnergyRevenue || 0,
          asset.revenue.merchantGreenRevenue || 0,
          asset.revenue.merchantEnergyRevenue || 0,
          asset.volume.adjustedVolume || 0
        ]
        rows.push(row.join(','))
      }
    })
    
    return rows.join('\n')
  } else {
    const headers = [
      'time_period', 'interval_type', 'year', 'quarter', 'month',
      'total_revenue_m', 'total_volume_mwh', 'weighted_avg_price', 'contracted_percentage'
    ]
    
    const rows = [headers.join(',')]
    
    portfolioTimeSeries.forEach(period => {
      const row = [
        period.timeDimension.interval,
        period.timeDimension.intervalType,
        period.timeDimension.year,
        period.timeDimension.quarter || '',
        period.timeDimension.month || '',
        period.portfolio.totalRevenue,
        period.portfolio.totalVolume,
        period.portfolio.weightedAvgPrice,
        period.portfolio.contractedPercentage
      ]
      rows.push(row.join(','))
    })
    
    return rows.join('\n')
  }
}

/**
 * Generate legacy custom scenario
 */
async function generateLegacyCustomScenario(requestData) {
  // This would contain the previous enhanced-timeseries logic
  // Keeping for backward compatibility
  return NextResponse.json({
    error: 'Legacy custom scenario generation not implemented',
    message: 'Please use enhanced calculations for custom scenarios'
  }, { status: 501 })
}