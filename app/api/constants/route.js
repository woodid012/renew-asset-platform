import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

// GET - Fetch default constants and settings
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // financial, technical, market, general
    
    // Build query
    const query = category ? { category } : {}
    
    // Fetch constants
    const constants = await db.collection('constants')
      .find(query)
      .sort({ category: 1, order: 1 })
      .toArray()
    
    // If no data exists, return default constants
    if (constants.length === 0) {
      const defaultConstants = getDefaultConstants(category)
      return NextResponse.json(defaultConstants)
    }
    
    // Format data for frontend
    const formattedConstants = constants.map(item => ({
      id: item._id.toString(),
      ...item,
      _id: undefined
    }))
    
    return NextResponse.json(formattedConstants)
    
  } catch (error) {
    console.error('Constants GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch constants' },
      { status: 500 }
    )
  }
}

// POST - Create new constant
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const constantData = await request.json()
    
    // Validate required fields
    if (!constantData.key || !constantData.category || constantData.value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, category, value' },
        { status: 400 }
      )
    }
    
    // Check if constant already exists
    const existing = await db.collection('constants').findOne({
      key: constantData.key,
      category: constantData.category
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Constant with this key already exists in category' },
        { status: 409 }
      )
    }
    
    const newConstant = {
      ...constantData,
      createdAt: new Date(),
      lastUpdated: new Date()
    }
    
    const result = await db.collection('constants').insertOne(newConstant)
    
    return NextResponse.json({
      id: result.insertedId.toString(),
      ...newConstant
    }, { status: 201 })
    
  } catch (error) {
    console.error('Constants POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create constant' },
      { status: 500 }
    )
  }
}

// PUT - Update existing constant
export async function PUT(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const { searchParams } = new URL(request.url)
    const constantId = searchParams.get('id')
    
    if (!constantId) {
      return NextResponse.json(
        { error: 'Constant ID is required' },
        { status: 400 }
      )
    }
    
    const updateData = await request.json()
    
    // Remove id from update data and add lastUpdated
    const { id, _id, ...dataToUpdate } = updateData
    dataToUpdate.lastUpdated = new Date()
    
    const result = await db.collection('constants').updateOne(
      { _id: new ObjectId(constantId) },
      { $set: dataToUpdate }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Constant not found' },
        { status: 404 }
      )
    }
    
    // Fetch and return updated constant
    const updatedConstant = await db.collection('constants').findOne({ _id: new ObjectId(constantId) })
    
    return NextResponse.json({
      id: updatedConstant._id.toString(),
      ...updatedConstant,
      _id: undefined
    })
    
  } catch (error) {
    console.error('Constants PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update constant' },
      { status: 500 }
    )
  }
}

// DELETE - Remove constant
export async function DELETE(request) {
  try {
    const client = await clientPromise
    const db = client.db('renewable_assets')
    
    const { searchParams } = new URL(request.url)
    const constantId = searchParams.get('id')
    
    if (!constantId) {
      return NextResponse.json(
        { error: 'Constant ID is required' },
        { status: 400 }
      )
    }
    
    const result = await db.collection('constants').deleteOne({
      _id: new ObjectId(constantId)
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Constant not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Constants DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete constant' },
      { status: 500 }
    )
  }
}

// Default constants if none exist in database
function getDefaultConstants(category) {
  const allDefaults = {
    financial: [
      {
        key: 'default_debt_ratio',
        category: 'financial',
        value: 70,
        unit: '%',
        description: 'Default debt ratio for project finance',
        order: 1
      },
      {
        key: 'default_equity_ratio',
        category: 'financial',
        value: 30,
        unit: '%',
        description: 'Default equity ratio for project finance',
        order: 2
      },
      {
        key: 'default_debt_rate',
        category: 'financial',
        value: 4.5,
        unit: '%',
        description: 'Default debt interest rate',
        order: 3
      },
      {
        key: 'target_equity_return',
        category: 'financial',
        value: 12.0,
        unit: '%',
        description: 'Target equity return (IRR)',
        order: 4
      },
      {
        key: 'corporate_tax_rate',
        category: 'financial',
        value: 30,
        unit: '%',
        description: 'Australian corporate tax rate',
        order: 5
      },
      {
        key: 'discount_rate',
        category: 'financial',
        value: 8.0,
        unit: '%',
        description: 'Default discount rate for NPV calculations',
        order: 6
      }
    ],
    technical: [
      {
        key: 'solar_capacity_factor',
        category: 'technical',
        value: 25,
        unit: '%',
        description: 'Default solar capacity factor',
        order: 1
      },
      {
        key: 'wind_capacity_factor',
        category: 'technical',
        value: 35,
        unit: '%',
        description: 'Default wind capacity factor',
        order: 2
      },
      {
        key: 'battery_capacity_factor',
        category: 'technical',
        value: 15,
        unit: '%',
        description: 'Default battery capacity factor',
        order: 3
      },
      {
        key: 'annual_degradation',
        category: 'technical',
        value: 0.5,
        unit: '%/year',
        description: 'Annual performance degradation',
        order: 4
      },
      {
        key: 'project_life',
        category: 'technical',
        value: 25,
        unit: 'years',
        description: 'Default project operational life',
        order: 5
      },
      {
        key: 'availability_factor',
        category: 'technical',
        value: 97,
        unit: '%',
        description: 'Default availability factor',
        order: 6
      }
    ],
    market: [
      {
        key: 'price_escalation',
        category: 'market',
        value: 2.0,
        unit: '%/year',
        description: 'Default electricity price escalation',
        order: 1
      },
      {
        key: 'baseload_price',
        category: 'market',
        value: 65,
        unit: '$/MWh',
        description: 'Default baseload electricity price',
        order: 2
      },
      {
        key: 'solar_price_discount',
        category: 'market',
        value: 15,
        unit: '%',
        description: 'Solar price discount vs baseload',
        order: 3
      },
      {
        key: 'wind_price_discount',
        category: 'market',
        value: 10,
        unit: '%',
        description: 'Wind price discount vs baseload',
        order: 4
      },
      {
        key: 'green_premium',
        category: 'market',
        value: 15,
        unit: '%',
        description: 'Green certificate premium',
        order: 5
      }
    ],
    general: [
      {
        key: 'default_region',
        category: 'general',
        value: 'QLD',
        unit: '',
        description: 'Default Australian region',
        order: 1
      },
      {
        key: 'currency',
        category: 'general',
        value: 'AUD',
        unit: '',
        description: 'Default currency',
        order: 2
      },
      {
        key: 'opex_percentage',
        category: 'general',
        value: 2.5,
        unit: '% of revenue',
        description: 'Default OPEX as percentage of revenue',
        order: 3
      },
      {
        key: 'maintenance_escalation',
        category: 'general',
        value: 2.5,
        unit: '%/year',
        description: 'Annual maintenance cost escalation',
        order: 4
      }
    ]
  }
  
  if (category && allDefaults[category]) {
    return allDefaults[category]
  }
  
  // Return all defaults if no category specified
  return Object.values(allDefaults).flat()
}