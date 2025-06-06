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
  const [volumeChartView, setVolumeChartView] = useState<'Energy' | 'Unit' | 'Both'>('Both');
  const [mtmChartView, setMtmChartView] = useState<'Energy' | 'Unit' | 'Both'>('Both');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Category colors
  const categoryColors: { [key: string]: string } = {
    'Energy': '#10b981',
    'Unit': '#3b82f6',
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
    const typeAggregations = {
      retail: { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 },
      wholesale: { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 },
      offtake: { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 }
    };

    const categoryAggregations: { [key: string]: { count: number, volume: number, avgStrike: number, totalStrike: number } } = {};

    activeContracts.forEach(contract => {
      // Type aggregation
      typeAggregations[contract.type].count += 1;
      typeAggregations[contract.type].volume += contract.annualVolume;
      typeAggregations[contract.type].totalStrike += contract.strikePrice * contract.annualVolume;

      // Category aggregation
      if (!categoryAggregations[contract.category]) {
        categoryAggregations[contract.category] = { count: 0, volume: 0, avgStrike: 0, totalStrike: 0 };
      }
      categoryAggregations[contract.category].count += 1;
      categoryAggregations[contract.category].volume += contract.annualVolume;
      categoryAggregations[contract.category].totalStrike += contract.strikePrice * contract.annualVolume;
    });

    // Calculate volume-weighted average strike prices
    Object.keys(typeAggregations).forEach(type => {
      const agg = typeAggregations[type as keyof typeof typeAggregations];
      agg.avgStrike = agg.volume > 0 ? agg.totalStrike / agg.volume : 0;
    });

    Object.keys(categoryAggregations).forEach(category => {
      const agg = categoryAggregations[category];
      agg.avgStrike = agg.volume > 0 ? agg.totalStrike / agg.volume : 0;
    });

    return { typeAggregations, categoryAggregations };
  };

  const { typeAggregations, categoryAggregations } = calculateAggregations();

  // Create volume chart data
  const createVolumeChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const categoryData: { [key: string]: number[] } = {};
    
    activeContracts.forEach(contract => {
      if (!categoryData[contract.category]) {
        categoryData[contract.category] = new Array(12).fill(0);
      }
      
      const volumeProfile = volumeShapes[contract.volumeShape] || [];
      volumeProfile.forEach((pct, monthIndex) => {
        const monthlyVolume = contract.annualVolume * pct / 100;
        categoryData[contract.category][monthIndex] += monthlyVolume;
      });
    });

    const datasets: any[] = [];
    
    Object.entries(categoryData).forEach(([category, monthlyVolumes]) => {
      if (volumeChartView === 'Both' || volumeChartView === category) {
        const color = categoryColors[category] || '#6b7280';
        datasets.push({
          label: category,
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

  // Create MtM chart data
  const createMtMChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const categoryData: { [key: string]: number[] } = {};
    
    activeContracts.forEach(contract => {
      if (!categoryData[contract.category]) {
        categoryData[contract.category] = new Array(12).fill(0);
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
        
        categoryData[contract.category][monthIndex] += netMtM;
      });
    });

    const datasets: any[] = [];
    
    Object.entries(categoryData).forEach(([category, monthlyMtM]) => {
      if (mtmChartView === 'Both' || mtmChartView === category) {
        const color = categoryColors[category] || '#6b7280';
        datasets.push({
          label: category,
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
        text: `Monthly Volume by Category (${selectedYear})`,
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
        text: `Monthly Net MtM by Category (${selectedYear})`,
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
              
              {/* By Contract Type */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">By Contract Type</h3>
                <div className="space-y-3">
                  {Object.entries(typeAggregations).map(([type, data]) => (
                    data.count > 0 && (
                      <div key={type} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${getContractTypeColor(type)}`}>
                            {type}
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
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: categoryColors[category] || '#6b7280' }}
                          ></div>
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {category}
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
              {(['Energy', 'Unit', 'Both'] as const).map((view) => (
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
              {(['Energy', 'Unit', 'Both'] as const).map((view) => (
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