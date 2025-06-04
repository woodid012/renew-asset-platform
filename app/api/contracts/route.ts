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

// Sample contract data to populate database
const sampleContracts = [
  {
    name: "NSW Solar Farm Offtake",
    type: "offtake",
    category: "Solar Farm",
    state: "NSW",
    counterparty: "Sunpower Energy",
    startDate: "2026-01-01",
    endDate: "2035-12-31",
    annualVolume: 250000,
    strikePrice: 65.50,
    unit: "Energy",
    volumeShape: "solar",
    status: "active",
    indexation: "CPI",
    referenceDate: "2026-01-01"
  },
  {
    name: "VIC Wind Farm PPA",
    type: "offtake",
    category: "Wind Farm",
    state: "VIC",
    counterparty: "WindGen Australia",
    startDate: "2026-06-01",
    endDate: "2040-05-31",
    annualVolume: 400000,
    strikePrice: 58.75,
    unit: "Energy",
    volumeShape: "wind",
    status: "active",
    indexation: "Fixed",
    referenceDate: "2026-06-01"
  },
  {
    name: "SA Government Retail Contract",
    type: "retail",
    category: "Retail Customer",
    state: "SA",
    counterparty: "SA Government",
    startDate: "2026-07-01",
    endDate: "2029-06-30",
    annualVolume: 180000,
    strikePrice: 95.20,
    unit: "Energy",
    volumeShape: "flat",
    status: "active",
    indexation: "CPI + 1%",
    referenceDate: "2026-07-01"
  },
  {
    name: "NSW Baseload Swap",
    type: "wholesale",
    category: "Swap",
    state: "NSW",
    counterparty: "Energy Trader Co",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    annualVolume: 500000,
    strikePrice: 72.30,
    unit: "Energy",
    volumeShape: "flat",
    status: "pending",
    indexation: "Fixed",
    referenceDate: "2026-01-01"
  },
  {
    name: "QLD Industrial Customer",
    type: "retail",
    category: "Retail Customer",
    state: "QLD",
    counterparty: "Mining Corp Ltd",
    startDate: "2026-03-01",
    endDate: "2031-02-28",
    annualVolume: 320000,
    strikePrice: 89.50,
    unit: "Energy",
    volumeShape: "custom",
    status: "active",
    indexation: "CPI + 0.5%",
    referenceDate: "2026-03-01"
  }
];

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contracts');

    // Check if contracts exist, if not, populate with sample data
    const contractCount = await collection.countDocuments();
    
    if (contractCount === 0) {
      console.log('No contracts found, inserting sample data...');
      const result = await collection.insertMany(sampleContracts);
      console.log(`Inserted ${result.insertedCount} sample contracts`);
    }

    // Fetch all contracts
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
    const requiredFields = ['name', 'type', 'category', 'state', 'counterparty', 'annualVolume', 'strikePrice'];
    const missingFields = requiredFields.filter(field => !contractData[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        missingFields 
      }, { status: 400 });
    }

    // Set default values
    contractData.status = contractData.status || 'active';
    contractData.unit = contractData.unit || 'Energy';
    contractData.volumeShape = contractData.volumeShape || 'flat';
    contractData.createdAt = new Date();
    contractData.updatedAt = new Date();

    const result = await collection.insertOne(contractData);
    
    if (result.acknowledged) {
      const newContract = await collection.findOne({ _id: result.insertedId });
      return NextResponse.json(newContract, { status: 201 });
    } else {
      return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating contract:', error);
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contracts');
    const { id, ...updateData } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
    }

    updateData.updatedAt = new Date();

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const updatedContract = await collection.findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedContract);
  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ error: 'Failed to update contract' }, { status: 500 });
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
    return NextResponse.json({ error: 'Failed to delete contract' }, { status: 500 });
  }
}