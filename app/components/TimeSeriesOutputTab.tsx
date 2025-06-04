'use client';

import { useState } from 'react';

interface Contract {
  _id?: string;
  id?: number;
  name: string;
  type: 'retail' | 'wholesale' | 'offtake';
  category: string;
  state: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  annualVolume: number;
  strikePrice: number;
  unit: string;
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  indexation: string;
  referenceDate: string;
}

interface TimeSeriesRow {
  buysell: string;
  deal_name: string;
  state: string;
  type: string;
  month_start: number;
  year: number;
  fy: number;
  unit: string;
  scenario: string;
  sub_type: string;
  volume_pct: number;
  volume_mwh: string;
  strike_price: number;
  strike_price_x_volume: number;
  market_price: number;
  market_price_x_volume: number;
  net_mtm: number;
}

interface TimeSeriesOutputTabProps {
  contracts: Contract[];
  timeSeriesData: TimeSeriesRow[];
  setTimeSeriesData: (data: TimeSeriesRow[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  marketPrices: { [key: string]: number[] };
  volumeShapes: { [key: string]: number[] };
}

export default function TimeSeriesOutputTab({
  contracts,
  timeSeriesData,
  setTimeSeriesData,
  isLoading,
  setIsLoading,
  marketPrices,
  volumeShapes,
}: TimeSeriesOutputTabProps) {
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [year, setYear] = useState('2026');
  const [interval, setInterval] = useState('M');
  const [scenario, setScenario] = useState('Central');
  const [exportFormat, setExportFormat] = useState('csv');

  const generateTimeSeries = async () => {
    setIsLoading(true);
    
    let outputData: TimeSeriesRow[] = [];
    const contractsToProcess = selectedContracts.length > 0 
      ? contracts.filter(c => selectedContracts.includes(c._id || c.id?.toString() || ''))
      : contracts;
    
    contractsToProcess.forEach(contract => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const volumeProfile = volumeShapes[contract.volumeShape];
      
      if (interval === 'M') {
        months.forEach((month, index) => {
          const buySell = contract.type === 'retail' ? 'Sell' : 'Buy';
          const volumePct = volumeProfile[index];
          const actualVolume = contract.annualVolume * volumePct / 100;
          const marketPrice = marketPrices[contract.state][index];
          const strikePriceXVolume = actualVolume * contract.strikePrice;
          const marketPriceXVolume = actualVolume * marketPrice;
          
          let netMtM;
          if (contract.type === 'retail') {
            netMtM = strikePriceXVolume - marketPriceXVolume;
          } else {
            netMtM = marketPriceXVolume - strikePriceXVolume;
          }
          
          outputData.push({
            buysell: buySell,
            deal_name: contract.name,
            state: contract.state,
            type: contract.category,
            month_start: index + 1,
            year: parseInt(year),
            fy: parseInt(year),
            unit: contract.unit,
            scenario: scenario,
            sub_type: contract.category,
            volume_pct: volumePct,
            volume_mwh: actualVolume.toFixed(0),
            strike_price: contract.strikePrice,
            strike_price_x_volume: strikePriceXVolume,
            market_price: marketPrice,
            market_price_x_volume: marketPriceXVolume,
            net_mtm: netMtM
          });
        });
      } else if (interval === 'Y') {
        // Yearly data - sum all months
        const totalVolume = contract.annualVolume;
        const avgMarketPrice = marketPrices[contract.state].reduce((sum, price) => sum + price, 0) / 12;
        const strikePriceXVolume = totalVolume * contract.strikePrice;
        const marketPriceXVolume = totalVolume * avgMarketPrice;
        
        let netMtM;
        if (contract.type === 'retail') {
          netMtM = strikePriceXVolume - marketPriceXVolume;
        } else {
          netMtM = marketPriceXVolume - strikePriceXVolume;
        }
        
        outputData.push({
          buysell: contract.type === 'retail' ? 'Sell' : 'Buy',
          deal_name: contract.name,
          state: contract.state,
          type: contract.category,
          month_start: 1,
          year: parseInt(year),
          fy: parseInt(year),
          unit: contract.unit,
          scenario: scenario,
          sub_type: contract.category,
          volume_pct: 100,
          volume_mwh: totalVolume.toFixed(0),
          strike_price: contract.strikePrice,
          strike_price_x_volume: strikePriceXVolume,
          market_price: avgMarketPrice,
          market_price_x_volume: marketPriceXVolume,
          net_mtm: netMtM
        });
      }
    });
    
    setTimeSeriesData(outputData);
    setIsLoading(false);
  };

  const exportData = () => {
    if (timeSeriesData.length === 0) {
      alert('No data to export. Please generate time series first.');
      return;
    }

    if (exportFormat === 'csv') {
      exportToCSV();
    } else if (exportFormat === 'json') {
      exportToJSON();
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Buy/Sell', 'Deal Name', 'State', 'Type', 'Month', 'Year', 'FY', 'Unit',
      'Scenario', 'Sub Type', 'Volume %', 'Volume (MWh)', 'Strike Price',
      'Strike Price × Volume', 'Market Price', 'Market Price × Volume', 'Net MtM'
    ];

    const csvContent = [
      headers.join(','),
      ...timeSeriesData.map(row => [
        row.buysell,
        `"${row.deal_name}"`,
        row.state,
        `"${row.type}"`,
        row.month_start,
        row.year,
        row.fy,
        row.unit,
        row.scenario,
        `"${row.sub_type}"`,
        row.volume_pct.toFixed(2),
        row.volume_mwh,
        row.strike_price.toFixed(2),
        row.strike_price_x_volume.toFixed(2),
        row.market_price.toFixed(2),
        row.market_price_x_volume.toFixed(2),
        row.net_mtm.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy_contracts_timeseries_${year}_${scenario}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(timeSeriesData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy_contracts_timeseries_${year}_${scenario}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleContractToggle = (contractId: string) => {
    setSelectedContracts(prev => 
      prev.includes(contractId) 
        ? prev.filter(id => id !== contractId)
        : [...prev, contractId]
    );
  };

  const selectAllContracts = () => {
    setSelectedContracts(contracts.map(c => c._id || c.id?.toString() || ''));
  };

  const clearSelection = () => {
    setSelectedContracts([]);
  };

  // Calculate summary statistics
  const summaryStats = {
    totalRows: timeSeriesData.length,
    totalVolume: timeSeriesData.reduce((sum, row) => sum + parseFloat(row.volume_mwh), 0),
    totalMtM: timeSeriesData.reduce((sum, row) => sum + row.net_mtm, 0),
    uniqueContracts: new Set(timeSeriesData.map(row => row.deal_name)).size,
    uniqueStates: new Set(timeSeriesData.map(row => row.state)).size,
  };

  return (
    <div className="space-y-8">
      {/* Generation Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          🔧 Time Series Generation Controls
        </h2>
        
        <div className="space-y-6">
          {/* Contract Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contract Selection</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <button 
                  onClick={selectAllContracts}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Select All
                </button>
                <button 
                  onClick={clearSelection}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Clear All
                </button>
                <span className="text-sm text-gray-600 font-medium">
                  {selectedContracts.length === 0 ? 'All contracts' : `${selectedContracts.length} selected`}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {contracts.map(contract => (
                  <label key={contract._id || contract.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedContracts.includes(contract._id || contract.id?.toString() || '')}
                      onChange={() => handleContractToggle(contract._id || contract.id?.toString() || '')}
                      className="rounded text-blue-500 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{contract.name}</div>
                      <div className="text-xs text-gray-500">({contract.state})</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Generation Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="yearSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Financial Year
                </label>
                <select 
                  id="yearSelect" 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="2024">FY 2024</option>
                  <option value="2025">FY 2025</option>
                  <option value="2026">FY 2026</option>
                  <option value="2027">FY 2027</option>
                  <option value="2028">FY 2028</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="intervalSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Time Interval
                </label>
                <select 
                  id="intervalSelect" 
                  value={interval} 
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="M">Monthly</option>
                  <option value="Y">Yearly</option>
                  <option value="D" disabled>Daily (Coming Soon)</option>
                  <option value="5M" disabled>5-Minute (Coming Soon)</option>
                  <option value="30M" disabled>30-Minute (Coming Soon)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="scenarioSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Scenario
                </label>
                <select 
                  id="scenarioSelect" 
                  value={scenario} 
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Central">Central</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                  <option value="Stress">Stress Test</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button 
                  onClick={generateTimeSeries} 
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? 'Generating...' : 'Generate Time Series'}
                </button>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Export Options</h3>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label htmlFor="exportFormat" className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <select 
                  id="exportFormat" 
                  value={exportFormat} 
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="excel" disabled>Excel (Coming Soon)</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button 
                  onClick={exportData}
                  disabled={timeSeriesData.length === 0}
                  className="bg-green-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  📊 Export Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📈 Generation Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summaryStats.totalRows.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-medium">Total Rows</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summaryStats.totalVolume.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-medium">Total Volume (MWh)</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${summaryStats.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summaryStats.totalMtM >= 0 ? '+' : ''}${summaryStats.totalMtM.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 font-medium">Net MtM</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{summaryStats.uniqueContracts}</div>
              <div className="text-sm text-gray-600 font-medium">Contracts</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{summaryStats.uniqueStates}</div>
              <div className="text-sm text-gray-600 font-medium">States</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{year}</div>
              <div className="text-sm text-gray-600 font-medium">{interval === 'M' ? 'Monthly' : 'Yearly'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Data Output Table */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            📈 Time Series Output
          </h2>
          {timeSeriesData.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                🖨️ Print
              </button>
              <button 
                onClick={exportData}
                className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                📊 Export
              </button>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-3 font-semibold text-gray-700">Buy/Sell</th>
                <th className="text-left p-3 font-semibold text-gray-700">Deal Name</th>
                <th className="text-left p-3 font-semibold text-gray-700">State</th>
                <th className="text-left p-3 font-semibold text-gray-700">Type</th>
                <th className="text-left p-3 font-semibold text-gray-700">Month</th>
                <th className="text-left p-3 font-semibold text-gray-700">Year</th>
                <th className="text-left p-3 font-semibold text-gray-700">FY</th>
                <th className="text-left p-3 font-semibold text-gray-700">Unit</th>
                <th className="text-left p-3 font-semibold text-gray-700">Scenario</th>
                <th className="text-left p-3 font-semibold text-gray-700">Sub Type</th>
                <th className="text-left p-3 font-semibold text-gray-700">Volume %</th>
                <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                <th className="text-left p-3 font-semibold text-gray-700">Strike Price</th>
                <th className="text-left p-3 font-semibold text-gray-700">Strike Price × Volume</th>
                <th className="text-left p-3 font-semibold text-gray-700">Market Price</th>
                <th className="text-left p-3 font-semibold text-gray-700">Market Price × Volume</th>
                <th className="text-left p-3 font-semibold text-gray-700">Net MtM</th>
              </tr>
            </thead>
            <tbody>
              {timeSeriesData.length === 0 ? (
                <tr>
                  <td colSpan={17} className="text-center py-12 text-gray-500">
                    Click "Generate Time Series" to see output data
                  </td>
                </tr>
              ) : (
                timeSeriesData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.buysell === 'Buy' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {row.buysell}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-900">{row.deal_name}</td>
                    <td className="p-3">{row.state}</td>
                    <td className="p-3">{row.type}</td>
                    <td className="p-3">{row.month_start}</td>
                    <td className="p-3">{row.year}</td>
                    <td className="p-3">{row.fy}</td>
                    <td className="p-3">{row.unit}</td>
                    <td className="p-3">{row.scenario}</td>
                    <td className="p-3">{row.sub_type}</td>
                    <td className="p-3">{row.volume_pct.toFixed(1)}%</td>
                    <td className="p-3 font-medium">{parseFloat(row.volume_mwh).toLocaleString()}</td>
                    <td className="p-3">${row.strike_price.toFixed(2)}</td>
                    <td className="p-3">${row.strike_price_x_volume.toLocaleString()}</td>
                    <td className="p-3">${row.market_price.toFixed(2)}</td>
                    <td className="p-3">${row.market_price_x_volume.toLocaleString()}</td>
                    <td className={`p-3 font-semibold ${row.net_mtm >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${row.net_mtm.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}