'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/app/contexts/UserContext';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
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

// Import the integrated revenue calculations
import { 
  calculateAssetRevenue, 
  calculateStressRevenue,
  generatePortfolioData,
  processPortfolioData,
  calculatePortfolioSummary,
  validateAssetForRevenue
} from '@/lib/revenueCalculations';

export default function IntegratedRevenuePage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice, priceSource } = useMerchantPrices();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  
  // Analysis configuration - simplified
  const [revenueFilter, setRevenueFilter] = useState('all'); // all, energy, green
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [viewMode, setViewMode] = useState('annual'); // annual, quarterly
  const [analysisYears, setAnalysisYears] = useState(30);
  
  // Results
  const [revenueProjections, setRevenueProjections] = useState([]);
  const [portfolioSummary, setPortfolioSummary] = useState({});
  const [assetValidations, setAssetValidations] = useState({});

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Auto-recalculate when parameters change
  useEffect(() => {
    if (Object.keys(assets).length > 0) {
      console.log('Auto-calculating revenue projections with:', {
        assetsCount: Object.keys(assets).length,
        revenueFilter,
        selectedRegion,
        analysisYears,
        priceSource
      });
      calculateRevenueProjections();
      validateAssets();
    }
  }, [assets, constants, revenueFilter, selectedRegion, analysisYears, getMerchantPrice]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      console.log(`Loading portfolio: userId=${currentUser.id}, portfolioId=${currentPortfolio.portfolioId}`);
      
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        console.log('Portfolio data loaded:', {
          assetsCount: Object.keys(portfolioData.assets || {}).length,
          portfolioName: portfolioData.portfolioName,
          priceSource
        });
        
        setAssets(portfolioData.assets || {});
        setConstants({
          ...portfolioData.constants,
          // Add default constants if missing
          HOURS_IN_YEAR: 8760,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: 2.5,
          referenceYear: 2025
        });
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
      } else if (response.status === 404) {
        console.log('Portfolio not found, starting fresh');
        setAssets({});
        setConstants({});
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRevenueProjections = () => {
    if (Object.keys(assets).length === 0) return;
    
    const startYear = parseInt(selectedYear);
    let timeIntervals;
    
    // Generate time intervals based on view mode
    if (viewMode === 'quarterly') {
      timeIntervals = [];
      for (let year = startYear; year < startYear + analysisYears; year++) {
        for (let quarter = 1; quarter <= 4; quarter++) {
          timeIntervals.push(`${year}-Q${quarter}`);
        }
      }
    } else {
      // Annual view
      timeIntervals = Array.from({ length: analysisYears }, (_, i) => startYear + i);
    }
    
    // Filter assets by selected region
    const filteredAssets = selectedRegion === 'ALL' 
      ? assets 
      : Object.fromEntries(
          Object.entries(assets).filter(([key, asset]) => asset.state === selectedRegion)
        );
    
    console.log(`Generating portfolio data for ${timeIntervals.length} ${viewMode} periods`);
    console.log('Using price source:', priceSource);
    console.log('Region filter:', selectedRegion);
    console.log('Assets after region filter:', Object.keys(filteredAssets).length, 'of', Object.keys(assets).length);
    
    // Generate portfolio data using the filtered assets
    const portfolioData = generatePortfolioData(filteredAssets, timeIntervals, constants, getMerchantPrice);
    
    console.log('Generated portfolio data:', portfolioData.slice(0, 2));
    
    // Process for visualization
    const visibleAssets = Object.fromEntries(
      Object.values(filteredAssets).map(asset => [asset.name, true])
    );
    
    const processedData = processPortfolioData(portfolioData, filteredAssets, visibleAssets);
    
    console.log('Processed data sample:', processedData.slice(0, 2));
    
    // Don't apply revenue filter to the data itself - let the chart handle display
    setRevenueProjections(processedData);
    
    // Calculate portfolio summary using filtered assets (use original data for summary)
    const summary = calculatePortfolioSummary(portfolioData, filteredAssets);
    console.log('Portfolio summary:', summary);
    setPortfolioSummary(summary);
  };

  const validateAssets = () => {
    const validations = {};
    // Filter assets by selected region for validation
    const assetsToValidate = selectedRegion === 'ALL' 
      ? Object.values(assets)
      : Object.values(assets).filter(asset => asset.state === selectedRegion);
      
    assetsToValidate.forEach(asset => {
      validations[asset.name] = validateAssetForRevenue(asset);
    });
    setAssetValidations(validations);
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'storage': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  // Helper function to get asset colors
  const getAssetColor = (index) => {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548', '#607D8B'];
    return colors[index % colors.length];
  };

  // Helper function to prepare data for asset breakdown chart
  const prepareAssetBreakdownData = () => {
    if (revenueProjections.length === 0) return [];
    
    // Filter assets by selected region
    const filteredAssets = selectedRegion === 'ALL' 
      ? assets 
      : Object.fromEntries(
          Object.entries(assets).filter(([key, asset]) => asset.state === selectedRegion)
        );
    
    // Take only first 10 years for readability
    const dataToShow = revenueProjections.slice(0, Math.min(10, revenueProjections.length));
    
    return dataToShow.map(period => {
      const chartData = {
        year: period.timeInterval
      };
      
      // Add each filtered asset's revenue based on current filter
      Object.values(filteredAssets).forEach(asset => {
        let assetRevenue = 0;
        
        switch (revenueFilter) {
          case 'energy':
            assetRevenue = (period[`${asset.name} Contracted Energy`] || 0) + 
                          (period[`${asset.name} Merchant Energy`] || 0);
            break;
          case 'green':
            assetRevenue = (period[`${asset.name} Contracted Green`] || 0) + 
                          (period[`${asset.name} Merchant Green`] || 0);
            break;
          default:
            assetRevenue = (period[`${asset.name} Contracted Green`] || 0) + 
                          (period[`${asset.name} Contracted Energy`] || 0) + 
                          (period[`${asset.name} Merchant Green`] || 0) + 
                          (period[`${asset.name} Merchant Energy`] || 0);
            break;
        }
        
        chartData[asset.name] = assetRevenue;
      });
      
      return chartData;
    });
  };

  // Calculate max revenue for fixed Y-axis - handle filtered display
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
    return Math.ceil(maxValue * 1.1); // Add 10% padding
  }, [revenueProjections, revenueFilter]);

  // Show loading state if no user/portfolio selected
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
          <p className="text-gray-600">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  const assetBreakdownData = prepareAssetBreakdownData();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analysis</h1>
          <p className="text-gray-600">Portfolio revenue modeling with contract analysis</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {
              selectedRegion === 'ALL' 
                ? `${Object.keys(assets).length} assets (All Regions)` 
                : `${Object.values(assets).filter(asset => asset.state === selectedRegion).length} assets (${selectedRegion})`
            } • Price Source: {priceSource}
          </p>
        </div>
      </div>

      {/* Configuration Panel - Simplified */}
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

      {/* Revenue Projections Chart with Fixed Y-Axis */}
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

      {/* Revenue Type Filter Explanation */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Filter Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'all', name: 'All Revenue', description: 'Shows both energy and green revenue streams', color: 'border-green-500 bg-green-50' },
            { key: 'energy', name: 'Energy Only', description: 'Shows only electricity energy revenue', color: 'border-blue-500 bg-blue-50' },
            { key: 'green', name: 'Green Only', description: 'Shows only green certificate revenue', color: 'border-yellow-500 bg-yellow-50' }
          ].map(filter => {
            const isSelected = revenueFilter === filter.key;
            
            return (
              <div 
                key={filter.key} 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  isSelected ? filter.color : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setRevenueFilter(filter.key)}
              >
                <h4 className="font-medium text-gray-900 mb-2">{filter.name}</h4>
                <p className="text-sm text-gray-600 mb-2">{filter.description}</p>
                {isSelected && (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Selected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Asset Revenue Breakdown */}
      {(() => {
        const filteredAssets = selectedRegion === 'ALL' 
          ? assets 
          : Object.fromEntries(
              Object.entries(assets).filter(([key, asset]) => asset.state === selectedRegion)
            );
        return Object.keys(filteredAssets).length > 1 && assetBreakdownData.length > 0;
      })() && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">
            Asset Revenue Breakdown (First 10 Years) - {
              revenueFilter === 'all' ? 'All Revenue' :
              revenueFilter === 'energy' ? 'Energy Only' :
              'Green Only'
            }
            {selectedRegion !== 'ALL' && <span className="text-sm font-normal text-gray-500"> - {selectedRegion} Region</span>}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={assetBreakdownData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => `$${value}M`} />
              <Tooltip formatter={(value) => [`${value.toFixed(2)}M`, '']} />
              <Legend />
              {(() => {
                const filteredAssets = selectedRegion === 'ALL' 
                  ? assets 
                  : Object.fromEntries(
                      Object.entries(assets).filter(([key, asset]) => asset.state === selectedRegion)
                    );
                return Object.values(filteredAssets).map((asset, index) => (
                  <Bar
                    key={asset.name}
                    dataKey={asset.name}
                    stackId="assets"
                    fill={getAssetColor(index)}
                    name={asset.name}
                  />
                ));
              })()}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset Details Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">
          Asset Portfolio Analysis
          {selectedRegion !== 'ALL' && <span className="text-sm font-normal text-gray-500"> - {selectedRegion} Region</span>}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Asset</th>
                <th className="text-right py-2">Type</th>
                <th className="text-right py-2">Region</th>
                <th className="text-right py-2">Capacity (MW)</th>
                <th className="text-right py-2">Contracts</th>
                <th className="text-right py-2">Avg Revenue ($M)</th>
                <th className="text-right py-2">Contracted %</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(assets)
                .filter(asset => selectedRegion === 'ALL' || asset.state === selectedRegion)
                .map(asset => {
                const validation = assetValidations[asset.name];
                const assetRevenue = revenueProjections.length > 0 ? 
                  revenueProjections.reduce((sum, proj) => {
                    let total = 0;
                    switch (revenueFilter) {
                      case 'energy':
                        total = (proj[`${asset.name} Contracted Energy`] || 0) + 
                               (proj[`${asset.name} Merchant Energy`] || 0);
                        break;
                      case 'green':
                        total = (proj[`${asset.name} Contracted Green`] || 0) + 
                               (proj[`${asset.name} Merchant Green`] || 0);
                        break;
                      default:
                        total = (proj[`${asset.name} Contracted Green`] || 0) + 
                               (proj[`${asset.name} Contracted Energy`] || 0) + 
                               (proj[`${asset.name} Merchant Green`] || 0) + 
                               (proj[`${asset.name} Merchant Energy`] || 0);
                        break;
                    }
                    return sum + total;
                  }, 0) / revenueProjections.length : 0;
                
                const contractedRev = revenueProjections.length > 0 ? 
                  revenueProjections.reduce((sum, proj) => {
                    let contracted = 0;
                    switch (revenueFilter) {
                      case 'energy':
                        contracted = (proj[`${asset.name} Contracted Energy`] || 0);
                        break;
                      case 'green':
                        contracted = (proj[`${asset.name} Contracted Green`] || 0);
                        break;
                      default:
                        contracted = (proj[`${asset.name} Contracted Green`] || 0) + 
                                   (proj[`${asset.name} Contracted Energy`] || 0);
                        break;
                    }
                    return sum + contracted;
                  }, 0) / revenueProjections.length : 0;
                
                const contractedPercent = assetRevenue > 0 ? (contractedRev / assetRevenue) * 100 : 0;
                
                return (
                  <tr key={asset.name} className="border-b">
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        {getAssetIcon(asset.type)}
                        <span className="font-medium">{asset.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 capitalize">{asset.type}</td>
                    <td className="text-right py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedRegion !== 'ALL' && asset.state === selectedRegion 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {asset.state || 'N/A'}
                      </span>
                    </td>
                    <td className="text-right py-2">{asset.capacity}</td>
                    <td className="text-right py-2">{asset.contracts?.length || 0}</td>
                    <td className="text-right py-2">${assetRevenue.toFixed(2)}</td>
                    <td className="text-right py-2">{contractedPercent.toFixed(0)}%</td>
                    <td className="text-right py-2">
                      <div className="flex items-center justify-end space-x-1">
                        {validation?.isValid ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={validation?.isValid ? 'text-green-600' : 'text-red-600'}>
                          {validation?.isValid ? 'Valid' : 'Issues'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation Summary */}
      {Object.values(assetValidations).some(v => !v?.isValid || v?.warnings?.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-yellow-800">Asset Validation Summary</h3>
          <div className="space-y-3">
            {Object.entries(assetValidations).map(([assetName, validation]) => {
              if (!validation || (validation.isValid && validation.warnings.length === 0)) return null;
              
              return (
                <div key={assetName} className="border-l-4 border-yellow-400 pl-4">
                  <h4 className="font-medium text-yellow-900">{assetName}</h4>
                  {validation.errors?.map((error, i) => (
                    <div key={i} className="text-red-600 text-sm flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {validation.warnings?.map((warning, i) => (
                    <div key={i} className="text-yellow-700 text-sm flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(() => {
        const filteredAssetCount = selectedRegion === 'ALL' 
          ? Object.keys(assets).length
          : Object.values(assets).filter(asset => asset.state === selectedRegion).length;
        return filteredAssetCount === 0;
      })() && (
        <div className="bg-white rounded-lg shadow border p-8">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedRegion === 'ALL' 
                ? 'No Assets to Analyze' 
                : `No Assets in ${selectedRegion}`
              }
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedRegion === 'ALL' 
                ? 'Add assets to your portfolio to perform revenue analysis'
                : `No assets found in the ${selectedRegion} region. Try selecting "All Regions" or add assets in this region.`
              }
            </p>
            {selectedRegion === 'ALL' ? (
              <a
                href="/pages/assets"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <span>Add Assets</span>
              </a>
            ) : (
              <button
                onClick={() => setSelectedRegion('ALL')}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <span>Show All Regions</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status Information */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Revenue analysis with automatic recalculation
            </span>
          </div>
          <div className="text-green-600 text-sm">
            Filter: {
              revenueFilter === 'all' ? 'All Revenue' :
              revenueFilter === 'energy' ? 'Energy Only' :
              'Green Only'
            } • Region: {selectedRegion} • Period: {analysisYears} years • Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          Live calculations include contract escalation, asset degradation, merchant price forecasts ({priceSource}), and revenue type filtering with fixed Y-axis scaling.
        </div>
      </div>
    </div>
  );
}