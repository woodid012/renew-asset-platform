// Enhanced version of app/api/price-curves/route.ts with fallback for Green contracts

import { MongoClient, Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

let client: MongoClient | undefined;
let db: Db | undefined;

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

type ProjectedMetadata = Pick<PriceCurveRecord, 'year' | 'profile' | 'type' | 'state'>;

export async function GET(request: NextRequest) {
  try {
    const { db: connectedDb } = await connectToDatabase();
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves');
    
    const { searchParams } = new URL(request.url);
    const curve = searchParams.get('curve') || 'Aurora Jan 2025';
    const yearParam = searchParams.get('year');
    const profile = searchParams.get('profile') || 'baseload';
    const requestedType = searchParams.get('type') || 'Energy';
    
    console.log(`Fetching price curves for: curve=${curve}, year=${yearParam || 'all'}, profile=${profile}, type=${requestedType}`);
    
    // First, check what data is available
    const availableData = await collection.find({ curve: curve }).toArray();
    const availableTypes = [...new Set(availableData.map(r => r.type))];
    const availableProfiles = [...new Set(availableData.map(r => r.profile))];
    const availableStates = [...new Set(availableData.map(r => r.state))];
    
    console.log('Available in database:', {
      types: availableTypes,
      profiles: availableProfiles,
      states: availableStates,
      totalRecords: availableData.length
    });
    
    // Determine the actual type to query
    let actualType = requestedType;
    
    // Handle Green contracts - try different variations
    if (requestedType === 'Green') {
      const greenVariations = ['Green', 'green', 'GREEN', 'renewable', 'Renewable'];
      const foundGreenType = greenVariations.find(variation => 
        availableTypes.includes(variation)
      );
      
      if (foundGreenType) {
        actualType = foundGreenType;
        console.log(`Found Green data with type: ${actualType}`);
      } else {
        console.log('No Green price data found, falling back to Energy prices');
        actualType = 'Energy';
      }
    }
    
    // Build query
    const query: any = {
      curve: curve,
      type: actualType
    };
    
    if (profile && profile.toLowerCase() !== 'all') {
      query.profile = profile;
    }
    
    let yearToFilter: number | null = null;
    if (yearParam && yearParam.toLowerCase() !== 'all') {
      const parsedYear = parseInt(yearParam, 10);
      if (!isNaN(parsedYear)) {
        query.year = parsedYear;
        yearToFilter = parsedYear;
      }
    }
    
    // Fetch data
    let priceCurveData = await collection.find(query).sort({ state: 1, month: 1 }).toArray();
    
    // If no data found with the specific profile, try with 'baseload' as fallback
    if (priceCurveData.length === 0 && profile !== 'baseload') {
      console.log(`No data found for profile '${profile}', trying 'baseload'`);
      const fallbackQuery = { ...query, profile: 'baseload' };
      priceCurveData = await collection.find(fallbackQuery).sort({ state: 1, month: 1 }).toArray();
    }
    
    // If still no data, provide synthetic data for Green contracts
    if (priceCurveData.length === 0 && requestedType === 'Green') {
      console.log('Generating synthetic Green certificate prices');
      
      // Generate synthetic green certificate prices (typically $20-60/MWh)
      const syntheticGreenPrices = {
        NSW: [45, 42, 38, 35, 40, 48, 52, 55, 50, 44, 41, 47],
        VIC: [43, 40, 36, 33, 38, 46, 50, 53, 48, 42, 39, 45],
        QLD: [47, 44, 40, 37, 42, 50, 54, 57, 52, 46, 43, 49],
        SA: [49, 46, 42, 39, 44, 52, 56, 59, 54, 48, 45, 51],
        WA: [41, 38, 34, 31, 36, 44, 48, 51, 46, 40, 37, 43]
      };
      
      const transformedData: { [state: string]: number[] } = syntheticGreenPrices;
      const timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      return NextResponse.json({
        success: true,
        marketPrices: transformedData,
        timeLabels: timeLabels,
        isTimeSeries: false,
        synthetic: true, // Flag to indicate this is synthetic data
        metadata: {
          curve: curve,
          profile: profile,
          type: requestedType,
          year: yearToFilter ? yearToFilter.toString() : 'all',
          availableYears: [2025],
          availableProfiles: ['baseload'],
          availableTypes: ['Green'],
          availableStates: Object.keys(syntheticGreenPrices),
          recordCount: Object.keys(syntheticGreenPrices).length * 12,
          totalRecordsForCurveType: Object.keys(syntheticGreenPrices).length * 12,
          timePoints: 12,
          note: 'Synthetic Green certificate prices generated as fallback'
        }
      });
    }
    
    if (priceCurveData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `No price curve data found for the specified criteria`,
        debug: {
          requestedType,
          actualType,
          query,
          availableTypes,
          availableProfiles
        }
      }, { status: 404 });
    }
    
    // Transform data (existing logic)
    const transformedData: { [state: string]: number[] } = {};
    let timeLabels: string[] = [];
    
    const uniqueStatesSet = new Set<string>(priceCurveData.map((record: PriceCurveRecord) => record.state));
    const states: string[] = Array.from(uniqueStatesSet).sort();
        
    if (!yearToFilter) {
      const sortedData = priceCurveData.sort((a: PriceCurveRecord, b: PriceCurveRecord) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      const uniqueYearMonths = [...new Set(sortedData.map((record: PriceCurveRecord) => `${record.year}-${record.month.toString().padStart(2, '0')}`))].sort();
      timeLabels = uniqueYearMonths.map((dateStr) => { 
        const [yr, mnth] = dateStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(mnth, 10) - 1]} ${yr}`;
      });
      
      states.forEach(state => {
        const stateData: number[] = [];
        uniqueYearMonths.forEach(yearMonthKey => {
          const [targetYearStr, targetMonthStr] = yearMonthKey.split('-');
          const targetYear = parseInt(targetYearStr, 10);
          const targetMonth = parseInt(targetMonthStr, 10);
          
          const recordsForPeriod = priceCurveData.filter((record: PriceCurveRecord) => 
            record.state === state && 
            record.year === targetYear && 
            record.month === targetMonth
          );
          
          if (recordsForPeriod.length > 0) {
            const average = recordsForPeriod.reduce((sum: number, record: PriceCurveRecord) => sum + record.price, 0) / recordsForPeriod.length;
            stateData.push(parseFloat(average.toFixed(2)));
          } else {
            stateData.push(0);
          }
        });
        transformedData[state] = stateData;
      });
      
    } else {
      timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      states.forEach(state => {
        const monthlyAverages: number[] = Array(12).fill(0);
        
        for (let month = 1; month <= 12; month++) {
          const recordsForMonth = priceCurveData.filter((record: PriceCurveRecord) => 
            record.state === state &&
            record.year === yearToFilter &&
            record.month === month
          );
          
          if (recordsForMonth.length > 0) {
            const average = recordsForMonth.reduce((sum: number, record: PriceCurveRecord) => sum + record.price, 0) / recordsForMonth.length;
            monthlyAverages[month - 1] = parseFloat(average.toFixed(2));
          }
        }
        transformedData[state] = monthlyAverages;
      });
    }
    
    // Get metadata from all available data
    const allDataForCurveAndType = await collection.find({ curve: curve, type: actualType })
                                        .project<ProjectedMetadata>({ year: 1, profile: 1, type: 1, state: 1 })
                                        .toArray();

    const metadataYears = [...new Set(allDataForCurveAndType.map((record: Pick<PriceCurveRecord, 'year'>) => record.year))].sort((a, b) => a - b);
    const metadataProfiles = [...new Set(allDataForCurveAndType.map((record: Pick<PriceCurveRecord, 'profile'>) => record.profile))].sort();
    const metadataTypes = [...new Set(allDataForCurveAndType.map((record: Pick<PriceCurveRecord, 'type'>) => record.type))].sort();
    
    console.log(`Returning data for ${Object.keys(transformedData).length} states`);
    
    return NextResponse.json({
      success: true,
      marketPrices: transformedData,
      timeLabels: timeLabels,
      isTimeSeries: !yearToFilter,
      fallbackUsed: actualType !== requestedType, // Flag if we used fallback
      metadata: {
        curve: curve,
        profile: profile,
        type: requestedType, // Return the requested type
        actualType: actualType, // Include the actual type used
        year: yearToFilter ? yearToFilter.toString() : 'all',
        availableYears: metadataYears,
        availableProfiles: metadataProfiles,
        availableTypes: metadataTypes,
        availableStates: states,
        recordCount: priceCurveData.length,
        totalRecordsForCurveType: allDataForCurveAndType.length,
        timePoints: timeLabels.length
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching price curves:', error);
    if (error.message && error.message.includes('Mongo')) {
        client = undefined;
        db = undefined;
    }
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch price curves',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    success: false, 
    error: 'POST method not supported for this endpoint. Use GET to fetch price curves or the Python upload script for data submission.' 
  }, { status: 405 });
}