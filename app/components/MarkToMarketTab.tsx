'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Chart.js to avoid SSR issues
const LineChart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { 
  ssr: false,
  loading: () => <div className="loading">Loading chart...</div>
});

const BarChart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { 
  ssr: false,
  loading: () => <div className="loading">Loading chart...</div>
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
}

export default function MarkToMarketTab({
  contracts,
  selectedContract,
  setSelectedContract,
  marketPrices,
  volumeShapes,
}: MarkToMarketTabProps) {
  const [viewMode, setViewMode] = useState<'individual' | 'portfolio' | 'comparison'>('portfolio');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'totalMtM' | 'avgMtM' | 'volatility'>('totalMtM');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  // Calculate MtM data for all contracts
  const mtmData = useMemo(() => {
    return contracts.map((contract, index) => {
      const volumeProfile = volumeShapes[contract.volumeShape] || volumeShapes.flat;
      const statePrices = marketPrices[contract.state] || marketPrices.NSW;
      
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
  }, [contracts, marketPrices, volumeShapes]);

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
      const datasets = selectedContracts.map((contractId, index) => {
        const contractMtM = mtmData.find(data => data.contractId === contractId);
        if (contractMtM) {
          return {
            label: contractMtM.contractName,
            data: contractMtM.monthlyMtM,
            borderColor: getContractColor(contractId, index),
            backgroundColor: getContractColor(contractId, index) + '20',
            borderWidth: 2,
            tension: 0.1,
          };
        }
        return null;
      }).filter(Boolean);

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
    <div className="mtm-container">
      <div className="mtm-controls">
        <div className="view-mode-controls">
          <label>View Mode:</label>
          <div className="mode-buttons">
            <button 
              className={`btn-small ${viewMode === 'portfolio' ? 'active' : ''}`}
              onClick={() => setViewMode('portfolio')}
            >
              Portfolio
            </button>
            <button 
              className={`btn-small ${viewMode === 'individual' ? 'active' : ''}`}
              onClick={() => setViewMode('individual')}
            >
              Individual
            </button>
            <button 
              className={`btn-small ${viewMode === 'comparison' ? 'active' : ''}`}
              onClick={() => setViewMode('comparison')}
            >
              Comparison
            </button>
          </div>
        </div>

        {viewMode === 'individual' && (
          <div className="contract-selector">
            <label>Select Contract:</label>
            <select 
              value={selectedContract?._id || selectedContract?.id || ''}
              onChange={(e) => {
                const contract = contracts.find(c => 
                  c._id === e.target.value || c.id?.toString() === e.target.value
                );
                setSelectedContract(contract || null);
              }}
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

      <div className="mtm-grid">
        {/* Main Chart */}
        <div className="chart-container main-chart">
          <div className="chart-wrapper">
            <LineChart data={createChartData()} options={chartOptions} />
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="card summary-stats">
          <h2>📊 Summary Statistics</h2>
          {viewMode === 'portfolio' ? (
            <div className="stats-content">
              <div className="stat-item">
                <span className="stat-label">Total Annual MtM:</span>
                <span className={`stat-value ${portfolioTotals.totalMtM >= 0 ? 'positive' : 'negative'}`}>
                  {portfolioTotals.totalMtM >= 0 ? '+' : ''}${portfolioTotals.totalMtM.toLocaleString()}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Avg Monthly MtM:</span>
                <span className={`stat-value ${portfolioTotals.avgMonthlyMtM >= 0 ? 'positive' : 'negative'}`}>
                  {portfolioTotals.avgMonthlyMtM >= 0 ? '+' : ''}${portfolioTotals.avgMonthlyMtM.toLocaleString()}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Best Month:</span>
                <span className="stat-value positive">
                  +${portfolioTotals.maxMtM.toLocaleString()}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Worst Month:</span>
                <span className="stat-value negative">
                  ${portfolioTotals.minMtM.toLocaleString()}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Volatility:</span>
                <span className="stat-value">
                  ${portfolioTotals.volatility.toLocaleString()}
                </span>
              </div>
            </div>
          ) : selectedContract && viewMode === 'individual' ? (
            (() => {
              const contractMtM = mtmData.find(data => 
                data.contract._id === selectedContract._id || data.contract.id === selectedContract.id
              );
              return contractMtM ? (
                <div className="stats-content">
                  <h4>{contractMtM.contractName}</h4>
                  <div className="stat-item">
                    <span className="stat-label">Total Annual MtM:</span>
                    <span className={`stat-value ${contractMtM.totalMtM >= 0 ? 'positive' : 'negative'}`}>
                      {contractMtM.totalMtM >= 0 ? '+' : ''}${contractMtM.totalMtM.toLocaleString()}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg Monthly MtM:</span>
                    <span className={`stat-value ${contractMtM.avgMonthlyMtM >= 0 ? 'positive' : 'negative'}`}>
                      {contractMtM.avgMonthlyMtM >= 0 ? '+' : ''}${contractMtM.avgMonthlyMtM.toLocaleString()}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Best Month:</span>
                    <span className="stat-value positive">
                      +${contractMtM.maxMtM.toLocaleString()}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Worst Month:</span>
                    <span className="stat-value negative">
                      ${contractMtM.minMtM.toLocaleString()}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Volatility:</span>
                    <span className="stat-value">
                      ${contractMtM.volatility.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : <p>Select a contract to view statistics</p>;
            })()
          ) : (
            <div className="stats-content">
              <p>Select contracts to compare in the list below</p>
              <div className="comparison-summary">
                <div className="stat-item">
                  <span className="stat-label">Selected Contracts:</span>
                  <span className="stat-value">{selectedContracts.length}</span>
                </div>
                {selectedContracts.length > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Combined MtM:</span>
                    <span className="stat-value positive">
                      +${selectedContracts.reduce((sum, contractId) => {
                        const data = mtmData.find(d => d.contractId === contractId);
                        return sum + (data?.totalMtM || 0);
                      }, 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contract Comparison Bar Chart */}
        <div className="chart-container comparison-chart">
          <div className="chart-wrapper">
            <BarChart data={createBarChartData()} options={barChartOptions} />
          </div>
        </div>

        {/* Contract List */}
        <div className="card contract-mtm-list">
          <div className="list-header">
            <h2>📋 Contract MtM Analysis</h2>
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="name">Name</option>
                <option value="totalMtM">Total MtM</option>
                <option value="avgMtM">Avg Monthly MtM</option>
                <option value="volatility">Volatility</option>
              </select>
              <button 
                className="btn-small"
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="mtm-contract-list">
            {sortedMtmData.map((data, index) => (
              <div 
                key={data.contractId}
                className={`mtm-contract-item ${
                  selectedContract && (selectedContract._id === data.contract._id || selectedContract.id === data.contract.id) ? 'selected' : ''
                } ${
                  viewMode === 'comparison' && selectedContracts.includes(data.contractId) ? 'comparison-selected' : ''
                }`}
                onClick={() => {
                  if (viewMode === 'comparison') {
                    handleContractToggle(data.contractId);
                  } else {
                    setSelectedContract(data.contract);
                  }
                }}
              >
                <div className="contract-header">
                  <div className="contract-name">
                    {viewMode === 'comparison' && (
                      <input
                        type="checkbox"
                        checked={selectedContracts.includes(data.contractId)}
                        onChange={() => handleContractToggle(data.contractId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className={`status-indicator status-${data.contract.status}`}></span>
                    {data.contractName}
                  </div>
                  <div className={`mtm-value ${data.totalMtM >= 0 ? 'positive' : 'negative'}`}>
                    {data.totalMtM >= 0 ? '+' : ''}${data.totalMtM.toLocaleString()}
                  </div>
                </div>
                <div className="mtm-details">
                  <div className="detail-item">
                    <span>Avg Monthly:</span>
                    <span className={data.avgMonthlyMtM >= 0 ? 'positive' : 'negative'}>
                      {data.avgMonthlyMtM >= 0 ? '+' : ''}${data.avgMonthlyMtM.toLocaleString()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span>Volatility:</span>
                    <span>${data.volatility.toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <span>Range:</span>
                    <span>
                      ${data.minMtM.toLocaleString()} to +${data.maxMtM.toLocaleString()}
                    </span>
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