// app/api/results/route.js
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');

  const resultsDirectory = path.join(process.cwd(), 'backend', 'results');

  try {
    // Check if results directory exists
    try {
      await fs.access(resultsDirectory);
      console.log(`✓ Results directory exists: ${resultsDirectory}`);
    } catch {
      console.error(`✗ Results directory not found: ${resultsDirectory}`);
      return new Response(
        JSON.stringify({ error: 'Results directory not found. Please run the backend model first.' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // List all files in the directory for debugging
    const allFiles = await fs.readdir(resultsDirectory);
    console.log(`Files in results directory:`, allFiles);

    if (assetId) {
      let filePath;
      let filename;
      
      if (assetId === 'assets_combined') {
        filename = 'assets_combined.json';
        filePath = path.join(resultsDirectory, filename);
      } else if (assetId === 'asset_inputs_summary') {
        filename = 'asset_inputs_summary.json';
        filePath = path.join(resultsDirectory, filename);
      } else {
        filename = `asset_${assetId}.json`;
        filePath = path.join(resultsDirectory, filename);
      }
      
      console.log(`Looking for file: ${filename} at path: ${filePath}`);
      
      try {
        await fs.access(filePath);
        console.log(`✓ File exists: ${filename}`);
        
        const fileContents = await fs.readFile(filePath, 'utf8');
        console.log(`✓ File read successfully: ${filename}, size: ${fileContents.length} bytes`);
        
        // Parse and handle NaN values
        const data = JSON.parse(fileContents);
        const cleanedData = cleanNaNValues(data);
        
        return new Response(JSON.stringify(cleanedData), { 
          headers: { 
            'Content-Type': 'application/json', 
            'Cache-Control': 'no-store' 
          } 
        });
      } catch (error) {
        console.error(`✗ Error reading file ${filename}:`, error);
        return new Response(
          JSON.stringify({ 
            error: `Error reading file: ${filename}`, 
            details: error.message,
            availableFiles: allFiles
          }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Return all individual asset files combined (exclude summary and combined files)
      const assetFiles = allFiles.filter(file => 
        file.startsWith('asset_') && 
        file.endsWith('.json') && 
        !file.includes('combined') && 
        !file.includes('summary')
      );
      
      console.log(`Asset files found:`, assetFiles);
      
      if (assetFiles.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No asset files found. Please run the backend model first.',
            availableFiles: allFiles
          }), 
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const allData = [];
      for (const file of assetFiles) {
        try {
          const filePath = path.join(resultsDirectory, file);
          const fileContents = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(fileContents);
          // Ensure data is an array before concatenating
          if (Array.isArray(data)) {
            allData.push(...data);
          } else {
            console.warn(`File ${file} does not contain an array`);
          }
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
        }
      }

      return new Response(JSON.stringify(cleanNaNValues(allData)), { 
        headers: { 
          'Content-Type': 'application/json', 
          'Cache-Control': 'no-store' 
        } 
      });
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to replace NaN values with null or appropriate defaults
function cleanNaNValues(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanNaNValues(item));
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number' && isNaN(value)) {
        cleaned[key] = null;
      } else {
        cleaned[key] = cleanNaNValues(value);
      }
    }
    return cleaned;
  }
  return obj;
}