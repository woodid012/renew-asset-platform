
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request) {
  try {
    const { startDate, endDate } = await request.json();

    const pythonScriptPath = path.join(process.cwd(), 'backend', 'main.py');

    const pythonProcess = spawn('python', [pythonScriptPath, startDate, endDate]);

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
    });

    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python process exited with code ${code}: ${pythonError}`));
        }
      });
    });

    const cashFlowData = JSON.parse(pythonOutput);

    return NextResponse.json({ cashFlows: cashFlowData });
  } catch (error) {
    console.error('Error running Python script:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
