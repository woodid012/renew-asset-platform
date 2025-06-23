import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

// GET - Fetch all users or specific user
export async function GET(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const email = searchParams.get('email')
    
    let query = {}
    if (userId) query._id = new ObjectId(userId)
    if (email) query.email = email
    
    if (userId || email) {
      // Get specific user
      const user = await db.collection('users').findOne(query)
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      // Also fetch user's portfolios
      const portfolios = await db.collection('portfolios').find({
        userId: user._id.toString()
      }).toArray()
      
      return NextResponse.json({
        id: user._id.toString(),
        ...user,
        _id: undefined,
        portfolios: portfolios.map(p => ({
          portfolioId: p.portfolioId,
          portfolioName: p.portfolioName || 'Unnamed Portfolio',
          lastUpdated: p.lastUpdated,
          assetCount: Object.keys(p.assets || {}).length
        }))
      })
    } else {
      // Get all users
      const users = await db.collection('users').find({}).toArray()
      
      // For each user, get portfolio count
      const usersWithPortfolios = await Promise.all(
        users.map(async (user) => {
          const portfolioCount = await db.collection('portfolios').countDocuments({
            userId: user._id.toString()
          })
          
          return {
            id: user._id.toString(),
            ...user,
            _id: undefined,
            portfolioCount
          }
        })
      )
      
      return NextResponse.json(usersWithPortfolios)
    }
    
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST - Create new user
export async function POST(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const userData = await request.json()
    
    // Validate required fields
    if (!userData.email || !userData.name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      )
    }
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      email: userData.email
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }
    
    // Create new user
    const newUser = {
      name: userData.name,
      email: userData.email,
      company: userData.company || '',
      role: userData.role || 'user',
      defaultPortfolio: userData.defaultPortfolio || 'main',
      preferences: userData.preferences || {
        theme: 'light',
        currency: 'AUD',
        dateFormat: 'DD/MM/YYYY',
        timezone: 'Australia/Sydney'
      },
      createdAt: new Date(),
      lastUpdated: new Date(),
      lastLogin: new Date(),
      isActive: true
    }
    
    const result = await db.collection('users').insertOne(newUser)
    
    // Create default portfolio for the user
    const defaultPortfolio = {
      userId: result.insertedId.toString(),
      portfolioId: userData.defaultPortfolio || 'main',
      portfolioName: `${userData.name}'s Portfolio`,
      version: '2.0',
      assets: {},
      constants: {},
      analysisMode: 'simple',
      priceSource: 'merchant_price_monthly.csv',
      createdAt: new Date(),
      lastUpdated: new Date()
    }
    
    await db.collection('portfolios').insertOne(defaultPortfolio)
    
    return NextResponse.json({
      id: result.insertedId.toString(),
      ...newUser,
      portfolios: [{
        portfolioId: defaultPortfolio.portfolioId,
        portfolioName: defaultPortfolio.portfolioName,
        lastUpdated: defaultPortfolio.lastUpdated,
        assetCount: 0
      }]
    }, { status: 201 })
    
  } catch (error) {
    console.error('Users POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// PUT - Update user
export async function PUT(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }
    
    const updateData = await request.json()
    
    // Remove sensitive fields and add lastUpdated
    const { id, _id, createdAt, ...dataToUpdate } = updateData
    dataToUpdate.lastUpdated = new Date()
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: dataToUpdate }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Fetch and return updated user
    const updatedUser = await db.collection('users').findOne({ 
      _id: new ObjectId(userId) 
    })
    
    return NextResponse.json({
      id: updatedUser._id.toString(),
      ...updatedUser,
      _id: undefined
    })
    
  } catch (error) {
    console.error('Users PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE - Remove user (and all their portfolios)
export async function DELETE(request) {
  try {
    const client = await clientPromise
    const db = client.db('energy_contracts')
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }
    
    // Delete all user's portfolios first
    const portfolioDeleteResult = await db.collection('portfolios').deleteMany({
      userId: userId
    })
    
    // Delete the user
    const userDeleteResult = await db.collection('users').deleteOne({
      _id: new ObjectId(userId)
    })
    
    if (userDeleteResult.deletedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: `User deleted successfully. ${portfolioDeleteResult.deletedCount} portfolios also removed.`
    })
    
  } catch (error) {
    console.error('Users DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}