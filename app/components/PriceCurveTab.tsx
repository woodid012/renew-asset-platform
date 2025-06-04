'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Chart.js to avoid SSR issues
const Chart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64 text-gray-500">Loading chart...</div>
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
    <div className="space-y-8">
      {/* Chart Panel */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            📈 Market Price Curves
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <button 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showAll ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setShowAll(true)}
              >
                Show All States
              </button>
              <button 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !showAll ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setShowAll(false)}
              >
                Single State
              </button>
            </div>
            
            {!showAll && (
              <div className="flex items-center gap-2">
                <label htmlFor="stateSelect" className="text-sm font-medium text-gray-700">State:</label>
                <select 
                  id="stateSelect"
                  value={selectedState} 
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        
        <div className="h-96">
          <Chart data={createPriceCurveData()} options={chartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Price Data Table */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📊 Price Data Management
            </h2>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <button 
                    onClick={handleStartEdit}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    Edit Prices
                  </button>
                  <button 
                    onClick={loadSampleData}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Load Sample Data
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleSaveChanges}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={handleCancelEdit}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={loadSampleData}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    Load Sample
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-3 font-semibold text-gray-700 sticky left-0 bg-gray-50">Month</th>
                  {states.map(state => (
                    <th key={state} className="text-center p-3 font-semibold" style={{ color: stateColors[state] }}>
                      {state}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month, monthIndex) => (
                  <tr key={month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800 sticky left-0 bg-white">{month}</td>
                    {states.map(state => (
                      <td key={state} className="p-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={getCurrentPrices(state)[monthIndex] || 0}
                            onChange={(e) => handlePriceChange(state, monthIndex, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          <span className="font-medium text-gray-700">
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
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            📈 Price Statistics
          </h2>
          <div className="space-y-4">
            {states.map(state => {
              const stats = calculateStats(marketPrices[state]);
              return (
                <div key={state} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: stateColors[state] }}
                    ></div>
                    <h4 className="font-semibold text-gray-800">{state}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 font-medium">Average:</span>
                      <span className="ml-2 text-gray-900 font-semibold">${stats.avg.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Volatility:</span>
                      <span className="ml-2 text-gray-900 font-semibold">${stats.volatility.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Min:</span>
                      <span className="ml-2 text-green-600 font-semibold">${stats.min.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Max:</span>
                      <span className="ml-2 text-red-600 font-semibold">${stats.max.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          ℹ️ Price Curve Information
        </h2>
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 leading-relaxed mb-4">
            These price curves represent the monthly average electricity prices for each state 
            and are used for mark-to-market calculations across your contract portfolio.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Data Sources:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• AEMO market data (historical averages)</li>
                <li>• Forward price forecasts</li>
                <li>• Seasonal adjustments</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Usage:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Contract mark-to-market valuations</li>
                <li>• Risk assessment and scenario analysis</li>
                <li>• Time series output generation</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Update Frequency:</h4>
              <p className="text-sm text-gray-600">
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