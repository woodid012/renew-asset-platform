'use client';

import { useState, useEffect, useMemo } from 'react';
import { Contract, SettingsData } from '@/app/types';
import { mtmCalculationEngine, MtMCalculationResult, MtMCalculationOptions } from '@/app/services/mtmCalculationEngine';
import TimeSeriesEditor, { TimeSeriesPoint, TimeSeriesConfig } from './GenericTimeSeriesEditor';

interface MarkToMarketTabProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  settings: SettingsData | null;
  marketPrices: { [key: string]: number[] };
}

interface PortfolioAggregation {
  totalContracts: number;
  totalVolume: number;
  totalAbsVolume: number;
  totalMtM: number;
  totalContractRevenue: number;
  totalMarketValue: number;
  weightedAvgContractPrice: number;
  weightedAvgMarketPrice: number;
}

interface GroupedResults {
  [groupKey: string]: MtMCalculationResult[];
}

export default function MarkToMarketTab({
  contracts,
  selectedContract,
  setSelectedContract,
  settings,
  marketPrices,
}: MarkToMarketTabProps) {
  // Core state
  const [mtmResults, setMtmResults] = useState<MtMCalculationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [lastCalculationTime, setLastCalculationTime] = useState<Date | null>(null);

  // Calculation options
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearType, setYearType] = useState<'CY' | 'FY'>('CY');
  const [priceCurve, setPriceCurve] = useState('Aurora Jan 2025');
  const [marketPriceProfile, setMarketPriceProfile] = useState<'auto' | 'baseload' | 'solar' | 'wind'>('auto');
  const [includeForecast, setIncludeForecast] = useState(true);

  // Display options
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'state' | 'contractType' | 'direction'>('category');
  const [sortBy, setSortBy] = useState<'mtmPnL' | 'volume' | 'contractName'>('mtmPnL');
  const [filterDirection, setFilterDirection] = useState<'all' | 'buy' | 'sell'>('all');
  const [showTimeSeriesDetails, setShowTimeSeriesDetails] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());

  // Time series editor state
  const [editingTimeSeriesContract, setEditingTimeSeriesContract] = useState<string | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);

  // Get available years from contracts
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    
    // Add current year and next few years
    for (let i = -2; i <= 5; i++) {
      years.add(currentYear + i);
    }
    
    // Add years from contract dates
    contracts.forEach(contract => {
      if (contract.startDate && contract.endDate) {
        const startYear = new Date(contract.startDate).getFullYear();
        const endYear = new Date(contract.endDate).getFullYear();
        
        for (let year = startYear; year <= endYear; year++) {
          years.add(year);
        }
      }
      
      // Add years from time series data
      if (contract.timeSeriesData) {
        contract.timeSeriesData.forEach(ts => {
          const year = parseInt(ts.period.split('-')[0]);
          if (!isNaN(year)) {
            years.add(year);
          }
        });
      }
    });
    
    return Array.from(years).sort((a, b) => a - b);
  }, [contracts]);

  // Perform MtM calculations
  const calculateMtM = async () => {
    setIsCalculating(true);
    setCalculationError(null);
    
    try {
      console.log(`🚀 Starting MtM calculation for ${yearType} ${selectedYear}`);
      
      const options: MtMCalculationOptions = {
        selectedYear,
        yearType,
        priceCurve,
        includeForecast,
        marketPriceProfile
      };
      
      const results = await mtmCalculationEngine.calculatePortfolioMtM(contracts, options);
      
      setMtmResults(results);
      setLastCalculationTime(new Date());
      
      console.log(`✅ MtM calculation completed: ${results.length} contracts processed`);
      
    } catch (error) {
      console.error('❌ MtM calculation failed:', error);
      setCalculationError(error instanceof Error ? error.message : 'Unknown calculation error');
    } finally {
      setIsCalculating(false);
    }
  };

  // Auto-calculate when key parameters change
  useEffect(() => {
    if (contracts.length > 0) {
      calculateMtM();
    }
  }, [selectedYear, yearType, priceCurve, marketPriceProfile, contracts]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = mtmResults;

    if (filterDirection !== 'all') {
      filtered = filtered.filter(result => result.direction === filterDirection);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'mtmPnL':
          return b.totalMtMPnL - a.totalMtMPnL;
        case 'volume':
          return Math.abs(b.totalVolume) - Math.abs(a.totalVolume);
        case 'contractName':
          return a.contractName.localeCompare(b.contractName);
        default:
          return b.totalMtMPnL - a.totalMtMPnL;
      }
    });

    return filtered;
  }, [mtmResults, filterDirection, sortBy]);

  // Group results
  const groupedResults: GroupedResults = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Contracts': filteredResults };
    }

    const groups: GroupedResults = {};

    filteredResults.forEach(result => {
      let groupKey = '';
      switch (groupBy) {
        case 'category':
          groupKey = result.category;
          break;
        case 'state':
          groupKey = result.state;
          break;
        case 'contractType':
          groupKey = result.contractType;
          break;
        case 'direction':
          groupKey = result.direction.toUpperCase();
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(result);
    });

    return groups;
  }, [filteredResults, groupBy]);

  // Calculate portfolio aggregation
  const portfolioAggregation: PortfolioAggregation = useMemo(() => {
    return filteredResults.reduce((acc, result) => ({
      totalContracts: acc.totalContracts + 1,
      totalVolume: acc.totalVolume + result.totalVolume,
      totalAbsVolume: acc.totalAbsVolume + result.totalAbsVolume,
      totalMtM: acc.totalMtM + result.totalMtMPnL,
      totalContractRevenue: acc.totalContractRevenue + result.totalContractRevenue,
      totalMarketValue: acc.totalMarketValue + result.totalMarketValue,
      weightedAvgContractPrice: 0, // Will calculate after
      weightedAvgMarketPrice: 0 // Will calculate after
    }), {
      totalContracts: 0,
      totalVolume: 0,
      totalAbsVolume: 0,
      totalMtM: 0,
      totalContractRevenue: 0,
      totalMarketValue: 0,
      weightedAvgContractPrice: 0,
      weightedAvgMarketPrice: 0
    });
  }, [filteredResults]);

  // Calculate weighted averages
  portfolioAggregation.weightedAvgContractPrice = portfolioAggregation.totalAbsVolume > 0 
    ? portfolioAggregation.totalContractRevenue / portfolioAggregation.totalAbsVolume 
    : 0;
  portfolioAggregation.weightedAvgMarketPrice = portfolioAggregation.totalAbsVolume > 0 
    ? portfolioAggregation.totalMarketValue / portfolioAggregation.totalAbsVolume 
    : 0;

  // Group aggregation helper
  const getGroupAggregation = (results: MtMCalculationResult[]) => {
    return results.reduce((acc, result) => ({
      totalVolume: acc.totalVolume + result.totalVolume,
      totalAbsVolume: acc.totalAbsVolume + result.totalAbsVolume,
      totalMtM: acc.totalMtM + result.totalMtMPnL,
      totalContractRevenue: acc.totalContractRevenue + result.totalContractRevenue,
      totalMarketValue: acc.totalMarketValue + result.totalMarketValue,
      count: acc.count + 1
    }), {
      totalVolume: 0,
      totalAbsVolume: 0,
      totalMtM: 0,
      totalContractRevenue: 0,
      totalMarketValue: 0,
      count: 0
    });
  };

  // Toggle functions
  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleContractExpansion = (contractId: string) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedContracts(newExpanded);
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(Object.keys(groupedResults)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  // Time series editor functions
  const openTimeSeriesEditor = (result: MtMCalculationResult) => {
    const timeSeriesPoints: TimeSeriesPoint[] = result.timeSeriesData.map(point => ({
      timestamp: `${point.period}-01T00:00:00Z`,
      value: point.marketPrice,
      metadata: {
        period: point.period,
        contractVolume: point.contractVolume,
        contractPrice: point.contractPrice,
        mtmPnL: point.mtmPnL
      }
    }));
    
    setTimeSeriesData(timeSeriesPoints);
    setEditingTimeSeriesContract(result.contractId);
  };

  const closeTimeSeriesEditor = () => {
    setEditingTimeSeriesContract(null);
    setTimeSeriesData([]);
  };

  const handleTimeSeriesDataChange = (newData: TimeSeriesPoint[]) => {
    setTimeSeriesData(newData);
    // Here you could implement saving the changes back to the contract
    console.log('Time series data updated:', newData);
  };

  const timeSeriesConfig: TimeSeriesConfig = {
    label: 'Market Price',
    unit: 'MWh',
    valueType: 'currency',
    precision: 2,
    defaultValue: 0,
    aggregationMethod: 'average',
    allowedIntervals: ['monthly', 'quarterly', 'yearly']
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              💹 Mark-to-Market Analysis
              <span className="text-sm font-normal text-gray-500">
                (Powered by MtM Calculation Engine)
              </span>
            </h2>
            <p className="text-gray-600 mt-2">
              Time-series based MtM calculations with integrated market price service
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={calculateMtM}
              disabled={isCalculating}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isCalculating ? '⏳ Calculating...' : '🔄 Recalculate'}
            </button>
          </div>
        </div>

        {/* Calculation Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year Type</label>
            <select
              value={yearType}
              onChange={(e) => setYearType(e.target.value as 'CY' | 'FY')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="CY">Calendar Year</option>
              <option value="FY">Financial Year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{yearType} {year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Curve</label>
            <select
              value={priceCurve}
              onChange={(e) => setPriceCurve(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Aurora Jan 2025">Aurora Jan 2025</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Market Price Profile</label>
            <select
              value={marketPriceProfile}
              onChange={(e) => setMarketPriceProfile(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">Auto-detect</option>
              <option value="baseload">Baseload</option>
              <option value="solar">Solar</option>
              <option value="wind">Wind</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="none">None</option>
              <option value="category">Category</option>
              <option value="state">State</option>
              <option value="contractType">Contract Type</option>
              <option value="direction">Direction</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter Direction</label>
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="buy">Buy Only</option>
              <option value="sell">Sell Only</option>
            </select>
          </div>
        </div>

        {/* Additional Options */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-6">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={includeForecast}
                  onChange={(e) => setIncludeForecast(e.target.checked)}
                  className="mr-2"
                />
                Include Forecast Periods
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={showTimeSeriesDetails}
                  onChange={(e) => setShowTimeSeriesDetails(e.target.checked)}
                  className="mr-2"
                />
                Show Time Series Details
              </label>
            </div>
            
            <div className="text-xs text-gray-500">
              {lastCalculationTime && (
                <>Last calculated: {lastCalculationTime.toLocaleString()}</>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {calculationError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Calculation Error: {calculationError}</p>
          </div>
        )}
      </div>

      {/* Portfolio Summary */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Summary ({yearType} {selectedYear})</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Active Contracts</div>
            <div className="text-2xl font-bold text-blue-800">{portfolioAggregation.totalContracts}</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Net Volume</div>
            <div className="text-2xl font-bold text-purple-800">
              {portfolioAggregation.totalVolume.toLocaleString()} MWh
            </div>
            <div className="text-xs text-purple-600">
              ({portfolioAggregation.totalAbsVolume.toLocaleString()} gross)
            </div>
          </div>

          <div className={`rounded-lg p-4 border ${
            portfolioAggregation.totalMtM >= 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-sm font-medium ${
              portfolioAggregation.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              Total MtM P&L
            </div>
            <div className={`text-2xl font-bold ${
              portfolioAggregation.totalMtM >= 0 ? 'text-green-800' : 'text-red-800'
            }`}>
              ${portfolioAggregation.totalMtM.toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 font-medium">Avg Contract Price</div>
            <div className="text-2xl font-bold text-gray-800">
              ${portfolioAggregation.weightedAvgContractPrice.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 font-medium">Avg Market Price</div>
            <div className="text-2xl font-bold text-gray-800">
              ${portfolioAggregation.weightedAvgMarketPrice.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Group Controls */}
      {groupBy !== 'none' && Object.keys(groupedResults).length > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {Object.keys(groupedResults).length} groups found
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAllGroups}
                className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
              >
                ➕ Expand All
              </button>
              <button
                onClick={collapseAllGroups}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
              >
                ➖ Collapse All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped Results */}
      <div className="space-y-6">
        {Object.entries(groupedResults).map(([groupName, results]) => {
          const groupAgg = getGroupAggregation(results);
          const isExpanded = expandedGroups.has(groupName);
          const canExpand = groupBy !== 'none' && results.length > 1;
          
          return (
            <div key={groupName} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              {/* Group Header */}
              <div 
                className={`p-6 ${canExpand ? 'cursor-pointer hover:bg-gray-50' : ''} border-b border-gray-100`}
                onClick={() => canExpand && toggleGroupExpansion(groupName)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {canExpand && (
                      <button className="text-xl text-gray-500 hover:text-gray-700 transition-colors">
                        {isExpanded ? '➖' : '➕'}
                      </button>
                    )}
                    <h3 className="text-lg font-semibold text-gray-800">{groupName}</h3>
                    <span className="text-sm text-gray-500">({groupAgg.count} contract{groupAgg.count !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Net Volume</div>
                      <div className={`font-semibold ${groupAgg.totalVolume < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {groupAgg.totalVolume.toLocaleString()} MWh
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">MtM P&L</div>
                      <div className={`text-lg font-bold ${groupAgg.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${groupAgg.totalMtM.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Contracts */}
              {(isExpanded || !canExpand) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-3 font-semibold text-gray-700">Contract</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Direction</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Avg Contract Price</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Avg Market Price</th>
                        <th className="text-left p-3 font-semibold text-gray-700">MtM P&L</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Data Source</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, index) => {
                        const isContractExpanded = expandedContracts.has(result.contractId);
                        
                        return (
                          <React.Fragment key={result.contractId}>
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {showTimeSeriesDetails && result.timeSeriesData.length > 0 && (
                                    <button
                                      onClick={() => toggleContractExpansion(result.contractId)}
                                      className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                      {isContractExpanded ? '🔽' : '▶️'}
                                    </button>
                                  )}
                                  <div>
                                    <div className="font-medium text-gray-900">{result.contractName}</div>
                                    <div className="text-xs text-gray-500">{result.counterparty}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                                  result.direction === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {result.direction}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className={`font-medium ${result.totalVolume < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {result.totalVolume.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">{result.periodsCalculated} periods</div>
                              </td>
                              <td className="p-3 font-medium">${result.weightedAvgContractPrice.toFixed(2)}</td>
                              <td className="p-3 font-medium">${result.weightedAvgMarketPrice.toFixed(2)}</td>
                              <td className="p-3">
                                <div className={`font-semibold ${
                                  result.totalMtMPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ${result.totalMtMPnL.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ${(result.totalAbsVolume > 0 ? result.totalMtMPnL / result.totalAbsVolume : 0).toFixed(2)}/MWh
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="space-y-1">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    result.volumeDataSource === 'time_series' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {result.volumeDataSource === 'time_series' ? 'Time Series' : 'Shape-based'}
                                  </span>
                                  <div className="text-xs text-gray-500">{result.marketPriceProfile}</div>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openTimeSeriesEditor(result)}
                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                    title="View Market Price Time Series"
                                  >
                                    📊 TS
                                  </button>
                                  <button
                                    onClick={() => {
                                      const contract = contracts.find(c => c._id === result.contractId || c.name === result.contractName);
                                      setSelectedContract(contract || null);
                                    }}
                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                                    title="View Contract Details"
                                  >
                                    🔍 View
                                  </button>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Time Series Breakdown */}
                            {showTimeSeriesDetails && isContractExpanded && result.timeSeriesData.length > 0 && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-gray-50 border-t border-gray-200">
                                    <div className="p-4">
                                      <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                        📈 Time Series Breakdown - {result.contractName}
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-gray-100">
                                              <th className="text-left p-2 font-medium">Period</th>
                                              <th className="text-left p-2 font-medium">Volume (MWh)</th>
                                              <th className="text-left p-2 font-medium">Contract Price</th>
                                              <th className="text-left p-2 font-medium">Market Price</th>
                                              <th className="text-left p-2 font-medium">Contract Revenue</th>
                                              <th className="text-left p-2 font-medium">Market Value</th>
                                              <th className="text-left p-2 font-medium">Period MtM</th>
                                              <th className="text-left p-2 font-medium">Cumulative MtM</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {result.timeSeriesData.map((point, pointIndex) => (
                                              <tr key={point.period} className="border-b border-gray-200 hover:bg-gray-100">
                                                <td className="p-2 font-medium">{point.period}</td>
                                                <td className="p-2">{point.contractVolume.toLocaleString()}</td>
                                                <td className="p-2">${point.contractPrice.toFixed(2)}</td>
                                                <td className="p-2">${point.marketPrice.toFixed(2)}</td>
                                                <td className="p-2">${point.contractRevenue.toLocaleString()}</td>
                                                <td className="p-2">${point.marketValue.toLocaleString()}</td>
                                                <td className={`p-2 font-medium ${
                                                  point.mtmPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                  ${point.mtmPnL.toLocaleString()}
                                                </td>
                                                <td className={`p-2 font-medium ${
                                                  point.cumulativeMtM >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                  ${point.cumulativeMtM.toLocaleString()}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No Results Message */}
      {filteredResults.length === 0 && !isCalculating && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No MtM Data Available</h3>
          <p className="text-gray-600">
            No active contracts found for {yearType} {selectedYear} or calculation failed. 
            Please check your contracts and try recalculating.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>Possible reasons:</p>
            <ul className="list-disc list-inside mt-2">
              <li>No active contracts for the selected year</li>
              <li>Market price data unavailable</li>
              <li>Contract volume data missing</li>
              <li>Network connectivity issues</li>
            </ul>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isCalculating && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Calculating Mark-to-Market...</h3>
          <p className="text-gray-600">
            Processing {contracts.filter(c => c.status === 'active').length} active contracts using the MtM Calculation Engine
          </p>
          <div className="mt-4">
            <div className="animate-pulse bg-gray-200 h-2 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      )}

      {/* Time Series Editor Modal */}
      {editingTimeSeriesContract && (
        <TimeSeriesEditor
          data={timeSeriesData}
          config={timeSeriesConfig}
          onDataChange={handleTimeSeriesDataChange}
          onClose={closeTimeSeriesEditor}
        />
      )}

      {/* Debug Information */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🔧 Calculation Engine Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Calculation Features:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Time-series based volume calculations</li>
              <li>• Integrated Market Price Service</li>
              <li>• Period-by-period MtM breakdown</li>
              <li>• Shape-based fallback calculations</li>
              <li>• Parallel contract processing</li>
              <li>• Real-time error handling</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Data Sources:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Contract time series data</li>
              <li>• Market price service API</li>
              <li>• Volume shape algorithms</li>
              <li>• Price escalation calculations</li>
              <li>• MongoDB price curves</li>
              <li>• Intelligent fallback data</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Performance Metrics:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Active Contracts: {contracts.filter(c => c.status === 'active').length}</li>
              <li>• Successful Calculations: {mtmResults.length}</li>
              <li>• Calculation Time: {lastCalculationTime ? `${Date.now() - lastCalculationTime.getTime()}ms` : 'N/A'}</li>
              <li>• Market Price Profile: {marketPriceProfile}</li>
              <li>• Time Series Details: {showTimeSeriesDetails ? 'Enabled' : 'Disabled'}</li>
              <li>• Error State: {calculationError ? 'Yes' : 'None'}</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">💡 New MtM Calculation Engine Features:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <strong>Period-by-Period Analysis:</strong> Detailed monthly breakdown with cumulative tracking
            </div>
            <div>
              <strong>Smart Volume Detection:</strong> Automatic fallback from time-series to shape-based calculations
            </div>
            <div>
              <strong>Market Price Integration:</strong> Direct integration with your Market Price Service
            </div>
            <div>
              <strong>Time Series Editor:</strong> Interactive editing of market price time series data
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}