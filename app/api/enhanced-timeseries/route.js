// app/api/enhanced-timeseries/route.js
import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { 
  generateTimeIntervals,
  generateEnhancedPortfolioTimeSeries,
  calculateEnhancedAssetRevenue
} from '@/lib/enhancedTimeSeriesCalculations'

// GET - Fetch enhanced time series revenue data with flexible intervals
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    const assetName = searchParams.get('assetName') // Optional - for single asset
    
    // Time series parameters
    const intervalType = searchParams.get('intervalType') || 'annual' // annual, quarterly, monthly, custom
    const startYear = parseInt(searchParams.get('startYear')) || new Date().getFullYear()
    const periods = parseInt(searchParams.get('periods')) || 30
    const customIntervals = searchParams.get('customIntervals') ? 
      searchParams.get('customIntervals').split(',') : null
    
    // Response format options
    const format = searchParams.get('format') || 'json' // json, csv
    const includeLegacy = searchParams.get('includeLegacy') !== 'false' // Default true for backward compatibility
    const includeProjectFinance = searchParams.get('includeProjectFinance') === 'true'
    
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
    
    // Simple merchant price function that integrates with your existing price provider
    // In production, this should use your actual MerchantPriceProvider
    const getMerchantPrice = (profile, type, state, timeInterval) => {
      // Default prices with escalation
      const defaultPrices = {
        solar: { green: 35, Energy: 65 },
        wind: { green: 35, Energy: 65 },
        storage: { 
          0.5: 15, 1: 20, 2: 25, 4: 35,
          Energy: 80 
        }
      }
      
      // Extract year for escalation
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
    
    // Add project finance data if requested
    if (includeProjectFinance) {
      // This would integrate with your existing calculateProjectMetrics function
      // For now, we'll add placeholder structure
      portfolioTimeSeries.forEach(period => {
        Object.keys(period.assets).forEach(assetName => {
          const asset = period.assets[assetName]
          asset.projectFinance = {
            // Placeholder - would come from your existing project finance calculations
            operatingCashFlow: asset.revenue.totalRevenue * 0.85, // Assuming 15% OPEX
            debtService: asset.revenue.totalRevenue * 0.1, // Placeholder
            equityCashFlow: asset.revenue.totalRevenue * 0.75, // Placeholder
            dscr: asset.revenue.totalRevenue > 0 ? (asset.revenue.totalRevenue * 0.85) / (asset.revenue.totalRevenue * 0.1) : null
          }
        })
        
        // Portfolio-level project finance
        period.portfolio.projectFinance = {
          totalOperatingCashFlow: period.portfolio.totalRevenue * 0.85,
          totalDebtService: period.portfolio.totalRevenue * 0.1,
          totalEquityCashFlow: period.portfolio.totalRevenue * 0.75,
          portfolioDSCR: period.portfolio.totalRevenue > 0 ? 
            (period.portfolio.totalRevenue * 0.85) / (period.portfolio.totalRevenue * 0.1) : null
        }
      })
    }
    
    // Handle CSV export
    if (format === 'csv') {
      const csvData = generateCSVFromTimeSeries(portfolioTimeSeries, assetName, includeLegacy)
      
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="enhanced-timeseries-${portfolioId}-${intervalType}.csv"`
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
        dataStructureVersion: '2.0'
      },
      
      // Summary statistics
      summary: {
        totalCapacity: Object.values(filteredAssets).reduce((sum, asset) => 
          sum + (parseFloat(asset.capacity) || 0), 0),
        averageRevenue: portfolioTimeSeries.length > 0 ? 
          portfolioTimeSeries.reduce((sum, period) => sum + period.portfolio.totalRevenue, 0) / portfolioTimeSeries.length : 0,
        totalProjectedRevenue: portfolioTimeSeries.reduce((sum, period) => sum + period.portfolio.totalRevenue, 0),
        contractedPercentage: portfolioTimeSeries.length > 0 ?
          portfolioTimeSeries.reduce((sum, period) => sum + period.portfolio.contractedPercentage, 0) / portfolioTimeSeries.length : 0
      },
      
      // Time series data
      timeSeries: portfolioTimeSeries
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Enhanced time series API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate enhanced time series data', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Generate custom scenarios with modified parameters
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const requestData = await request.json()
    const { 
      userId, 
      portfolioId, 
      scenarioName = 'custom',
      intervalType = 'annual',
      timeIntervals,
      assetModifications = {},
      constantsOverride = {},
      priceOverrides = {},
      stressScenario = null // 'base', 'worst', 'volume', 'price'
    } = requestData
    
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
    const constants = {
      ...portfolio.constants,
      ...constantsOverride,
      HOURS_IN_YEAR: 8760
    }
    
    // Apply stress scenario to constants if specified
    if (stressScenario) {
      switch (stressScenario) {
        case 'worst':
          constants.volumeVariation = (constants.volumeVariation || 20) * 1.5
          constants.greenPriceVariation = (constants.greenPriceVariation || 20) * 1.5
          constants.EnergyPriceVariation = (constants.EnergyPriceVariation || 20) * 1.5
          break
        case 'volume':
          constants.volumeVariation = (constants.volumeVariation || 20) * 2
          break
        case 'price':
          constants.greenPriceVariation = (constants.greenPriceVariation || 20) * 2
          constants.EnergyPriceVariation = (constants.EnergyPriceVariation || 20) * 2
          break
      }
    }
    
    // Custom price function with overrides
    const getMerchantPrice = (profile, type, state, timeInterval) => {
      // Check for price overrides first
      if (priceOverrides[profile] && priceOverrides[profile][type]) {
        let basePrice = priceOverrides[profile][type]
        
        // Apply stress scenario to merchant prices
        if (stressScenario === 'price' || stressScenario === 'worst') {
          const variation = type === 'green' ? 
            (constants.greenPriceVariation || 20) : 
            (constants.EnergyPriceVariation || 20)
          basePrice *= (1 - variation/100)
        }
        
        return basePrice
      }
      
      // Default pricing with escalation
      const defaultPrices = {
        solar: { green: 35, Energy: 65 },
        wind: { green: 35, Energy: 65 },
        storage: { 0.5: 15, 1: 20, 2: 25, 4: 35, Energy: 80 }
      }
      
      let basePrice = defaultPrices[profile]?.[type] || 50
      
      // Apply stress scenario
      if (stressScenario === 'price' || stressScenario === 'worst') {
        const variation = type === 'green' ? 
          (constants.greenPriceVariation || 20) : 
          (constants.EnergyPriceVariation || 20)
        basePrice *= (1 - variation/100)
      }
      
      // Apply escalation
      const year = parseInt(timeInterval.toString().split('-')[0] || timeInterval.toString())
      const escalationRate = constants.escalation / 100 || 0.025
      const referenceYear = constants.referenceYear || 2025
      const escalationFactor = Math.pow(1 + escalationRate, year - referenceYear)
      
      return basePrice * escalationFactor
    }
    
    // Use provided time intervals or generate defaults
    const intervals = timeIntervals || generateTimeIntervals(intervalType, 2025, 30)
    
    // Generate enhanced time series with modifications
    const portfolioTimeSeries = generateEnhancedPortfolioTimeSeries(
      modifiedAssets, 
      intervals, 
      constants, 
      getMerchantPrice
    )
    
    // Apply volume stress scenario if specified
    if (stressScenario === 'volume' || stressScenario === 'worst') {
      const volumeReduction = 1 - (constants.volumeVariation || 20) / 100
      
      portfolioTimeSeries.forEach(period => {
        Object.keys(period.assets).forEach(assetName => {
          const asset = period.assets[assetName]
          if (asset.volume) {
            // Apply volume reduction to all volume measures
            Object.keys(asset.volume).forEach(key => {
              if (typeof asset.volume[key] === 'number' && key.includes('Volume')) {
                asset.volume[key] *= volumeReduction
              }
            })
            
            // Recalculate revenue based on reduced volume
            if (asset.revenue) {
              Object.keys(asset.revenue).forEach(key => {
                if (typeof asset.revenue[key] === 'number') {
                  asset.revenue[key] *= volumeReduction
                }
              })
            }
            
            // Update legacy fields
            if (asset.legacy) {
              Object.keys(asset.legacy).forEach(key => {
                if (typeof asset.legacy[key] === 'number' && key !== 'greenPercentage' && key !== 'EnergyPercentage') {
                  asset.legacy[key] *= volumeReduction
                }
              })
            }
          }
        })
        
        // Recalculate portfolio aggregates
        period.portfolio.totalRevenue = Object.values(period.assets).reduce((sum, asset) => 
          sum + (asset.revenue?.totalRevenue || 0), 0)
        period.portfolio.totalVolume = Object.values(period.assets).reduce((sum, asset) => 
          sum + (asset.volume?.adjustedVolume || 0), 0)
      })
    }
    
    const response = {
      metadata: {
        userId,
        portfolioId,
        scenarioName,
        intervalType,
        stressScenario,
        hasAssetModifications: Object.keys(assetModifications).length > 0,
        hasConstantsOverride: Object.keys(constantsOverride).length > 0,
        hasPriceOverrides: Object.keys(priceOverrides).length > 0,
        totalAssets: Object.keys(modifiedAssets).length,
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
      
      timeSeries: portfolioTimeSeries
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Custom scenario API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate custom scenario', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV from time series data
 */
function generateCSVFromTimeSeries(portfolioTimeSeries, singleAsset = null, includeLegacy = true) {
  if (singleAsset) {
    // Single asset CSV
    const headers = [
      'timeseries', 'interval_type', 'year', 'quarter', 'month',
      'asset_name', 'asset_type', 'asset_capacity',
      'base_volume', 'degradation_factor', 'volume_loss_adjustment', 'adjusted_volume',
      'contracted_green_price', 'contracted_energy_price', 'merchant_green_price', 'merchant_energy_price',
      'contracted_green_revenue', 'contracted_energy_revenue', 'merchant_green_revenue', 'merchant_energy_revenue',
      'total_revenue'
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
          asset.volume.baseVolume || '',
          asset.volume.degradationFactor || '',
          asset.volume.volumeLossAdjustment || '',
          asset.volume.adjustedVolume || '',
          asset.prices.contractedGreenPrice || '',
          asset.prices.contractedEnergyPrice || '',
          asset.prices.merchantGreenPrice || '',
          asset.prices.merchantEnergyPrice || '',
          asset.revenue.contractedGreenRevenue || '',
          asset.revenue.contractedEnergyRevenue || '',
          asset.revenue.merchantGreenRevenue || '',
          asset.revenue.merchantEnergyRevenue || '',
          asset.revenue.totalRevenue || ''
        ]
        rows.push(row.join(','))
      }
    })
    
    return rows.join('\n')
  } else {
    // Portfolio CSV
    const headers = [
      'timeseries', 'interval_type', 'year', 'quarter', 'month',
      'total_revenue', 'total_volume', 'total_capacity', 'weighted_avg_price', 'contracted_percentage'
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
        period.portfolio.totalCapacity,
        period.portfolio.weightedAvgPrice,
        period.portfolio.contractedPercentage
      ]
      rows.push(row.join(','))
    })
    
    return rows.join('\n')
  }
}