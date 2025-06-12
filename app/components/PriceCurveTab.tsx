'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { fetchPriceCurves, clearPriceCache, marketPriceService, PriceCurveParams, PriceCurveMetadata } from '@/app/services/marketPriceService';

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
  Filler,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
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

  // Helper function to get display-friendly type names
  const getDisplayTypeName = (type: string): string => {
    switch (type) {
      case 'Green':
        return 'Green Certificate';
      case 'Energy':
        return 'Energy';
      default:
        return type;
    }
  };

  // Fetch price curve data using the new service
  const fetchPriceCurveData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🚀 Fetching price curves via service: ${selectedType} - ${selectedProfile} - ${selectedYear}`);
      
      const params: PriceCurveParams = {
        curve: selectedCurve,
        year: selectedYear,
        profile: selectedProfile,
        type: selectedType,
        interval: selectedInterval,
        cpiRate: cpiRate,
        refYear: refYear
      };
      
      const result = await fetchPriceCurves(params);
      
      if (result.success) {
        updateMarketPrices(result.marketPrices);
        setMetadata(result.metadata);
        setTimeLabels(result.timeLabels || months);
        setIsTimeSeries(result.isTimeSeries || false);
        setCpiSettings(result.cpiSettings);
        
        console.log('✅ Successfully loaded price curve data:', {
          seriesCount: result.metadata.seriesCount,
          recordCount: result.metadata.recordCount,
          timePoints: result.metadata.timePoints
        });
        
        // Clear any previous errors
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch price curve data');
        console.error('❌ API Error:', result.error);
        
        // Still update with fallback data if available
        if (result.marketPrices && Object.keys(result.marketPrices).length > 0) {
          updateMarketPrices(result.marketPrices);
          setTimeLabels(result.timeLabels || months);
          setIsTimeSeries(result.isTimeSeries || false);
          setMetadata(result.metadata);
        }
      }
    } catch (err) {
      console.error('🚨 Network Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
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
    
    console.log('🎯 Creating chart data with keys:', seriesKeys);
    console.log('🎯 Selected type:', selectedType, 'Selected profile:', selectedProfile);
    
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
    
    // Generate colors for different profiles and types
    const getSeriesColor = (seriesKey: string, index: number) => {
      const lowerKey = seriesKey.toLowerCase();
      
      // Color coding based on content
      if (lowerKey.includes('green')) {
        if (lowerKey.includes('solar')) return '#10b981'; // Green for solar green certificates
        if (lowerKey.includes('wind')) return '#059669';  // Darker green for wind green certificates  
        return '#34d399'; // Light green for baseload green certificates
      }
      
      if (lowerKey.includes('solar')) return '#f59e0b'; // Orange for solar energy
      if (lowerKey.includes('wind')) return '#3b82f6';   // Blue for wind energy
      if (lowerKey.includes('baseload')) return '#6366f1'; // Indigo for baseload energy
      
      // Fallback colors by state
      const stateColors: { [key: string]: string } = {
        'nsw': '#667eea',
        'vic': '#764ba2', 
        'qld': '#f093fb',
        'sa': '#4facfe',
        'wa': '#43e97b'
      };
      
      for (const [state, color] of Object.entries(stateColors)) {
        if (lowerKey.includes(state)) return color;
      }
      
      // Final fallback
      const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'];
      return colors[index % colors.length];
    };
    
    if (showAll) {
      // When showing all, filter by selected state and show different profiles/types
      let filteredSeries = seriesKeys;
      
      // For Green certificates, we need to look for keys that include the state and "green"
      if (selectedType === 'Green') {
        filteredSeries = seriesKeys.filter(key => 
          key.toLowerCase().includes(selectedState.toLowerCase()) && 
          key.toLowerCase().includes('green')
        );
        
        console.log('🟢 Filtered Green certificate series for', selectedState, ':', filteredSeries);
      } else {
        // For Energy, use existing logic
        filteredSeries = seriesKeys.filter(key => 
          key.includes(selectedState) && !key.toLowerCase().includes('green')
        );
        
        console.log('⚡ Filtered Energy series for', selectedState, ':', filteredSeries);
      }
      
      const datasets = filteredSeries.map((seriesKey, index) => {
        // Create better labels for the legend
        let label = seriesKey;
        if (seriesKey.includes(' - ')) {
          const parts = seriesKey.split(' - ');
          if (parts.length >= 2) {
            // For "QLD - baseload - green" -> "Baseload Green"
            // For "NSW - solar - Energy" -> "Solar Energy"
            const profile = parts[1];
            const type = parts[2] || selectedType;
            label = `${profile.charAt(0).toUpperCase() + profile.slice(1)} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
          }
        }
        
        return {
          label: label,
          data: aggregatedData[seriesKey] || [],
          borderColor: getSeriesColor(seriesKey, index),
          backgroundColor: getSeriesColor(seriesKey, index) + '20',
          borderWidth: 3,
          tension: 0.1,
          pointBackgroundColor: getSeriesColor(seriesKey, index),
          pointBorderColor: getSeriesColor(seriesKey, index),
          pointBorderWidth: 2,
          pointRadius: 4,
        };
      });

      return {
        labels: chartLabels,
        datasets: datasets
      };
    } else {
      // Single series view - find the best match for selected state and type
      let selectedSeries: string;
      
      if (selectedType === 'Green') {
        // Look for Green certificate data for the selected state
        selectedSeries = seriesKeys.find(key => 
          key.toLowerCase().includes(selectedState.toLowerCase()) && 
          key.toLowerCase().includes('green')
        ) || seriesKeys.find(key => key.toLowerCase().includes('green')) || seriesKeys[0];
      } else {
        // Look for Energy data for the selected state
        selectedSeries = seriesKeys.find(key => 
          key.includes(selectedState) && !key.toLowerCase().includes('green')
        ) || seriesKeys.find(key => key.includes(selectedState)) || seriesKeys[0];
      }
      
      console.log('📊 Selected series for single view:', selectedSeries);
      
      return {
        labels: chartLabels,
        datasets: [{
          label: selectedSeries,
          data: aggregatedData[selectedSeries] || [],
          borderColor: getSeriesColor(selectedSeries, 0),
          backgroundColor: getSeriesColor(selectedSeries, 0) + '20',
          borderWidth: 3,
          tension: 0.1,
          pointBackgroundColor: getSeriesColor(selectedSeries, 0),
          pointBorderColor: getSeriesColor(selectedSeries, 0),
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
        text: `${getDisplayTypeName(selectedType)} Prices: ${selectedProfile === 'all' ? 'All Profiles' : selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1)} - ${selectedYear === 'all' ? 'All Years' : selectedYear} (${selectedCurve})`,
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

  // Clear cache function
  const handleClearCache = () => {
    clearPriceCache();
    fetchPriceCurveData(); // Refresh after clearing cache
  };

  return (
    <div className="space-y-8">
      {/* Controls Panel */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          📈 Price Curve Data Controls
          <span className="text-sm font-normal text-gray-500">
            (Powered by Market Price Service)
          </span>
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
              <option value="Green">Green</option>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="flex items-end">
              <button 
                onClick={handleClearCache}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-all duration-200 text-sm"
              >
                🧹 Clear Cache
              </button>
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
            <p className="text-red-600 text-sm mt-1">Using fallback data where available</p>
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

        {/* Service Status */}
        <div className="mt-4 text-xs text-gray-500">
          Cache Status: {marketPriceService.getCacheStats().size} entries | 
          Service Instance: {marketPriceService.constructor.name}
        </div>
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
            These nominal price curves are sourced from your MongoDB database via the Market Price Service 
            with CPI escalation applied. All prices are escalated to nominal values using the specified CPI rate and reference year.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Data Sources:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• MongoDB price_curves collection</li>
                <li>• Aurora Jan 2025 forecast data</li>
                <li>• Multiple profile types (baseload, solar, wind)</li>
                <li>• Energy and green certificate prices</li>
                <li>• Market Price Service with intelligent caching</li>
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
              <h4 className="font-semibold text-gray-800 mb-3">Service Features:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Intelligent price matching algorithm</li>
                <li>• 5-minute response caching</li>
                <li>• Automatic fallback data</li>
                <li>• Contract mark-to-market integration</li>
                <li>• Type conversion (UI ↔ Database)</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">💡 New Market Price Service Features:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
              <div>
                <strong>Unified API:</strong> Same service powers both Price Curves and Mark-to-Market calculations
              </div>
              <div>
                <strong>Smart Caching:</strong> Reduces API calls and improves performance
              </div>
              <div>
                <strong>Error Resilience:</strong> Automatic fallback to default prices when API unavailable
              </div>
              <div>
                <strong>Debug Tools:</strong> Cache status and detailed logging for troubleshooting
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}