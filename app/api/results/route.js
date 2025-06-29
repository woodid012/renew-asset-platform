import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');

  const resultsDirectory = path.join(process.cwd(), 'backend', 'results');

  try {
    if (assetId) {
      let filePath;
      if (assetId === 'assets_combined' || assetId === 'asset_inputs_summary') {
        filePath = path.join(resultsDirectory, `${assetId}.json`);
      } else {
        filePath = path.join(resultsDirectory, `asset_${assetId}.json`);
      }
      const fileContents = await fs.readFile(filePath, 'utf8');
      return new Response(fileContents, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } else {
      const files = await fs.readdir(resultsDirectory);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const allData = await Promise.all(jsonFiles.map(async (file) => {
        const filePath = path.join(resultsDirectory, file);
        const fileContents = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContents);
      }));

      return new Response(JSON.stringify(allData.flat()), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  } catch (error) {
    console.error('Error reading results files:', error);
    return new Response(JSON.stringify({ error: 'Failed to load data' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
