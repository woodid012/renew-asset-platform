'use client'

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  TrendingUp, 
  RefreshCw, 
  Download, 
  Settings, 
  Calendar,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const PriceCurvesTab = () => {
  const [priceData, setPriceData] = useState({});
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Chart configuration
  const [viewMode, setViewMode] = useState('states');
  const [selectedState, setSelectedState] = useState('QLD');
  const [selectedType, setSelectedType] = useState('Energy');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedScenario, setSelectedScenario] = useState('Central');
  const [selectedCurve, setSelectedCurve] = useState('Aurora Jan 2025 Intervals');
  const [timeInterval, setTimeInterval] = useState('monthly');
  const [showRawData, setShowRawData] = useState(false);

  // Available options
  const [availableStates, setAvailableStates] = useState(['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS']);
  const [availableTypes, setAvailableTypes] = useState(['Energy', 'Green']);
  const [availableScenarios, setAvailableScenarios] = useState(['Central', 'Low', 'High']);
  const [availableYears, setAvailableYears] = useState(['2025', '2026', '2027', '2028', '2029', '2030', 'all']);

  const timeIntervals = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  // Colors for different lines
  const stateColors = {
    QLD: '#F59E0B', // Yellow/Orange for Queensland
    NSW: '#3B82F6', // Blue for NSW
    VIC: '#10B981', // Green for Victoria
    SA: '#EF4444',  // Red for South Australia
    WA: '#8B5CF6', // Purple for Western Australia
    TAS: '#6B7280'  // Gray for Tasmania
  };

  const typeColors = {
    Energy: '#3B82F6', // Blue
    Green: '#10B981',  // Green
    gas: '#F59E0B',    // Yellow
    coal: '#6B7280'    // Gray
  };

  // Fetch available options from API
  const fetchAvailableOptions = async () => {
    try {
      const response = await fetch(`/api/price-curves?curve=${encodeURIComponent(selectedCurve)}&scenario=${selectedScenario}`);
      const result = await response.json();
      
      if (result.success) {
        setAvailableStates(result.availableStates || ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS']);
        setAvailableTypes(result.availableTypes || ['Energy', 'Green']);
        setAvailableScenarios(result.availableScenarios || ['Central', 'Low', 'High']);
        setAvailableYears(result.financialYears ? [...result.financialYears.map(String), 'all'] : ['2025', 'all']);
      }
    } catch (err) {
      console.error('Error fetching options:', err);
    }
  };

  // Fetch price data
  const fetchPriceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const allData = {};
      
      if (viewMode === 'states') {
        // Fetch data for all states with selected type
        for (const state of availableStates) {
          const params = new URLSearchParams({
            state: state,
            type: selectedType,
            year: selectedYear,
            scenario: selectedScenario,
            curve: selectedCurve
          });
          
          console.log(`Fetching data for ${state}:`, `/api/price-curves?${params}`);
          
          const response = await fetch(`/api/price-curves?${params}`);
          const result = await response.json();
          
          if (result.success && result.marketPrices) {
            // Find the matching series key for this state
            const seriesKey = Object.keys(result.marketPrices).find(key => 
              key.includes(state) || key.startsWith(state)
            );
            
            if (seriesKey && result.marketPrices[seriesKey]) {
              allData[state] = result.marketPrices[seriesKey];
            }
          }
        }
      } else {
        // Fetch data for all types with selected state
        for (const type of availableTypes) {
          const params = new URLSearchParams({
            state: selectedState,
            type: type,
            year: selectedYear,
            scenario: selectedScenario,
            curve: selectedCurve
          });
          
          console.log(`Fetching data for ${type}:`, `/api/price-curves?${params}`);
          
          const response = await fetch(`/api/price-curves?${params}`);
          const result = await response.json();
          
          if (result.success && result.marketPrices) {
            // Find the matching series key for this type
            const seriesKey = Object.keys(result.marketPrices).find(key => 
              key.includes(type) || key.endsWith(type)
            );
            
            if (seriesKey && result.marketPrices[seriesKey]) {
              allData[type] = result.marketPrices[seriesKey];
            }
          }
        }
      }
      
      setPriceData(allData);
      
      // Transform data for time series chart
      const chartData = transformToTimeSeriesData(allData);
      setTimeSeriesData(chartData);
      
    } catch (err) {
      console.error('Error fetching price data:', err);
      setError(`Failed to fetch price data: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Transform price data to time series format
  const transformToTimeSeriesData = (data) => {
    const allDataPoints = {};
    
    // Collect all data points by identifier
    Object.entries(data).forEach(([seriesKey, points]) => {
      if (Array.isArray(points)) {
        points.forEach(point => {
          const identifier = seriesKey; // QLD, NSW, Energy, etc.
          
          if (!allDataPoints[identifier]) {
            allDataPoints[identifier] = [];
          }
          
          allDataPoints[identifier].push({
            date: new Date(point.date),
            price: point.price,
            monthName: point.monthName,
            year: point.year,
            month: point.month
          });
        });
      }
    });
    
    // Sort each identifier's data by date
    Object.keys(allDataPoints).forEach(identifier => {
      allDataPoints[identifier].sort((a, b) => a.date.getTime() - b.date.getTime());
    });
    
    // Find the overall date range
    const allDates = Object.values(allDataPoints).flat().map(d => d.date);
    if (allDates.length === 0) return [];
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Generate time intervals
    const timePoints = [];
    
    if (timeInterval === 'monthly') {
      const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      while (current <= maxDate) {
        timePoints.push({
          date: new Date(current),
          label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (timeInterval === 'quarterly') {
      const startYear = minDate.getFullYear();
      const endYear = maxDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        for (let quarter = 0; quarter < 4; quarter++) {
          const quarterStart = new Date(year, quarter * 3, 1);
          if (quarterStart >= minDate && quarterStart <= maxDate) {
            timePoints.push({
              date: quarterStart,
              label: `Q${quarter + 1} ${year}`
            });
          }
        }
      }
    } else { // yearly
      const startYear = minDate.getFullYear();
      const endYear = maxDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        timePoints.push({
          date: new Date(year, 0, 1),
          label: year.toString()
        });
      }
    }
    
    // Aggregate data for each time point
    const timeSeriesData = timePoints.map(({ date, label }) => {
      const dataPoint = { month: label };
      
      Object.entries(allDataPoints).forEach(([identifier, points]) => {
        let relevantPoints = [];
        
        if (timeInterval === 'monthly') {
          relevantPoints = points
            .filter(p => p.date.getFullYear() === date.getFullYear() && p.date.getMonth() === date.getMonth())
            .map(p => p.price);
        } else if (timeInterval === 'quarterly') {
          const quarterStart = date.getMonth();
          const quarterEnd = quarterStart + 2;
          relevantPoints = points
            .filter(p => p.date.getFullYear() === date.getFullYear() && 
                        p.date.getMonth() >= quarterStart && 
                        p.date.getMonth() <= quarterEnd)
            .map(p => p.price);
        } else { // yearly
          relevantPoints = points
            .filter(p => p.date.getFullYear() === date.getFullYear())
            .map(p => p.price);
        }
        
        if (relevantPoints.length > 0) {
          const average = relevantPoints.reduce((sum, price) => sum + price, 0) / relevantPoints.length;
          dataPoint[identifier] = Math.round(average * 100) / 100;
        }
      });
      
      return dataPoint;
    });
    
    return timeSeriesData.filter(point => 
      Object.keys(point).length > 1
    );
  };

  // Get line configuration for chart
  const getLineConfig = () => {
    if (viewMode === 'states') {
      return availableStates.map(state => ({
        key: state,
        color: stateColors[state] || '#6B7280',
        name: state
      }));
    } else {
      return availableTypes.map(type => ({
        key: type,
        color: typeColors[type] || '#6B7280',
        name: type
      }));
    }
  };

  // Calculate summary statistics
  const calculateSummaryStats = () => {
    if (timeSeriesData.length === 0) return { avgPrice: 0, minPrice: 0, maxPrice: 0, dataPoints: 0 };
    
    const allPrices = [];
    timeSeriesData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'month' && typeof point[key] === 'number') {
          allPrices.push(point[key]);
        }
      });
    });
    
    if (allPrices.length === 0) return { avgPrice: 0, minPrice: 0, maxPrice: 0, dataPoints: 0 };
    
    return {
      avgPrice: allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length,
      minPrice: Math.min(...allPrices),
      maxPrice: Math.max(...allPrices),
      dataPoints: timeSeriesData.length
    };
  };

  // Load available options on mount
  useEffect(() => {
    fetchAvailableOptions();
  }, [selectedCurve, selectedScenario]);

  // Fetch data when parameters change
  useEffect(() => {
    if (availableStates.length > 0 && availableTypes.length > 0) {
      fetchPriceData();
    }
  }, [viewMode, selectedState, selectedType, selectedYear, selectedScenario, selectedCurve, availableStates, availableTypes]);

  // Re-aggregate when time interval changes
  useEffect(() => {
    if (Object.keys(priceData).length > 0) {
      const chartData = transformToTimeSeriesData(priceData);
      setTimeSeriesData(chartData);
    }
  }, [timeInterval, priceData]);

  const lineConfig = getLineConfig();
  const summaryStats = calculateSummaryStats();

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Curves Viewer</h1>
          <p className="text-gray-600">Market electricity price analysis and forecasting</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchPriceData}
            disabled={loading}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Loading...' : 'Refresh Data'}</span>
          </button>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Price Curve Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="states">Compare States</option>
              <option value="types">Compare Types</option>
            </select>
          </div>
          
          {viewMode === 'types' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {availableStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          )}
          
          {viewMode === 'states' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {availableTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Financial Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year === 'all' ? 'All Years' : `FY${year}`}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scenario</label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableScenarios.map(scenario => (
                <option key={scenario} value={scenario}>{scenario}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Interval</label>
            <select
              value={timeInterval}
              onChange={(e) => setTimeInterval(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {timeIntervals.map(interval => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Curve</label>
            <select
              value={selectedCurve}
              onChange={(e) => setSelectedCurve(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="Aurora Jan 2025 Intervals">Aurora Jan 2025</option>
              <option value="AEMO">AEMO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Price</p>
              <p className="text-2xl font-bold text-gray-900">${summaryStats.avgPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-500">per MWh</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Min Price</p>
              <p className="text-2xl font-bold text-gray-900">${summaryStats.minPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-500">per MWh</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Max Price</p>
              <p className="text-2xl font-bold text-gray-900">${summaryStats.maxPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-500">per MWh</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Zap className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Data Points</p>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.dataPoints}</p>
              <p className="text-sm text-gray-500">time periods</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart Summary */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Chart Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-600">View Mode</div>
              <div className="font-semibold">
                {viewMode === 'states' ? 'Comparing States' : 'Comparing Types'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">
                {viewMode === 'states' ? 'Type' : 'State'}
              </div>
              <div className="font-semibold">
                {viewMode === 'states' ? selectedType : selectedState}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Financial Year</div>
              <div className="font-semibold">
                {selectedYear === 'all' ? 'All Years' : `FY${selectedYear}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Scenario</div>
              <div className="font-semibold">{selectedScenario}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Interval</div>
              <div className="font-semibold capitalize">{timeInterval}</div>
            </div>
          </div>
        </div>
      )}

      {/* Price Curves Chart */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Price Curves Over Time</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  label={{ value: 'Price ($/MWh)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value, name) => [`$${value?.toFixed(2) || 0}/MWh`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                
                {lineConfig.map(({ key, color, name }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    name={name}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Price Statistics */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Price Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {lineConfig.map(({ key, color, name }) => {
              const prices = timeSeriesData
                .map(d => d[key])
                .filter(p => typeof p === 'number');
              
              if (prices.length === 0) return null;
              
              const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              
              return (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    ></div>
                    <h3 className="font-semibold">{name}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average:</span>
                      <span className="font-medium">${avg.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min:</span>
                      <span className="font-medium">${min.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max:</span>
                      <span className="font-medium">${max.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Range:</span>
                      <span className="font-medium">${(max - min).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw Data Table */}
      {timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Raw Time Series Data</h2>
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {showRawData ? '🔼 Collapse' : '🔽 Expand'}
            </button>
          </div>
          
          {showRawData && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left">Time Period</th>
                    {lineConfig.map(({ key, name }) => (
                      <th key={key} className="px-3 py-2 text-left">
                        {name} ($/MWh)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSeriesData.slice(0, 50).map((row, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium">{row.month}</td>
                      {lineConfig.map(({ key }) => (
                        <td key={key} className="px-3 py-2">
                          {typeof row[key] === 'number' 
                            ? `${row[key].toFixed(2)}`
                            : '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {timeSeriesData.length > 50 && (
                <div className="text-gray-500 text-center py-2">
                  ... and {timeSeriesData.length - 50} more data points
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status Display */}
      {timeSeriesData.length > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-800 font-medium">
                Price data loaded successfully - {timeSeriesData.length} data points across {lineConfig.length} series
              </span>
            </div>
            <div className="text-green-600 text-sm">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      ) : !loading && !error && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📈</div>
          <div className="text-gray-600">
            Configure your view settings and click "Refresh Data" to load price curves
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceCurvesTab;