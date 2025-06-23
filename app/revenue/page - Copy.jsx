'use client'

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, DollarSign, Calendar, Download, Settings, RefreshCw, Sun, Wind, Battery, Zap } from 'lucide-react';

export default function MarketPriceIntegration() {
  const [assets, setAssets] = useState([]);
  const [priceData, setPriceData] = useState({});
  const [revenueProjections, setRevenueProjections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Configuration state
  const [selectedRegion, setSelectedRegion] = useState('QLD');
  const [selectedScenario, setSelectedScenario] = useState('Central');
  const [selectedCurve, setSelectedCurve] = useState('Aurora Jan 2025 Intervals');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [viewMode, setViewMode] = useState('monthly');

  // Available options
  const availableRegions = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS'];
  const availableScenarios = ['Central', 'Low', 'High'];
  const availableYears = ['2025', '2026', '2027', '2028', '2029', '2030'];

  // Fetch assets from your existing API
  useEffect(() => {
    fetchAssets();
  }, []);

  // Fetch price data when parameters change
  useEffect(() => {
    if (assets.length > 0) {
      fetchPriceData();
    }
  }, [selectedRegion, selectedScenario, selectedCurve, selectedYear, assets]);

  // Calculate revenue projections when price data changes
  useEffect(() => {
    if (Object.keys(priceData).length > 0) {
      calculateRevenueProjections();
    }
  }, [priceData, assets]);

  const fetchAssets = async () => {
    try {
      // Fetch from your existing assets API
      const response = await fetch('/api/assets?userId=6853b044dd2ecce8ba519ba5&portfolioId=zebre');
      if (response.ok) {
        const assetsData = await response.json();
        // Convert your asset format to our format
        const convertedAssets = assetsData.map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: asset.type || 'solar', // Default to solar if not specified
          capacity: asset.capacity || 0,
          region: asset.location || 'QLD', // Use location as region, default to QLD
          contractType: 'Energy' // Default to Energy contracts
        }));
        setAssets(convertedAssets);
      } else {
        // Fallback to mock data if API fails
        const mockAssets = [
          { id: '1', name: 'Solar Farm Alpha', type: 'solar', capacity: 100, region: 'QLD', contractType: 'Energy' },
          { id: '2', name: 'Wind Farm Beta', type: 'wind', capacity: 120, region: 'NSW', contractType: 'Energy' },
          { id: '3', name: 'Battery Storage', type: 'battery', capacity: 30, region: 'VIC', contractType: 'Energy' },
          { id: '4', name: 'Green Solar Farm', type: 'solar', capacity: 80, region: 'QLD', contractType: 'Green' }
        ];
        setAssets(mockAssets);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
      // Use mock data as fallback
      const mockAssets = [
        { id: '1', name: 'Solar Farm Alpha', type: 'solar', capacity: 100, region: 'QLD', contractType: 'Energy' },
        { id: '2', name: 'Wind Farm Beta', type: 'wind', capacity: 120, region: 'NSW', contractType: 'Energy' },
        { id: '3', name: 'Battery Storage', type: 'battery', capacity: 30, region: 'VIC', contractType: 'Energy' }
      ];
      setAssets(mockAssets);
    }
  };

  const fetchPriceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const allPriceData = {};
      
      // Fetch data for each unique combination of region and contract type
      const uniqueCombinations = new Set(
        assets.map(asset => `${asset.region || selectedRegion}-${asset.contractType || 'Energy'}`)
      );

      for (const combination of uniqueCombinations) {
        const [region, contractType] = combination.split('-');
        
        const params = new URLSearchParams({
          state: region,
          type: contractType,
          year: selectedYear,
          scenario: selectedScenario,
          curve: selectedCurve
        });
        
        console.log(`Fetching price data for ${region}-${contractType}:`, `/api/price-curves?${params}`);
        
        const response = await fetch(`/api/price-curves?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.marketPrices) {
          // The API returns marketPrices as an object with series keys
          Object.entries(result.marketPrices).forEach(([seriesKey, points]) => {
            // Use a simplified key for easier access
            const simplifiedKey = `${region}-${contractType}`;
            allPriceData[simplifiedKey] = points;
          });
        } else {
          console.warn(`No data found for ${region}-${contractType}:`, result);
        }
      }
      
      setPriceData(allPriceData);
      console.log('Fetched price data:', Object.keys(allPriceData));
      
    } catch (err) {
      console.error('Error fetching price data:', err);
      setError(`Failed to fetch market price data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateRevenueProjections = () => {
    if (Object.keys(priceData).length === 0) {
      console.log('No price data available for revenue calculations');
      return;
    }

    const projections = [];
    
    // Get all unique months from price data
    const allMonths = new Set();
    Object.values(priceData).forEach(points => {
      if (Array.isArray(points)) {
        points.forEach(point => {
          if (point.year && point.monthName) {
            allMonths.add(`${point.year}-${point.monthName}`);
          }
        });
      }
    });
    
    if (allMonths.size === 0) {
      console.log('No valid months found in price data');
      return;
    }
    
    const sortedMonths = Array.from(allMonths).sort();
    console.log('Processing months:', sortedMonths);
    
    sortedMonths.forEach(monthKey => {
      const [year, monthName] = monthKey.split('-');
      const yearNum = parseInt(year);
      
      if (isNaN(yearNum)) return;
      
      const assetRevenues = {};
      let totalRevenue = 0;
      let totalPrice = 0;
      let priceCount = 0;
      
      assets.forEach(asset => {
        const priceSeriesKey = `${asset.region || selectedRegion}-${asset.contractType || 'Energy'}`;
        const pricePoints = priceData[priceSeriesKey] || [];
        
        const monthPrice = pricePoints.find(point => 
          point.year === yearNum && point.monthName === monthName
        );
        
        if (monthPrice && monthPrice.price > 0) {
          const revenue = calculateAssetRevenue(asset, monthPrice.price, monthName);
          assetRevenues[asset.id] = revenue;
          totalRevenue += revenue;
          totalPrice += monthPrice.price;
          priceCount++;
        } else {
          assetRevenues[asset.id] = 0;
        }
      });
      
      const averagePrice = priceCount > 0 ? totalPrice / priceCount : 0;
      
      projections.push({
        year: yearNum,
        month: monthName,
        assetRevenues,
        totalRevenue,
        averagePrice
      });
    });
    
    console.log(`Generated ${projections.length} revenue projections`);
    setRevenueProjections(projections);
  };

  const calculateAssetRevenue = (asset, price, month) => {
    // Get capacity factor based on asset type
    const capacityFactors = {
      solar: 0.25,
      wind: 0.35,
      battery: 0.15
    };
    
    const capacityFactor = capacityFactors[asset.type];
    const hoursInMonth = 730; // Approximate
    const generation = asset.capacity * capacityFactor * hoursInMonth / 1000; // Convert to MWh
    
    return generation * price / 1000000; // Convert to millions
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'battery': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const totalPortfolioRevenue = revenueProjections.reduce((sum, proj) => sum + proj.totalRevenue, 0);
  const averageMonthlyRevenue = revenueProjections.length > 0 ? totalPortfolioRevenue / revenueProjections.length : 0;
  const averageMarketPrice = revenueProjections.length > 0 
    ? revenueProjections.reduce((sum, proj) => sum + proj.averagePrice, 0) / revenueProjections.length 
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Price Integration</h1>
          <p className="text-gray-600">Real-time pricing for portfolio revenue analysis</p>
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
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Market Data Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableRegions.map(region => (
                <option key={region} value={region}>{region}</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Curve</label>
            <select
              value={selectedCurve}
              onChange={(e) => setSelectedCurve(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="Aurora Jan 2025 Intervals">Aurora Jan 2025</option>
              <option value="AEMO">AEMO</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Portfolio Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${totalPortfolioRevenue.toFixed(1)}M
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${averageMonthlyRevenue.toFixed(2)}M
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Market Price</p>
              <p className="text-2xl font-bold text-gray-900">
                ${averageMarketPrice.toFixed(0)}/MWh
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Assets</p>
              <p className="text-2xl font-bold text-gray-900">
                {assets.length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Projections Chart */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Projections</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueProjections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}M`, '']} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="totalRevenue" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Total Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Market Price Chart */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Market Prices</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueProjections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toFixed(0)}/MWh`, '']} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="averagePrice" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Average Price"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset Revenue Breakdown */}
      {revenueProjections.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Revenue Breakdown</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={revenueProjections.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}M`, '']} />
              <Legend />
              {assets.map((asset, index) => (
                <Bar
                  key={asset.id}
                  dataKey={`assetRevenues.${asset.id}`}
                  stackId="assets"
                  fill={`hsl(${index * 60}, 70%, 50%)`}
                  name={asset.name}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset Details Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Portfolio Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Asset</th>
                <th className="text-right py-2">Type</th>
                <th className="text-right py-2">Capacity (MW)</th>
                <th className="text-right py-2">Region</th>
                <th className="text-right py-2">Contract Type</th>
                <th className="text-right py-2">Total Revenue ($M)</th>
                <th className="text-right py-2">Avg Monthly ($M)</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => {
                const totalAssetRevenue = revenueProjections.reduce(
                  (sum, proj) => sum + (proj.assetRevenues[asset.id] || 0), 0
                );
                const avgMonthlyAssetRevenue = revenueProjections.length > 0 
                  ? totalAssetRevenue / revenueProjections.length 
                  : 0;
                
                return (
                  <tr key={asset.id} className="border-b">
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        {getAssetIcon(asset.type)}
                        <span>{asset.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 capitalize">{asset.type}</td>
                    <td className="text-right py-2">{asset.capacity}</td>
                    <td className="text-right py-2">{asset.region || selectedRegion}</td>
                    <td className="text-right py-2">{asset.contractType || 'Energy'}</td>
                    <td className="text-right py-2">${totalAssetRevenue.toFixed(2)}</td>
                    <td className="text-right py-2">${avgMonthlyAssetRevenue.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status */}
      {revenueProjections.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-800 font-medium">
                Market data loaded successfully - {revenueProjections.length} data points across {assets.length} assets
              </span>
            </div>
            <div className="text-green-600 text-sm">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}