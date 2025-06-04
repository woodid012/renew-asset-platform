'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
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

interface TimeSeriesRow {
  buysell: string;
  deal_name: string;
  state: string;
  type: string;
  month_start: number;
  year: number;
  fy: number;
  unit: string;
  scenario: string;
  sub_type: string;
  volume_pct: number;
  volume_mwh: string;
  strike_price: number;
  strike_price_x_volume: number;
  market_price: number;
  market_price_x_volume: number;
  net_mtm: number;
}

export default function EnergyContractManagement() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Chart colors for different contracts
  const chartColorsByContract: { [key: string]: string } = {
    1: '#667eea', // NSW Solar
    2: '#764ba2', // VIC Wind  
    3: '#f093fb', // SA Government
    4: '#4facfe', // NSW Baseload
    5: '#43e97b'  // QLD Industrial
  };

  // Market price curves (monthly average prices by state)
  const marketPrices: { [key: string]: number[] } = {
    NSW: [85.20, 78.50, 72.30, 69.80, 75.60, 82.40, 89.70, 91.20, 86.50, 79.30, 74.80, 81.60],
    VIC: [82.10, 76.20, 70.50, 67.90, 73.20, 79.80, 86.30, 88.50, 83.70, 76.80, 72.40, 78.90],
    QLD: [88.50, 81.70, 75.80, 73.20, 78.90, 85.60, 92.10, 94.30, 89.20, 82.40, 77.60, 84.80],
    SA: [91.20, 84.60, 78.30, 75.70, 81.50, 88.90, 95.80, 98.20, 92.60, 85.30, 80.10, 87.40],
    WA: [79.80, 73.50, 67.90, 65.40, 71.20, 77.60, 83.90, 86.10, 81.40, 74.70, 70.20, 76.50]
  };

  // Volume shape profiles (monthly percentages)
  const volumeShapes: { [key: string]: number[] } = {
    flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
    solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
    wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
    custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
  };

  // Fetch contracts from API
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setIsInitialLoading(true);
        const response = await fetch('/api/contracts');
        if (response.ok) {
          const data = await response.json();
          setContracts(data);
        } else {
          console.error('Failed to fetch contracts');
        }
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchContracts();
  }, []);

  const generateTimeSeries = async () => {
    setIsLoading(true);
    const yearSelect = document.getElementById('yearSelect') as HTMLSelectElement;
    const intervalSelect = document.getElementById('intervalSelect') as HTMLSelectElement;
    const scenarioSelect = document.getElementById('scenarioSelect') as HTMLSelectElement;
    
    const year = yearSelect?.value || '2026';
    const interval = intervalSelect?.value || 'M';
    const scenario = scenarioSelect?.value || 'Central';
    
    let outputData: TimeSeriesRow[] = [];
    
    contracts.forEach(contract => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const volumeProfile = volumeShapes[contract.volumeShape];
      
      if (interval === 'M') {
        months.forEach((month, index) => {
          const buySell = contract.type === 'retail' ? 'Sell' : 'Buy';
          const volumePct = volumeProfile[index];
          const actualVolume = contract.annualVolume * volumePct / 100;
          const marketPrice = marketPrices[contract.state][index];
          const strikePriceXVolume = actualVolume * contract.strikePrice;
          const marketPriceXVolume = actualVolume * marketPrice;
          
          let netMtM;
          if (contract.type === 'retail') {
            netMtM = strikePriceXVolume - marketPriceXVolume;
          } else {
            netMtM = marketPriceXVolume - strikePriceXVolume;
          }
          
          outputData.push({
            buysell: buySell,
            deal_name: contract.name,
            state: contract.state,
            type: contract.category,
            month_start: index + 1,
            year: parseInt(year),
            fy: parseInt(year),
            unit: contract.unit,
            scenario: scenario,
            sub_type: contract.category,
            volume_pct: volumePct,
            volume_mwh: actualVolume.toFixed(0),
            strike_price: contract.strikePrice,
            strike_price_x_volume: strikePriceXVolume,
            market_price: marketPrice,
            market_price_x_volume: marketPriceXVolume,
            net_mtm: netMtM
          });
        });
      }
    });
    
    setTimeSeriesData(outputData);
    setIsLoading(false);
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

  if (isInitialLoading) {
    return (
      <div className="container">
        <div className="loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>Loading Energy Contract Management System...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Energy Contract Management System</title>
        <meta name="description" content="Manage energy contracts with volume profiling and MtM analysis" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container">
        <div className="header">
          <h1>Energy Contract Management System</h1>
          <p>Manage wholesale, retail, and offtake energy contracts with flexible volume profiling and time series output</p>
        </div>

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
        </div>

        <div className="chart-container">
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

        <div className="controls">
          <h3>🔧 Time Series Generation Controls</h3>
          <div className="control-row">
            <div className="form-group">
              <label htmlFor="yearSelect">Financial Year</label>
              <select id="yearSelect" defaultValue="2026">
                <option value="2025">FY 2025</option>
                <option value="2026">FY 2026</option>
                <option value="2027">FY 2027</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="intervalSelect">Time Interval</label>
              <select id="intervalSelect" defaultValue="M">
                <option value="M">Monthly</option>
                <option value="D">Daily</option>
                <option value="5M">5-Minute</option>
                <option value="30M">30-Minute</option>
                <option value="Y">Yearly</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="scenarioSelect">Scenario</label>
              <select id="scenarioSelect" defaultValue="Central">
                <option value="Central">Central</option>
                <option value="High">High</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button className="btn" onClick={generateTimeSeries} disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate Time Series'}
              </button>
            </div>
          </div>
        </div>

        <div className="output-section">
          <h2>📈 Time Series Output</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="output-table">
              <thead>
                <tr>
                  <th>Buy/Sell</th>
                  <th>Deal Name</th>
                  <th>State</th>
                  <th>Type</th>
                  <th>Month</th>
                  <th>Year</th>
                  <th>FY</th>
                  <th>Unit</th>
                  <th>Scenario</th>
                  <th>Sub Type</th>
                  <th>Volume %</th>
                  <th>Volume (MWh)</th>
                  <th>Strike Price</th>
                  <th>Strike Price × Volume</th>
                  <th>Market Price</th>
                  <th>Market Price × Volume</th>
                  <th>Net MtM</th>
                </tr>
              </thead>
              <tbody>
                {timeSeriesData.length === 0 ? (
                  <tr>
                    <td colSpan={17} style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                      Click "Generate Time Series" to see output data
                    </td>
                  </tr>
                ) : (
                  timeSeriesData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.buysell}</td>
                      <td>{row.deal_name}</td>
                      <td>{row.state}</td>
                      <td>{row.type}</td>
                      <td>{row.month_start}</td>
                      <td>{row.year}</td>
                      <td>{row.fy}</td>
                      <td>{row.unit}</td>
                      <td>{row.scenario}</td>
                      <td>{row.sub_type}</td>
                      <td>{row.volume_pct.toFixed(1)}%</td>
                      <td>{parseFloat(row.volume_mwh).toLocaleString()}</td>
                      <td>{row.strike_price.toFixed(2)}</td>
                      <td>${row.strike_price_x_volume.toLocaleString()}</td>
                      <td>{row.market_price.toFixed(2)}</td>
                      <td>${row.market_price_x_volume.toLocaleString()}</td>
                      <td style={{ color: row.net_mtm >= 0 ? '#48bb78' : '#e53e3e' }}>
                        ${row.net_mtm.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}