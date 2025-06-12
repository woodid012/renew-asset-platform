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
  _id?: any;
  profile: string;
  type: string;
  state: string;
  time: string; // e.g., "1/07/2024" or ISO date string
  price: number;
  curve: string;
  date: Date; // MongoDB Date object
  year: number;
  month: number; // 1-12
  month_name: string;
  // Additional time granularity fields that might exist
  day?: number;
  hour?: number;
  minute?: number;
  quarter?: number;
  week?: number;
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
  day?: number;
  hour?: number;
  minute?: number;
  quarter?: number;
  week?: number;
}

interface EnhancedPriceCurveResponse {
  success: boolean;
  marketPrices: { [seriesKey: string]: TimeSeriesPoint[] };
  timeLabels: string[];
  isTimeSeries: boolean;
  metadata: {
    curve: string;
    profile: string;
    type: string;
    year: number | string;
    state: string;
    availableYears: number[];
    availableProfiles: string[];
    availableTypes: string[];
    availableStates: string[];
    recordCount: number;
    timePoints: number;
    seriesCount: number;
    timeResolution: string;
    startDate: string;
    endDate: string;
    dataFrequency: string;
    interval?: string;
  };
  query?: any; // For debugging
}

/**
 * Time Series Utilities for handling different time resolutions
 */
class TimeSeriesUtils {
  /**
   * Detect time resolution from data points
   */
  static detectTimeResolution(records: PriceCurveRecord[]): string {
    if (records.length < 2) return 'unknown';
    
    const sortedRecords = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const timeDiffs: number[] = [];
    
    for (let i = 1; i < Math.min(10, sortedRecords.length); i++) {
      const diff = new Date(sortedRecords[i].date).getTime() - new Date(sortedRecords[i-1].date).getTime();
      timeDiffs.push(diff);
    }
    
    const avgDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    const minutes = avgDiff / (1000 * 60);
    
    if (minutes <= 35) return '30min';
    if (minutes <= 65) return 'hourly';
    if (minutes <= 1500) return 'daily';
    if (minutes <= 10500) return 'weekly';
    if (minutes <= 45000) return 'monthly';
    if (minutes <= 135000) return 'quarterly';
    return 'yearly';
  }

  /**
   * Generate time labels based on resolution and data
   */
  static generateTimeLabels(records: PriceCurveRecord[], timeResolution: string): string[] {
    const uniqueTimes = new Set<string>();
    
    records.forEach(record => {
      let label: string;
      const date = new Date(record.date);
      
      switch (timeResolution) {
        case '30min':
        case 'hourly':
          label = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
          break;
        case 'daily':
          label = date.toISOString().substring(0, 10); // YYYY-MM-DD
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          label = `Week ${weekStart.toISOString().substring(0, 10)}`;
          break;
        case 'monthly':
          label = `${record.month_name} ${record.year}`;
          break;
        case 'quarterly':
          const quarter = Math.ceil(record.month / 3);
          label = `Q${quarter} ${record.year}`;
          break;
        case 'yearly':
          label = record.year.toString();
          break;
        default:
          label = record.time;
      }
      
      uniqueTimes.add(label);
    });
    
    return Array.from(uniqueTimes).sort();
  }

  /**
   * Create series key for grouping data
   */
  static createSeriesKey(record: PriceCurveRecord, includeProfile: boolean = true): string {
    const parts = [record.state];
    
    if (includeProfile && record.profile !== 'baseload') {
      parts.push(record.profile);
    }
    
    if (record.type !== 'Energy') {
      parts.push(record.type.toLowerCase());
    }
    
    return parts.join(' - ');
  }

  /**
   * Convert database record to TimeSeriesPoint
   */
  static recordToTimeSeriesPoint(record: PriceCurveRecord): TimeSeriesPoint {
    const date = new Date(record.date);
    
    return {
      time: record.time,
      price: record.price,
      date: date,
      year: record.year,
      month: record.month,
      monthName: record.month_name,
      day: record.day,
      hour: record.hour,
      minute: record.minute,
      quarter: record.quarter || Math.ceil(record.month / 3),
      week: record.week
    };
  }

  /**
   * Filter records by date range
   */
  static filterByDateRange(
    records: PriceCurveRecord[], 
    startDate?: string, 
    endDate?: string
  ): PriceCurveRecord[] {
    if (!startDate && !endDate) return records;
    
    return records.filter(record => {
      const recordDate = new Date(record.date);
      
      if (startDate && recordDate < new Date(startDate)) return false;
      if (endDate && recordDate > new Date(endDate)) return false;
      
      return true;
    });
  }

