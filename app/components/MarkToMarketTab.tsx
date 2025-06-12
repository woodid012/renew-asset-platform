'use client';

import { useState, useMemo } from 'react';
import { Contract, SettingsData } from '@/app/types';
import { getContractPrice, ContractPriceRequest } from '@/app/services/marketPriceService';

interface MarkToMarketTabProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  settings: SettingsData | null;
  marketPrices: { [key: string]: number[] };
}

interface MtMCalculation {
  contractId: string;
  contractName: string;
  direction: 'buy' | 'sell';
  category: string;
  state: string;
  contractType: string;
  counterparty: string;
  year: number;
  yearType: 'CY' | 'FY';
  volume: number; // Signed volume (negative for sell)
  avgContractPrice: number;
  avgMarketPrice: number;
  contractRevenue: number;
  marketValue: number;
  mtmPnL: number;
  volumeShape: string;
  dataSource: string;
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

  getYearsCovered: (timeSeriesData: any[]): number[] => {
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

// Legacy market price function for backward compatibility
const getLegacyMarketPrice = (volumeShape: string, state: string, contractType: string, marketPrices: { [key: string]: number[] }): number[] => {
  console.log(`🔍 Getting market price for: state=${state}, volumeShape=${volumeShape}, contractType=${contractType}`);
  console.log('📊 Available market price keys:', Object.keys(marketPrices));
  
  // Handle Green certificates - match your database structure
  if (contractType === 'Green') {
    console.log('🟢 Looking for Green certificate prices...');
    
    const greenKeys = [
      `${state} - baseload - green`,     
      `${state} - solar - green`,        
      `${state} - wind - green`,         
      
      ...(volumeShape.toLowerCase().includes('solar') ? [`${state} - solar - green`] : []),
      ...(volumeShape.toLowerCase().includes('wind') ? [`${state} - wind - green`] : []),
      
      `${state} - green`,                
      `${state}-green`,                  
      `${state} green`,                  
      
      'NSW - baseload - green',
      'VIC - baseload - green', 
      'SA - baseload - green',
      'WA - baseload - green',
      'TAS - baseload - green',
      
      'green',
      'Green',
      'baseload - green',
      'green - baseload',
      
      ...Object.keys(marketPrices).filter(key => 
        key.toLowerCase().includes('green') || 
        key.toLowerCase().includes('certificate') ||
        key.toLowerCase().includes('rec')
      )
    ];
    
    const uniqueGreenKeys = [...new Set(greenKeys)];
    
    for (const key of uniqueGreenKeys) {
      if (marketPrices[key] && marketPrices[key].length > 0) {
        console.log(`✅ Found Green certificate prices using key: "${key}"`);
        return marketPrices[key];
      }
    }
    
    console.warn('❌ No Green certificate prices found! Using default: $45/MWh');
    return Array(12).fill(45);
  }
  
  // Energy price logic
  console.log('⚡ Looking for Energy prices...');
  
  let profileType = 'baseload';
  if (volumeShape.toLowerCase().includes('solar')) {
    profileType = 'solar';
  } else if (volumeShape.toLowerCase().includes('wind')) {
    profileType = 'wind';
  }
  
  const energyKeys = [
    `${state} - ${profileType} - Energy`,  
    `${state} - ${profileType} - energy`,  
    `${state} - ${profileType}`,           
    `${state} - baseload - Energy`,        
    `${state} - baseload - energy`,        
    `${state} - baseload`,                 
    `${state}`,                            
  ];
  
  for (const key of energyKeys) {
    if (marketPrices[key] && marketPrices[key].length > 0) {
      console.log(`✅ Found Energy prices using key: "${key}"`);
      return marketPrices[key];
    }
  }
  
  const stateKeys = Object.keys(marketPrices).filter(key => key.includes(state));
  if (stateKeys.length > 0 && marketPrices[stateKeys[0]].length > 0) {
    console.log(`⚠️ Using fallback state key: "${stateKeys[0]}"`);
    return marketPrices[stateKeys[0]];
  }
  
  console.warn(`❌ No market prices found for ${state} ${profileType} ${contractType}`);
  return contractType === 'Green' ? Array(12).fill(45) : Array(12).fill(80);
};

// Price calculation utilities
const calculateContractPrice = (contract: Contract, monthIndex: number, year: number): number => {
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
  
  // Default to fixed price
  return contract.strikePrice;
};

export default function MarkToMarketTab({
  contracts,
  selectedContract,
  setSelectedContract,
  settings,
  marketPrices,
}: MarkToMarketTabProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearType, setYearType] = useState<'CY' | 'FY'>('CY');
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'state' | 'contractType' | 'direction'>('category');
  const [sortBy, setSortBy] = useState<'mtmPnL' | 'volume' | 'contractName'>('mtmPnL');
  const [filterDirection, setFilterDirection] = useState<'all' | 'buy' | 'sell'>('all');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Get available years from contracts
  const getAvailableYears = (): number[] => {
    const years = new Set<number>();
    
    contracts.forEach(contract => {
      if (VolumeUtils.hasMonthlyData(contract)) {
        const timeSeriesYears = VolumeUtils.getYearsCovered(contract.timeSeriesData!);
        timeSeriesYears.forEach(year => years.add(year));
      } else {
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

  // Calculate MtM for all contracts
  const mtmCalculations = useMemo((): MtMCalculation[] => {
    const calculations: MtMCalculation[] = [];
    const activeContracts = contracts.filter(contract => contract.status === 'active');

    activeContracts.forEach(contract => {
      let yearsToProcess: number[] = [];
      
      if (VolumeUtils.hasMonthlyData(contract)) {
        const timeSeriesYears = VolumeUtils.getYearsCovered(contract.timeSeriesData!);
        yearsToProcess = timeSeriesYears.filter(year => year === selectedYear);
      } else {
        if (contract.startDate && contract.endDate) {
          const startDate = new Date(contract.startDate);
          const endDate = new Date(contract.endDate);
          
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            let yearToCheck: number;
            
            if (yearType === 'FY') {
              const month = currentDate.getMonth() + 1;
              if (month >= 7) {
                yearToCheck = currentDate.getFullYear() + 1;
              } else {
                yearToCheck = currentDate.getFullYear();
              }
            } else {
              yearToCheck = currentDate.getFullYear();
            }
            
            if (yearToCheck === selectedYear) {
              yearsToProcess.push(yearToCheck);
              break;
            }
            currentDate.setFullYear(currentDate.getFullYear() + 1);
          }
        }
      }

      yearsToProcess.forEach(year => {
        // Get monthly volumes and prices for the year
        const monthlyVolumes = VolumeUtils.getMonthlyVolumes(contract, year);
        const marketPricesForProfile = getLegacyMarketPrice(
          contract.volumeShape, 
          contract.state, 
          contract.contractType || 'Energy',
          marketPrices
        );

        // Skip calculation if no market prices found
        if (marketPricesForProfile.length === 0) {
          console.warn(`Skipping ${contract.name}: No market prices found for ${contract.state} ${contract.volumeShape} ${contract.contractType || 'Energy'}`);
          return;
        }

        let totalVolume = 0;
        let totalContractValue = 0;
        let totalMarketValue = 0;
        let weightedContractPrice = 0;
        let weightedMarketPrice = 0;

        // Calculate month by month
        monthlyVolumes.forEach((volume, monthIndex) => {
          if (volume > 0) {
            const contractPrice = calculateContractPrice(contract, monthIndex, year);
            const marketPrice = marketPricesForProfile[monthIndex];

            // Skip if no market price available for this month
            if (!marketPrice || marketPrice <= 0) {
              console.warn(`Skipping month ${monthIndex + 1} for ${contract.name}: No market price data`);
              return;
            }

            totalVolume += volume;
            totalContractValue += volume * contractPrice;
            totalMarketValue += volume * marketPrice;
          }
        });

        if (totalVolume > 0) {
          weightedContractPrice = totalContractValue / totalVolume;
          weightedMarketPrice = totalMarketValue / totalVolume;

          // Apply direction sign to volume
          const signedVolume = contract.direction === 'sell' ? -totalVolume : totalVolume;

          // Calculate MtM based on direction
          let mtmPnL = 0;
          let contractRevenue = 0;
          let marketValue = 0;

          if (contract.direction === 'sell') {
            // Sell: MtM = (Contract Price × Volume) - (Market Price × Volume)
            contractRevenue = totalContractValue;
            marketValue = totalMarketValue;
            mtmPnL = contractRevenue - marketValue;
          } else {
            // Buy: MtM = (Market Price × Volume) - (Contract Price × Volume)
            contractRevenue = totalContractValue;
            marketValue = totalMarketValue;
            mtmPnL = marketValue - contractRevenue;
          }

          calculations.push({
            contractId: contract._id || contract.name,
            contractName: contract.name,
            direction: contract.direction || 'buy',
            category: contract.category,
            state: contract.state,
            contractType: contract.contractType || 'Energy',
            counterparty: contract.counterparty,
            year,
            yearType,
            volume: signedVolume,
            avgContractPrice: weightedContractPrice,
            avgMarketPrice: weightedMarketPrice,
            contractRevenue,
            marketValue,
            mtmPnL,
            volumeShape: contract.volumeShape,
            dataSource: VolumeUtils.hasMonthlyData(contract) ? 'Time Series' : 'Shape-based'
          });
        }
      });
    });

    return calculations;
  }, [contracts, selectedYear, yearType, marketPrices]);

  // Filter calculations
  const filteredCalculations = useMemo(() => {
    let filtered = mtmCalculations;

    if (filterDirection !== 'all') {
      filtered = filtered.filter(calc => calc.direction === filterDirection);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'mtmPnL':
          return b.mtmPnL - a.mtmPnL;
        case 'volume':
          return Math.abs(b.volume) - Math.abs(a.volume);
        case 'contractName':
          return a.contractName.localeCompare(b.contractName);
        default:
          return b.mtmPnL - a.mtmPnL;
      }
    });

    return filtered;
  }, [mtmCalculations, filterDirection, sortBy]);

  // Group calculations
  const groupedCalculations = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Contracts': filteredCalculations };
    }

    const groups: { [key: string]: MtMCalculation[] } = {};

    filteredCalculations.forEach(calc => {
      let groupKey = '';
      switch (groupBy) {
        case 'category':
          groupKey = calc.category;
          break;
        case 'state':
          groupKey = calc.state;
          break;
        case 'contractType':
          groupKey = calc.contractType;
          break;
        case 'direction':
          groupKey = calc.direction.toUpperCase();
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(calc);
    });

    return groups;
  }, [filteredCalculations, groupBy]);

