import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// GET - Fetch portfolio summary data
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts') // Using your existing database name
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || '6853b044dd2ecce8ba519ba5'
    const portfolioId = searchParams.get('portfolioId') || 'zebre'
    
    // Get portfolio from your existing collection
    const portfolio = await db.collection('portfolios').findOne({
      userId: userId,
      portfolioId: portfolioId
    })
    
    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
    }
    
    // Return the full portfolio structure
    const portfolioData = {
      version: portfolio.version || '2.0',
      portfolioName: portfolio.portfolioName || 'Portfolio',
      portfolioId: portfolio.portfolioId,
      userId: portfolio.userId,
      assets: portfolio.assets || {},
      constants: portfolio.constants || {},
      analysisMode: portfolio.analysisMode || 'simple',
      priceSource: portfolio.priceSource || 'merchant_price_monthly.csv',
      lastUpdated: portfolio.lastUpdated,
      createdAt: portfolio.createdAt
    }
    
    return NextResponse.json(portfolioData)
    
  } catch (error) {
    console.error('Portfolio API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    )
  }
}

// POST - Create or update portfolio
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const portfolioData = await request.json()
    
    // Use defaults if not provided
    const userId = portfolioData.userId || '6853b044dd2ecce8ba519ba5'
    const portfolioId = portfolioData.portfolioId || 'zebre'
    
    // Validate portfolio structure
    if (!portfolioData.assets && !portfolioData.portfolioName) {
      return NextResponse.json(
        { error: 'Invalid portfolio data structure' },
        { status: 400 }
      )
    }
    
    // Prepare the portfolio document
    const portfolioDoc = {
      userId,
      portfolioId,
      portfolioName: portfolioData.portfolioName || 'Portfolio',
      version: portfolioData.version || '2.0',
      assets: portfolioData.assets || {},
      constants: portfolioData.constants || {},
      analysisMode: portfolioData.analysisMode || 'simple',
      activePortfolio: portfolioData.activePortfolio || portfolioId,
      portfolioSource: portfolioData.portfolioSource,
      priceSource: portfolioData.priceSource || 'merchant_price_monthly.csv',
      lastUpdated: new Date(),
      exportDate: portfolioData.exportDate
    }
    
    // Check if portfolio exists
    const existingPortfolio = await db.collection('portfolios').findOne({
      userId: userId,
      portfolioId: portfolioId
    })
    
    let result
    if (existingPortfolio) {
      // Update existing portfolio
      portfolioDoc.createdAt = existingPortfolio.createdAt
      result = await db.collection('portfolios').updateOne(
        { userId, portfolioId },
        { $set: portfolioDoc }
      )
    } else {
      // Create new portfolio
      portfolioDoc.createdAt = new Date()
      result = await db.collection('portfolios').insertOne(portfolioDoc)
    }
    
    if (!result.acknowledged && !result.matchedCount) {
      return NextResponse.json(
        { error: 'Failed to save portfolio' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      portfolioId,
      message: existingPortfolio ? 'Portfolio updated successfully' : 'Portfolio created successfully',
      lastUpdated: portfolioDoc.lastUpdated
    }, { status: existingPortfolio ? 200 : 201 })
    
  } catch (error) {
    console.error('Portfolio POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save portfolio' },
      { status: 500 }
    )
  }
}

// DELETE - Remove portfolio
export async function DELETE(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || '6853b044dd2ecce8ba519ba5'
    const portfolioId = searchParams.get('portfolioId') || 'zebre'
    
    const result = await db.collection('portfolios').deleteOne({
      userId: userId,
      portfolioId: portfolioId
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Portfolio deleted successfully'
    })
    
  } catch (error) {
    console.error('Portfolio DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete portfolio' },
      { status: 500 }
    )
  }
}