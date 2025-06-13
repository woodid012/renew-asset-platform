import { MongoClient, Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

let client: MongoClient | undefined;
let db: Db | undefined;

// In-memory cache for price curve data
const priceCache = new Map<string, any>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of priceCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      priceCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

async function connectToDatabase() {
  if (!client || !db) {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set.');
      }
      client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      db = client.db(process.env.MONGODB_DB || 'energy_contracts');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      client = undefined;
      db = undefined;
      throw error;
    }
  }
  if (!db) {
    throw new Error("Database not initialized after connection attempt.");
  }
  return { client, db };
}

interface PriceCurveRecord {
  _id?: any;
  profile: string;
  type: string;
  state: string;
  time: string;
  price: number;
  curve: string;
  date: Date;
  year: number;
  month: number;
  month_name: string;
  uploadedAt?: Date;
  updatedAt?: Date;
}

interface TimeSeriesPoint {
  time: string;
  price: number;
  date: Date;
  year: number;
  month: number;
  monthName: string;
}

interface PriceCurveResponse {
  success: boolean;
  marketPrices: { [seriesKey: string]: TimeSeriesPoint[] };
  metadata: {
    curve: string;
    profile: string;
    type: string;
    year: number | string;
    availableYears: number[];
    availableProfiles: string[];
    availableTypes: string[];
    availableStates: string[];
    recordCount: number;
    seriesCount: number;
  };
  cached?: boolean;
  query?: any;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const curve = searchParams.get('curve') || 'Aurora Jan 2025';
    const yearParam = searchParams.get('year');
    const profile = searchParams.get('profile') || 'baseload';
    const type = searchParams.get('type') || 'Energy';
    const state = searchParams.get('state');
    
    // Generate cache key
    const cacheKey = JSON.stringify({
      curve,
      year: yearParam || 'all',
      profile,
      type,
      state: state || 'all'
    });
    
    // Check cache first
    const cachedResult = priceCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      console.log(`🚀 Returning cached price data for key: ${cacheKey}`);
      return NextResponse.json({
        ...cachedResult.data,
        cached: true
      });
    }
    
    console.log(`🔍 Fetching fresh price curve data:`, {
      curve, year: yearParam || 'all', profile, type, state: state || 'all'
    });
    
    const { db: connectedDb } = await connectToDatabase();
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves');
    
    // Build base query
    const query: any = {
      curve: curve,
      type: type
    };
    
    // Add profile filter (allow 'all' to get multiple profiles)
    if (profile && profile.toLowerCase() !== 'all') {
      query.profile = profile;
    }
    
    // Add state filter (allow 'all' to get multiple states)
    if (state && state.toLowerCase() !== 'all') {
      query.state = state;
    }
    
    // Add year filter
    if (yearParam && yearParam.toLowerCase() !== 'all') {
      const parsedYear = parseInt(yearParam, 10);
      if (!isNaN(parsedYear)) {
        query.year = parsedYear;
      }
    }
    
    console.log('📊 MongoDB query:', JSON.stringify(query, null, 2));
    
    // Fetch data with sorting
    const priceCurveData = await collection
      .find(query)
      .sort({ state: 1, profile: 1, year: 1, month: 1 })
      .toArray();
    
    if (priceCurveData.length === 0) {
      const errorResponse = {
        success: false,
        error: `No price curve data found for the specified criteria`,
        marketPrices: {},
        metadata: {
          curve,
          profile,
          type,
          year: yearParam || 'all',
          availableYears: [],
          availableProfiles: [],
          availableTypes: [],
          availableStates: [],
          recordCount: 0,
          seriesCount: 0
        },
        query: query
      };
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    console.log(`📈 Found ${priceCurveData.length} price curve records`);
    
    // Group data by series (state, profile, type combinations)
    const seriesData: { [seriesKey: string]: TimeSeriesPoint[] } = {};
    
    priceCurveData.forEach(record => {
      const seriesKey = createSeriesKey(record);
      
      if (!seriesData[seriesKey]) {
        seriesData[seriesKey] = [];
      }
      
      const timeSeriesPoint: TimeSeriesPoint = {
        time: record.time,
        price: record.price,
        date: new Date(record.date),
        year: record.year,
        month: record.month,
        monthName: record.month_name
      };
      
      seriesData[seriesKey].push(timeSeriesPoint);
    });
    
    // Sort each series by month
    Object.keys(seriesData).forEach(key => {
      seriesData[key].sort((a, b) => a.month - b.month);
    });
    
    // Gather metadata
    const metadata = {
      curve,
      profile,
      type,
      year: yearParam || 'all',
      availableYears: [...new Set(priceCurveData.map(r => r.year))].sort((a, b) => a - b),
      availableProfiles: [...new Set(priceCurveData.map(r => r.profile))].sort(),
      availableTypes: [...new Set(priceCurveData.map(r => r.type))].sort(),
      availableStates: [...new Set(priceCurveData.map(r => r.state))].sort(),
      recordCount: priceCurveData.length,
      seriesCount: Object.keys(seriesData).length
    };
    
    const response: PriceCurveResponse = {
      success: true,
      marketPrices: seriesData,
      metadata: metadata
    };
    
    // Cache the result
    priceCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });
    
    console.log(`✅ Returning fresh price curve data and caching with key: ${cacheKey}`);
    console.log(`📊 Cache size: ${priceCache.size} entries`);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Error in price curves API:', error);
    
    // Reset connection on MongoDB errors
    if (error.message && error.message.includes('Mongo')) {
      client = undefined;
      db = undefined;
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch price curves',
      details: error instanceof Error ? error.message : String(error),
      marketPrices: {},
      metadata: {
        curve: 'Aurora Jan 2025',
        profile: 'baseload',
        type: 'Energy',
        year: 'all',
        availableYears: [],
        availableProfiles: [],
        availableTypes: [],
        availableStates: [],
        recordCount: 0,
        seriesCount: 0
      }
    }, { status: 500 });
  }
}

