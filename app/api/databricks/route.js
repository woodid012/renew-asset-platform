// app/api/databricks-simple/route.js
import { NextResponse } from 'next/server';

// Your Databricks connection details
const DATABRICKS_CONFIG = {
  host: "https://dbc-5563cebe-5df1.cloud.databricks.com",
  warehouse_id: "9fdae2ebaf20745b", // Extract from your http_path
  access_token: "dapiaa84fd29e7d6cd2b4306ad7d6852a6f3"
};

async function executeQueryHTTP(query) {
  try {
    console.log('Executing query via Databricks REST API:', query);
    
    const response = await fetch(`${DATABRICKS_CONFIG.host}/api/2.0/sql/statements`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DATABRICKS_CONFIG.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        statement: query,
        warehouse_id: DATABRICKS_CONFIG.warehouse_id,
        wait_timeout: '30s'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Databricks API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Databricks API response:', result);

    if (result.status?.state === 'SUCCEEDED') {
      const columns = result.manifest?.schema?.columns?.map(col => col.name) || [];
      const data = result.result?.data_array || [];
      
      return {
        success: true,
        columns,
        data,
        row_count: data.length,
        execution_time: result.result?.data_array?.length || 0
      };
    } else {
      const errorMessage = result.status?.error?.message || 'Query failed';
      return {
        success: false,
        error: errorMessage
      };
    }

  } catch (error) {
    console.error('Databricks HTTP query error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test';
    const table = searchParams.get('table');
    const limit = searchParams.get('limit') || '10';
    const customQuery = searchParams.get('q');

    let query;
    
    switch (action) {
      case 'test':
        query = "SELECT current_timestamp() as current_time, 'Connected to Databricks via HTTP!' as message";
        break;
        
      case 'tables':
        query = "SHOW TABLES";
        break;
        
      case 'sample':
        if (!table) {
          throw new Error('Table parameter required for sample action');
        }
        query = `SELECT * FROM ${table} LIMIT ${limit}`;
        break;
        
      case 'query':
        if (!customQuery) {
          throw new Error('Query parameter "q" is required');
        }
        query = customQuery;
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const result = await executeQueryHTTP(query);

    return NextResponse.json({
      action,
      timestamp: new Date().toISOString(),
      result,
      connection_method: 'HTTP_API'
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      throw new Error('Query is required in request body');
    }

    const result = await executeQueryHTTP(query);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      result,
      connection_method: 'HTTP_API'
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}