  // Calculate group aggregations
  const getGroupAggregation = (calculations: MtMCalculation[]) => {
    return calculations.reduce((acc, calc) => ({
      totalVolume: acc.totalVolume + calc.volume,
      totalAbsVolume: acc.totalAbsVolume + Math.abs(calc.volume),
      totalMtM: acc.totalMtM + calc.mtmPnL,
      totalContractRevenue: acc.totalContractRevenue + calc.contractRevenue,
      totalMarketValue: acc.totalMarketValue + calc.marketValue,
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

  // Overall portfolio aggregation
  const portfolioAggregation = getGroupAggregation(filteredCalculations);

  // Toggle group expansion
  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  // Expand all groups
  const expandAllGroups = () => {
    setExpandedGroups(new Set(Object.keys(groupedCalculations)));
  };

  // Collapse all groups  
  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  const availableYears = getAvailableYears();

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              💹 Mark-to-Market Analysis
            </h2>
            <p className="text-gray-600 mt-2">
              Comprehensive MtM calculations with contract-level breakdowns and aggregations
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="mtmPnL">MtM P&L</option>
              <option value="volume">Volume</option>
              <option value="contractName">Contract Name</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              {filteredCalculations.length} of {mtmCalculations.length} contracts
            </div>
          </div>
        </div>

        {/* Debug Information Panel */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              🔍 {showDebugInfo ? 'Hide' : 'Show'} Market Price Debug Info
            </button>
            <div className="text-xs text-gray-500">
              Available market price keys: {Object.keys(marketPrices).length}
            </div>
          </div>
          
          {showDebugInfo && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3">Available Market Price Keys:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                {Object.keys(marketPrices).map(key => (
                  <div key={key} className="bg-white rounded px-2 py-1 border">
                    <span className="font-mono text-blue-600">{key}</span>
                    <span className="text-gray-500 ml-2">
                      ({marketPrices[key]?.length || 0} points)
                    </span>
                  </div>
                ))}
              </div>
              
              {filteredCalculations.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-800 mb-2">Contract Market Price Mapping:</h5>
                  <div className="space-y-1 text-xs">
                    {filteredCalculations.slice(0, 5).map((calc, index) => {
                      const contract = contracts.find(c => c.name === calc.contractName);
                      if (!contract) return null;
                      
                      return (
                        <div key={index} className="flex justify-between bg-white rounded px-2 py-1">
                          <span className="text-gray-700">
                            {calc.contractName} ({contract.state} {contract.volumeShape} {contract.contractType || 'Energy'})
                          </span>
                          <span className="font-mono text-blue-600">
                            Avg: ${calc.avgMarketPrice.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Portfolio Summary ({yearType} {selectedYear})</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Active Contracts</div>
            <div className="text-2xl font-bold text-blue-800">{portfolioAggregation.count}</div>
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
            <div className="text-sm text-gray-600 font-medium">Avg MtM per MWh</div>
            <div className="text-2xl font-bold text-gray-800">
              ${portfolioAggregation.totalAbsVolume > 0 
                ? (portfolioAggregation.totalMtM / portfolioAggregation.totalAbsVolume).toFixed(2) 
                : '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Results */}
      <div className="space-y-6">
        {/* Group Controls */}
        {groupBy !== 'none' && Object.keys(groupedCalculations).length > 1 && (
          <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {Object.keys(groupedCalculations).length} groups found
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

        {Object.entries(groupedCalculations).map(([groupName, calculations]) => {
          const groupAgg = getGroupAggregation(calculations);
          const isExpanded = expandedGroups.has(groupName);
          const canExpand = groupBy !== 'none' && calculations.length > 1;
          
          return (
            <div key={groupName} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              {/* Group Header with Summary */}
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
                      <div className="text-xs text-gray-400">
                        ({groupAgg.totalAbsVolume.toLocaleString()} gross)
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">MtM P&L</div>
                      <div className={`text-lg font-bold ${groupAgg.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${groupAgg.totalMtM.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        ${groupAgg.totalAbsVolume > 0 ? (groupAgg.totalMtM / groupAgg.totalAbsVolume).toFixed(2) : '0.00'}/MWh
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Avg Contract Price</div>
                      <div className="font-semibold text-gray-800">
                        ${groupAgg.totalAbsVolume > 0 ? (groupAgg.totalContractRevenue / groupAgg.totalAbsVolume).toFixed(2) : '0.00'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Avg Market Price</div>
                      <div className="font-semibold text-gray-800">
                        ${groupAgg.totalAbsVolume > 0 ? (groupAgg.totalMarketValue / groupAgg.totalAbsVolume).toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Contracts (Expandable) */}
              {(isExpanded || !canExpand) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-3 font-semibold text-gray-700">Contract</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Direction</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Category</th>
                        <th className="text-left p-3 font-semibold text-gray-700">State</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Contract Price</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Market Price</th>
                        <th className="text-left p-3 font-semibold text-gray-700">MtM P&L</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Data Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations.map((calc, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium text-gray-900">{calc.contractName}</div>
                            <div className="text-xs text-gray-500">{calc.counterparty}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                              calc.direction === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {calc.direction}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700">{calc.category}</td>
                          <td className="p-3 text-gray-700">{calc.state}</td>
                          <td className="p-3">
                            <div className={`font-medium ${calc.volume < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {calc.volume.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">{calc.volumeShape}</div>
                          </td>
                          <td className="p-3 font-medium">${calc.avgContractPrice.toFixed(2)}</td>
                          <td className="p-3 font-medium">${calc.avgMarketPrice.toFixed(2)}</td>
                          <td className="p-3">
                            <div className={`font-semibold ${
                              calc.mtmPnL >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${calc.mtmPnL.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              ${(Math.abs(calc.volume) > 0 ? calc.mtmPnL / Math.abs(calc.volume) : 0).toFixed(2)}/MWh
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              calc.dataSource === 'Time Series' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {calc.dataSource}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCalculations.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No MtM Data Available</h3>
          <p className="text-gray-600">
            No active contracts found for {yearType} {selectedYear} with available market price data. 
            Please check your contracts, market price data, or select a different year.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>Contracts are skipped when:</p>
            <ul className="list-disc list-inside mt-2">
              <li>No matching market price curves are found</li>
              <li>Market price data is incomplete or zero</li>
              <li>Contract has no volume for the selected year</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}