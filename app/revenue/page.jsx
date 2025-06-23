'use client'

import { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Download,
  Settings,
  Sun,
  Wind,
  Battery,
  Zap
} from 'lucide-react';

const RevenueAnalysis = () => {
  const [selectedAsset, setSelectedAsset] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('annual');
  const [marketCurve, setMarketCurve] = useState('baseload');
  const [assets, setAssets] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);

  // Mock assets and data - replace with API calls
  useEffect(() => {
    // Mock assets
    setAssets([
      { id: 'all', name: 'All Assets', type: 'portfolio' },
      { id: 1, name: 'Solar Farm Alpha', type: 'solar', capacity: 100 },
      { id: 2, name: 'Wind Farm Beta', type: 'wind', capacity: 120 },
      { id: 3, name: 'Battery Storage', type: 'battery', capacity: 30 }
    ]);

    // Mock market price curves
    setMarketPrices([
      { year: 2024, baseload: 65, solar: 45, wind: 55, green: 75 },
      { year: 2025, baseload: 68, solar: 47, wind: 57, green: 78 },
      { year: 2026, baseload: 70, solar: 49, wind: 59, green: 80 },
      { year: 2027, baseload: 72, solar: 51, wind: 61, green: 82 },
      { year: 2028, baseload: 74, solar: 53, wind: 63, green: 84 },
      { year: 2029, baseload: 76, solar: 55, wind: 65, green: 86 },
      { year: 2030, baseload: 78, solar: 57, wind: 67, green: 88 }
    ]);

    // Generate revenue projections
    generateRevenueData();
    generateCashFlowData();
  }, [selectedAsset, marketCurve]);

  const generateRevenueData = () => {
    const years = Array.from({ length: 7 }, (_, i) => 2024 + i);
    const data = years.map(year => {
      const basePrice = getMarketPrice(year);
      return {
        year,
        solarRevenue: calculateAssetRevenue('solar', year, basePrice * 0.85),
        windRevenue: calculateAssetRevenue('wind', year, basePrice * 0.95),
        batteryRevenue: calculateAssetRevenue('battery', year, basePrice * 1.2),
        totalRevenue: calculateAssetRevenue('solar', year, basePrice * 0.85) + 
                     calculateAssetRevenue('wind', year, basePrice * 0.95) + 
                     calculateAssetRevenue('battery', year, basePrice * 1.2)
      };
    });
    setRevenueData(data);
  };

  const generateCashFlowData = () => {
    const years = Array.from({ length: 20 }, (_, i) => 2024 + i);
    const data = years.map(year => {
      const revenue = calculateTotalRevenue(year);
      const opex = revenue * 0.15; // 15% of revenue as OPEX
      const depreciation = year <= 2029 ? 8 : 4; // Higher depreciation in early years
      const ebitda = revenue - opex;
      const netCashFlow = ebitda - depreciation;
      
      return {
        year,
        revenue: Math.round(revenue * 10) / 10,
        opex: Math.round(opex * 10) / 10,
        ebitda: Math.round(ebitda * 10) / 10,
        netCashFlow: Math.round(netCashFlow * 10) / 10
      };
    });
    setCashFlowData(data);
  };

  const getMarketPrice = (year) => {
    const priceData = marketPrices.find(p => p.year === year);
    return priceData ? priceData[marketCurve] : 70;
  };

  const calculateAssetRevenue = (assetType, year, price) => {
    const asset = assets.find(a => a.type === assetType);
    if (!asset) return 0;
    
    const capacity = asset.capacity;
    const capacityFactor = getCapacityFactor(assetType);
    const hoursPerYear = 8760;
    const degradation = Math.pow(0.995, year - 2024); // 0.5% annual degradation
    
    const generation = capacity * capacityFactor * hoursPerYear * degradation / 1000; // MWh
    return generation * price / 1000000; // Convert to millions
  };

  const calculateTotalRevenue = (year) => {
    const basePrice = getMarketPrice(year);
    return calculateAssetRevenue('solar', year, basePrice * 0.85) + 
           calculateAssetRevenue('wind', year, basePrice * 0.95) + 
           calculateAssetRevenue('battery', year, basePrice * 1.2);
  };

  const getCapacityFactor = (assetType) => {
    switch (assetType) {
      case 'solar': return 0.25;
      case 'wind': return 0.35;
      case 'battery': return 0.15;
      default: return 0.25;
    }
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'battery': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const currentYearRevenue = revenueData.find(d => d.year === 2024)?.totalRevenue || 0;
  const projectedGrowth = revenueData.length > 1 ? 
    ((revenueData[revenueData.length - 1]?.totalRevenue - currentYearRevenue) / currentYearRevenue * 100) : 0;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analysis</h1>
          <p className="text-gray-600">Project cash flows and market curve integration</p>
        </div>
        <div className="flex space-x-3">
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

      {/* Controls */}
      <div className="bg-white rounded-lg shadow border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Market Curve</label>
            <select
              value={marketCurve}
              onChange={(e) => setMarketCurve(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="baseload">Baseload</option>
              <option value="solar">Solar</option>
              <option value="wind">Wind</option>
              <option value="green">Green Premium</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${currentYearRevenue.toFixed(1)}M
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
              <p className="text-sm font-medium text-gray-600">7-Year Growth</p>
              <p className="text-2xl font-bold text-gray-900">
                {projectedGrowth.toFixed(1)}%
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
              <p className="text-sm font-medium text-gray-600">Market Price</p>
              <p className="text-2xl font-bold text-gray-900">
                ${getMarketPrice(2024)}/MWh
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
              <p className="text-sm font-medium text-gray-600">Contract Period</p>
              <p className="text-2xl font-bold text-gray-900">
                20 Years
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
        {/* Revenue Projection Chart */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Projections</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toFixed(1)}M`, '']} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="solarRevenue" 
                stroke="#EAB308" 
                strokeWidth={2}
                name="Solar Revenue"
              />
              <Line 
                type="monotone" 
                dataKey="windRevenue" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Wind Revenue"
              />
              <Line 
                type="monotone" 
                dataKey="batteryRevenue" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Battery Revenue"
              />
              <Line 
                type="monotone" 
                dataKey="totalRevenue" 
                stroke="#6366F1" 
                strokeWidth={3}
                name="Total Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Market Price Curves */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Market Price Curves</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={marketPrices}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}/MWh`, '']} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="baseload" 
                stroke="#6B7280" 
                strokeWidth={2}
                name="Baseload"
              />
              <Line 
                type="monotone" 
                dataKey="solar" 
                stroke="#EAB308" 
                strokeWidth={2}
                name="Solar"
              />
              <Line 
                type="monotone" 
                dataKey="wind" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Wind"
              />
              <Line 
                type="monotone" 
                dataKey="green" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Green Premium"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Analysis */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">20-Year Cash Flow Projection</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value) => [`$${value.toFixed(1)}M`, '']} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stackId="1"
              stroke="#10B981" 
              fill="#10B981"
              fillOpacity={0.6}
              name="Revenue"
            />
            <Area 
              type="monotone" 
              dataKey="opex" 
              stackId="2"
              stroke="#EF4444" 
              fill="#EF4444"
              fillOpacity={0.6}
              name="OPEX"
            />
            <Line 
              type="monotone" 
              dataKey="netCashFlow" 
              stroke="#6366F1" 
              strokeWidth={3}
              name="Net Cash Flow"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Asset Breakdown Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Revenue Breakdown (2024)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Asset</th>
                <th className="text-right py-2">Capacity (MW)</th>
                <th className="text-right py-2">Generation (GWh)</th>
                <th className="text-right py-2">Price ($/MWh)</th>
                <th className="text-right py-2">Revenue ($M)</th>
                <th className="text-right py-2">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {assets.filter(a => a.type !== 'portfolio').map(asset => {
                const generation = asset.capacity * getCapacityFactor(asset.type) * 8.76;
                const price = getMarketPrice(2024) * (asset.type === 'solar' ? 0.85 : asset.type === 'wind' ? 0.95 : 1.2);
                const revenue = generation * price / 1000;
                const percentage = (revenue / currentYearRevenue) * 100;
                
                return (
                  <tr key={asset.id} className="border-b">
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        {getAssetIcon(asset.type)}
                        <span>{asset.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-2">{asset.capacity}</td>
                    <td className="text-right py-2">{generation.toFixed(1)}</td>
                    <td className="text-right py-2">${price.toFixed(0)}</td>
                    <td className="text-right py-2">${revenue.toFixed(1)}</td>
                    <td className="text-right py-2">{percentage.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalysis;