
import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

let client;
let clientPromise;

if (!uri) {
  throw new Error('Please add your MONGODB_URI to .env.local');
}

if (!dbName) {
  throw new Error('Please add your MONGODB_DB to .env.local');
}

// In production, it's best practice to use a global variable
// to avoid reconnecting on every API call.
if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection('PRICE_Curves_2'); // Targeting the new collection

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    let pipeline = [];

    // Stage to ensure TIME is a Date object. If it's a string, convert it.
    pipeline.push({
      $addFields: {
        TIME: {
          $cond: {
            if: { $type: "$TIME" },
            then: "$TIME",
            else: { $toDate: "$TIME" } // Attempt to convert if it's a string
          }
        }
      }
    });

    const fiscalYearStartMonth = 7; // Assuming July as the start month for fiscal year

    let groupStage = {
      _id: {
        REGION: '$REGION',
        PROFILE: '$PROFILE',
        TYPE: '$TYPE',
      },
      TIME: { $first: '$TIME' },
      PRICE: { $avg: '$PRICE' },
    };

    let sortStage = {};

    if (period === 'monthly') {
      groupStage._id.year = { $year: '$TIME' };
      groupStage._id.month = { $month: '$TIME' };
      sortStage = { '_id.year': 1, '_id.month': 1 };
    } else if (period === 'quarterly') {
      groupStage._id.year = { $year: '$TIME' };
      groupStage._id.quarter = { $ceil: { $divide: [{ $month: '$TIME' }, 3] } };
      sortStage = { '_id.year': 1, '_id.quarter': 1 };
    } else if (period === 'yearly') {
      groupStage._id.year = { $year: '$TIME' };
      sortStage = { '_id.year': 1 };
    } else if (period === 'fiscal_yearly') {
      // Project fiscal year first
      pipeline.push({
        $project: {
          _id: 0,
          TIME: '$TIME',
          PRICE: '$PRICE',
          REGION: '$REGION',
          PROFILE: '$PROFILE',
          TYPE: '$TYPE',
          fiscalYear: {
            $cond: {
              if: { $lt: [{ $month: '$TIME' }, fiscalYearStartMonth] },
              then: { $subtract: [{ $year: '$TIME' }, 1] },
              else: { $year: '$TIME' },
            },
          },
        },
      });
      groupStage._id.fiscalYear = '$fiscalYear';
      sortStage = { '_id.fiscalYear': 1 };
    } else {
      // Default: no aggregation, just sort by TIME
      pipeline.push({ $sort: { TIME: 1 } });
      // No grouping, so return directly
      const data = await collection.aggregate(pipeline).toArray();
      return NextResponse.json(data);
    }

    pipeline.push({ $group: groupStage });
    pipeline.push({ $sort: sortStage });

    const data = await collection.aggregate(pipeline).toArray();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching price curves directly from MongoDB:', error);
    return NextResponse.json({ message: 'Error fetching price curves', error: error.message }, { status: 500 });
  }
}
