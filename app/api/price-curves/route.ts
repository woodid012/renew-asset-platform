import { MongoClient, Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

let client: MongoClient | undefined;
let db: Db | undefined;

async function connectToDatabase() {
  if (!client || !db) { // Check for db as well, ensure client is connected
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
      // If connection fails, reset client and db so next request can retry
      client = undefined;
      db = undefined;
      throw error; // Re-throw error to be caught by the handler
    }
  }
  // Ensure db is returned, as client alone is not enough
  if (!db) {
    // This case should ideally not be reached if client.connect succeeded
    // but as a safeguard:
    throw new Error("Database not initialized after connection attempt.");
  }
  return { client, db };
}

interface PriceCurveRecord {
  profile: string;
  type: string;
  state: string;
  time: string; // Assuming time is a string, adjust if it's a different type (e.g., ISODate string)
  price: number;
  curve: string;
  date: Date; // MongoDB driver typically converts BSON Dates to JS Date objects
  year: number;
  month: number; // 1-12
  month_name: string;
}

export async function GET(request: NextRequest) {
  try {
    const { db: connectedDb } = await connectToDatabase(); // Renamed to avoid conflict
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves'); // Specify collection type
    
    const { searchParams } = new URL(request.url);
    const curve = searchParams.get('curve') || 'Aurora Jan 2025';
    const yearParam = searchParams.get('year'); // Keep as string or null
    const profile = searchParams.get('profile') || 'baseload';
    const type = searchParams.get('type') || 'Energy';
    
    console.log(`Fetching price curves for: curve=${curve}, year=${yearParam || 'all'}, profile=${profile}, type=${type}`);
    
    // Build query
    const query: any = { // Using 'any' for query flexibility, can be tightened
      curve: curve,
      type: type
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
      } else {
        console.warn(`Invalid year parameter received: ${yearParam}. Ignoring year filter.`);
      }
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
    
    const transformedData: { [state: string]: number[] } = {};
    let timeLabels: string[] = [];
    
    // FIX: Explicitly type `states` as string[]
    const uniqueStatesSet = new Set<string>(priceCurveData.map((record: PriceCurveRecord) => record.state));
    const states: string[] = Array.from(uniqueStatesSet).sort(); // Also sort states for consistent order
        
    if (!yearToFilter) { // "all" years selected or no year specified
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
      
      states.forEach(state => { // state is now correctly typed as string
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
            stateData.push(parseFloat(average.toFixed(2))); // Round to 2 decimal places
          } else {
            stateData.push(0); // Or null, or handle as needed
          }
        });
        transformedData[state] = stateData; // This line should now work
      });
      
    } else { // Specific year selected
      timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      states.forEach(state => { // state is now correctly typed as string
        const monthlyAverages: number[] = Array(12).fill(0); // Or null
        
        for (let month = 1; month <= 12; month++) {
          const recordsForMonth = priceCurveData.filter((record: PriceCurveRecord) => 
            record.state === state &&
            record.year === yearToFilter && // Ensure we are filtering by the selected year
            record.month === month
          );
          
          if (recordsForMonth.length > 0) {
            const average = recordsForMonth.reduce((sum: number, record: PriceCurveRecord) => sum + record.price, 0) / recordsForMonth.length;
            monthlyAverages[month - 1] = parseFloat(average.toFixed(2)); // Round to 2 decimal places
          }
        }
        transformedData[state] = monthlyAverages; // This line should now work
      });
    }
    
    // Metadata: Consider optimizing this if `allData` is very large.
    // For now, keeping original logic but ensuring collection type.
    const allDataForCurveAndType = await connectedDb.collection<PriceCurveRecord>('price_curves')
                                        .find({ curve: curve, type: type })
                                        .project({ year: 1, profile: 1, type: 1, state: 1 }) // Project only needed fields
                                        .toArray();

    const availableYears = [...new Set(allDataForCurveAndType.map((record: Pick<PriceCurveRecord, 'year'>) => record.year))].sort((a, b) => a - b);
    const availableProfiles = [...new Set(allDataForCurveAndType.map((record: Pick<PriceCurveRecord, 'profile'>) => record.profile))].sort();
    const availableTypes = [...new Set(allDataForCurveAndType.map((record: Pick<PriceCurveRecord, 'type'>) => record.type))].sort();
    // `states` is already calculated and sorted above
    
    console.log(`Returning data for ${Object.keys(transformedData).length} states`);
    
    return NextResponse.json({
      success: true,
      marketPrices: transformedData,
      timeLabels: timeLabels,
      isTimeSeries: !yearToFilter,
      metadata: {
        curve: curve,
        profile: profile,
        type: type,
        year: yearToFilter ? yearToFilter.toString() : 'all',
        availableYears: availableYears,
        availableProfiles: availableProfiles,
        availableTypes: availableTypes,
        availableStates: states, // Use the already computed and sorted states
        recordCount: priceCurveData.length, // Records matching current filter
        totalRecordsForCurveType: allDataForCurveAndType.length, // Total records for this curve/type combination
        timePoints: timeLabels.length
      }
    });
    
  } catch (error: any) { // Catch as any or unknown then check type
    console.error('Error fetching price curves:', error);
    // Ensure client is reset if it's a MongoDB connection error that connectToDatabase might have missed re-throwing
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
  // It's good practice to explicitly handle methods you don't support.
  return NextResponse.json({ 
    success: false, 
    error: 'POST method not supported for this endpoint. Use GET to fetch price curves or the Python upload script for data submission.' 
  }, { status: 405 }); // Method Not Allowed
}
