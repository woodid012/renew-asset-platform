'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Proper dynamic import for Chart.js
const Line = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-64 text-gray-500">Loading chart...</div>
  }
);

// Register Chart.js components INCLUDING Filler
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler, // ADD THIS
} from 'chart.js';

if (typeof window !== 'undefined') {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler // ADD THIS
  );
}

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
  contractType?: string; // New field for Energy/Green
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  indexation: string;
  referenceDate: string;
}

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
  const [volumeChartView, setVolumeChartView] = useState<'Energy' | 'Green' | 'Both'>('Both');
  const [mtmChartView, setMtmChartView] = useState<'Energy' | 'Green' | 'Both'>('Both');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Type colors (Green/Energy based on contractType)
  const contractTypeColors: { [key: string]: string } = {
    'Energy': '#10b981',
    'Green': '#3b82f6',
  };

  // Get contract type colors
  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'retail': return 'bg-orange-100 text-orange-800';
      case 'wholesale': return 'bg-green-100 text-green-800';
      case 'offtake': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Get available years from contracts
  const getAvailableYears = () => {
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

  // Calculate aggregations for selected year
  const calculateAggregations = () => {
    // Combined business type + contract type aggregations
    const combinedTypeAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};

    // Pure contract type aggregations (Energy/Green)
    const contractTypeAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};

    const categoryAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};

    activeContracts.forEach(contract => {
      const contractTypeKey = contract.contractType || 'Energy'; // Default to Energy if not set
      
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

      // Category aggregation
      if (!categoryAggregations[contract.category]) {
        categoryAggregations[contract.category] = { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 };
      }
      categoryAggregations[contract.category].count += 1;
      categoryAggregations[contract.category].volume += contract.annualVolume;
      categoryAggregations[contract.category].totalStrike += contract.strikePrice * contract.annualVolume;
    });

    // Calculate volume-weighted average strike prices for combined types
    Object.keys(combinedTypeAggregations).forEach(combinedType => {
      const agg = combinedTypeAggregations[combinedType];
      agg.avgStrike = agg.volume > 0 ? agg.totalStrike / agg.volume : 0;
    });

    // Calculate for contract types
    Object.keys(contractTypeAggregations).forEach(contractType => {
      const agg = contractTypeAggregations[contractType];
      agg.avgStrike = agg.volume > 0 ? agg.totalStrike / agg.volume : 0;
    });

    Object.keys(categoryAggregations).forEach(category => {
      const agg = categoryAggregations[category];
      agg.avgStrike = agg.volume > 0 ? agg.totalStrike / agg.volume : 0;
    });

    return { combinedTypeAggregations, contractTypeAggregations, categoryAggregations };
  };

  const { combinedTypeAggregations, contractTypeAggregations, categoryAggregations } = calculateAggregations();

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

  // Create volume chart data - UPDATED to use contractType instead of unit
  const createVolumeChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const contractTypeData: { [key: string]: number[] } = {};
    
    activeContracts.forEach(contract => {
      const contractTypeKey = contract.contractType || 'Energy'; // Default to Energy if not set
      if (!contractTypeData[contractTypeKey]) {
        contractTypeData[contractTypeKey] = new Array(12).fill(0);
      }
      
      const volumeProfile = volumeShapes[contract.volumeShape] || [];
      volumeProfile.forEach((pct, monthIndex) => {
        const monthlyVolume = contract.annualVolume * pct / 100;
        contractTypeData[contractTypeKey][monthIndex] += monthlyVolume;
      });
    });

    const datasets: any[] = [];
    
    Object.entries(contractTypeData).forEach(([contractType, monthlyVolumes]) => {
      if (volumeChartView === 'Both' || volumeChartView === contractType) {
        const color = contractTypeColors[contractType] || '#6b7280';
        datasets.push({
          label: contractType,
          data: monthlyVolumes,
          borderColor: color,
          backgroundColor: color + '20',
          borderWidth: 3,
          tension: 0.1,
          fill: true
        });
      }
    });

    return {
      labels: months,
      datasets: datasets
    };
  };

  // Create MtM chart data - UPDATED to use contractType
  const createMtMChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const contractTypeData: { [key: string]: number[] } = {};
    
    activeContracts.forEach(contract => {
      const contractTypeKey = contract.contractType || 'Energy'; // Default to Energy if not set
      if (!contractTypeData[contractTypeKey]) {
        contractTypeData[contractTypeKey] = new Array(12).fill(0);
      }
      
      const volumeProfile = volumeShapes[contract.volumeShape] || [];
      const statePrices = marketPrices[contract.state] || marketPrices.NSW || [];
      
      volumeProfile.forEach((pct, monthIndex) => {
        const volume = contract.annualVolume * pct / 100;
        const strikeValue = volume * contract.strikePrice;
        const marketValue = volume * (statePrices[monthIndex] || 0);
        
        let netMtM;
        if (contract.type === 'retail') {
          netMtM = strikeValue - marketValue;
        } else {
          netMtM = marketValue - strikeValue;
        }
        
        contractTypeData[contractTypeKey][monthIndex] += netMtM;
      });
    });

    const datasets: any[] = [];
    
    Object.entries(contractTypeData).forEach(([contractType, monthlyMtM]) => {
      if (mtmChartView === 'Both' || mtmChartView === contractType) {
        const color = contractTypeColors[contractType] || '#6b7280';
        datasets.push({
          label: contractType,
          data: monthlyMtM,
          borderColor: color,
          backgroundColor: color + '20',
          borderWidth: 3,
          tension: 0.1,
          fill: true
        });
      }
    });

    return {
      labels: months,
      datasets: datasets
    };
  };

  // Chart options
  const volumeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Monthly Volume by Contract Type (${selectedYear})`,
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        display: true,
        position: 'top' as const
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Volume (MWh)'
        },
        ticks: {
          callback: function(value: any) {
            return value.toLocaleString();
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    },
    animation: {
      duration: 0
    }
  };

  const mtmChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Monthly Net MtM by Contract Type (${selectedYear})`,
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        display: true,
        position: 'top' as const
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Net MtM ($)'
        },
        ticks: {
          callback: function(value: any) {
            return '$' + value.toLocaleString();
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    },
    animation: {
      duration: 0
    }
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
              
              {/* By Contract Type (Energy/Green) - Shows split by business type */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">By Contract Type (Energy/Green)</h3>
                <div className="space-y-3">
                  {Object.entries(contractTypeAggregations).map(([contractType, data]) => (
                    data.count > 0 && (
                      <div key={contractType} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: contractTypeColors[contractType] || '#6b7280' }}
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
                        
                        {/* Show breakdown by business type within this contract type */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-500 mb-2">Breakdown by Business Type:</div>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(combinedTypeAggregations)
                              .filter(([key]) => key.includes(contractType))
                              .map(([combinedType, combinedData]) => (
                                <div key={combinedType} className={`px-2 py-1 rounded text-xs ${getCombinedTypeColor(combinedType)}`}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{combinedType}</span>
                                    <span>{combinedData.count} • {combinedData.volume.toLocaleString()} MWh • ${combinedData.avgStrike.toFixed(2)}/MWh</span>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
              
              {/* By Business Type - Shows split by contract type */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">By Business Type (Retail/Wholesale/Offtake)</h3>
                <div className="space-y-3">
                  {['retail', 'wholesale', 'offtake'].map(businessType => {
                    // Calculate totals for this business type across all contract types
                    const businessTypeData = Object.entries(combinedTypeAggregations)
                      .filter(([key]) => key.toLowerCase().includes(businessType))
                      .reduce((acc, [, data]) => ({
                        count: acc.count + data.count,
                        volume: acc.volume + data.volume,
                        totalStrike: acc.totalStrike + data.totalStrike
                      }), { count: 0, volume: 0, totalStrike: 0 });
                    
                    const avgStrike = businessTypeData.volume > 0 ? businessTypeData.totalStrike / businessTypeData.volume : 0;
                    
                    return businessTypeData.count > 0 && (
                      <div key={businessType} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${getContractTypeColor(businessType)}`}>
                            {businessType}
                          </span>
                          <span className="text-sm text-gray-600">{businessTypeData.count} contract{businessTypeData.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 font-medium">Total Volume:</span>
                            <span className="ml-2 text-gray-900 font-semibold">{businessTypeData.volume.toLocaleString()} MWh</span>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Avg Strike:</span>
                            <span className="ml-2 text-gray-900 font-semibold">${avgStrike.toFixed(2)}/MWh</span>
                          </div>
                        </div>
                        
                        {/* Show breakdown by contract type within this business type */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-500 mb-2">Breakdown by Contract Type:</div>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(combinedTypeAggregations)
                              .filter(([key]) => key.toLowerCase().includes(businessType))
                              .map(([combinedType, combinedData]) => (
                                <div key={combinedType} className={`px-2 py-1 rounded text-xs ${getCombinedTypeColor(combinedType)}`}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{combinedType}</span>
                                    <span>{combinedData.count} • {combinedData.volume.toLocaleString()} MWh • ${combinedData.avgStrike.toFixed(2)}/MWh</span>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

      {/* Right Panel - Charts */}
      <div className="space-y-6">
        
        {/* Volume Chart */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📈 Volume Analysis
            </h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['Energy', 'Green', 'Both'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setVolumeChartView(view)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    volumeChartView === view
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            {activeContracts.length > 0 ? (
              <Line data={createVolumeChartData()} options={volumeChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No active contracts for {selectedYear}</p>
              </div>
            )}
          </div>
        </div>

        {/* MtM Chart */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              💰 Net MtM Analysis
            </h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['Energy', 'Green', 'Both'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setMtmChartView(view)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    mtmChartView === view
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            {activeContracts.length > 0 ? (
              <Line data={createMtMChartData()} options={mtmChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No active contracts for {selectedYear}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}