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

interface PriceCurveTabProps {
  marketPrices: { [key: string]: number[] };
  updateMarketPrices: (newPrices: { [key: string]: number[] }) => void;
}

export default function PriceCurveTab({
  marketPrices,
  updateMarketPrices,
}: PriceCurveTabProps) {
  const [selectedState, setSelectedState] = useState('NSW');
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: number[] }>({});
  const [isEditing, setIsEditing] = useState(false);
  const [showAll, setShowAll] = useState(true);

  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const stateColors: { [key: string]: string } = {
    NSW: '#667eea',
    VIC: '#764ba2',
    QLD: '#f093fb',
    SA: '#4facfe',
    WA: '#43e97b'
  };

  const handleStartEdit = () => {
    setEditingPrices({ ...marketPrices });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditingPrices({});
    setIsEditing(false);
  };

  const handleSaveChanges = () => {
    updateMarketPrices(editingPrices);
    setIsEditing(false);
    setEditingPrices({});
  };

  const handlePriceChange = (state: string, monthIndex: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditingPrices(prev => ({
      ...prev,
      [state]: prev[state]?.map((price, index) => 
        index === monthIndex ? numValue : price
      ) || marketPrices[state]?.map((price, index) => 
        index === monthIndex ? numValue : price
      ) || []
    }));
  };

  const getCurrentPrices = (state: string) => {
    return isEditing ? (editingPrices[state] || marketPrices[state]) : marketPrices[state];
  };

  // Create chart data for price curves
  const createPriceCurveData = () => {
    if (showAll) {
      const datasets = states.map(state => ({
        label: state,
        data: marketPrices[state],
        borderColor: stateColors[state],
        backgroundColor: stateColors[state] + '20',
        borderWidth: 2,
        tension: 0.1,
        pointBackgroundColor: stateColors[state],
        pointBorderColor: stateColors[state],
        pointBorderWidth: 2,
        pointRadius: 4,
      }));

      return {
        labels: months,
        datasets: datasets
      };
    } else {
      return {
        labels: months,
        datasets: [{
          label: selectedState,
          data: marketPrices[selectedState],
          borderColor: stateColors[selectedState],
          backgroundColor: stateColors[selectedState] + '20',
          borderWidth: 3,
          tension: 0.1,
          pointBackgroundColor: stateColors[selectedState],
          pointBorderColor: stateColors[selectedState],
          pointBorderWidth: 2,
          pointRadius: 5,
          fill: true,
        }]
      };
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: showAll ? 'Market Price Curves - All States' : `Market Price Curve - ${selectedState}`,
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
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}/MWh`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Price ($/MWh)'
        },
        ticks: {
          callback: function(value: any) {
            return '$' + value.toFixed(0);
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
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  // Calculate statistics
  const calculateStats = (prices: number[]) => {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const volatility = Math.sqrt(prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length);
    
    return { min, max, avg, volatility };
  };

  const loadSampleData = () => {
    const samplePrices = {
      NSW: [85.20, 78.50, 72.30, 69.80, 75.60, 82.40, 89.70, 91.20, 86.50, 79.30, 74.80, 81.60],
      VIC: [82.10, 76.20, 70.50, 67.90, 73.20, 79.80, 86.30, 88.50, 83.70, 76.80, 72.40, 78.90],
      QLD: [88.50, 81.70, 75.80, 73.20, 78.90, 85.60, 92.10, 94.30, 89.20, 82.40, 77.60, 84.80],
      SA: [91.20, 84.60, 78.30, 75.70, 81.50, 88.90, 95.80, 98.20, 92.60, 85.30, 80.10, 87.40],
      WA: [79.80, 73.50, 67.90, 65.40, 71.20, 77.60, 83.90, 86.10, 81.40, 74.70, 70.20, 76.50]
    };
    
    if (isEditing) {
      setEditingPrices(samplePrices);
    } else {
      updateMarketPrices(samplePrices);
    }
  };

  return (
    <div className="price-curve-container">
      <div className="price-curve-grid">
        {/* Chart Panel */}
        <div className="chart-container">
          <div className="chart-controls">
            <div className="chart-view-controls">
              <button 
                className={`btn-small ${showAll ? 'active' : ''}`}
                onClick={() => setShowAll(true)}
              >
                Show All States
              </button>
              <button 
                className={`btn-small ${!showAll ? 'active' : ''}`}
                onClick={() => setShowAll(false)}
              >
                Single State
              </button>
            </div>
            
            {!showAll && (
              <div className="state-selector">
                <label htmlFor="stateSelect">Select State:</label>
                <select 
                  id="stateSelect"
                  value={selectedState} 
                  onChange={(e) => setSelectedState(e.target.value)}
                >
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="chart-wrapper">
            <Chart data={createPriceCurveData()} options={chartOptions} />
          </div>
        </div>

        {/* Price Data Table */}
        <div className="card price-data-panel">
          <div className="panel-header">
            <h2>📊 Price Data Management</h2>
            <div className="panel-actions">
              {!isEditing ? (
                <>
                  <button className="btn-small btn-primary" onClick={handleStartEdit}>
                    Edit Prices
                  </button>
                  <button className="btn-small btn-secondary" onClick={loadSampleData}>
                    Load Sample Data
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-small btn-success" onClick={handleSaveChanges}>
                    Save Changes
                  </button>
                  <button className="btn-small btn-secondary" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                  <button className="btn-small btn-info" onClick={loadSampleData}>
                    Load Sample
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="price-table-container">
            <table className="price-table">
              <thead>
                <tr>
                  <th>Month</th>
                  {states.map(state => (
                    <th key={state} style={{ color: stateColors[state] }}>{state}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month, monthIndex) => (
                  <tr key={month}>
                    <td className="month-cell">{month}</td>
                    {states.map(state => (
                      <td key={state}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={getCurrentPrices(state)[monthIndex] || 0}
                            onChange={(e) => handlePriceChange(state, monthIndex, e.target.value)}
                            className="price-input"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          <span className="price-value">
                            ${getCurrentPrices(state)[monthIndex]?.toFixed(2) || '0.00'}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statistics Panel */}
        <div className="card statistics-panel">
          <h2>📈 Price Statistics</h2>
          <div className="stats-grid">
            {states.map(state => {
              const stats = calculateStats(marketPrices[state]);
              return (
                <div key={state} className="stat-card">
                  <div className="stat-header" style={{ borderLeftColor: stateColors[state] }}>
                    <h4>{state}</h4>
                  </div>
                  <div className="stat-values">
                    <div className="stat-item">
                      <span className="stat-label">Average:</span>
                      <span className="stat-value">${stats.avg.toFixed(2)}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Min:</span>
                      <span className="stat-value text-green">${stats.min.toFixed(2)}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Max:</span>
                      <span className="stat-value text-red">${stats.max.toFixed(2)}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Volatility:</span>
                      <span className="stat-value">${stats.volatility.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Information Panel */}
        <div className="card info-panel">
          <h2>ℹ️ Price Curve Information</h2>
          <div className="info-content">
            <p>
              These price curves represent the monthly average electricity prices for each state 
              and are used for mark-to-market calculations across your contract portfolio.
            </p>
            
            <div className="info-section">
              <h4>Data Sources:</h4>
              <ul>
                <li>AEMO market data (historical averages)</li>
                <li>Forward price forecasts</li>
                <li>Seasonal adjustments</li>
              </ul>
            </div>

            <div className="info-section">
              <h4>Usage:</h4>
              <ul>
                <li>Contract mark-to-market valuations</li>
                <li>Risk assessment and scenario analysis</li>
                <li>Time series output generation</li>
              </ul>
            </div>

            <div className="info-section">
              <h4>Update Frequency:</h4>
              <p>
                Price curves should be updated monthly or when significant market 
                events occur that may affect forward price expectations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}