  /**
   * Aggregate data for different time resolutions
   */
  static aggregateByResolution(
    records: PriceCurveRecord[], 
    targetResolution: string
  ): PriceCurveRecord[] {
    if (targetResolution === 'auto') return records;
    
    const grouped = new Map<string, PriceCurveRecord[]>();
    
    records.forEach(record => {
      const groupKey = this.getAggregationKey(record, targetResolution);
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(record);
    });
    
    const aggregated: PriceCurveRecord[] = [];
    
    grouped.forEach((groupRecords, key) => {
      const avgPrice = groupRecords.reduce((sum, r) => sum + r.price, 0) / groupRecords.length;
      const firstRecord = groupRecords[0];
      
      aggregated.push({
        ...firstRecord,
        price: avgPrice,
        time: key
      });
    });
    
    return aggregated;
  }

  /**
   * Get aggregation key for grouping records
   */
  private static getAggregationKey(record: PriceCurveRecord, resolution: string): string {
    const date = new Date(record.date);
    
    switch (resolution) {
      case 'daily':
        return date.toISOString().substring(0, 10);
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().substring(0, 10);
      case 'monthly':
        return `${record.year}-${record.month.toString().padStart(2, '0')}`;
      case 'quarterly':
        const quarter = Math.ceil(record.month / 3);
        return `${record.year}-Q${quarter}`;
      case 'yearly':
        return record.year.toString();
      default:
        return record.time;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { db: connectedDb } = await connectToDatabase();
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves');
    
    const { searchParams } = new URL(request.url);
    
    // Enhanced parameters
    const curve = searchParams.get('curve') || 'Aurora Jan 2025';
    const yearParam = searchParams.get('year');
    const profile = searchParams.get('profile') || 'baseload';
    const type = searchParams.get('type') || 'Energy';
    const state = searchParams.get('state'); // New: specific state filter
    const startDateParam = searchParams.get('startDate'); // New: date range start
    const endDateParam = searchParams.get('endDate'); // New: date range end
    const timeResolution = searchParams.get('timeResolution') || 'auto'; // New: target resolution
    const includeMetadata = searchParams.get('includeMetadata') !== 'false';
    
    // Convert null to undefined for TypeScript compatibility
    const startDate = startDateParam || undefined;
    const endDate = endDateParam || undefined;
    
    console.log(`🔍 Enhanced price curve query:`, {
      curve, year: yearParam || 'all', profile, type, state: state || 'all',
      startDate, endDate, timeResolution
    });
    
    // Build base query
    const query: any = {
      curve: curve,
      type: type // Use exact type from request (keep original case)
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
    let yearToFilter: number | null = null;
    if (yearParam && yearParam.toLowerCase() !== 'all') {
      const parsedYear = parseInt(yearParam, 10);
      if (!isNaN(parsedYear)) {
        query.year = parsedYear;
        yearToFilter = parsedYear;
      } else {
        console.warn(`Invalid year parameter: ${yearParam}`);
      }
    }
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    console.log('📊 MongoDB query:', JSON.stringify(query, null, 2));
    
    // Fetch data with sorting
    const priceCurveData = await collection
      .find(query)
      .sort({ state: 1, profile: 1, date: 1 })
      .toArray();
    
    if (priceCurveData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: `No price curve data found for the specified criteria`,
        query: query
      }, { status: 404 });
    }
    
    console.log(`📈 Found ${priceCurveData.length} price curve records`);
    
    // Apply additional date filtering if needed
    const filteredData = TimeSeriesUtils.filterByDateRange(priceCurveData, startDate, endDate);
    
    // Detect or use specified time resolution
    const detectedResolution = TimeSeriesUtils.detectTimeResolution(filteredData);
    const actualResolution = timeResolution === 'auto' ? detectedResolution : timeResolution;
    
    console.log(`⏰ Time resolution: detected=${detectedResolution}, using=${actualResolution}`);
    
    // Aggregate data if needed
    const processedData = TimeSeriesUtils.aggregateByResolution(filteredData, actualResolution);
    
    // Group data by series (state, profile, type combinations)
    const seriesData: { [seriesKey: string]: TimeSeriesPoint[] } = {};
    const timeLabelsSet = new Set<string>();
    
    processedData.forEach(record => {
      const seriesKey = TimeSeriesUtils.createSeriesKey(record, profile === 'all');
      
      if (!seriesData[seriesKey]) {
        seriesData[seriesKey] = [];
      }
      
      const timeSeriesPoint = TimeSeriesUtils.recordToTimeSeriesPoint(record);
      seriesData[seriesKey].push(timeSeriesPoint);
      
      // Add to time labels for metadata
      timeLabelsSet.add(timeSeriesPoint.time);
    });
    
    // Sort each series by time
    Object.keys(seriesData).forEach(key => {
      seriesData[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    
    // Generate time labels
    const timeLabels = TimeSeriesUtils.generateTimeLabels(processedData, actualResolution);
    
    // Calculate date range from actual data
    const sortedDates = processedData.map(r => r.date).sort((a, b) => a.getTime() - b.getTime());
    const dataStartDate = sortedDates[0]?.toISOString().split('T')[0] || startDate || '2025-01-01';
    const dataEndDate = sortedDates[sortedDates.length - 1]?.toISOString().split('T')[0] || endDate || '2025-12-31';
    
    // Gather metadata if requested
    let metadata: any = {
      curve,
      profile,
      type,
      year: yearToFilter ? yearToFilter.toString() : 'all',
      state: state || 'all',
      recordCount: processedData.length,
      timePoints: timeLabels.length,
      seriesCount: Object.keys(seriesData).length,
      timeResolution: actualResolution,
      startDate: dataStartDate,
      endDate: dataEndDate,
      dataFrequency: actualResolution,
      availableYears: [],
      availableProfiles: [],
      availableTypes: [],
      availableStates: []
    };
    
    if (includeMetadata) {
      console.log('📊 Gathering comprehensive metadata...');
      
      // Get comprehensive metadata from all available data for this curve
      const metadataQuery = { curve: curve };
      const allData = await connectedDb.collection<PriceCurveRecord>('price_curves')
        .find(metadataQuery)
        .project({ year: 1, profile: 1, type: 1, state: 1 })
        .toArray();
      
      metadata.availableYears = [...new Set(allData.map(r => r.year))].sort((a, b) => a - b);
      metadata.availableProfiles = [...new Set(allData.map(r => r.profile))].sort();
      metadata.availableTypes = [...new Set(allData.map(r => r.type))].sort();
      metadata.availableStates = [...new Set(allData.map(r => r.state))].sort();
    }
    
    const response: EnhancedPriceCurveResponse = {
      success: true,
      marketPrices: seriesData,
      timeLabels: timeLabels,
      isTimeSeries: true,
      metadata: metadata
    };
    
    console.log(`✅ Returning enhanced price curve data:`, {
      seriesCount: response.metadata.seriesCount,
      timePoints: response.metadata.timePoints,
      timeResolution: response.metadata.timeResolution,
      dateRange: `${response.metadata.startDate} to ${response.metadata.endDate}`
    });
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Error in enhanced price curves API:', error);
    
    // Reset connection on MongoDB errors
    if (error.message && error.message.includes('Mongo')) {
      client = undefined;
      db = undefined;
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch enhanced price curves',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db: connectedDb } = await connectToDatabase();
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves');
    
    const body = await request.json();
    
    // Handle bulk insert of time series data
    if (Array.isArray(body)) {
      console.log(`📊 Bulk inserting ${body.length} price curve records`);
      
      // Validate and enhance records
      const processedRecords = body.map(record => {
        const date = new Date(record.time || record.date);
        
        return {
          ...record,
          date: date,
          year: record.year || date.getFullYear(),
          month: record.month || (date.getMonth() + 1),
          month_name: record.month_name || date.toLocaleString('default', { month: 'long' }),
          day: record.day || date.getDate(),
          hour: record.hour || date.getHours(),
          minute: record.minute || date.getMinutes(),
          quarter: record.quarter || Math.ceil((date.getMonth() + 1) / 3),
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
    
    const processedRecord = {
      ...record,
      date: date,
      year: record.year || date.getFullYear(),
      month: record.month || (date.getMonth() + 1),
      month_name: record.month_name || date.toLocaleString('default', { month: 'long' }),
      day: record.day || date.getDate(),
      hour: record.hour || date.getHours(),
      minute: record.minute || date.getMinutes(),
      quarter: record.quarter || Math.ceil((date.getMonth() + 1) / 3),
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

export async function PUT(request: NextRequest) {
  return NextResponse.json({ 
    success: false, 
    error: 'PUT method not supported. Use POST for inserting price curve data.' 
  }, { status: 405 });
}

export async function DELETE(request: NextRequest) {
  try {
    const { db: connectedDb } = await connectToDatabase();
    const collection = connectedDb.collection<PriceCurveRecord>('price_curves');
    
    const { searchParams } = new URL(request.url);
    const curve = searchParams.get('curve');
    const confirmDelete = searchParams.get('confirm') === 'true';
    
    if (!confirmDelete) {
      return NextResponse.json({ 
        error: 'Delete operation requires confirm=true parameter for safety' 
      }, { status: 400 });
    }
    
    if (!curve) {
      return NextResponse.json({ 
        error: 'Curve name is required for deletion' 
      }, { status: 400 });
    }
    
    const result = await collection.deleteMany({ curve: curve });
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} records for curve: ${curve}`,
      deletedCount: result.deletedCount
    });
    
  } catch (error: any) {
    console.error('❌ Error deleting price curve data:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to delete price curve data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}