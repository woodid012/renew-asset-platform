'use client';

import { useState, useEffect } from 'react';
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
  timePoints: number;
  seriesCount: number;
  interval?: string;
}

export default function PriceCurveTab({
  marketPrices,
  updateMarketPrices,
}: PriceCurveTabProps) {
  const [selectedState, setSelectedState] = useState('NSW');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedProfile, setSelectedProfile] = useState('baseload');
  const [selectedType, setSelectedType] = useState('Energy');
  const [selectedCurve, setSelectedCurve] = useState('Aurora Jan 2025');
  const [selectedInterval, setSelectedInterval] = useState('auto');
  const [cpiRate, setCpiRate] = useState('2.5');
  const [refYear, setRefYear] = useState('2025');
  const [showAll, setShowAll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<PriceCurveMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);
  const [isTimeSeries, setIsTimeSeries] = useState(false);
  const [cpiSettings, setCpiSettings] = useState<any>(null);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const stateColors: { [key: string]: string } = {
    NSW: '#667eea',
    VIC: '#764ba2',
    QLD: '#f093fb',
    SA: '#4facfe',
    WA: '#43e97b'
  };

  // Fetch price curve data from MongoDB
  const fetchPriceCurveData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        curve: selectedCurve,
        profile: selectedProfile,
        type: selectedType,
        interval: selectedInterval,
        cpiRate: cpiRate,
        refYear: refYear
      });
      
      // Only add year if it's not "all"
      if (selectedYear !== 'all') {
        params.append('year', selectedYear);
      }
      
      const response = await fetch(`/api/price-curves?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        updateMarketPrices(result.marketPrices);
        setMetadata(result.metadata);
        setTimeLabels(result.timeLabels || months);
        setIsTimeSeries(result.isTimeSeries || false);
        setCpiSettings(result.cpiSettings);
        console.log('Fetched price curve data:', result.metadata);
      } else {
        setError(result.error || 'Failed to fetch price curve data');
        console.error('API Error:', result);
      }
    } catch (err) {
      // If API is not available, provide fallback message
      if (err instanceof Error && err.message.includes('404')) {
        setError('Price curves API not found. Please create the API route at /api/price-curves/route.ts');
      } else {
        setError('Network error while fetching price curve data. Using fallback data.');
      }
      console.error('Network Error:', err);
      
      // Use existing marketPrices as fallback
      if (Object.keys(marketPrices).length === 0) {
        // Set some fallback data if none exists
        const fallbackPrices = {
          NSW: [85.20, 78.50, 72.30, 69.80, 75.60, 82.40, 89.70, 91.20, 86.50, 79.30, 74.80, 81.60],
          VIC: [82.10, 76.20, 70.50, 67.90, 73.20, 79.80, 86.30, 88.50, 83.70, 76.80, 72.40, 78.90],
          QLD: [88.50, 81.70, 75.80, 73.20, 78.90, 85.60, 92.10, 94.30, 89.20, 82.40, 77.60, 84.80],
          SA: [91.20, 84.60, 78.30, 75.70, 81.50, 88.90, 95.80, 98.20, 92.60, 85.30, 80.10, 87.40]
        };
        updateMarketPrices(fallbackPrices);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount and when parameters change
  useEffect(() => {
    fetchPriceCurveData();
  }, [selectedYear, selectedProfile, selectedType, selectedCurve, selectedInterval, cpiRate, refYear]);

  // Create chart data for price curves with interval aggregation
  const createPriceCurveData = () => {
    const seriesKeys = Object.keys(marketPrices);
    let chartLabels = isTimeSeries ? timeLabels : months;
    let aggregatedData: { [key: string]: number[] } = {};
    
    // Apply interval aggregation to chart data
    if (selectedInterval !== 'auto' && selectedInterval !== 'M') {
      // Aggregate data based on selected interval
      seriesKeys.forEach(seriesKey => {
        const originalData = marketPrices[seriesKey] || [];
        const aggregated: number[] = [];
        
        if (selectedInterval === 'Q') {
          // Quarterly aggregation - ensure we process all quarters
          const numQuarters = Math.ceil(originalData.length / 3);
          for (let q = 0; q < numQuarters; q++) {
            const startIdx = q * 3;
            const endIdx = Math.min(startIdx + 3, originalData.length);
            const quarterData = originalData.slice(startIdx, endIdx).filter(val => val > 0);
            
            if (quarterData.length > 0) {
              const avg = quarterData.reduce((sum, val) => sum + val, 0) / quarterData.length;
              aggregated.push(avg);
            } else {
              aggregated.push(0);
            }
          }
        } else if (selectedInterval === 'Y') {
          // Yearly aggregation - ensure we process all years
          const numYears = Math.ceil(originalData.length / 12);
          for (let y = 0; y < numYears; y++) {
            const startIdx = y * 12;
            const endIdx = Math.min(startIdx + 12, originalData.length);
            const yearData = originalData.slice(startIdx, endIdx).filter(val => val > 0);
            
            if (yearData.length > 0) {
              const avg = yearData.reduce((sum, val) => sum + val, 0) / yearData.length;
              aggregated.push(avg);
            } else {
              aggregated.push(0);
            }
          }
        }
        
        aggregatedData[seriesKey] = aggregated;
      });
      
      // Generate aggregated labels based on the first series data length
      if (seriesKeys.length > 0) {
        const firstSeriesLength = aggregatedData[seriesKeys[0]]?.length || 0;
        const newLabels: string[] = [];
        
        if (selectedInterval === 'Q') {
          for (let i = 0; i < firstSeriesLength; i++) {
            if (isTimeSeries && timeLabels.length > i * 3) {
              // Extract year from time series label
              const originalLabel = timeLabels[i * 3] || '';
              const yearMatch = originalLabel.match(/\d{4}/);
              const year = yearMatch ? yearMatch[0] : '';
              newLabels.push(`Q${(i % 4) + 1} ${year}`);
            } else {
              newLabels.push(`Q${(i % 4) + 1}`);
            }
          }
        } else if (selectedInterval === 'Y') {
          for (let i = 0; i < firstSeriesLength; i++) {
            if (isTimeSeries && timeLabels.length > i * 12) {
              // Extract year from time series label
              const originalLabel = timeLabels[i * 12] || '';
              const yearMatch = originalLabel.match(/\d{4}/);
              newLabels.push(yearMatch ? yearMatch[0] : `Year ${i + 1}`);
            } else {
              newLabels.push(`Year ${i + 1}`);
            }
          }
        }
        
        chartLabels = newLabels;
      }
    } else {
      // Use original data for monthly or auto
      aggregatedData = marketPrices;
    }
    
    // Generate colors for different profiles
    const profileColors: { [key: string]: string } = {
      'baseload': '#667eea',
      'solar': '#f093fb', 
      'wind': '#43e97b'
    };
    
    const generateColor = (seriesKey: string, index: number) => {
      // Try to match profile from series key
      const lowerKey = seriesKey.toLowerCase();
      if (lowerKey.includes('baseload')) return profileColors.baseload;
      if (lowerKey.includes('solar')) return profileColors.solar;
      if (lowerKey.includes('wind')) return profileColors.wind;
      
      // Fallback to indexed colors
      const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'];
      return colors[index % colors.length];
    };
    
    if (showAll) {
      // When showing all, group by profile for the selected state only
      const filteredSeries = seriesKeys.filter(key => key.includes(selectedState));
      
      const datasets = filteredSeries.map((seriesKey, index) => ({
        label: seriesKey.includes(' - ') ? seriesKey.split(' - ')[1] : seriesKey,
        data: aggregatedData[seriesKey] || [],
        borderColor: generateColor(seriesKey, index),
        backgroundColor: generateColor(seriesKey, index) + '20',
        borderWidth: 3,
        tension: 0.1,
        pointBackgroundColor: generateColor(seriesKey, index),
        pointBorderColor: generateColor(seriesKey, index),
        pointBorderWidth: 2,
        pointRadius: 4,
      }));

      return {
        labels: chartLabels,
        datasets: datasets
      };
    } else {
      // Single series view
      const selectedSeries = seriesKeys.find(key => key.includes(selectedState)) || seriesKeys[0];
      
      return {
        labels: chartLabels,
        datasets: [{
          label: selectedSeries,
          data: aggregatedData[selectedSeries] || [],
          borderColor: generateColor(selectedSeries, 0),
          backgroundColor: generateColor(selectedSeries, 0) + '20',
          borderWidth: 3,
          tension: 0.1,
          pointBackgroundColor: generateColor(selectedSeries, 0),
          pointBorderColor: generateColor(selectedSeries, 0),
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
        text: `Nominal Prices: ${selectedProfile === 'all' ? 'All Profiles' : selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1)} ${selectedType} - ${selectedYear === 'all' ? 'All Years' : selectedYear} (${selectedCurve})`,
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
          text: isTimeSeries ? 'Time Period' : 'Month'
        },
        ticks: {
          maxTicksLimit: isTimeSeries ? 20 : 12,
          maxRotation: 45,
          minRotation: 0
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  // Calculate average for table
  const calculateAverage = (prices: number[]) => {
    if (!prices || prices.length === 0) return null;
    
    const validPrices = prices.filter(p => p > 0);
    if (validPrices.length === 0) return null;
    
    return validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
  };

  return (
    <div className="space-y-8">
      {/* Controls Panel */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          📈 Price Curve Data Controls
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          {/* Curve Selection */}
          <div>
            <label htmlFor="curveSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Price Curve
            </label>
            <select 
              id="curveSelect"
              value={selectedCurve} 
              onChange={(e) => setSelectedCurve(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Aurora Jan 2025">Aurora Jan 2025</option>
            </select>
          </div>

          {/* Year Selection */}
          <div>
            <label htmlFor="yearSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Year
            </label>
            <select 
              id="yearSelect"
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Years</option>
              {metadata?.availableYears.map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              )) || ['2025', '2026', '2027'].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Profile Selection */}
          <div>
            <label htmlFor="profileSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Profile
            </label>
            <select 
              id="profileSelect"
              value={selectedProfile} 
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {metadata?.availableProfiles.map(profile => (
                <option key={profile} value={profile}>{profile.charAt(0).toUpperCase() + profile.slice(1)}</option>
              )) || ['baseload', 'solar', 'wind'].map(profile => (
                <option key={profile} value={profile}>{profile.charAt(0).toUpperCase() + profile.slice(1)}</option>
              ))}
              <option value="all">All Profiles</option>
            </select>
          </div>

          {/* Type Selection */}
          <div>
            <label htmlFor="typeSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select 
              id="typeSelect"
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Energy">Energy</option>
              <option value="green">Green</option>
            </select>
          </div>

          {/* Interval Selection */}
          <div>
            <label htmlFor="intervalSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Chart Interval
            </label>
            <select 
              id="intervalSelect"
              value={selectedInterval} 
              onChange={(e) => setSelectedInterval(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">Auto</option>
              <option value="M">Monthly</option>
              <option value="Q">Quarterly</option>
              <option value="Y">Yearly</option>
            </select>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button 
              onClick={fetchPriceCurveData}
              disabled={isLoading}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* CPI Escalation Controls */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔢 CPI Escalation Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cpiRate" className="block text-sm font-medium text-gray-700 mb-2">
                CPI Rate (% per annum)
              </label>
              <input
                id="cpiRate"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={cpiRate}
                onChange={(e) => setCpiRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="refYear" className="block text-sm font-medium text-gray-700 mb-2">
                Reference Year
              </label>
              <input
                id="refYear"
                type="number"
                min="2020"
                max="2030"
                value={refYear}
                onChange={(e) => setRefYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              {cpiSettings && (
                <div className="text-sm text-gray-600">
                  <div><strong>Applied:</strong> {cpiSettings.rate}% from {cpiSettings.referenceYear}</div>
                  <div><strong>Status:</strong> {cpiSettings.escalationApplied ? 'Escalated' : 'Not Applied'}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAll ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setShowAll(true)}
          >
            Show All Profiles
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !showAll ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setShowAll(false)}
          >
            Single Profile
          </button>
          
          <select 
            value={selectedState} 
            onChange={(e) => setSelectedState(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {metadata?.availableStates.map(state => (
              <option key={state} value={state}>{state}</option>
            )) || ['NSW', 'VIC', 'QLD', 'SA'].map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          
          {showAll && (
            <div className="text-sm text-gray-600 flex items-center ml-2">
              Showing all profiles for {selectedState}
            </div>
          )}
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}

        {metadata && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Loaded:</strong> {metadata.recordCount} records from {metadata.curve} | 
              <strong> Profile:</strong> {metadata.profile} | 
              <strong> Type:</strong> {metadata.type} | 
              <strong> Year:</strong> {metadata.year} | 
              <strong> Interval:</strong> {selectedInterval === 'auto' ? `Auto (${metadata.interval || 'M'})` : selectedInterval} |
              <strong> Series:</strong> {metadata.seriesCount} | 
              <strong> Points:</strong> {metadata.timePoints} {isTimeSeries ? '(Time Series)' : '(Monthly)'}
            </p>
          </div>
        )}
      </div>

      {/* Chart Panel */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="h-96">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading price curve data...</div>
            </div>
          ) : Object.keys(marketPrices).length > 0 ? (
            <Chart data={createPriceCurveData()} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No price curve data available. Please check your data source.</p>
            </div>
          )}
        </div>
      </div>


      {/* Information Panel */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          ℹ️ Price Curve Information
        </h2>
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 leading-relaxed mb-4">
            These nominal price curves are sourced from your MongoDB database with CPI escalation applied. 
            All prices are escalated to nominal values using the specified CPI rate and reference year.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Data Sources:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• MongoDB price_curves collection</li>
                <li>• Aurora Jan 2025 forecast data</li>
                <li>• Multiple profile types (baseload, solar, wind)</li>
                <li>• Energy and green certificate prices</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Available Data:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Years: {metadata?.availableYears.join(', ') || 'Loading...'}</li>
                <li>• States: {metadata?.availableStates.join(', ') || 'Loading...'}</li>
                <li>• Profiles: {metadata?.availableProfiles.join(', ') || 'Loading...'}</li>
                <li>• Types: {metadata?.availableTypes.join(', ') || 'Loading...'}</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Usage:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Contract mark-to-market valuations</li>
                <li>• Risk assessment and scenario analysis</li>
                <li>• Time series output generation</li>
                <li>• Portfolio optimization with nominal prices</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}