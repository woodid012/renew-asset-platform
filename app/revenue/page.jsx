'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { 
  TrendingUp, 
  RefreshCw, 
  Download, 
  Settings, 
  Calendar,
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
  const { getMerchantPrice } = useMerchantPrices();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [priceData, setPriceData] = useState({});
  
  // Analysis configuration
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [selectedRegion, setSelectedRegion] = useState('QLD');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [viewMode, setViewMode] = useState('annual');
  const [analysisYears, setAnalysisYears] = useState(10);
  
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

  // Recalculate when parameters change
  useEffect(() => {
    if (Object.keys(assets).length > 0) {
      calculateRevenueProjections();
      validateAssets();
    }
  }, [assets, constants, selectedRevenueCase, analysisYears]);

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
          portfolioName: portfolioData.portfolioName
        });
        
        setAssets(portfolioData.assets || {});
        setConstants({
          ...portfolioData.constants,
          // Add default constants if missing
          HOURS_IN_YEAR: 8760,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: 2.5, // Hardcoded for now
          referenceYear: 2025 // Hardcoded for now
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
    const timeIntervals = Array.from({ length: analysisYears }, (_, i) => startYear + i);
    
    // Generate portfolio data using the integrated calculations
    const portfolioData = generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice);
    
    // Process for visualization
    const visibleAssets = Object.fromEntries(
      Object.values(assets).map(asset => [asset.name, true])
    );
    
    const processedData = processPortfolioData(portfolioData, assets, visibleAssets);
    
    // Apply stress scenarios
    const stressedData = processedData.map(period => {
      const stressedPeriod = { ...period };
      
      if (selectedRevenueCase !== 'base') {
        // Apply stress to each component
        const baseRevenue = {
          contractedGreen: period.contractedGreen,
          contractedEnergy: period.contractedEnergy,
          merchantGreen: period.merchantGreen,
          merchantEnergy: period.merchantEnergy
        };
        
        const stressedRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
        
        stressedPeriod.contractedGreen = stressedRevenue.contractedGreen;
        stressedPeriod.contractedEnergy = stressedRevenue.contractedEnergy;
        stressedPeriod.merchantGreen = stressedRevenue.merchantGreen;
        stressedPeriod.merchantEnergy = stressedRevenue.merchantEnergy;
        stressedPeriod.total = stressedRevenue.contractedGreen + stressedRevenue.contractedEnergy + 
                              stressedRevenue.merchantGreen + stressedRevenue.merchantEnergy;
      }
      
      return stressedPeriod;
    });
    
    setRevenueProjections(stressedData);
    
    // Calculate portfolio summary
    const summary = calculatePortfolioSummary(portfolioData, assets);
    setPortfolioSummary(summary);
  };

  const validateAssets = () => {
    const validations = {};
    Object.values(assets).forEach(asset => {
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

  const exportData = () => {
    const portfolioData = generatePortfolioData(
      assets, 
      Array.from({ length: analysisYears }, (_, i) => parseInt(selectedYear) + i), 
      constants, 
      getMerchantPrice
    );
    
    const csvData = formatRevenueDataForExport(portfolioData, assets, 'csv');
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${portfolioName}_revenue_projections.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrated Revenue Analysis</h1>
          <p className="text-gray-600">Advanced revenue modeling with contract analysis and stress testing</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {Object.keys(assets).length} assets
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={calculateRevenueProjections}
            disabled={loading}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button 
            onClick={exportData}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Scenario</label>
            <select
              value={selectedRevenueCase}
              onChange={(e) => setSelectedRevenueCase(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="base">Base Case</option>
              <option value="worst">Combined Downside</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
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
            Revenue Projections - {selectedRevenueCase.charAt(0).toUpperCase() + selectedRevenueCase.slice(1)} Scenario
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={revenueProjections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeInterval" />
              <YAxis />
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
              />
              <Area 
                type="monotone" 
                dataKey="contractedEnergy" 
                stackId="1"
                stroke="#3B82F6" 
                fill="#3B82F6"
                name="Contracted Energy"
              />
              <Area 
                type="monotone" 
                dataKey="merchantGreen" 
                stackId="1"
                stroke="#F59E0B" 
                fill="#F59E0B"
                name="Merchant Green"
              />
              <Area 
                type="monotone" 
                dataKey="merchantEnergy" 
                stackId="1"
                stroke="#EF4444" 
                fill="#EF4444"
                name="Merchant Energy"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Scenario Comparison */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Scenario Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['base', 'volume', 'price', 'worst'].map(scenario => {
            const isSelected = selectedRevenueCase === scenario;
            const scenarioName = scenario === 'worst' ? 'Combined Downside' : 
                               scenario.charAt(0).toUpperCase() + scenario.slice(1);
            
            return (
              <div 
                key={scenario} 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedRevenueCase(scenario)}
              >
                <h4 className="font-medium text-gray-900 mb-2">{scenarioName}</h4>
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between mb-1">
                    <span>Revenue Impact:</span>
                    <span className={scenario === 'base' ? 'text-green-600' : 'text-red-600'}>
                      {scenario === 'base' ? '100%' : 
                       scenario === 'volume' ? '-15%' :
                       scenario === 'price' ? '-10%' : '-25%'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {scenario === 'base' && 'No stress applied'}
                    {scenario === 'volume' && 'Volume stress only'}
                    {scenario === 'price' && 'Price stress only'}
                    {scenario === 'worst' && 'Combined stress'}
                  </div>
                </div>
                {isSelected && (
                  <div className="mt-2 flex items-center text-green-600 text-sm">
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
      {Object.keys(assets).length > 1 && revenueProjections.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Revenue Breakdown</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={revenueProjections.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeInterval" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value.toFixed(2)}M`, '']} />
              <Legend />
              {Object.values(assets).map((asset, index) => (
                <Bar
                  key={asset.name}
                  dataKey={asset.name}
                  stackId="assets"
                  fill={getAssetColor(index)}
                  name={asset.name}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset Details Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Portfolio Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Asset</th>
                <th className="text-right py-2">Type</th>
                <th className="text-right py-2">Capacity (MW)</th>
                <th className="text-right py-2">Contracts</th>
                <th className="text-right py-2">Avg Revenue ($M)</th>
                <th className="text-right py-2">Contracted %</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(assets).map(asset => {
                const validation = assetValidations[asset.name];
                const assetRevenue = revenueProjections.length > 0 ? 
                  revenueProjections.reduce((sum, proj) => {
                    const total = (proj[`${asset.name} Contracted Green`] || 0) + 
                                 (proj[`${asset.name} Contracted Energy`] || 0) + 
                                 (proj[`${asset.name} Merchant Green`] || 0) + 
                                 (proj[`${asset.name} Merchant Energy`] || 0);
                    return sum + total;
                  }, 0) / revenueProjections.length : 0;
                
                const contractedRev = revenueProjections.length > 0 ? 
                  revenueProjections.reduce((sum, proj) => {
                    return sum + (proj[`${asset.name} Contracted Green`] || 0) + 
                               (proj[`${asset.name} Contracted Energy`] || 0);
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
      {Object.keys(assets).length === 0 && (
        <div className="bg-white rounded-lg shadow border p-8">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Assets to Analyze</h3>
            <p className="text-gray-600 mb-4">
              Add assets to your portfolio to perform revenue analysis
            </p>
            <a
              href="/assets"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <span>Add Assets</span>
            </a>
          </div>
        </div>
      )}

      {/* Status Information */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Revenue analysis using integrated performance calculations
            </span>
          </div>
          <div className="text-green-600 text-sm">
            Scenario: {selectedRevenueCase} • Period: {analysisYears} years • Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          Calculations include contract escalation, asset degradation, merchant price forecasts, quarterly capacity factors, and comprehensive stress scenarios.
        </div>
      </div>
    </div>
  );

  // Helper functions
  function getAssetColor(index) {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[index % colors.length];
  }

  function formatRevenueDataForExport(portfolioData, assets, format) {
    if (format === 'json') {
      return JSON.stringify({
        metadata: {
          exportDate: new Date().toISOString(),
          assetCount: Object.keys(assets).length,
          periodCount: portfolioData.length,
          scenario: selectedRevenueCase
        },
        assets: assets,
        revenueData: portfolioData
      }, null, 2);
    }

    // CSV format
    const headers = ['Period', 'Total Revenue', 'Contracted Green', 'Contracted Energy', 'Merchant Green', 'Merchant Energy'];
    
    // Add asset-specific columns
    Object.values(assets).forEach(asset => {
      headers.push(`${asset.name} Total`, `${asset.name} Contracted`, `${asset.name} Merchant`);
    });

    const rows = [headers.join(',')];

    portfolioData.forEach(period => {
      const row = [
        period.timeInterval,
        Object.values(period.assets).reduce((sum, asset) => sum + asset.total, 0).toFixed(2),
        Object.values(period.assets).reduce((sum, asset) => sum + asset.contractedGreen, 0).toFixed(2),
        Object.values(period.assets).reduce((sum, asset) => sum + asset.contractedEnergy, 0).toFixed(2),
        Object.values(period.assets).reduce((sum, asset) => sum + asset.merchantGreen, 0).toFixed(2),
        Object.values(period.assets).reduce((sum, asset) => sum + asset.merchantEnergy, 0).toFixed(2)
      ];

      // Add asset-specific data
      Object.values(assets).forEach(asset => {
        const assetData = period.assets[asset.name] || { total: 0, contractedGreen: 0, contractedEnergy: 0, merchantGreen: 0, merchantEnergy: 0 };
        row.push(
          assetData.total.toFixed(2),
          (assetData.contractedGreen + assetData.contractedEnergy).toFixed(2),
          (assetData.merchantGreen + assetData.merchantEnergy).toFixed(2)
        );
      });

      rows.push(row.join(','));
    });

    return rows.join('\n');
  }
}