/**
 * Create series key for grouping data
 */
function createSeriesKey(record: PriceCurveRecord): string {
  const parts = [record.state];
  
  if (record.profile !== 'baseload') {
    parts.push(record.profile);
  }
  
  if (record.type !== 'Energy') {
    parts.push(record.type.toLowerCase());
  }
  
  return parts.join(' - ');
}

// Cache management endpoints
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'clear-cache') {
    const cacheSize = priceCache.size;
    priceCache.clear();
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${cacheSize} cached entries`,
      cacheSize: 0
    });
  }
  
  if (action === 'cache-stats') {
    const stats = {
      size: priceCache.size,
      keys: Array.from(priceCache.keys()),
      memoryUsage: process.memoryUsage()
    };
    
    return NextResponse.json({
      success: true,
      cache: stats
    });
  }
  
  return NextResponse.json({ 
    error: 'Invalid action. Use ?action=clear-cache or ?action=cache-stats' 
  }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const { db: connectedDb } = await connectToDatabase();
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves');
    
    const body = await request.json();
    
    // Handle bulk insert of time series data
    if (Array.isArray(body)) {
      console.log(`📊 Bulk inserting ${body.length} price curve records`);
      
      // Clear cache since we're adding new data
      priceCache.clear();
      console.log('🧹 Cleared price cache due to new data insert');
      
      // Validate and enhance records
      const processedRecords = body.map(record => {
        const date = new Date(record.time || record.date);
        
        return {
          ...record,
          date: date,
          year: record.year || date.getFullYear(),
          month: record.month || (date.getMonth() + 1),
          month_name: record.month_name || date.toLocaleString('default', { month: 'long' }),
          uploadedAt: new Date(),
          updatedAt: new Date()
        };
      });
      
      const result = await collection.insertMany(processedRecords);
      
      return NextResponse.json({
        success: true,
        message: `Successfully inserted ${result.insertedCount} price curve records`,
        insertedCount: result.insertedCount,
        insertedIds: Object.values(result.insertedIds)
      });
    }
    
    // Handle single record insert
    const record = body;
    const date = new Date(record.time || record.date);
    
    // Clear cache since we're adding new data
    priceCache.clear();
    console.log('🧹 Cleared price cache due to new data insert');
    
    const processedRecord = {
      ...record,
      date: date,
      year: record.year || date.getFullYear(),
      month: record.month || (date.getMonth() + 1),
      month_name: record.month_name || date.toLocaleString('default', { month: 'long' }),
      uploadedAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(processedRecord);
    
    return NextResponse.json({
      success: true,
      message: 'Successfully inserted price curve record',
      insertedId: result.insertedId
    });
    
  } catch (error: any) {
    console.error('❌ Error inserting price curve data:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to insert price curve data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}