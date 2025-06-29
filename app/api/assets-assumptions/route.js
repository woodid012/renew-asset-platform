// app/api/asset-assumptions/route.js
import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

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
    const constants = portfolio.constants || {}
    const assetCosts = constants.assetCosts || {}
    
    // Build simplified assumptions object
    const assetAssumptions = {}
    
    Object.values(assets).forEach(asset => {
      const costs = assetCosts[asset.name] || {}
      
      assetAssumptions[asset.name] = {
        // Basic Asset Info
        name: asset.name,
        type: asset.type,
        state: asset.state,
        capacity: parseFloat(asset.capacity) || 0,
        volume: parseFloat(asset.volume) || 0,
        assetStartDate: asset.assetStartDate,
        constructionStartDate: asset.constructionStartDate,
        assetLife: asset.assetLife || 25,
        
        // Technical Assumptions
        volumeLossAdjustment: parseFloat(asset.volumeLossAdjustment) || 95,
        annualDegradation: parseFloat(asset.annualDegradation) || 0.5,
        qtrCapacityFactor_q1: parseFloat(asset.qtrCapacityFactor_q1) || null,
        qtrCapacityFactor_q2: parseFloat(asset.qtrCapacityFactor_q2) || null,
        qtrCapacityFactor_q3: parseFloat(asset.qtrCapacityFactor_q3) || null,
        qtrCapacityFactor_q4: parseFloat(asset.qtrCapacityFactor_q4) || null,
        
        // Financial Assumptions
        capex: costs.capex || 0,
        operatingCosts: costs.operatingCosts || 0,
        operatingCostEscalation: costs.operatingCostEscalation || 2.5,
        terminalValue: costs.terminalValue || 0,
        
        // Debt Assumptions
        maxGearing: costs.maxGearing || 0.7,
        targetDSCRContract: costs.targetDSCRContract || 1.4,
        targetDSCRMerchant: costs.targetDSCRMerchant || 1.8,
        interestRate: costs.interestRate || 0.06,
        tenorYears: costs.tenorYears || 20,
        debtStructure: costs.debtStructure || 'sculpting',
        
        // Construction & Equity Timing
        equityTimingUpfront: costs.equityTimingUpfront !== false,
        constructionDuration: costs.constructionDuration || 12,
        
        // Contract Summary
        contractCount: asset.contracts ? asset.contracts.length : 0,
        contracts: asset.contracts || []
      }
    })
    
    return NextResponse.json({
      portfolioName: portfolio.portfolioName,
      userId,
      portfolioId,
      assetCount: Object.keys(assetAssumptions).length,
      totalCapacity: Object.values(assetAssumptions).reduce((sum, asset) => sum + asset.capacity, 0),
      totalCapex: Object.values(assetAssumptions).reduce((sum, asset) => sum + asset.capex, 0),
      assets: assetAssumptions
    })
    
  } catch (error) {
    console.error('Asset assumptions API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset assumptions', details: error.message },
      { status: 500 }
    )
  }
}