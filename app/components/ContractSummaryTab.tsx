'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Chart.js to avoid SSR issues
const Chart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { 
  ssr: false,
  loading: () => <div className="loading">Loading chart...</div>
});

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
    1: '#667eea', // NSW Solar
    2: '#764ba2', // VIC Wind  
    3: '#f093fb', // SA Government
    4: '#4facfe', // NSW Baseload
    5: '#43e97b'  // QLD Industrial
  };

  const getContractColor = (contract: Contract, index: number): string => {
    return chartColorsByContract[contract._id || contract.id?.toString() || (index + 1).toString()] || 
           chartColorsByContract[(index + 1).toString()] || '#667eea';
  };

  // Create volume chart data
  const createVolumeChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const datasets = contracts.map((contract, index) => {
      const volumeProfile = volumeShapes[contract.volumeShape];
      const monthlyVolumes = volumeProfile.map(pct => (contract.annualVolume * pct / 100));
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
      const statePrices = marketPrices[contract.state] || marketPrices.NSW;
      const color = getContractColor(contract, index);
      
      const monthlyMtM = volumeProfile.map((pct, monthIndex) => {
        const volume = contract.annualVolume * pct / 100;
        const strikeValue = volume * contract.strikePrice;
        const marketValue = volume * statePrices[monthIndex];
        
        let netMtM;
        if (contract.type === 'retail') {
          netMtM = strikeValue - marketValue;
        } else {
          netMtM = marketValue - strikeValue;
        }
        
        return netMtM;
      });
      
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
    <div className="main-grid">
      <div className="left-panel">
        <div className="card">
          <h2>📋 Contract Portfolio</h2>
          <div className="contract-list">
            {contracts.map((contract, index) => (
              <div 
                key={contract._id || contract.id || index}
                className={`contract-item ${selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id) ? 'selected' : ''}`}
                onClick={() => setSelectedContract(contract)}
              >
                <div className="contract-header">
                  <div className="contract-name">
                    <span className={`status-indicator status-${contract.status}`}></span>
                    {contract.name}
                  </div>
                  <div className={`contract-type ${contract.type}`}>{contract.type.toUpperCase()}</div>
                </div>
                <div className="contract-details">
                  <div className="detail-item">
                    <div className="detail-label">State</div>
                    <div>{contract.state}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Volume Shape</div>
                    <div>{contract.volumeShape.charAt(0).toUpperCase() + contract.volumeShape.slice(1)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Annual Volume</div>
                    <div>{contract.annualVolume.toLocaleString()} MWh</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>📊 Contract Summary</h2>
          <div id="contractSummary">
            {!selectedContract ? (
              <p style={{ color: '#718096', textAlign: 'center', padding: '40px 0' }}>
                Select a contract to view details
              </p>
            ) : (
              <div>
                <h3 style={{ color: '#2d3748', marginBottom: '20px' }}>{selectedContract.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '5px' }}>Counterparty</div>
                    <div style={{ color: '#2d3748' }}>{selectedContract.counterparty}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '5px' }}>Category</div>
                    <div style={{ color: '#2d3748' }}>{selectedContract.category}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '5px' }}>Contract Period</div>
                    <div style={{ color: '#2d3748' }}>{selectedContract.startDate} to {selectedContract.endDate}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '5px' }}>Strike Price</div>
                    <div style={{ color: '#2d3748' }}>${selectedContract.strikePrice}/MWh</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '5px' }}>Indexation</div>
                    <div style={{ color: '#2d3748' }}>{selectedContract.indexation}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '5px' }}>Reference Date</div>
                    <div style={{ color: '#2d3748' }}>{selectedContract.referenceDate}</div>
                  </div>
                </div>
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontWeight: '500', color: '#4a5568', marginBottom: '10px' }}>
                    Monthly Volume Profile ({selectedContract.volumeShape})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', fontSize: '0.8rem' }}>
                    {volumeShapes[selectedContract.volumeShape].map((pct, i) => (
                      <div key={i} style={{ background: '#f7fafc', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                        <div style={{ fontWeight: '500' }}>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}
                        </div>
                        <div style={{ color: '#4299e1' }}>{pct.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chart-container">
        <h2>📈 Portfolio Volume Analysis</h2>
        <div className="chart-wrapper">
          {contracts.length > 0 && (
            <Chart data={createVolumeChartData()} options={chartOptions} />
          )}
        </div>
        <div className="chart-legend">
          {contracts.map((contract, index) => (
            <div key={contract._id || contract.id || index} className="legend-item">
              <div 
                className="legend-color" 
                style={{ backgroundColor: getContractColor(contract, index) }}
              ></div>
              <span>{contract.name} ({contract.annualVolume.toLocaleString()} MWh/yr)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
        <h2>💰 Net MtM Earnings</h2>
        <div className="chart-wrapper">
          {contracts.length > 0 && (
            <Chart data={createMtMChartData()} options={mtmChartOptions} />
          )}
        </div>
        <div className="chart-legend">
          {contracts.map((contract, index) => {
            // Calculate total annual MtM for the legend
            const volumeProfile = volumeShapes[contract.volumeShape];
            const statePrices = marketPrices[contract.state] || marketPrices.NSW;
            
            let totalMtM = 0;
            volumeProfile.forEach((pct, monthIndex) => {
              const volume = contract.annualVolume * pct / 100;
              const strikeValue = volume * contract.strikePrice;
              const marketValue = volume * statePrices[monthIndex];
              
              let netMtM;
              if (contract.type === 'retail') {
                netMtM = strikeValue - marketValue;
              } else {
                netMtM = marketValue - strikeValue;
              }
              totalMtM += netMtM;
            });
            
            return (
              <div key={contract._id || contract.id || index} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: getContractColor(contract, index) }}
                ></div>
                <span>{contract.name} ({totalMtM >= 0 ? '+' : ''}${totalMtM.toLocaleString()})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}