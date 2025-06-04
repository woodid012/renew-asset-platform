import { MongoClient } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

let client: MongoClient;
let db: any;

async function connectToDatabase() {
  if (!client) {
    try {
      client = new MongoClient(process.env.MONGODB_URI!, {
      });
      await client.connect();
      db = client.db(process.env.MONGODB_DB || 'energy_contracts');
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }
  return { client, db };
}

interface PriceCurveRecord {
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
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('price_curves');
    
    const { searchParams } = new URL(request.url);
    const curve = searchParams.get('curve') || 'Aurora Jan 2025';
    const year = searchParams.get('year');
    const profile = searchParams.get('profile') || 'baseload';
    const type = searchParams.get('type') || 'Energy';
    
    console.log(`Fetching price curves for: curve=${curve}, year=${year}, profile=${profile}, type=${type}`);
    
    // Build query
    const query: any = {
      curve: curve,
      profile: profile,
      type: type
    };
    
    if (year) {
      query.year = parseInt(year);
    }
    
    // Fetch data
    const priceCurveData = await collection.find(query).sort({ state: 1, month: 1 }).toArray();
    
    if (priceCurveData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `No price curve data found for the specified criteria`,
        query: query
      }, { status: 404 });
    }
    
    // Transform data into the format expected by the frontend
    // Group by state, then create monthly arrays
    const transformedData: { [state: string]: number[] } = {};
    
    // Get unique states
    const states = [...new Set(priceCurveData.map(record => record.state))];
    
    states.forEach(state => {
      // Get records for this state, sorted by month
      const stateRecords = priceCurveData
        .filter(record => record.state === state)
        .sort((a, b) => a.month - b.month);
      
      // If we have a specific year, get 12 months
      if (year) {
        transformedData[state] = Array(12).fill(0);
        stateRecords.forEach(record => {
          if (record.month >= 1 && record.month <= 12) {
            transformedData[state][record.month - 1] = record.price;
          }
        });
      } else {
        // If no year specified, get current year data (2025) or first available year
        const currentYear = new Date().getFullYear();
        const targetYear = currentYear;
        
        const yearRecords = stateRecords.filter(record => record.year === targetYear);
        
        if (yearRecords.length > 0) {
          transformedData[state] = Array(12).fill(0);
          yearRecords.forEach(record => {
            if (record.month >= 1 && record.month <= 12) {
              transformedData[state][record.month - 1] = record.price;
            }
          });
        } else {
          // Fallback to first available year for this state
          const firstYearRecords = stateRecords.filter(record => record.year === stateRecords[0]?.year).slice(0, 12);
          transformedData[state] = Array(12).fill(0);
          firstYearRecords.forEach(record => {
            if (record.month >= 1 && record.month <= 12) {
              transformedData[state][record.month - 1] = record.price;
            }
          });
        }
      }
    });
    
    // Get metadata about available data
    const availableYears = [...new Set(priceCurveData.map(record => record.year))].sort();
    const availableProfiles = [...new Set(priceCurveData.map(record => record.profile))];
    const availableTypes = [...new Set(priceCurveData.map(record => record.type))];
    const availableStates = states.sort();
    
    console.log(`Returning data for ${Object.keys(transformedData).length} states`);
    
    return NextResponse.json({
      success: true,
      marketPrices: transformedData,
      metadata: {
        curve: curve,
        profile: profile,
        type: type,
        year: year ? parseInt(year) : (year || 'current'),
        availableYears: availableYears,
        availableProfiles: availableProfiles,
        availableTypes: availableTypes,
        availableStates: availableStates,
        recordCount: priceCurveData.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching price curves:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch price curves',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    success: false, 
    error: 'POST method not supported for price curves API. Use the Python upload script instead.' 
  }, { status: 405 });
}