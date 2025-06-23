import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

// GET - Fetch assets from portfolio
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts') // Using your existing database
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    
    // Build query for portfolio
    let query = {}
    if (userId) query.userId = userId
    if (portfolioId) query.portfolioId = portfolioId
    
    // Get portfolio(s)
    const portfolios = await db.collection('portfolios').find(query).toArray()
    
    if (portfolios.length === 0) {
      return NextResponse.json([]) // Return empty array if no portfolios
    }
    
    // Use first portfolio or specific one
    const portfolio = portfolios[0]
    const assets = portfolio.assets || {}
    
    // Convert assets object to array with proper IDs
    const assetArray = Object.entries(assets)
      .filter(([key, asset]) => asset && asset.name) // Filter out empty assets
      .map(([key, asset]) => ({
        id: key, // Use the object key as ID
        portfolioId: portfolio.portfolioId,
        ...asset,
        // Ensure numeric fields are properly parsed
        capacity: parseFloat(asset.capacity) || 0,
        totalCapex: parseFloat(asset.totalCapex) || 0,
        ppaPrice: parseFloat(asset.ppaPrice) || 0,
        contractDuration: parseInt(asset.contractDuration) || 0,
        escalation: parseFloat(asset.escalation) || 0,
        debtRatio: parseFloat(asset.debtRatio) || 0,
        equityRatio: parseFloat(asset.equityRatio) || 0,
        debtRate: parseFloat(asset.debtRate) || 0,
        equityReturn: parseFloat(asset.equityReturn) || 0,
        projectLife: parseInt(asset.projectLife) || 25
      }))
    
    return NextResponse.json(assetArray)
    
  } catch (error) {
    console.error('Assets GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}

// POST - Create new asset in portfolio
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const assetData = await request.json()
    const { userId, portfolioId } = assetData
    
    // Validate required fields
    if (!assetData.name || !assetData.type || !assetData.capacity) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, capacity' },
        { status: 400 }
      )
    }
    
    if (!userId || !portfolioId) {
      return NextResponse.json(
        { error: 'userId and portfolioId are required' },
        { status: 400 }
      )
    }
    
    // Find the portfolio
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
    
    // Find next available asset key
    const assets = portfolio.assets || {}
    const existingKeys = Object.keys(assets).map(k => parseInt(k)).filter(k => !isNaN(k))
    const nextKey = existingKeys.length > 0 ? Math.max(...existingKeys) + 1 : 1
    
    // Remove portfolio metadata from asset data
    const { userId: _, portfolioId: __, ...cleanAssetData } = assetData
    
    // Add metadata to asset
    const newAsset = {
      ...cleanAssetData,
      createdAt: new Date(),
      lastUpdated: new Date()
    }
    
    // Update portfolio with new asset
    const updatePath = `assets.${nextKey}`
    const result = await db.collection('portfolios').updateOne(
      { _id: portfolio._id },
      { 
        $set: { 
          [updatePath]: newAsset,
          lastUpdated: new Date()
        } 
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to add asset to portfolio' },
        { status: 500 }
      )
    }
    
    // Return created asset with ID
    const createdAsset = {
      id: nextKey.toString(),
      portfolioId,
      ...newAsset
    }
    
    return NextResponse.json(createdAsset, { status: 201 })
    
  } catch (error) {
    console.error('Assets POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    )
  }
}

// PUT - Update existing asset in portfolio
export async function PUT(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('id')
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    
    if (!assetId || !userId || !portfolioId) {
      return NextResponse.json(
        { error: 'Asset ID, userId, and portfolioId are required' },
        { status: 400 }
      )
    }
    
    const updateData = await request.json()
    
    // Remove metadata from update data
    const { id, portfolioId: _, userId: __, ...dataToUpdate } = updateData
    dataToUpdate.lastUpdated = new Date()
    
    // Update the specific asset in the portfolio
    const updatePath = `assets.${assetId}`
    const result = await db.collection('portfolios').updateOne(
      { 
        userId: userId,
        portfolioId: portfolioId 
      },
      { 
        $set: { 
          [updatePath]: dataToUpdate,
          lastUpdated: new Date()
        } 
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Portfolio or asset not found' },
        { status: 404 }
      )
    }
    
    // Return updated asset
    return NextResponse.json({
      id: assetId,
      portfolioId,
      ...dataToUpdate
    })
    
  } catch (error) {
    console.error('Assets PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    )
  }
}

// DELETE - Remove asset from portfolio
export async function DELETE(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('id')
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    
    if (!assetId || !userId || !portfolioId) {
      return NextResponse.json(
        { error: 'Asset ID, userId, and portfolioId are required' },
        { status: 400 }
      )
    }
    
    // Remove the asset from the portfolio
    const unsetPath = `assets.${assetId}`
    const result = await db.collection('portfolios').updateOne(
      { 
        userId: userId,
        portfolioId: portfolioId 
      },
      { 
        $unset: { [unsetPath]: "" },
        $set: { lastUpdated: new Date() }
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Assets DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    )
  }
}