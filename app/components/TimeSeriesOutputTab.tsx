'use client';

import { useState } from 'react';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';


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

interface EnhancedTimeSeriesOutputTabProps {
  contracts: Contract[];
  timeSeriesData: TimeSeriesRow[];
  setTimeSeriesData: (data: TimeSeriesRow[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  marketPrices: { [key: string]: number[] };
  volumeShapes: { [key: string]: number[] };
}

// Volume calculation utilities
const VolumeUtils = {
  hasMonthlyData: (contract: Contract): boolean => {
    return !!(contract.timeSeriesData && contract.timeSeriesData.length > 0);
  },

  getMonthlyVolumes: (contract: Contract, year: number): number[] => {
    if (!contract.timeSeriesData) {
      return VolumeUtils.calculateFromPercentages(contract);
    }

    const monthlyVolumes = new Array(12).fill(0);
    
    contract.timeSeriesData.forEach(data => {
      const [dataYear, dataMonth] = data.period.split('-').map(Number);
      
      if (dataYear === year && dataMonth >= 1 && dataMonth <= 12) {
        monthlyVolumes[dataMonth - 1] = data.volume;
      }
    });

    return monthlyVolumes;
  },

  calculateFromPercentages: (contract: Contract): number[] => {
    const volumeShapes = {
      flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
      solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
      wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
      custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
    };

    const percentages = volumeShapes[contract.volumeShape] || volumeShapes.flat;
    return percentages.map(pct => (contract.annualVolume * pct) / 100);
  },

  getVolumeForPeriod: (contract: Contract, year: number, month: number): { volume: number; percentage: number } => {
    if (VolumeUtils.hasMonthlyData(contract)) {
      // Use actual monthly data
      const targetPeriod = `${year}-${month.toString().padStart(2, '0')}`;
      const dataPoint = contract.timeSeriesData?.find(d => d.period === targetPeriod);
      
      if (dataPoint) {
        // Calculate percentage based on total volume for that year
        const yearlyVolumes = VolumeUtils.getMonthlyVolumes(contract, year);
        const yearTotal = yearlyVolumes.reduce((sum, vol) => sum + vol, 0);
        const percentage = yearTotal > 0 ? (dataPoint.volume / yearTotal) * 100 : 0;
        
        return {
          volume: dataPoint.volume,
          percentage: percentage
        };
      }
      
      return { volume: 0, percentage: 0 };
    } else {
      // Use percentage-based calculation
      const monthlyVolumes = VolumeUtils.calculateFromPercentages(contract);
      const volumeShapes = {
        flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
        solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
        wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
        custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
      };
      const percentages = volumeShapes[contract.volumeShape] || volumeShapes.flat;
      
      return {
        volume: monthlyVolumes[month - 1] || 0,
        percentage: percentages[month - 1] || 8.33
      };
    }
  },

  getYearsCovered: (timeSeriesData: TimeSeriesDataPoint[]): number[] => {
    if (!timeSeriesData) return [];
    
    const years = new Set<number>();
    timeSeriesData.forEach(data => {
      const year = parseInt(data.period.split('-')[0]);
      if (!isNaN(year)) {
        years.add(year);
      }
    });
    
    return Array.from(years).sort();
  }
};

export default function EnhancedTimeSeriesOutputTab({
  contracts,
  timeSeriesData,
  setTimeSeriesData,
  isLoading,
  setIsLoading,
  marketPrices,
  volumeShapes,
}: EnhancedTimeSeriesOutputTabProps) {
  const [year, setYear] = useState('all');
  const [interval, setInterval] = useState('M');
  const [scenario, setScenario] = useState('Central');
  const [exportFormat, setExportFormat] = useState('csv');
  const [yearType, setYearType] = useState<'FY' | 'CY'>('FY');

  // Helper function to get years from contracts based on year type
  const getContractYears = (): number[] => {
    const years = new Set<number>();
    
    contracts.forEach(contract => {
      if (VolumeUtils.hasMonthlyData(contract)) {
        // Use years from time series data
        const timeSeriesYears = VolumeUtils.getYearsCovered(contract.timeSeriesData!);
        timeSeriesYears.forEach(year => years.add(year));
      } else {
        // Use contract start/end dates
        if (contract.startDate && contract.endDate) {
          const startDate = new Date(contract.startDate);
          const endDate = new Date(contract.endDate);
          
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            let yearToAdd: number;
            
            if (yearType === 'FY') {
              const month = currentDate.getMonth() + 1;
              if (month >= 7) {
                yearToAdd = currentDate.getFullYear() + 1;
              } else {
                yearToAdd = currentDate.getFullYear();
              }
            } else {
              yearToAdd = currentDate.getFullYear();
            }
            
            years.add(yearToAdd);
            currentDate.setFullYear(currentDate.getFullYear() + 1);
          }
        }
      }
    });
    
    return Array.from(years).sort((a, b) => a - b);
  };

  // Helper function to get market price with fallback
  const getMarketPrice = (state: string, monthIndex: number): number => {
    if (marketPrices[state] && marketPrices[state][monthIndex] !== undefined) {
      return marketPrices[state][monthIndex];
    }
    
    if (marketPrices['NSW'] && marketPrices['NSW'][monthIndex] !== undefined) {
      console.warn(`No market price data for state ${state}, using NSW as fallback`);
      return marketPrices['NSW'][monthIndex];
    }
    
    console.warn(`No market price data for state ${state} or NSW, using default price`);
    return 80.0;
  };

  // Helper function to get strike price for a given period
// Helper function to get strike price for a given period
  const getStrikePrice = (contract: Contract, monthIndex: number, year: number): number => {
    // Handle time series based pricing
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
    
    // Handle escalation based pricing
    if (contract.pricingType === 'escalation' && contract.escalationRate && contract.referenceDate) {
      const refYear = new Date(contract.referenceDate).getFullYear();
      const yearsDiff = year - refYear;
      const escalationFactor = Math.pow(1 + (contract.escalationRate / 100), yearsDiff + (monthIndex / 12));
      return contract.strikePrice * escalationFactor;
    }
    
    // Fallback for 'fixed', 'custom_time_of_day', or any other unhandled pricing types.
    // This ensures that even new, unhandled pricing types will gracefully use the base strike price.
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
        contractsToProcess.forEach(contract => {
          // Skip contracts with no data for this year
          if (VolumeUtils.hasMonthlyData(contract)) {
            const hasDataForYear = contract.timeSeriesData?.some(data => {
              const dataYear = parseInt(data.period.split('-')[0]);
              return dataYear === selectedYear;
            });
            
            if (!hasDataForYear) {
              console.log(`Skipping contract ${contract.name} - no data for year ${selectedYear}`);
              return;
            }
          }

          if (interval === 'M') {
            // Monthly data generation
            months.forEach((month, index) => {
              const buySell = contract.type === 'retail' ? 'Sell' : 'Buy';
              
              // Get volume data (either from time series or percentage)
              const volumeData = VolumeUtils.getVolumeForPeriod(contract, selectedYear, index + 1);
              const actualVolume = volumeData.volume;
              const volumePct = volumeData.percentage;
              
              // Skip if no volume for this period
              if (actualVolume === 0) {
                return;
              }
              
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
            let totalVolume = 0;
            let totalMarketValue = 0;
            let totalStrikeValue = 0;
            let totalVolumeWeighted = 0;
            
            if (VolumeUtils.hasMonthlyData(contract)) {
              // Sum actual monthly data for the year
              contract.timeSeriesData?.forEach(data => {
                const dataYear = parseInt(data.period.split('-')[0]);
                if (dataYear === selectedYear) {
                  const monthIndex = parseInt(data.period.split('-')[1]) - 1;
                  const monthMarketPrice = getMarketPrice(contract.state, monthIndex);
                  const monthStrikePrice = getStrikePrice(contract, monthIndex, selectedYear);
                  
                  totalVolume += data.volume;
                  totalMarketValue += data.volume * monthMarketPrice;
                  totalStrikeValue += data.volume * monthStrikePrice;
                  totalVolumeWeighted += data.volume;
                }
              });
            } else {
              // Use percentage-based calculation
              totalVolume = contract.annualVolume;
              
              const monthlyVolumes = VolumeUtils.calculateFromPercentages(contract);
              monthlyVolumes.forEach((monthVolume, monthIndex) => {
                const monthMarketPrice = getMarketPrice(contract.state, monthIndex);
                const monthStrikePrice = getStrikePrice(contract, monthIndex, selectedYear);
                
                totalMarketValue += monthVolume * monthMarketPrice;
                totalStrikeValue += monthVolume * monthStrikePrice;
                totalVolumeWeighted += monthVolume;
              });
            }
            
            if (totalVolume === 0) {
              return; // Skip if no volume for this year
            }
            
            const avgMarketPrice = totalVolumeWeighted > 0 ? totalMarketValue / totalVolumeWeighted : getMarketPrice(contract.state, 0);
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
              fy: yearType === 'FY' ? selectedYear : selectedYear + 1,
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

  // Get contracts with monthly data vs percentage-based
  const contractsWithMonthlyData = contracts.filter(VolumeUtils.hasMonthlyData);
  const contractsWithPercentageData = contracts.filter(c => !VolumeUtils.hasMonthlyData(c));

  return (
    <div className="space-y-8">
      {/* Generation Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          🔧 Enhanced Time Series Generation Controls
        </h2>
        
        <div className="space-y-6">
          {/* Contract Data Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Contract Data Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <span>📈</span>
                  <strong>Monthly Time Series Data</strong>
                </div>
                <p className="text-blue-700">
                  {contractsWithMonthlyData.length} contracts with actual monthly volume data
                </p>
                {contractsWithMonthlyData.length > 0 && (
                  <div className="text-xs text-blue-600 mt-1">
                    Types: {[...new Set(contractsWithMonthlyData.map(c => c.category))].join(', ')}
                  </div>
                )}
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <span>📊</span>
                  <strong>Percentage-Based Volume</strong>
                </div>
                <p className="text-green-700">
                  {contractsWithPercentageData.length} contracts using volume shape percentages
                </p>
                {contractsWithPercentageData.length > 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    Shapes: {[...new Set(contractsWithPercentageData.map(c => c.volumeShape))].join(', ')}
                  </div>
                )}
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-800 mb-2">
                  <span>🎯</span>
                  <strong>Active Contracts</strong>
                </div>
                <p className="text-purple-700">
                  {contracts.filter(c => c.status === 'active').length} of {contracts.length} contracts active
                </p>
                <div className="text-xs text-purple-600 mt-1">
                  Available years: {availableYears.join(', ') || 'None'}
                </div>
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
                    setYear('all');
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
            📈 Enhanced Time Series Output
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
                <th className="text-left p-3 font-semibold text-gray-700">Volume %</th>
                <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                <th className="text-left p-3 font-semibold text-gray-700">Strike Price</th>
                <th className="text-left p-3 font-semibold text-gray-700">Market Price</th>
                <th className="text-left p-3 font-semibold text-gray-700">Net MtM</th>
                <th className="text-left p-3 font-semibold text-gray-700">Data Source</th>
              </tr>
            </thead>
            <tbody>
              {timeSeriesData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-gray-500">
                    <div className="space-y-2">
                      <div className="text-4xl">📊</div>
                      <div>Click "Generate Time Series" to see output data</div>
                      <div className="text-sm">
                        {contracts.filter(c => c.status === 'active').length === 0 ? 
                          'No active contracts found - add contracts in the Contract Input tab' : 
                          availableYears.length === 0 ?
                          'No valid years found for contracts - check contract dates or upload volume data' :
                          `Ready to generate data for ${contracts.filter(c => c.status === 'active').length} active contracts`
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                timeSeriesData.map((row, index) => {
                  // Determine data source for this row
                  const contract = contracts.find(c => c.name === row.deal_name);
                  const dataSource = VolumeUtils.hasMonthlyData(contract!) ? 'Monthly Data' : 'Percentage Shape';
                  
                  return (
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
                      <td className="p-3">{row.volume_pct.toFixed(1)}%</td>
                      <td className="p-3 font-medium">{parseFloat(row.volume_mwh).toLocaleString()}</td>
                      <td className="p-3">${row.strike_price.toFixed(2)}</td>
                      <td className="p-3">${row.market_price.toFixed(2)}</td>
                      <td className={`p-3 font-semibold ${row.net_mtm >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${row.net_mtm.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          dataSource === 'Monthly Data' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {dataSource}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}