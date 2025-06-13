// /api/price-curves/route.js
import { MongoClient, Db } from 'mongodb';
import { NextResponse, NextRequest } from 'next/server';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ProjectHalo:5apsFwxTlqN8WHQR@cluster0.quuwlhb.mongodb.net/energy_contracts?retryWrites=true&w=majority&appName=Cluster0';
const MONGODB_DB = process.env.MONGODB_DB || 'energy_contracts';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Define an interface for the query object
interface PriceCurveQuery {
  curve: string;
  Scenario: string;
  state?: string; // Optional property
  type?: string;  // Optional property
  FY?: number;    // Optional property
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const state = searchParams.get('state'); // Region from CSV
    const type = searchParams.get('type'); // ContracType from CSV
    const year = searchParams.get('year'); // FY from CSV
    const scenario = searchParams.get('scenario') || 'Central'; // Scenario from CSV
    const curve = searchParams.get('curve') || 'Aurora Jan 2025 Intervals';

    console.log('Price Curves API - Query params:', {
      state, type, year, scenario, curve
    });

    const { db } = await connectToDatabase();

    // Build MongoDB query for price_curves_intervals collection
    const query: PriceCurveQuery = { // Apply the defined interface here
      curve: curve,
      Scenario: scenario
    };

    if (state) query.state = state; // Region mapped to state
    if (type) query.type = type; // ContracType
    if (year && year !== 'all') {
      query.FY = parseInt(year); // Financial Year
    }

    console.log('MongoDB query:', query);

    // Query price_curves_intervals collection only
    const collection = db.collection('price_curves_intervals');
    const data = await collection.find(query).sort({ date: 1 }).toArray();

    console.log(`Found ${data.length} records`);

    interface TransformedRecord {
      time: string;
      price: number;
      date: string;
      year: number;
      month: number;
      monthName: string;
      state: string;
      type: string;
      financialYear: number;
      calendarYear: number;
      scenario: string;
      period: string;
      curve: string;
    }

    // Transform data for response
    const transformedData = data.map(record => ({
      time: record.time, // Interval_date
      price: record.price, // price_real_$
      date: record.date,
      year: record.year,
      month: record.month_num,
      monthName: record.month_name,
      state: record.state, // Region
      type: record.type, // ContracType
      financialYear: record.FY,
      calendarYear: record.CY,
      scenario: record.Scenario,
      period: record.period_30,
      curve: record.curve
    })) as TransformedRecord[];

    // Group by series (combination of state and type)
    const marketPrices: { [key: string]: TransformedRecord[] } = {};

    transformedData.forEach(record => {
      const seriesKey = `${record.state}-${record.type}`;

      if (!marketPrices[seriesKey]) {
        marketPrices[seriesKey] = [];
      }

      marketPrices[seriesKey].push(record);
    });

    // Sort each series by date
    Object.keys(marketPrices).forEach(seriesKey => {
      marketPrices[seriesKey].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    // Calculate summary statistics
    const totalRecords = transformedData.length;
    const availableStates = [...new Set(transformedData.map(r => r.state))];
    const availableTypes = [...new Set(transformedData.map(r => r.type))];
    const availableScenarios = [...new Set(transformedData.map(r => r.scenario))];
    const financialYears = [...new Set(transformedData.map(r => r.financialYear))].sort();
    const dateRange = transformedData.length > 0 ? {
      start: Math.min(...transformedData.map(r => new Date(r.date).getTime())),
      end: Math.max(...transformedData.map(r => new Date(r.date).getTime()))
    } : null;

    return NextResponse.json({
      success: true,
      query: query,
      totalRecords,
      seriesCount: Object.keys(marketPrices).length,
      availableStates,
      availableTypes,
      availableScenarios,
      financialYears,
      dateRange: dateRange ? {
        start: new Date(dateRange.start).toISOString().split('T')[0],
        end: new Date(dateRange.end).toISOString().split('T')[0]
      } : null,
      marketPrices,
      message: `Found ${totalRecords} records across ${Object.keys(marketPrices).length} series`
    });

  } catch (error: any) {
    console.error('Price Curves API Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Failed to fetch price curve data'
    }, { status: 500 });
  }
}