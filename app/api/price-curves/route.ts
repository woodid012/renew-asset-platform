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
    
    console.log(`Fetching price curves for: curve=${curve}, year=${year || 'all'}, profile=${profile}, type=${type}`);
    
    // Build query
    const query: any = {
      curve: curve,
      type: type
    };
    
    // Only filter by profile if not "all"
    if (profile && profile !== 'all') {
      query.profile = profile;
    }
    
    // Only filter by year if specified and not "all"
    if (year && year !== 'all') {
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
    // Group by state, then create arrays (monthly or time series)
    const transformedData: { [state: string]: number[] } = {};
    let timeLabels: string[] = [];
    
    // Get unique states
    const states = [...new Set(priceCurveData.map(record => record.state))];
    
    // If "all" year is selected, create time series data
    if (!year || year === 'all') {
      // Create time series with all data points
      const sortedData = priceCurveData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      // Generate time labels
      const uniqueDates = [...new Set(sortedData.map(record => `${record.year}-${record.month.toString().padStart(2, '0')}`))].sort();
      timeLabels = uniqueDates.map(date => {
        const [year, month] = date.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      });
      
      states.forEach(state => {
        const stateData: number[] = [];
        
        uniqueDates.forEach(dateKey => {
          const [targetYear, targetMonth] = dateKey.split('-');
          
          // Find records for this state, year, and month
          const records = priceCurveData.filter(record => 
            record.state === state && 
            record.year === parseInt(targetYear) && 
            record.month === parseInt(targetMonth)
          );
          
          if (records.length > 0) {
            // If multiple profiles, average them
            const average = records.reduce((sum, record) => sum + record.price, 0) / records.length;
            stateData.push(average);
          } else {
            stateData.push(0);
          }
        });
        
        transformedData[state] = stateData;
      });
      
    } else {
      // Specific year selected - show 12 months
      timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      states.forEach(state => {
        // Group by month and calculate averages for the specific year
        const monthlyData: { [month: number]: number[] } = {};
        
        const stateRecords = priceCurveData.filter(record => record.state === state);
        
        stateRecords.forEach(record => {
          if (!monthlyData[record.month]) {
            monthlyData[record.month] = [];
          }
          monthlyData[record.month].push(record.price);
        });
        
        // Calculate monthly averages
        transformedData[state] = Array(12).fill(0);
        for (let month = 1; month <= 12; month++) {
          if (monthlyData[month] && monthlyData[month].length > 0) {
            const average = monthlyData[month].reduce((sum, price) => sum + price, 0) / monthlyData[month].length;
            transformedData[state][month - 1] = average;
          }
        }
      });
    }
    
    // Get metadata about available data (from all data, not filtered)
    const allDataQuery = { curve: curve, type: type };
    const allData = await collection.find(allDataQuery).toArray();
    
    const availableYears = [...new Set(allData.map(record => record.year))].sort();
    const availableProfiles = [...new Set(allData.map(record => record.profile))];
    const availableTypes = [...new Set(allData.map(record => record.type))];
    const availableStates = [...new Set(allData.map(record => record.state))].sort();
    
    console.log(`Returning data for ${Object.keys(transformedData).length} states`);
    
    return NextResponse.json({
      success: true,
      marketPrices: transformedData,
      timeLabels: timeLabels,
      isTimeSeries: !year || year === 'all',
      metadata: {
        curve: curve,
        profile: profile,
        type: type,
        year: year || 'all',
        availableYears: availableYears,
        availableProfiles: availableProfiles,
        availableTypes: availableTypes,
        availableStates: availableStates,
        recordCount: priceCurveData.length,
        timePoints: timeLabels.length
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