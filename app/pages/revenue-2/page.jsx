// app/revenue/page.jsx

'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/app/contexts/UserContext';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, 
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle,
  Sun,
  Wind,
  Battery,
  FileText,
  BarChart3
} from 'lucide-react';

export default function RevenuePageBackendData() {
  const { currentUser, currentPortfolio } = useUser();
  const { priceSource } = useMerchantPrices();
  
  // State management
  const [backendRevenueData, setBackendRevenueData] = useState([]);
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Analysis configuration
  const [revenueFilter, setRevenueFilter] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [viewMode, setViewMode] = useState('annual');
  const [analysisYears, setAnalysisYears] = useState(30);
  const [assetBreakdownView, setAssetBreakdownView] = useState('portfolio');
  
  // Results
  const [revenueProjections, setRevenueProjections] = useState([]);
  const [portfolioSummary, setPortfolioSummary] = useState({});
  const [assets, setAssets] = useState({});

  // Load backend revenue data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadBackendRevenueData();
    }
  }, [currentUser, currentPortfolio]);

  // Auto-recalculate when parameters change
  useEffect(() => {
    if (backendRevenueData.length > 0) {
      processRevenueData();
    }
  }, [backendRevenueData, revenueFilter, selectedRegion, analysisYears, selectedYear, viewMode]);

  const loadBackendRevenueData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load the combined revenue data from public folder
      const response = await fetch('/results/detailed-revenue/all_assets_revenue.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load revenue data: ${response.status}. Make sure backend data has been exported to public/results/detailed-revenue/`);
      }
      
      const revenueData = await response.json();
      setBackendRevenueData(revenueData);
      
      // Load portfolio data for asset info
      const portfolioResponse = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        setAssets(portfolioData.assets || {});
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
      } else if (portfolioResponse.status === 404) {
        setAssets({});
      }
      
    } catch (error) {
      console.error('Error loading backend revenue data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const processRevenueData = () => {
    if (backendRevenueData.length === 0) return;
    
    const startYear = parseInt(selectedYear);
    
    // Filter data by region and date range
    let filteredData = backendRevenueData.filter(item => {
      const itemDate = new Date(item.date);
      const itemYear = itemDate.getFullYear();
      
      // Filter by year range
      if (itemYear < startYear || itemYear >= startYear + analysisYears) {
        return false;
      }
      
      // Filter by region
      if (selectedRegion !== 'ALL' && item.asset_region !== selectedRegion) {
        return false;
      }
      
      return true;
    });
    
    // Group by time period
    const groupedData = {};
    
    filteredData.forEach(item => {
      const itemDate = new Date(item.date);
      let timeKey;
      
      if (viewMode === 'quarterly') {
        const quarter = Math.floor((itemDate.getMonth()) / 3) + 1;
        timeKey = `${itemDate.getFullYear()}-Q${quarter}`;
      } else {
        timeKey = itemDate.getFullYear();
      }
      
      if (!groupedData[timeKey]) {
        groupedData[timeKey] = {
          timeInterval: timeKey,
          contractedGreen: 0,
          contractedEnergy: 0,
          merchantGreen: 0,
          merchantEnergy: 0,
          total: 0,
          assets: {}
        };
      }
      
      const period = groupedData[timeKey];
      
      // Add to totals
      period.contractedGreen += item.contracted_green_revenue || 0;
      period.contractedEnergy += item.contracted_energy_revenue || 0;
      period.merchantGreen += item.merchant_green_revenue || 0;
      period.merchantEnergy += item.merchant_energy_revenue || 0;
      period.total += item.total_revenue || 0;
      
      // Track by asset for breakdown
      if (!period.assets[item.asset_name]) {
        period.assets[item.asset_name] = {
          contractedGreen: 0,
          contractedEnergy: 0,
          merchantGreen: 0,
          merchantEnergy: 0,
          total: 0
        };
      }
      
      const assetData = period.assets[item.asset_name];
      assetData.contractedGreen += item.contracted_green_revenue || 0;
      assetData.contractedEnergy += item.contracted_energy_revenue || 0;
      assetData.merchantGreen += item.merchant_green_revenue || 0;
      assetData.merchantEnergy += item.merchant_energy_revenue || 0;
      assetData.total += item.total_revenue || 0;
      
      // Add individual asset columns for breakdown table
      period[`${item.asset_name} Contracted Green`] = assetData.contractedGreen;
      period[`${item.asset_name} Contracted Energy`] = assetData.contractedEnergy;
      period[`${item.asset_name} Merchant Green`] = assetData.merchantGreen;
      period[`${item.asset_name} Merchant Energy`] = assetData.merchantEnergy;
    });
    
    const processedData = Object.values(groupedData).sort((a, b) => {
      if (viewMode === 'quarterly') {
        return a.timeInterval.localeCompare(b.timeInterval);
      }
      return a.timeInterval - b.timeInterval;
    });
    
    setRevenueProjections(processedData);
    
    // Calculate portfolio summary
    const summary = calculatePortfolioSummary(processedData, filteredData);
    setPortfolioSummary(summary);
  };

  const calculatePortfolioSummary = (processedData, filteredData) => {
    if (processedData.length === 0) return {};
    
    const totalRevenue = processedData.reduce((sum, period) => sum + period.total, 0);
    const averageRevenue = totalRevenue / processedData.length;
    
    const totalContracted = processedData.reduce((sum, period) => 
      sum + period.contractedGreen + period.contractedEnergy, 0);
    const totalMerchant = processedData.reduce((sum, period) => 
      sum + period.merchantGreen + period.merchantEnergy, 0);
    
    const contractedPercentage = totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0;
    const merchantPercentage = totalRevenue > 0 ? (totalMerchant / totalRevenue) * 100 : 0;
    
    // Calculate capacity from assets
    const uniqueAssets = [...new Set(filteredData.map(item => item.asset_name))];
    const totalCapacity = uniqueAssets.reduce((sum, assetName) => {
      const asset = Object.values(assets).find(a => a.name === assetName);
      return sum + (asset ? parseFloat(asset.capacity || 0) : 0);
    }, 0);
    
    return {
      averageRevenue,
      contractedPercentage,
      merchantPercentage,
      totalCapacity,
      assetCount: uniqueAssets.length
    };
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'storage': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  // Prepare data for asset breakdown table
  const prepareAssetBreakdownData = () => {
    if (revenueProjections.length === 0) return [];
    
    const uniqueAssets = [...new Set(backendRevenueData
      .filter(item => selectedRegion === 'ALL' || item.asset_region === selectedRegion)
      .map(item => item.asset_name))];
    
    if (assetBreakdownView === 'portfolio') {
      return revenueProjections.map(period => {
        const rowData = { year: period.timeInterval };
        
        uniqueAssets.forEach(assetName => {
          let assetRevenue = 0;
          switch (revenueFilter) {
            case 'energy':
              assetRevenue = (period[`${assetName} Contracted Energy`] || 0) + 
                            (period[`${assetName} Merchant Energy`] || 0);
              break;
            case 'green':
              assetRevenue = (period[`${assetName} Contracted Green`] || 0) + 
                            (period[`${assetName} Merchant Green`] || 0);
              break;
            default:
              assetRevenue = (period[`${assetName} Contracted Green`] || 0) + 
                            (period[`${assetName} Contracted Energy`] || 0) + 
                            (period[`${assetName} Merchant Green`] || 0) + 
                            (period[`${assetName} Merchant Energy`] || 0);
              break;
          }
          rowData[assetName] = assetRevenue;
        });
        
        return rowData;
      });
    } else {
      // Individual asset view
      return revenueProjections.map(period => {
        const rowData = { year: period.timeInterval };
        
        switch (revenueFilter) {
          case 'energy':
            rowData['Contracted'] = period[`${assetBreakdownView} Contracted Energy`] || 0;
            rowData['Merchant'] = period[`${assetBreakdownView} Merchant Energy`] || 0;
            break;
          case 'green':
            rowData['Contracted'] = period[`${assetBreakdownView} Contracted Green`] || 0;
            rowData['Merchant'] = period[`${assetBreakdownView} Merchant Green`] || 0;
            break;
          default:
            rowData['Contracted Green'] = period[`${assetBreakdownView} Contracted Green`] || 0;
            rowData['Contracted Energy'] = period[`${assetBreakdownView} Contracted Energy`] || 0;
            rowData['Merchant Green'] = period[`${assetBreakdownView} Merchant Green`] || 0;
            rowData['Merchant Energy'] = period[`${assetBreakdownView} Merchant Energy`] || 0;
            break;
        }
        
        return rowData;
      });
    }
  };

  // Calculate max revenue for fixed Y-axis
  const maxRevenue = useMemo(() => {
    if (revenueProjections.length === 0) return 100;
    
    const maxValue = Math.max(...revenueProjections.map(period => {
      switch (revenueFilter) {
        case 'energy':
          return (period.contractedEnergy || 0) + (period.merchantEnergy || 0);
        case 'green':
          return (period.contractedGreen || 0) + (period.merchantGreen || 0);
        default:
          return period.total || 0;
      }
    }));
    return Math.ceil(maxValue * 1.1);
  }, [revenueProjections, revenueFilter]);

  // Get available assets for breakdown dropdown
  const getAvailableAssetsForBreakdown = () => {
    const uniqueAssets = [...new Set(backendRevenueData
      .filter(item => selectedRegion === 'ALL' || item.asset_region === selectedRegion)
      .map(item => item.asset_name))];
    
    return [
      { value: 'portfolio', label: 'Portfolio (All Assets)' },
      ...uniqueAssets.map(assetName => {
        const asset = Object.values(assets).find(a => a.name === assetName);
        return {
          value: assetName,
          label: `${assetName} (${asset?.type || 'unknown'}, ${asset?.capacity || '0'}MW)`
        };
      })
    ];
  };

  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Portfolio Selected</h3>
          <p className="text-gray-600">Please select a user and portfolio to analyze revenue</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading backend revenue data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Make sure the backend has been run and data exported</p>
        </div>
      </div>
    );
  }

  const assetBreakdownData = prepareAssetBreakdownData();
  const availableAssetsForBreakdown = getAvailableAssetsForBreakdown();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analysis (Backend Data)</h1>
          <p className="text-gray-600">Portfolio revenue modeling with backend calculations</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {
              selectedRegion === 'ALL' 
                ? `${portfolioSummary.assetCount || 0} assets (All Regions)` 
                : `${portfolioSummary.assetCount || 0} assets (${selectedRegion})`
            } • Price Source: {priceSource}
          </p>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Type</label>
            <select
              value={revenueFilter}
              onChange={(e) => setRevenueFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Revenue</option>
              <option value="energy">Energy Only</option>
              <option value="green">Green Only</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {Array.from({ length: 10 }, (_, i) => 2025 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Period</label>
            <select
              value={analysisYears}
              onChange={(e) => setAnalysisYears(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value={5}>5 Years</option>
              <option value={10}>10 Years</option>
              <option value={15}>15 Years</option>
              <option value={20}>20 Years</option>
              <option value={25}>25 Years</option>
              <option value={30}>30 Years</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Region Focus</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="ALL">All Regions</option>
              <option value="QLD">Queensland</option>
              <option value="NSW">New South Wales</option>
              <option value="VIC">Victoria</option>
              <option value="SA">South Australia</option>
              <option value="WA">Western Australia</option>
              <option value="TAS">Tasmania</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Portfolio Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${portfolioSummary.averageRevenue?.toFixed(1) || '0.0'}M
              </p>
              <p className="text-sm text-gray-500">Average Annual</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contracted Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {portfolioSummary.contractedPercentage?.toFixed(0) || '0'}%
              </p>
              <p className="text-sm text-gray-500">of Total</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Merchant Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {portfolioSummary.merchantPercentage?.toFixed(0) || '0'}%
              </p>
              <p className="text-sm text-gray-500">of Total</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-gray-900">
                {portfolioSummary.totalCapacity?.toFixed(0) || '0'} MW
              </p>
              <p className="text-sm text-gray-500">{portfolioSummary.assetCount || 0} Assets</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Projections Chart */}
      {revenueProjections.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">
            Revenue Projections - {
              revenueFilter === 'all' ? 'All Revenue' :
              revenueFilter === 'energy' ? 'Energy Revenue Only' :
              'Green Revenue Only'
            }
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={revenueProjections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timeInterval"
                angle={viewMode === 'quarterly' ? -45 : 0}
                textAnchor={viewMode === 'quarterly' ? 'end' : 'middle'}
                height={viewMode === 'quarterly' ? 80 : 60}
              />
              <YAxis 
                domain={[0, maxRevenue]}
                tickFormatter={(value) => `${value}M`}
              />
              <Tooltip 
                formatter={(value) => [`${value.toFixed(2)}M`, '']}
                labelFormatter={(label) => `Year: ${label}`}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="contractedGreen" 
                stackId="1"
                stroke="#10B981" 
                fill="#10B981"
                name="Contracted Green"
                hide={revenueFilter === 'energy'}
              />
              <Area 
                type="monotone" 
                dataKey="contractedEnergy" 
                stackId="1"
                stroke="#3B82F6" 
                fill="#3B82F6"
                name="Contracted Energy"
                hide={revenueFilter === 'green'}
              />
              <Area 
                type="monotone" 
                dataKey="merchantGreen" 
                stackId="1"
                stroke="#F59E0B" 
                fill="#F59E0B"
                name="Merchant Green"
                hide={revenueFilter === 'energy'}
              />
              <Area 
                type="monotone" 
                dataKey="merchantEnergy" 
                stackId="1"
                stroke="#EF4444" 
                fill="#EF4444"
                name="Merchant Energy"
                hide={revenueFilter === 'green'}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset Revenue Breakdown Table */}
      {assetBreakdownData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {assetBreakdownView === 'portfolio' 
                ? `Asset Revenue Breakdown (${analysisYears} Year Analysis)` 
                : `${assetBreakdownView} Revenue Analysis`
              } - {
                revenueFilter === 'all' ? 'All Revenue' :
                revenueFilter === 'energy' ? 'Energy Only' :
                'Green Only'
              }
              {selectedRegion !== 'ALL' && <span className="text-sm font-normal text-gray-500"> - {selectedRegion} Region</span>}
            </h3>
            
            {/* Asset View Dropdown */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Asset View:</label>
              <select
                value={assetBreakdownView}
                onChange={(e) => setAssetBreakdownView(e.target.value)}
                className="p-2 border border-gray-300 rounded-md text-sm min-w-[200px]"
              >
                {availableAssetsForBreakdown.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Year</th>
                  {assetBreakdownView === 'portfolio' ? (
                    (() => {
                      const uniqueAssets = [...new Set(backendRevenueData
                        .filter(item => selectedRegion === 'ALL' || item.asset_region === selectedRegion)
                        .map(item => item.asset_name))];
                      return uniqueAssets.map(assetName => (
                        <th key={assetName} className="text-right py-3 px-2 font-medium text-gray-900">
                          {assetName} ($M)
                        </th>
                      ));
                    })()
                  ) : (
                    revenueFilter === 'all' ? (
                      <>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Contracted Green ($M)</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Contracted Energy ($M)</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Merchant Green ($M)</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Merchant Energy ($M)</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">Total ($M)</th>
                      </>
                    ) : (
                      <>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Contracted ($M)</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Merchant ($M)</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">Total ($M)</th>
                      </>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {assetBreakdownData.map((row, index) => (
                  <tr key={row.year} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="py-3 px-2 font-medium text-gray-900">{row.year}</td>
                    {assetBreakdownView === 'portfolio' ? (
                      (() => {
                        const uniqueAssets = [...new Set(backendRevenueData
                          .filter(item => selectedRegion === 'ALL' || item.asset_region === selectedRegion)
                          .map(item => item.asset_name))];
                        return uniqueAssets.map(assetName => (
                          <td key={assetName} className="text-right py-3 px-2 text-gray-700">
                            {(row[assetName] || 0).toFixed(2)}
                          </td>
                        ));
                      })()
                    ) : (
                      revenueFilter === 'all' ? (
                        <>
                          <td className="text-right py-3 px-2 text-gray-700">
                            {(row['Contracted Green'] || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-2 text-gray-700">
                            {(row['Contracted Energy'] || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-2 text-gray-700">
                            {(row['Merchant Green'] || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-2 text-gray-700">
                            {(row['Merchant Energy'] || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">
                            {((row['Contracted Green'] || 0) + (row['Contracted Energy'] || 0) + 
                              (row['Merchant Green'] || 0) + (row['Merchant Energy'] || 0)).toFixed(2)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="text-right py-3 px-2 text-gray-700">
                            {(row['Contracted'] || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-2 text-gray-700">
                            {(row['Merchant'] || 0).toFixed(2)}
                          </td>
                          <td className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">
                            {((row['Contracted'] || 0) + (row['Merchant'] || 0)).toFixed(2)}
                          </td>
                        </>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Information */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Revenue analysis using backend data
            </span>
          </div>
          <div className="text-green-600 text-sm">
            Filter: {
              revenueFilter === 'all' ? 'All Revenue' :
              revenueFilter === 'energy' ? 'Energy Only' :
              'Green Only'
            } • Region: {selectedRegion} • View: {
              assetBreakdownView === 'portfolio' ? 'Portfolio' : assetBreakdownView
            } • Period: {analysisYears} years
          </div>
        </div>
      </div>
    </div>
  );
}