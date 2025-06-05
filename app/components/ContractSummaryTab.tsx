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

// Register Chart.js components - do this only once
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register only once at module level
if (typeof window !== 'undefined') {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
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
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  marketPrices: { [key: string]: number[] };
  volumeShapes: { [key: string]: number[] };
}

export default function ContractSummaryTab({
  contracts,
  selectedContract,
  setSelectedContract,
  marketPrices,
  volumeShapes,
}: ContractSummaryTabProps) {

  // Chart colors for different contracts
  const chartColorsByContract: { [key: string]: string } = {
    1: '#667eea',
    2: '#764ba2', 
    3: '#f093fb',
    4: '#4facfe',
    5: '#43e97b'
  };

  const getContractColor = (contract: Contract, index: number): string => {
    return chartColorsByContract[contract._id || contract.id?.toString() || (index + 1).toString()] || 
           chartColorsByContract[(index + 1).toString()] || '#667eea';
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'retail': return 'bg-orange-100 text-orange-800';
      case 'wholesale': return 'bg-green-100 text-green-800';
      case 'offtake': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Create volume chart data
  const createVolumeChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const datasets = contracts.map((contract, index) => {
      const volumeProfile = volumeShapes[contract.volumeShape];
      const monthlyVolumes = volumeProfile?.map(pct => (contract.annualVolume * pct / 100)) || [];
      const color = getContractColor(contract, index);
      
      return {
        label: contract.name,
        data: monthlyVolumes,
        borderColor: color,
        backgroundColor: color + '80',
        borderWidth: selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id) ? 4 : 2,
        tension: 0.1
      };
    });

    return {
      labels: months,
      datasets: datasets
    };
  };

  // Create MtM chart data
  const createMtMChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const datasets = contracts.map((contract, index) => {
      const volumeProfile = volumeShapes[contract.volumeShape];
      const statePrices = marketPrices[contract.state] || marketPrices.NSW || [];
      const color = getContractColor(contract, index);
      
      const monthlyMtM = volumeProfile?.map((pct, monthIndex) => {
        const volume = contract.annualVolume * pct / 100;
        const strikeValue = volume * contract.strikePrice;
        const marketValue = volume * (statePrices[monthIndex] || 0);
        
        let netMtM;
        if (contract.type === 'retail') {
          netMtM = strikeValue - marketValue;
        } else {
          netMtM = marketValue - strikeValue;
        }
        
        return netMtM;
      }) || [];
      
      return {
        label: contract.name,
        data: monthlyMtM,
        borderColor: color,
        backgroundColor: color + '80',
        borderWidth: 2,
        tension: 0.1
      };
    });

    return {
      labels: months,
      datasets: datasets
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Monthly Volume Profile by Contract',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        display: false
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
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: 'Monthly Net Mark-to-Market Earnings by Contract'
      }
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
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
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Panel */}
      <div className="space-y-6">
        
        {/* Contract Portfolio */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📋 Contract Portfolio
          </h2>
          <div className="space-y-4">
            {contracts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No contracts found. Add contracts in the Contract Input tab.</p>
              </div>
            ) : (
              contracts.map((contract, index) => (
                <div 
                  key={contract._id || contract.id || index}
                  onClick={() => setSelectedContract(contract)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${contract.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="font-semibold text-gray-900">{contract.name}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getContractTypeColor(contract.type)}`}>
                      {contract.type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 font-medium">State:</span>
                      <span className="ml-2 text-gray-900">{contract.state}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Shape:</span>
                      <span className="ml-2 text-gray-900 capitalize">{contract.volumeShape}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600 font-medium">Annual Volume:</span>
                      <span className="ml-2 text-gray-900 font-semibold">{contract.annualVolume.toLocaleString()} MWh</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contract Details */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📊 Contract Summary
          </h2>
          {!selectedContract ? (
            <div className="text-center py-12 text-gray-500">
              <p>Select a contract to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">{selectedContract.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Counterparty</div>
                  <div className="text-gray-900">{selectedContract.counterparty}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Category</div>
                  <div className="text-gray-900">{selectedContract.category}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Contract Period</div>
                  <div className="text-gray-900">{selectedContract.startDate} to {selectedContract.endDate}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Strike Price</div>
                  <div className="text-gray-900">${selectedContract.strikePrice}/MWh</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Indexation</div>
                  <div className="text-gray-900">{selectedContract.indexation}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-600">Reference Date</div>
                  <div className="text-gray-900">{selectedContract.referenceDate}</div>
                </div>
              </div>
              
              {/* Monthly Volume Profile */}
              {volumeShapes[selectedContract.volumeShape] && (
                <div className="mt-6">
                  <div className="text-sm font-medium text-gray-600 mb-3">
                    Monthly Volume Profile ({selectedContract.volumeShape})
                  </div>
                  <div className="grid grid-cols-6 gap-2 text-xs">
                    {volumeShapes[selectedContract.volumeShape].map((pct, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-center">
                        <div className="font-medium text-gray-800">
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}
                        </div>
                        <div className="text-blue-600 font-medium">{pct.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Charts */}
      <div className="space-y-6">
        
        {/* Volume Chart */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📈 Portfolio Volume Analysis
          </h2>
          <div className="h-80">
            {contracts.length > 0 ? (
              <Line data={createVolumeChartData()} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Add contracts to see volume analysis</p>
              </div>
            )}
          </div>
          {contracts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4">
              {contracts.map((contract, index) => (
                <div key={contract._id || contract.id || index} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: getContractColor(contract, index) }}
                  ></div>
                  <span className="text-gray-700">{contract.name} ({contract.annualVolume.toLocaleString()} MWh/yr)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MtM Chart */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            💰 Net MtM Earnings
          </h2>
          <div className="h-80">
            {contracts.length > 0 ? (
              <Line data={createMtMChartData()} options={mtmChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Add contracts to see MtM analysis</p>
              </div>
            )}
          </div>
          {contracts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4">
              {contracts.map((contract, index) => {
                // Calculate total annual MtM for the legend
                const volumeProfile = volumeShapes[contract.volumeShape] || [];
                const statePrices = marketPrices[contract.state] || marketPrices.NSW || [];
                
                let totalMtM = 0;
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
                  totalMtM += netMtM;
                });
                
                return (
                  <div key={contract._id || contract.id || index} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: getContractColor(contract, index) }}
                    ></div>
                    <span className="text-gray-700">
                      {contract.name} ({totalMtM >= 0 ? '+' : ''}${totalMtM.toLocaleString()})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}