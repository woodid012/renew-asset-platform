'use client';

import { useState } from 'react';
import { Contract, SettingsData } from '@/app/types';

interface ContractSummaryTabProps {
  contracts: Contract[];
  marketPrices: { [key: string]: number[] };
  volumeShapes: { [key: string]: number[] };
}

export default function ContractSummaryTab({
  contracts,
  marketPrices,
  volumeShapes,
}: ContractSummaryTabProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Get available years from contracts
  const getAvailableYears = (): number[] => {
    const years = new Set<number>();
    contracts.forEach(contract => {
      const startYear = new Date(contract.startDate).getFullYear();
      const endYear = new Date(contract.endDate).getFullYear();
      
      for (let year = startYear; year <= endYear; year++) {
        years.add(year);
      }
    });
    
    if (years.size === 0) {
      years.add(new Date().getFullYear());
    }
    
    return Array.from(years).sort();
  };

  // Filter contracts active in selected year
  const getActiveContractsForYear = (year: number) => {
    return contracts.filter(contract => {
      const startYear = new Date(contract.startDate).getFullYear();
      const endYear = new Date(contract.endDate).getFullYear();
      return year >= startYear && year <= endYear;
    });
  };

  const availableYears = getAvailableYears();
  const activeContracts = getActiveContractsForYear(selectedYear);

  // Calculate basic aggregations for selected year
  const calculateBasicAggregations = () => {
    // Combined business type + contract type aggregations
    const combinedTypeAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};
    // Pure contract type aggregations (Energy/Green)
    const contractTypeAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};
    // Direction aggregations (Buy/Sell)
    const directionAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};
    const categoryAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};

    activeContracts.forEach(contract => {
      const contractTypeKey = contract.contractType || 'Energy'; // Default to Energy if not set
      const directionKey = contract.direction || 'buy'; // Default to buy if not set
      
      // Combined business type + contract type (e.g., "Retail Energy", "Wholesale Green")
      const combinedKey = `${contract.type.charAt(0).toUpperCase() + contract.type.slice(1)} ${contractTypeKey}`;
      if (!combinedTypeAggregations[combinedKey]) {
        combinedTypeAggregations[combinedKey] = { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 };
      }
      combinedTypeAggregations[combinedKey].count += 1;
      combinedTypeAggregations[combinedKey].volume += contract.annualVolume;
      combinedTypeAggregations[combinedKey].totalStrike += contract.strikePrice * contract.annualVolume;

      // Pure contract type aggregation (Energy/Green)
      if (!contractTypeAggregations[contractTypeKey]) {
        contractTypeAggregations[contractTypeKey] = { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 };
      }
      contractTypeAggregations[contractTypeKey].count += 1;
      contractTypeAggregations[contractTypeKey].volume += contract.annualVolume;
      contractTypeAggregations[contractTypeKey].totalStrike += contract.strikePrice * contract.annualVolume;

      // Direction aggregation (Buy/Sell)
      if (!directionAggregations[directionKey]) {
        directionAggregations[directionKey] = { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 };
      }
      directionAggregations[directionKey].count += 1;
      directionAggregations[directionKey].volume += contract.annualVolume;
      directionAggregations[directionKey].totalStrike += contract.strikePrice * contract.annualVolume;

      // Category aggregation
      if (!categoryAggregations[contract.category]) {
        categoryAggregations[contract.category] = { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 };
      }
      categoryAggregations[contract.category].count += 1;
      categoryAggregations[contract.category].volume += contract.annualVolume;
      categoryAggregations[contract.category].totalStrike += contract.strikePrice * contract.annualVolume;
    });

    // Calculate volume-weighted average strike prices for all aggregations
    [combinedTypeAggregations, contractTypeAggregations, directionAggregations, categoryAggregations].forEach(aggregation => {
      Object.keys(aggregation).forEach(key => {
        const agg = aggregation[key];
        agg.avgStrike = agg.volume > 0 ? agg.totalStrike / agg.volume : 0;
      });
    });

    return { combinedTypeAggregations, contractTypeAggregations, directionAggregations, categoryAggregations };
  };

  const { combinedTypeAggregations, contractTypeAggregations, directionAggregations, categoryAggregations } = calculateBasicAggregations();

  // Helper function to get color for combined business + contract type
  const getCombinedTypeColor = (combinedType: string) => {
    if (combinedType.includes('Energy')) {
      if (combinedType.includes('Retail')) return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500';
      if (combinedType.includes('Wholesale')) return 'bg-green-100 text-green-800 border-l-4 border-green-500';
      if (combinedType.includes('Offtake')) return 'bg-purple-100 text-purple-800 border-l-4 border-purple-500';
    } else if (combinedType.includes('Green')) {
      if (combinedType.includes('Retail')) return 'bg-orange-50 text-orange-900 border-l-4 border-orange-400';
      if (combinedType.includes('Wholesale')) return 'bg-green-50 text-green-900 border-l-4 border-green-400';
      if (combinedType.includes('Offtake')) return 'bg-purple-50 text-purple-900 border-l-4 border-purple-400';
    }
    return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Panel - Aggregations */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📊 Portfolio Aggregations
            </h2>
            <div className="flex items-center gap-2">
              <label htmlFor="year-select" className="text-sm font-medium text-gray-600">Year:</label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          {activeContracts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No active contracts found for {selectedYear}</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* By Direction (Buy/Sell) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">By Direction (Buy/Sell)</h3>
                <div className="space-y-3">
                  {Object.entries(directionAggregations).map(([direction, data]) => (
                    data.count > 0 && (
                      <div key={direction} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className={`w-4 h-4 rounded ${
                                direction === 'buy' ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            ></div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${
                              direction === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {direction}
                            </span>
                          </div>
                          <span className="text-sm text-gray-600">{data.count} contract{data.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 font-medium">Total Volume:</span>
                            <span className="ml-2 text-gray-900 font-semibold">{data.volume.toLocaleString()} MWh</span>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Avg Strike:</span>
                            <span className="ml-2 text-gray-900 font-semibold">${data.avgStrike.toFixed(2)}/MWh</span>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
              
              {/* By Contract Type (Energy/Green) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">By Contract Type (Energy/Green)</h3>
                <div className="space-y-3">
                  {Object.entries(contractTypeAggregations).map(([contractType, data]) => (
                    data.count > 0 && (
                      <div key={contractType} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className={`w-4 h-4 rounded ${
                                contractType === 'Green' ? 'bg-green-400' : 'bg-blue-400'
                              }`}
                            ></div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              contractType === 'Green' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {contractType}
                            </span>
                          </div>
                          <span className="text-sm text-gray-600">{data.count} contract{data.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 font-medium">Total Volume:</span>
                            <span className="ml-2 text-gray-900 font-semibold">{data.volume.toLocaleString()} MWh</span>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Avg Strike:</span>
                            <span className="ml-2 text-gray-900 font-semibold">${data.avgStrike.toFixed(2)}/MWh</span>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* By Category */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">By Category</h3>
                <div className="space-y-3">
                  {Object.entries(categoryAggregations).map(([category, data]) => (
                    <div key={category} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {category}
                        </span>
                        <span className="text-sm text-gray-600">{data.count} contract{data.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Total Volume:</span>
                          <span className="ml-2 text-gray-900 font-semibold">{data.volume.toLocaleString()} MWh</span>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Avg Strike:</span>
                          <span className="ml-2 text-gray-900 font-semibold">${data.avgStrike.toFixed(2)}/MWh</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall Portfolio Summary */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Portfolio ({selectedYear})</h3>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 font-medium">Active Contracts:</span>
                      <span className="ml-2 text-gray-900 font-semibold">{activeContracts.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Total Volume:</span>
                      <span className="ml-2 text-gray-900 font-semibold">
                        {activeContracts.reduce((sum, c) => sum + c.annualVolume, 0).toLocaleString()} MWh
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600 font-medium">Portfolio Avg Strike:</span>
                      <span className="ml-2 text-gray-900 font-semibold">
                        ${(activeContracts.reduce((sum, c) => sum + (c.strikePrice * c.annualVolume), 0) / 
                           activeContracts.reduce((sum, c) => sum + c.annualVolume, 0) || 0).toFixed(2)}/MWh
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Information */}
      <div className="space-y-6">
        
        {/* Charts Disabled Notice */}
        <div className="bg-yellow-50 rounded-xl p-6 shadow-md border border-yellow-200">
          <h2 className="text-2xl font-bold text-yellow-800 flex items-center gap-3 mb-4">
            ⚠️ Analysis Under Development
          </h2>
          <div className="space-y-4 text-yellow-700">
            <p>
              Volume and Mark-to-Market analysis charts are currently being recalibrated to ensure accuracy with the new Buy/Sell direction feature.
            </p>
            <p>
              The portfolio aggregations shown on the left provide basic contract summaries. For detailed analysis, please use:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Price Curves Tab:</strong> For market price data and forecasting</li>
              <li><strong>Time Series Output Tab:</strong> For detailed contract cashflow analysis</li>
              <li><strong>Contract Input Tab:</strong> For managing individual contract details</li>
            </ul>
          </div>
        </div>

        {/* Contract Overview */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📋 Contract Overview
          </h2>
          
          {activeContracts.length > 0 ? (
            <div className="space-y-4">
              {activeContracts.slice(0, 5).map((contract, index) => (
                <div key={contract._id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-800">{contract.name}</h4>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                        contract.direction === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {contract.direction || 'buy'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        contract.contractType === 'Green' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {contract.contractType || 'Energy'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Type:</span> {contract.type}
                    </div>
                    <div>
                      <span className="font-medium">State:</span> {contract.state}
                    </div>
                    <div>
                      <span className="font-medium">Volume:</span> {contract.annualVolume.toLocaleString()} MWh
                    </div>
                    <div>
                      <span className="font-medium">Strike:</span> ${contract.strikePrice}/MWh
                    </div>
                  </div>
                </div>
              ))}
              
              {activeContracts.length > 5 && (
                <div className="text-center text-gray-500 text-sm">
                  ... and {activeContracts.length - 5} more contracts
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No contracts found for {selectedYear}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}