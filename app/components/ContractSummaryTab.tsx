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

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'retail': return 'bg-orange-100 text-orange-800';
      case 'wholesale': return 'bg-green-100 text-green-800';
      case 'offtake': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // Helper function to determine if contract is Green or Energy based on category
  const isGreenContract = (category: string): boolean => {
    return category.toLowerCase().includes('green') || 
           category.toLowerCase().includes('renewable') ||
           category.toLowerCase().includes('solar') ||
           category.toLowerCase().includes('wind');
  };

  // Create portfolio volume chart data by calendar year
  const createPortfolioVolumeChartData = () => {
    // Generate years from 2024 to 2030
    const years = Array.from({length: 7}, (_, i) => (2024 + i).toString());
    
    // Initialize data structures
    const retailGreenData = new Array(years.length).fill(0);
    const retailEnergyData = new Array(years.length).fill(0);
    const wholesaleGreenData = new Array(years.length).fill(0);
    const wholesaleEnergyData = new Array(years.length).fill(0);
    const offtakeGreenData = new Array(years.length).fill(0);
    const offtakeEnergyData = new Array(years.length).fill(0);

    contracts.forEach(contract => {
      const startYear = new Date(contract.startDate).getFullYear();
      const endYear = new Date(contract.endDate).getFullYear();
      const isGreen = isGreenContract(contract.category);

      years.forEach((year, yearIndex) => {
        const currentYear = parseInt(year);
        
        // Check if contract is active in this year
        if (currentYear >= startYear && currentYear <= endYear) {
          if (contract.type === 'retail') {
            if (isGreen) {
              retailGreenData[yearIndex] += contract.annualVolume;
            } else {
              retailEnergyData[yearIndex] += contract.annualVolume;
            }
          } else if (contract.type === 'wholesale') {
            if (isGreen) {
              wholesaleGreenData[yearIndex] += contract.annualVolume;
            } else {
              wholesaleEnergyData[yearIndex] += contract.annualVolume;
            }
          } else if (contract.type === 'offtake') {
            if (isGreen) {
              offtakeGreenData[yearIndex] += contract.annualVolume;
            } else {
              offtakeEnergyData[yearIndex] += contract.annualVolume;
            }
          }
        }
      });
    });

    return {
      labels: years,
      datasets: [
        // Retail as dotted lines
        {
          label: 'Retail - Green',
          data: retailGreenData,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [5, 5],
          tension: 0.1,
          fill: false
        },
        {
          label: 'Retail - Energy',
          data: retailEnergyData,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [5, 5],
          tension: 0.1,
          fill: false
        },
        // Stacked wholesale and offtake
        {
          label: 'Wholesale - Green',
          data: wholesaleGreenData,
          backgroundColor: '#10b98180',
          borderColor: '#10b981',
          borderWidth: 1,
          fill: true
        },
        {
          label: 'Wholesale - Energy',
          data: wholesaleEnergyData,
          backgroundColor: '#f59e0b80',
          borderColor: '#f59e0b',
          borderWidth: 1,
          fill: true
        },
        {
          label: 'Offtake - Green',
          data: offtakeGreenData,
          backgroundColor: '#8b5cf680',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          fill: true
        },
        {
          label: 'Offtake - Energy',
          data: offtakeEnergyData,
          backgroundColor: '#ef444480',
          borderColor: '#ef4444',
          borderWidth: 1,
          fill: true
        }
      ]
    };
  };

  // Calculate MtM earnings by type and category
  const calculateMtMEarnings = () => {
    const mtmResults = {
      retail: { green: 0, energy: 0, total: 0 },
      wholesale: { green: 0, energy: 0, total: 0 },
      offtake: { green: 0, energy: 0, total: 0 },
      totals: { green: 0, energy: 0, combined: 0 }
    };

    contracts.forEach(contract => {
      const volumeProfile = volumeShapes[contract.volumeShape] || [];
      const statePrices = marketPrices[contract.state] || marketPrices.NSW || [];
      const isGreen = isGreenContract(contract.category);
      
      let contractMtM = 0;
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
        contractMtM += netMtM;
      });

      // Add to appropriate buckets
      if (isGreen) {
        mtmResults[contract.type].green += contractMtM;
        mtmResults.totals.green += contractMtM;
      } else {
        mtmResults[contract.type].energy += contractMtM;
        mtmResults.totals.energy += contractMtM;
      }
      
      mtmResults[contract.type].total += contractMtM;
      mtmResults.totals.combined += contractMtM;
    });

    return mtmResults;
  };

  const portfolioChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Portfolio Volume by Calendar Year',
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
      x: {
        title: {
          display: true,
          text: 'Year'
        }
      },
      y: {
        beginAtZero: true,
        stacked: true,
        title: {
          display: true,
          text: 'Volume (MWh)'
        },
        ticks: {
          callback: function(value: any) {
            return value.toLocaleString();
          }
        }
      }
    },
    animation: {
      duration: 0
    }
  };

  const mtmEarnings = calculateMtMEarnings();

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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${isGreenContract(contract.category) ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {isGreenContract(contract.category) ? 'Green' : 'Energy'}
                      </span>
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

        {/* MtM Earnings Summary */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            💰 MtM Earnings Summary
          </h2>
          <div className="space-y-6">
            {/* By Contract Type */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">By Contract Type</h3>
              <div className="space-y-3">
                {['retail', 'wholesale', 'offtake'].map(type => (
                  <div key={type} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-800 capitalize">{type}</span>
                      <span className={`font-bold ${mtmEarnings[type as keyof typeof mtmEarnings].total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${mtmEarnings[type as keyof typeof mtmEarnings].total.toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Green:</span>
                        <span className={mtmEarnings[type as keyof typeof mtmEarnings].green >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${mtmEarnings[type as keyof typeof mtmEarnings].green.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Energy:</span>
                        <span className={mtmEarnings[type as keyof typeof mtmEarnings].energy >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${mtmEarnings[type as keyof typeof mtmEarnings].energy.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio Totals */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Portfolio Totals</h3>
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Green Total</div>
                    <div className={`text-lg font-bold ${mtmEarnings.totals.green >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${mtmEarnings.totals.green.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Energy Total</div>
                    <div className={`text-lg font-bold ${mtmEarnings.totals.energy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${mtmEarnings.totals.energy.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Combined Total</div>
                    <div className={`text-xl font-bold ${mtmEarnings.totals.combined >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${mtmEarnings.totals.combined.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Charts */}
      <div className="space-y-6">
        
        {/* Portfolio Volume Chart */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="h-96">
            {contracts.length > 0 ? (
              <Line data={createPortfolioVolumeChartData()} options={portfolioChartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Add contracts to see portfolio volume analysis</p>
              </div>
            )}
          </div>
        </div>

        {/* Contract Details */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📊 Contract Details
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
    </div>
  );
}