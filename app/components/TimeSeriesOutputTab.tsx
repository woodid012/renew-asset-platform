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
  // New fields for pricing
  pricingType?: 'fixed' | 'escalation' | 'timeseries';
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  productDetail?: 'CY' | 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
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
  const [year, setYear] = useState('all');
  const [interval, setInterval] = useState('M');
  const [scenario, setScenario] = useState('Central');
  const [exportFormat, setExportFormat] = useState('csv');
  const [yearType, setYearType] = useState<'FY' | 'CY'>('FY');

  // Helper function to get years from contracts based on year type
  const getContractYears = (): number[] => {
    const years = new Set<number>();
    
    contracts.forEach(contract => {
      if (contract.startDate && contract.endDate) {
        const startDate = new Date(contract.startDate);
        const endDate = new Date(contract.endDate);
        
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          let yearToAdd: number;
          
          if (yearType === 'FY') {
            // Financial Year (July 1 - June 30)
            // If month is July-December, use current year. If Jan-June, use previous year + 1
            const month = currentDate.getMonth() + 1; // 1-12
            if (month >= 7) {
              yearToAdd = currentDate.getFullYear() + 1; // FY starts in July, so FY2025 starts July 2024
            } else {
              yearToAdd = currentDate.getFullYear();
            }
          } else {
            // Calendar Year
            yearToAdd = currentDate.getFullYear();
          }
          
          years.add(yearToAdd);
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
      }
    });
    
    return Array.from(years).sort((a, b) => a - b);
  };

  // Helper function to determine if a contract is active in a given year
  const isContractActiveInYear = (contract: Contract, targetYear: number): boolean => {
    if (!contract.startDate || !contract.endDate) return false;
    
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    
    let yearStart: Date, yearEnd: Date;
    
    if (yearType === 'FY') {
      // Financial Year: July 1 (targetYear-1) to June 30 (targetYear)
      yearStart = new Date(targetYear - 1, 6, 1); // July 1
      yearEnd = new Date(targetYear, 5, 30); // June 30
    } else {
      // Calendar Year: January 1 to December 31
      yearStart = new Date(targetYear, 0, 1); // January 1
      yearEnd = new Date(targetYear, 11, 31); // December 31
    }
    
    // Check if contract period overlaps with the target year period
    return startDate <= yearEnd && endDate >= yearStart;
  };

  // Helper function to get market price with fallback
  const getMarketPrice = (state: string, monthIndex: number): number => {
    // Try to get the price for the specific state
    if (marketPrices[state] && marketPrices[state][monthIndex] !== undefined) {
      return marketPrices[state][monthIndex];
    }
    
    // Fallback to NSW if available
    if (marketPrices['NSW'] && marketPrices['NSW'][monthIndex] !== undefined) {
      console.warn(`No market price data for state ${state}, using NSW as fallback`);
      return marketPrices['NSW'][monthIndex];
    }
    
    // Final fallback to a default price
    console.warn(`No market price data for state ${state} or NSW, using default price`);
    return 80.0; // Default price of $80/MWh
  };

  // Helper function to get volume profile with fallback
  const getVolumeProfile = (volumeShape: string): number[] => {
    if (volumeShapes[volumeShape]) {
      return volumeShapes[volumeShape];
    }
    
    // Fallback to flat profile if the specified shape doesn't exist
    console.warn(`Volume shape ${volumeShape} not found, using flat profile`);
    return volumeShapes['flat'] || [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33];
  };

  // Helper function to get strike price for a given period
  const getStrikePrice = (contract: Contract, monthIndex: number, year: number): number => {
    // If using time series pricing
    if (contract.pricingType === 'timeseries' && contract.priceTimeSeries && contract.priceTimeSeries.length > 0) {
      if (contract.priceInterval === 'monthly') {
        return contract.priceTimeSeries[monthIndex] || contract.strikePrice;
      } else if (contract.priceInterval === 'quarterly') {
        const quarterIndex = Math.floor(monthIndex / 3);
        return contract.priceTimeSeries[quarterIndex] || contract.strikePrice;
      } else if (contract.priceInterval === 'yearly') {
        return contract.priceTimeSeries[0] || contract.strikePrice;
      }
    }
    
    // If using escalation pricing
    if (contract.pricingType === 'escalation' && contract.escalationRate && contract.referenceDate) {
      const refYear = new Date(contract.referenceDate).getFullYear();
      const yearsDiff = year - refYear;
      const escalationFactor = Math.pow(1 + (contract.escalationRate / 100), yearsDiff + (monthIndex / 12));
      return contract.strikePrice * escalationFactor;
    }
    
    // Default to fixed pricing
    return contract.strikePrice;
  };

  const generateTimeSeries = async () => {
    setIsLoading(true);
    
    try {
      let outputData: TimeSeriesRow[] = [];
      const contractsToProcess = contracts.filter(contract => contract.status === 'active');
      
      if (contractsToProcess.length === 0) {
        alert('No active contracts found to generate time series data.');
        setIsLoading(false);
        return;
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Determine which years to process
      let yearsToProcess: number[] = [];
      if (year === 'all') {
        yearsToProcess = getContractYears();
      } else {
        yearsToProcess = [parseInt(year)];
      }
      
      if (yearsToProcess.length === 0) {
        alert('No valid years found for the selected contracts.');
        setIsLoading(false);
        return;
      }

      // Process each year
      yearsToProcess.forEach(selectedYear => {
        // Filter contracts that are active in this year
        const activeContractsForYear = contractsToProcess.filter(contract => 
          isContractActiveInYear(contract, selectedYear)
        );

        activeContractsForYear.forEach(contract => {
          // Validate contract data
          if (!contract.name || !contract.state || !contract.annualVolume || !contract.strikePrice) {
            console.warn(`Skipping contract ${contract.name || 'Unknown'} due to missing required data`);
            return;
          }

          const volumeProfile = getVolumeProfile(contract.volumeShape);
          
          if (interval === 'M') {
            // Monthly data generation
            months.forEach((month, index) => {
              const buySell = contract.type === 'retail' ? 'Sell' : 'Buy';
              const volumePct = volumeProfile[index];
              const actualVolume = contract.annualVolume * volumePct / 100;
              const marketPrice = getMarketPrice(contract.state, index);
              const strikePrice = getStrikePrice(contract, index, selectedYear);
              
              const strikePriceXVolume = actualVolume * strikePrice;
              const marketPriceXVolume = actualVolume * marketPrice;
              
              let netMtM;
              if (contract.type === 'retail') {
                netMtM = strikePriceXVolume - marketPriceXVolume;
              } else {
                netMtM = marketPriceXVolume - strikePriceXVolume;
              }
              
              // Determine the FY for this record
              let recordFY: number;
              if (yearType === 'FY') {
                recordFY = selectedYear;
              } else {
                // For CY, convert to FY (CY 2025 would be FY 2026 for most months)
                recordFY = selectedYear + (index >= 6 ? 1 : 0); // July onwards is next FY
              }
              
              outputData.push({
                buysell: buySell,
                deal_name: contract.name,
                state: contract.state,
                type: contract.category,
                month_start: index + 1,
                year: selectedYear,
                fy: recordFY,
                unit: contract.unit,
                scenario: scenario,
                sub_type: contract.category,
                volume_pct: volumePct,
                volume_mwh: actualVolume.toFixed(0),
                strike_price: strikePrice,
                strike_price_x_volume: strikePriceXVolume,
                market_price: marketPrice,
                market_price_x_volume: marketPriceXVolume,
                net_mtm: netMtM
              });
            });
          } else if (interval === 'Y') {
            // Yearly data generation
            const totalVolume = contract.annualVolume;
            
            // Calculate average market price for the year
            let totalMarketValue = 0;
            let totalVolumeWeighted = 0;
            
            volumeProfile.forEach((volumePct, monthIndex) => {
              const monthVolume = totalVolume * volumePct / 100;
              const monthMarketPrice = getMarketPrice(contract.state, monthIndex);
              totalMarketValue += monthVolume * monthMarketPrice;
              totalVolumeWeighted += monthVolume;
            });
            
            const avgMarketPrice = totalVolumeWeighted > 0 ? totalMarketValue / totalVolumeWeighted : getMarketPrice(contract.state, 0);
            
            // Use average strike price for the year (for escalation contracts)
            let totalStrikeValue = 0;
            volumeProfile.forEach((volumePct, monthIndex) => {
              const monthVolume = totalVolume * volumePct / 100;
              const monthStrikePrice = getStrikePrice(contract, monthIndex, selectedYear);
              totalStrikeValue += monthVolume * monthStrikePrice;
            });
            
            const avgStrikePrice = totalVolumeWeighted > 0 ? totalStrikeValue / totalVolumeWeighted : contract.strikePrice;
            
            const strikePriceXVolume = totalVolume * avgStrikePrice;
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
              year: selectedYear,
              fy: yearType === 'FY' ? selectedYear : selectedYear + 1, // Approximate FY conversion for CY
              unit: contract.unit,
              scenario: scenario,
              sub_type: contract.category,
              volume_pct: 100,
              volume_mwh: totalVolume.toFixed(0),
              strike_price: avgStrikePrice,
              strike_price_x_volume: strikePriceXVolume,
              market_price: avgMarketPrice,
              market_price_x_volume: marketPriceXVolume,
              net_mtm: netMtM
            });
          }
        });
      });
      
      if (outputData.length === 0) {
        alert('No data was generated. Please check your contracts and try again.');
      } else {
        setTimeSeriesData(outputData);
        console.log(`Generated ${outputData.length} time series records for ${yearsToProcess.length} year(s)`);
      }
    } catch (error) {
      console.error('Error generating time series:', error);
      alert('An error occurred while generating time series data. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
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

  // Get available years for the dropdown
  const availableYears = getContractYears();

  // Calculate summary statistics
  const summaryStats = {
    totalRows: timeSeriesData.length,
    totalVolume: timeSeriesData.reduce((sum, row) => sum + parseFloat(row.volume_mwh), 0),
    totalMtM: timeSeriesData.reduce((sum, row) => sum + row.net_mtm, 0),
    uniqueContracts: new Set(timeSeriesData.map(row => row.deal_name)).size,
    uniqueStates: new Set(timeSeriesData.map(row => row.state)).size,
  };

  // Get available market price states for validation
  const availableStates = Object.keys(marketPrices);
  const contractStates = [...new Set(contracts.map(c => c.state))];
  const missingStates = contractStates.filter(state => !availableStates.includes(state));

  return (
    <div className="space-y-8">
      {/* Generation Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          🔧 Time Series Generation Controls
        </h2>
        
        <div className="space-y-6">
          {/* Validation Warnings */}
          {missingStates.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <span>⚠️</span>
                <strong>Missing Market Data:</strong>
              </div>
              <p className="text-yellow-700 mt-1">
                No market price data found for states: {missingStates.join(', ')}. 
                These will use NSW prices as fallback or default to $80/MWh.
              </p>
            </div>
          )}

          {/* Contract Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contract Selection</h3>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-blue-800">
                    {contracts.filter(c => c.status === 'active').length} active contracts of {contracts.length} total
                  </div>
                  <div className="text-sm text-blue-600">
                    Time series will be generated for active contracts in {year === 'all' ? 'all available years' : `${yearType} ${year}`}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    States: {contractStates.join(', ')} | Available {yearType} years: {availableYears.join(', ') || 'None'}
                  </div>
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Generation Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label htmlFor="yearTypeSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Year Type
                </label>
                <select 
                  id="yearTypeSelect" 
                  value={yearType} 
                  onChange={(e) => {
                    setYearType(e.target.value as 'FY' | 'CY');
                    setYear('all'); // Reset year selection when type changes
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FY">Financial Year (Jul-Jun)</option>
                  <option value="CY">Calendar Year (Jan-Dec)</option>
                </select>
              </div>

              <div>
                <label htmlFor="yearSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  {yearType} Selection
                </label>
                <select 
                  id="yearSelect" 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Available Years</option>
                  {availableYears.map(yr => (
                    <option key={yr} value={yr.toString()}>{yearType} {yr}</option>
                  ))}
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
                  disabled={true}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                  title="Scenario selection currently disabled - uses Central scenario"
                >
                  <option value="Central">Central (Locked)</option>
                  <option value="High" disabled>High (Coming Soon)</option>
                  <option value="Low" disabled>Low (Coming Soon)</option>
                  <option value="Stress" disabled>Stress Test (Coming Soon)</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button 
                  onClick={generateTimeSeries} 
                  disabled={isLoading || contracts.filter(c => c.status === 'active').length === 0 || availableYears.length === 0}
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
              <div className="text-2xl font-bold text-gray-600">{year === 'all' ? 'All Years' : `${yearType} ${year}`}</div>
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
                    <div className="space-y-2">
                      <div className="text-4xl">📊</div>
                      <div>Click "Generate Time Series" to see output data</div>
                      <div className="text-sm">
                        {contracts.filter(c => c.status === 'active').length === 0 ? 
                          'No active contracts found - add contracts in the Contract Input tab' : 
                          availableYears.length === 0 ?
                          'No valid years found for contracts - check contract dates' :
                          `Ready to generate data for ${contracts.filter(c => c.status === 'active').length} active contracts across ${year === 'all' ? availableYears.length + ' years' : '1 year'}`
                        }
                      </div>
                    </div>
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