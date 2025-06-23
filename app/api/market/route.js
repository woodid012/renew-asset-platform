import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

// GET - Fetch market price data
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const { searchParams } = new URL(request.url)
    const curve = searchParams.get('curve') // baseload, solar, wind, green
    const region = searchParams.get('region') // QLD, NSW, VIC, SA, WA, TAS
    const startYear = parseInt(searchParams.get('startYear')) || new Date().getFullYear()
    const endYear = parseInt(searchParams.get('endYear')) || startYear + 10
    
    // Build query
    const query = {
      year: { $gte: startYear, $lte: endYear }
    }
    
    if (curve) query.curve = curve
    if (region) query.region = region
    
    // Fetch market data
    const marketData = await db.collection('market_prices')
      .find(query)
      .sort({ year: 1, curve: 1 })
      .toArray()
    
    // If no data exists, generate default curves
    if (marketData.length === 0) {
      const defaultData = generateDefaultMarketCurves(startYear, endYear, region)
      return NextResponse.json(defaultData)
    }
    
    // Format data for frontend
    const formattedData = marketData.map(item => ({
      id: item._id.toString(),
      year: item.year,
      curve: item.curve,
      region: item.region || 'NEM',
      price: item.price,
      escalation: item.escalation || 2.0,
      volatility: item.volatility || 15.0,
      lastUpdated: item.lastUpdated
    }))
    
    return NextResponse.json(formattedData)
    
  } catch (error) {
    console.error('Market GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    )
  }
}

// POST - Create/Update market price curves
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const marketData = await request.json()
    
    // Validate required fields
    if (!marketData.year || !marketData.curve || !marketData.price) {
      return NextResponse.json(
        { error: 'Missing required fields: year, curve, price' },
        { status: 400 }
      )
    }
    
    // Check if data already exists for this year/curve/region combination
    const existing = await db.collection('market_prices').findOne({
      year: marketData.year,
      curve: marketData.curve,
      region: marketData.region || 'NEM'
    })
    
    const dataToSave = {
      ...marketData,
      region: marketData.region || 'NEM',
      escalation: marketData.escalation || 2.0,
      volatility: marketData.volatility || 15.0,
      lastUpdated: new Date(),
      createdAt: existing ? existing.createdAt : new Date()
    }
    
    let result
    if (existing) {
      // Update existing
      result = await db.collection('market_prices').updateOne(
        { _id: existing._id },
        { $set: dataToSave }
      )
      dataToSave.id = existing._id.toString()
    } else {
      // Create new
      result = await db.collection('market_prices').insertOne(dataToSave)
      dataToSave.id = result.insertedId.toString()
    }
    
    return NextResponse.json(dataToSave, { status: existing ? 200 : 201 })
    
  } catch (error) {
    console.error('Market POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save market data' },
      { status: 500 }
    )
  }
}

// PUT - Bulk update market curves
export async function PUT(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const { curves, region = 'NEM' } = await request.json()
    
    if (!curves || !Array.isArray(curves)) {
      return NextResponse.json(
        { error: 'Curves array is required' },
        { status: 400 }
      )
    }
    
    const bulkOps = curves.map(curve => ({
      updateOne: {
        filter: {
          year: curve.year,
          curve: curve.curve,
          region: region
        },
        update: {
          $set: {
            ...curve,
            region: region,
            lastUpdated: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }))
    
    const result = await db.collection('market_prices').bulkWrite(bulkOps)
    
    return NextResponse.json({
      success: true,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
      total: curves.length
    })
    
  } catch (error) {
    console.error('Market PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update market data' },
      { status: 500 }
    )
  }
}

// Generate default market curves if no data exists
function generateDefaultMarketCurves(startYear, endYear, region = 'NEM') {
  const curves = ['baseload', 'solar', 'wind', 'green']
  const basePrices = {
    baseload: 65,
    solar: 45,
    wind: 55,
    green: 75
  }
  
  const regionalMultipliers = {
    'QLD': 1.0,
    'NSW': 1.05,
    'VIC': 0.95,
    'SA': 1.15,
    'WA': 0.90,
    'TAS': 0.85,
    'NEM': 1.0
  }
  
  const multiplier = regionalMultipliers[region] || 1.0
  const defaultData = []
  
  for (let year = startYear; year <= endYear; year++) {
    curves.forEach(curve => {
      const yearOffset = year - startYear
      const escalation = 1 + (0.02 * yearOffset) // 2% annual escalation
      const basePrice = basePrices[curve] * multiplier
      const price = Math.round(basePrice * escalation * 100) / 100
      
      defaultData.push({
        year,
        curve,
        region,
        price,
        escalation: 2.0,
        volatility: curve === 'baseload' ? 10.0 : 15.0,
        isDefault: true,
        lastUpdated: new Date()
      })
    })
  }
  
  return defaultData
}