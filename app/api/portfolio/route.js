import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// GET - Fetch portfolio summary data
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts') // Using your existing database name
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const portfolioId = searchParams.get('portfolioId')
    
    // Build query - if no specific portfolio, get the active one
    let query = {}
    if (userId) {
      query.userId = userId
    }
    if (portfolioId) {
      query.portfolioId = portfolioId
    }
    
    // Get portfolio(s) from your existing collection
    const portfolios = await db.collection('portfolios').find(query).toArray()
    
    if (portfolios.length === 0) {
      return NextResponse.json({ error: 'No portfolios found' }, { status: 404 })
    }
    
    // Use the first portfolio (or specific one if portfolioId provided)
    const portfolio = portfolios[0]
    
    // Extract assets from the portfolio structure
    const assets = portfolio.assets || {}
    const assetArray = Object.values(assets).filter(asset => asset && asset.name)
    
    // Calculate portfolio metrics
    const totalCapacity = assetArray.reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0)
    const totalProjects = assetArray.length
    
    // Calculate total revenue (based on asset data)
    const totalRevenue = assetArray.reduce((sum, asset) => {
      const capacityFactor = getCapacityFactor(asset.type)
      const price = parseFloat(asset.ppaPrice) || 65 // Default price if no PPA
      const capacity = parseFloat(asset.capacity) || 0
      const annualGeneration = capacity * capacityFactor * 8760 / 1000 // MWh
      const revenue = annualGeneration * price / 1000000 // Convert to millions
      return sum + revenue
    }, 0)
    
    // Calculate weighted average IRR
    const totalCapex = assetArray.reduce((sum, asset) => sum + (parseFloat(asset.totalCapex) || 0), 0)
    const avgIRR = totalCapex > 0 ? (totalRevenue / totalCapex) * 100 * 0.75 : 0 // Simplified IRR calc
    
    // Format asset data for dashboard
    const portfolioAssets = assetArray.map(asset => ({
      name: asset.name,
      type: asset.type || 'solar',
      capacity: parseFloat(asset.capacity) || 0,
      status: asset.status || 'planning',
      location: asset.location || 'Australia'
    }))
    
    const portfolioData = {
      portfolioId: portfolio.portfolioId,
      portfolioName: portfolio.portfolioName,
      totalCapacity: Math.round(totalCapacity * 10) / 10,
      totalProjects,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      irr: Math.round(avgIRR * 10) / 10,
      assets: portfolioAssets,
      analysisMode: portfolio.analysisMode,
      priceSource: portfolio.priceSource,
      lastUpdated: portfolio.lastUpdated || portfolio.updatedAt
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

// Helper function to get capacity factor by asset type
function getCapacityFactor(assetType) {
  switch (assetType?.toLowerCase()) {
    case 'solar': return 0.25
    case 'wind': return 0.35
    case 'battery': return 0.15
    case 'hybrid': return 0.30
    default: return 0.25
  }
}