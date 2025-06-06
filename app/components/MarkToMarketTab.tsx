'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Chart.js to avoid SSR issues
const LineChart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64 text-gray-500">Loading chart...</div>
});

const BarChart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64 text-gray-500">Loading chart...</div>
});

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

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

interface MarkToMarketTabProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  marketPrices: { [key: string]: number[] };
  volumeShapes: { [key: string]: number[] };
}

interface MtMData {
  contractId: string;
  contractName: string;
  monthlyMtM: number[];
  totalMtM: number;
  avgMonthlyMtM: number;
  maxMtM: number;
  minMtM: number;
  volatility: number;
  contract: Contract;
}

interface PriceCurveMetadata {
  curve: string;
  profile: string;
  type: string;
  year: number | string;
  availableYears: number[];
  availableProfiles: string[];
  availableTypes: string[];
  availableStates: string[];
  recordCount: number;
}

export default function MarkToMarketTab({
  contracts,
  selectedContract,
  setSelectedContract,
  marketPrices: fallbackMarketPrices,
  volumeShapes,
}: MarkToMarketTabProps) {
  const [viewMode, setViewMode] = useState<'individual' | 'portfolio' | 'comparison'>('portfolio');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'totalMtM' | 'avgMtM' | 'volatility'>('totalMtM');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Price curve controls
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [priceCurveData, setPriceCurveData] = useState<{ [key: string]: number[] }>({});
  const [priceCurveMetadata, setPriceCurveMetadata] = useState<PriceCurveMetadata | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedProfile, setSelectedProfile] = useState<string>('baseload');
  const [selectedType, setSelectedType] = useState<string>('Energy');
  const [selectedCurve, setSelectedCurve] = useState<string>('Aurora Jan 2025');
  const [priceError, setPriceError] = useState<string | null>(null);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const contractColors: { [key: string]: string } = {
    1: '#667eea',
    2: '#764ba2', 
    3: '#f093fb',
    4: '#4facfe',
    5: '#43e97b',
    6: '#ff6b6b',
    7: '#4ecdc4',
    8: '#45b7d1',
    9: '#96ceb4',
    10: '#feca57'
  };

  // Fetch price curve data from API
  const fetchPriceCurveData = async () => {
    setIsLoadingPrices(true);
    setPriceError(null);
    
    try {
      const params = new URLSearchParams({
        curve: selectedCurve,
        year: selectedYear.toString(),
        profile: selectedProfile,
        type: selectedType
      });
      
      const response = await fetch(`/api/price-curves?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPriceCurveData(data.marketPrices);
        setPriceCurveMetadata(data.metadata);
        console.log('Price curve data loaded:', data.metadata);
      } else {
        console.error('Failed to fetch price curves:', data.error);
        setPriceError(data.error);
        // Fallback to hardcoded data
        setPriceCurveData(fallbackMarketPrices);
      }
    } catch (error) {
      console.error('Error fetching price curves:', error);
      setPriceError('Failed to load price data');
      // Fallback to hardcoded data
      setPriceCurveData(fallbackMarketPrices);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Load price data on component mount and when parameters change
  useEffect(() => {
    fetchPriceCurveData();
  }, [selectedYear, selectedProfile, selectedType, selectedCurve]);

  // Use real price data if available, otherwise fallback
  const currentMarketPrices = Object.keys(priceCurveData).length > 0 ? priceCurveData : fallbackMarketPrices;

  // Calculate MtM data for all contracts
  const mtmData = useMemo(() => {
    return contracts.map((contract, index) => {
      const volumeProfile = volumeShapes[contract.volumeShape] || volumeShapes.flat;
      const statePrices = currentMarketPrices[contract.state] || currentMarketPrices.NSW;
      
      const monthlyMtM = volumeProfile.map((pct, monthIndex) => {
        const volume = contract.annualVolume * pct / 100;
        const strikeValue = volume * contract.strikePrice;
        const marketValue = volume * statePrices[monthIndex];
        
        if (contract.type === 'retail') {
          return strikeValue - marketValue; // Retail: strike - market
        } else {
          return marketValue - strikeValue; // Wholesale/Offtake: market - strike
        }
      });

      const totalMtM = monthlyMtM.reduce((sum, mtm) => sum + mtm, 0);
      const avgMonthlyMtM = totalMtM / 12;
      const maxMtM = Math.max(...monthlyMtM);
      const minMtM = Math.min(...monthlyMtM);
      const volatility = Math.sqrt(
        monthlyMtM.reduce((sum, mtm) => sum + Math.pow(mtm - avgMonthlyMtM, 2), 0) / 12
      );

      return {
        contractId: contract._id || contract.id?.toString() || index.toString(),
        contractName: contract.name,
        monthlyMtM,
        totalMtM,
        avgMonthlyMtM,
        maxMtM,
        minMtM,
        volatility,
        contract
      };
    });
  }, [contracts, currentMarketPrices, volumeShapes]);

  // Sort MtM data
  const sortedMtmData = useMemo(() => {
    return [...mtmData].sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (sortBy) {
        case 'name':
          return sortDirection === 'asc' 
            ? a.contractName.localeCompare(b.contractName)
            : b.contractName.localeCompare(a.contractName);
        case 'totalMtM':
          aValue = a.totalMtM;
          bValue = b.totalMtM;
          break;
        case 'avgMtM':
          aValue = a.avgMonthlyMtM;
          bValue = b.avgMonthlyMtM;
          break;
        case 'volatility':
          aValue = a.volatility;
          bValue = b.volatility;
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [mtmData, sortBy, sortDirection]);

  // Portfolio totals
  const portfolioTotals = useMemo(() => {
    const monthlyTotals = months.map((_, monthIndex) => 
      mtmData.reduce((sum, data) => sum + data.monthlyMtM[monthIndex], 0)
    );
    
    const totalMtM = monthlyTotals.reduce((sum, mtm) => sum + mtm, 0);
    const avgMonthlyMtM = totalMtM / 12;
    const maxMtM = Math.max(...monthlyTotals);
    const minMtM = Math.min(...monthlyTotals);
    const volatility = Math.sqrt(
      monthlyTotals.reduce((sum, mtm) => sum + Math.pow(mtm - avgMonthlyMtM, 2), 0) / 12
    );

    return {
      monthlyTotals,
      totalMtM,
      avgMonthlyMtM,
      maxMtM,
      minMtM,
      volatility
    };
  }, [mtmData, months]);

  const getContractColor = (contractId: string, index: number) => {
    return contractColors[contractId] || contractColors[(index + 1).toString()] || '#667eea';
  };

  // Create chart data based on view mode
  const createChartData = () => {
    if (viewMode === 'portfolio') {
      return {
        labels: months,
        datasets: [{
          label: 'Portfolio MtM',
          data: portfolioTotals.monthlyTotals,
          borderColor: '#667eea',
          backgroundColor: '#667eea20',
          borderWidth: 3,
          tension: 0.1,
          fill: true,
        }]
      };
    } else if (viewMode === 'individual' && selectedContract) {
      const contractMtM = mtmData.find(data => 
        data.contract._id === selectedContract._id || data.contract.id === selectedContract.id
      );
      
      if (contractMtM) {
        return {
          labels: months,
          datasets: [{
            label: contractMtM.contractName,
            data: contractMtM.monthlyMtM,
            borderColor: getContractColor(contractMtM.contractId, 0),
            backgroundColor: getContractColor(contractMtM.contractId, 0) + '20',
            borderWidth: 3,
            tension: 0.1,
            fill: true,
          }]
        };
      }
    } else if (viewMode === 'comparison') {
      const datasets = selectedContracts.reduce((acc, contractId, index) => {
        const contractMtM = mtmData.find(data => data.contractId === contractId);
        if (contractMtM) {
          acc.push({
            label: contractMtM.contractName,
            data: contractMtM.monthlyMtM,
            borderColor: getContractColor(contractId, index),
            backgroundColor: getContractColor(contractId, index) + '20',
            borderWidth: 2,
            tension: 0.1,
          });
        }
        return acc;
      }, [] as import('chart.js').ChartDataset<'line'>[]);

      return {
        labels: months,
        datasets: datasets
      };
    }

    return { labels: months, datasets: [] };
  };

  // Create bar chart data for contract comparison
  const createBarChartData = () => {
    return {
      labels: sortedMtmData.map(data => data.contractName),
      datasets: [{
        label: 'Total Annual MtM',
        data: sortedMtmData.map(data => data.totalMtM),
        backgroundColor: sortedMtmData.map((data, index) => 
          data.totalMtM >= 0 ? '#48bb7880' : '#e53e3e80'
        ),
        borderColor: sortedMtmData.map((data, index) => 
          data.totalMtM >= 0 ? '#48bb78' : '#e53e3e'
        ),
        borderWidth: 2,
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Mark-to-Market Analysis - ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View`,
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y >= 0 ? '+' : ''}$${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'MtM Value ($)'
        },
        ticks: {
          callback: function(value: any) {
            return (value >= 0 ? '+$' : '-$') + Math.abs(value).toLocaleString();
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Annual MtM by Contract',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Total MtM: ${context.parsed.y >= 0 ? '+' : ''}$${context.parsed.y.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Annual MtM ($)'
        },
        ticks: {
          callback: function(value: any) {
            return (value >= 0 ? '+$' : '-$') + Math.abs(value).toLocaleString();
          }
        }
      }
    }
  };

  const handleContractToggle = (contractId: string) => {
    setSelectedContracts(prev => 
      prev.includes(contractId) 
        ? prev.filter(id => id !== contractId)
        : [...prev, contractId]
    );
  };

  return (
    <div className="space-y-8">
      {/* Price Curve Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          📊 Price Curve Settings
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Curve:</label>
            <select 
              value={selectedCurve} 
              onChange={(e) => setSelectedCurve(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Aurora Jan 2025">Aurora Jan 2025</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year:</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoadingPrices}
            >
              {priceCurveMetadata?.availableYears?.map(year => (
                <option key={year} value={year}>{year}</option>
              )) || (
                <>
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile:</label>
            <select 
              value={selectedProfile} 
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoadingPrices}
            >
              {priceCurveMetadata?.availableProfiles?.map(profile => (
                <option key={profile} value={profile}>{profile.charAt(0).toUpperCase() + profile.slice(1)}</option>
              )) || (
                <>
                  <option value="baseload">Baseload</option>
                  <option value="solar">Solar</option>
                  <option value="wind">Wind</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type:</label>
            <select 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoadingPrices}
            >
              {priceCurveMetadata?.availableTypes?.map(type => (
                <option key={type} value={type}>{type}</option>
              )) || (
                <>
                  <option value="Energy">Energy</option>
                  <option value="green">Green</option>
                </>
              )}
            </select>
          </div>
        </div>
        
        {/* Price Data Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          {isLoadingPrices ? (
            <div className="text-blue-600 font-medium">🔄 Loading price data...</div>
          ) : priceError ? (
            <div className="text-red-600 font-medium">⚠️ {priceError} (using fallback data)</div>
          ) : priceCurveMetadata ? (
            <div className="text-green-600 font-medium">
              ✅ Loaded {priceCurveMetadata.recordCount} price records from {priceCurveMetadata.curve} 
              ({priceCurveMetadata.availableStates?.join(', ')})
            </div>
          ) : (
            <div className="text-yellow-600 font-medium">📊 Using default price data</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Mode:</label>
            <div className="flex gap-2">
              <button 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'portfolio' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setViewMode('portfolio')}
              >
                Portfolio
              </button>
              <button 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'individual' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setViewMode('individual')}
              >
                Individual
              </button>
              <button 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'comparison' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setViewMode('comparison')}
              >
                Comparison
              </button>
            </div>
          </div>

          {viewMode === 'individual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Contract:</label>
              <select 
                value={selectedContract?._id || selectedContract?.id || ''}
                onChange={(e) => {
                  const contract = contracts.find(c => 
                    c._id === e.target.value || c.id?.toString() === e.target.value
                  );
                  setSelectedContract(contract || null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
              >
                <option value="">Choose a contract...</option>
                {contracts.map(contract => (
                  <option 
                    key={contract._id || contract.id} 
                    value={contract._id || contract.id}
                  >
                    {contract.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="h-96">
            <LineChart data={createChartData()} options={chartOptions} />
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📊 Summary Statistics
          </h2>
          {viewMode === 'portfolio' ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Annual MtM</div>
                <div className={`text-2xl font-bold ${portfolioTotals.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolioTotals.totalMtM >= 0 ? '+' : ''}${portfolioTotals.totalMtM.toLocaleString()}
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Monthly MtM:</span>
                  <span className={`font-semibold ${portfolioTotals.avgMonthlyMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {portfolioTotals.avgMonthlyMtM >= 0 ? '+' : ''}${portfolioTotals.avgMonthlyMtM.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Best Month:</span>
                  <span className="font-semibold text-green-600">
                    +${portfolioTotals.maxMtM.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Worst Month:</span>
                  <span className="font-semibold text-red-600">
                    ${portfolioTotals.minMtM.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Volatility:</span>
                  <span className="font-semibold text-gray-900">
                    ${portfolioTotals.volatility.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : selectedContract && viewMode === 'individual' ? (
            (() => {
              const contractMtM = mtmData.find(data => 
                data.contract._id === selectedContract._id || data.contract.id === selectedContract.id
              );
              return contractMtM ? (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800">{contractMtM.contractName}</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Total Annual MtM</div>
                    <div className={`text-2xl font-bold ${contractMtM.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {contractMtM.totalMtM >= 0 ? '+' : ''}${contractMtM.totalMtM.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Monthly MtM:</span>
                      <span className={`font-semibold ${contractMtM.avgMonthlyMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {contractMtM.avgMonthlyMtM >= 0 ? '+' : ''}${contractMtM.avgMonthlyMtM.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Best Month:</span>
                      <span className="font-semibold text-green-600">
                        +${contractMtM.maxMtM.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Worst Month:</span>
                      <span className="font-semibold text-red-600">
                        ${contractMtM.minMtM.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Volatility:</span>
                      <span className="font-semibold text-gray-900">
                        ${contractMtM.volatility.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : <p className="text-gray-500">Select a contract to view statistics</p>;
            })()
          ) : (
            <div className="space-y-4">
              <p className="text-gray-500">Select contracts to compare in the list below</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Selected Contracts:</span>
                  <span className="font-semibold text-gray-900">{selectedContracts.length}</span>
                </div>
                {selectedContracts.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Combined MtM</div>
                    <div className="text-2xl font-bold text-green-600">
                      +${selectedContracts.reduce((sum, contractId) => {
                        const data = mtmData.find(d => d.contractId === contractId);
                        return sum + (data?.totalMtM || 0);
                      }, 0).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contract Comparison Bar Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="h-80">
            <BarChart data={createBarChartData()} options={barChartOptions} />
          </div>
        </div>

        {/* Contract List */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">📋 Contract MtM Analysis</h2>
            <div className="flex items-center gap-2">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="totalMtM">Total MtM</option>
                <option value="avgMtM">Avg Monthly MtM</option>
                <option value="volatility">Volatility</option>
              </select>
              <button 
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200 transition-colors"
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {sortedMtmData.map((data, index) => (
              <div 
                key={data.contractId}
                onClick={() => {
                  if (viewMode === 'comparison') {
                    handleContractToggle(data.contractId);
                  } else {
                    setSelectedContract(data.contract);
                  }
                }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedContract && (selectedContract._id === data.contract._id || selectedContract.id === data.contract.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : viewMode === 'comparison' && selectedContracts.includes(data.contractId)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {viewMode === 'comparison' && (
                      <input
                        type="checkbox"
                        checked={selectedContracts.includes(data.contractId)}
                        onChange={() => handleContractToggle(data.contractId)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    )}
                    <div className={`w-2 h-2 rounded-full ${data.contract.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="font-semibold text-gray-900">{data.contractName}</span>
                  </div>
                  <div className={`text-lg font-bold ${data.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.totalMtM >= 0 ? '+' : ''}${data.totalMtM.toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span>Avg Monthly:</span>
                    <span className={`ml-1 font-medium ${data.avgMonthlyMtM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.avgMonthlyMtM >= 0 ? '+' : ''}${data.avgMonthlyMtM.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span>Volatility:</span>
                    <span className="ml-1 font-medium">${data.volatility.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}