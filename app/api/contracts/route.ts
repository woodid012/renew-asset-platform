import { MongoClient, ObjectId } from 'mongodb';
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

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contracts');

    // REMOVED: No more sample data insertion - just fetch existing contracts
    const contracts = await collection.find({}).toArray();
    return NextResponse.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contracts');
    const contractData = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'type', 'category', 'state', 'counterparty'];
    const missingFields = requiredFields.filter(field => !contractData[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        missingFields 
      }, { status: 400 });
    }

    // Set default values and process enhanced fields
    contractData.status = contractData.status || 'active';
    contractData.unit = contractData.unit || 'Energy';
    contractData.direction = contractData.direction || 'sell';
    contractData.volumeShape = contractData.volumeShape || 'flat';
    contractData.pricingType = contractData.pricingType || 'fixed';
    contractData.dataSource = contractData.dataSource || 'manual';
    contractData.createdAt = new Date();
    contractData.updatedAt = new Date();

    // Handle volume data - calculate derived fields
    if (contractData.timeSeriesData && Array.isArray(contractData.timeSeriesData)) {
      // Calculate total volume from time series
      contractData.totalVolume = contractData.timeSeriesData.reduce((sum: number, data: any) => sum + (data.volume || 0), 0);
      
      // Extract years covered
      const years = new Set<number>();
      contractData.timeSeriesData.forEach((data: any) => {
        if (data.period) {
          const year = parseInt(data.period.split('-')[0]);
          if (!isNaN(year)) years.add(year);
        }
      });
      contractData.yearsCovered = Array.from(years).sort();
      
      // Update annual volume to match total if using time series
      if (contractData.totalVolume > 0) {
        contractData.annualVolume = contractData.totalVolume;
      }
    }

    // Handle tenor - ensure it's properly structured
    if (contractData.tenor && typeof contractData.tenor === 'object') {
      contractData.tenor = {
        value: Number(contractData.tenor.value) || 1,
        unit: contractData.tenor.unit || 'years'
      };
    }

    // Handle time-based pricing
    if (contractData.timeBasedPricing && typeof contractData.timeBasedPricing === 'object') {
      // Ensure periods array exists
      contractData.timeBasedPricing.periods = contractData.timeBasedPricing.periods || [];
      contractData.timeBasedPricing.defaultPrice = Number(contractData.timeBasedPricing.defaultPrice) || 0;
    }

    // Handle price time series
    if (contractData.priceTimeSeries && Array.isArray(contractData.priceTimeSeries)) {
      contractData.priceTimeSeries = contractData.priceTimeSeries.map((price: any) => Number(price) || 0);
    }

    // Handle LWP (Load Weighted Price) fields - NEW
    if (contractData.lwpPercentage !== undefined) {
      contractData.lwpPercentage = Number(contractData.lwpPercentage) || 100;
    }

    // Handle LWP time series - NEW
    if (contractData.lwpTimeSeries && Array.isArray(contractData.lwpTimeSeries)) {
      contractData.lwpTimeSeries = contractData.lwpTimeSeries.map((lwp: any) => Number(lwp) || 100);
    }

    // Handle LWP interval - NEW
    if (contractData.lwpInterval) {
      contractData.lwpInterval = contractData.lwpInterval;
    }

    // Handle LWP notes - NEW
    if (contractData.lwpNotes) {
      contractData.lwpNotes = contractData.lwpNotes;
    }

    // Ensure numeric fields are numbers
    contractData.annualVolume = Number(contractData.annualVolume) || 0;
    contractData.strikePrice = Number(contractData.strikePrice) || 0;
    contractData.escalationRate = contractData.escalationRate ? Number(contractData.escalationRate) : undefined;

    const result = await collection.insertOne(contractData);
    
    if (result.acknowledged) {
      const newContract = await collection.findOne({ _id: result.insertedId });
      return NextResponse.json(newContract, { status: 201 });
    } else {
      return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating contract:', error);
    return NextResponse.json({ 
      error: 'Failed to create contract', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contracts');
    const { id, _id, ...updateData } = await request.json();
    
    // Use either id or _id
    const contractId = id || _id;
    
    if (!contractId) {
      return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
    }

    // Process enhanced fields before update
    updateData.updatedAt = new Date();

    // Handle volume data - calculate derived fields
    if (updateData.timeSeriesData && Array.isArray(updateData.timeSeriesData)) {
      // Calculate total volume from time series
      updateData.totalVolume = updateData.timeSeriesData.reduce((sum: number, data: any) => sum + (data.volume || 0), 0);
      
      // Extract years covered
      const years = new Set<number>();
      updateData.timeSeriesData.forEach((data: any) => {
        if (data.period) {
          const year = parseInt(data.period.split('-')[0]);
          if (!isNaN(year)) years.add(year);
        }
      });
      updateData.yearsCovered = Array.from(years).sort();
      
      // Update annual volume to match total if using time series
      if (updateData.totalVolume > 0) {
        updateData.annualVolume = updateData.totalVolume;
      }
    }

    // Handle tenor - ensure it's properly structured
    if (updateData.tenor && typeof updateData.tenor === 'object') {
      updateData.tenor = {
        value: Number(updateData.tenor.value) || 1,
        unit: updateData.tenor.unit || 'years'
      };
    }

    // Handle time-based pricing
    if (updateData.timeBasedPricing && typeof updateData.timeBasedPricing === 'object') {
      // Ensure periods array exists
      updateData.timeBasedPricing.periods = updateData.timeBasedPricing.periods || [];
      updateData.timeBasedPricing.defaultPrice = Number(updateData.timeBasedPricing.defaultPrice) || 0;
    }

    // Handle price time series
    if (updateData.priceTimeSeries && Array.isArray(updateData.priceTimeSeries)) {
      updateData.priceTimeSeries = updateData.priceTimeSeries.map((price: any) => Number(price) || 0);
    }

    // Handle LWP (Load Weighted Price) fields - NEW
    if (updateData.lwpPercentage !== undefined) {
      updateData.lwpPercentage = Number(updateData.lwpPercentage) || 100;
    }

    // Handle LWP time series - NEW
    if (updateData.lwpTimeSeries && Array.isArray(updateData.lwpTimeSeries)) {
      updateData.lwpTimeSeries = updateData.lwpTimeSeries.map((lwp: any) => Number(lwp) || 100);
    }

    // Handle LWP interval - NEW
    if (updateData.lwpInterval !== undefined) {
      updateData.lwpInterval = updateData.lwpInterval;
    }

    // Handle LWP notes - NEW
    if (updateData.lwpNotes !== undefined) {
      updateData.lwpNotes = updateData.lwpNotes;
    }

    // Ensure numeric fields are numbers
    if (updateData.annualVolume !== undefined) {
      updateData.annualVolume = Number(updateData.annualVolume) || 0;
    }
    if (updateData.strikePrice !== undefined) {
      updateData.strikePrice = Number(updateData.strikePrice) || 0;
    }
    if (updateData.escalationRate !== undefined) {
      updateData.escalationRate = updateData.escalationRate ? Number(updateData.escalationRate) : undefined;
    }

    // Remove undefined values to avoid overwriting with undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const result = await collection.updateOne(
      { _id: new ObjectId(contractId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const updatedContract = await collection.findOne({ _id: new ObjectId(contractId) });
    return NextResponse.json(updatedContract);
  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ 
      error: 'Failed to update contract', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contracts');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    console.error('Error deleting contract:', error);
    return NextResponse.json({ 
      error: 'Failed to delete contract', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}