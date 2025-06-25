'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/app/contexts/UserContext';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import { useSaveContext } from '@/app/layout';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
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
  BarChart3,
  Save,
  RefreshCw,
  Settings,
  Download,
  Calendar,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';

export default function EnhancedRevenuePage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice, priceSource, escalationSettings } = useMerchantPrices();
  const { setHasUnsavedChanges, setSaveFunction } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  
  // Enhanced analysis configuration
  const [analysisConfig, setAnalysisConfig] = useState({
    intervalType: 'annual',
    startYear: new Date().getFullYear(),
    periods: 30,
    scenario: 'base',
    includeProjectFinance: false,
    includeSensitivity: false
  });
  
  // Display configuration
  const [displayConfig, setDisplayConfig] = useState({
    revenueFilter: 'all',
    selectedRegion: 'ALL',
    assetBreakdownView: 'portfolio',
    showLegacyData: false,
    chartType: 'area'
  });
  
  // Asset visibility
  const [assetVisibility, setAssetVisibility] = useState({});
  
  // Results from enhanced backend
  const [enhancedResults, setEnhancedResults] = useState(null);
  const [portfolioSummary, setPortfolioSummary] = useState({});
  const [validationResults, setValidationResults] = useState({});

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Set up save function
  useEffect(() => {
    setSaveFunction(() => async () => {
      await saveAnalysisConfiguration();
    });
  }, [analysisConfig, displayConfig, setSaveFunction]);

  // Auto-calculate when parameters change
  useEffect(() => {
    if (Object.keys(assets).length > 0) {
      calculateEnhancedRevenue();
    }
  }, [assets, constants, analysisConfig, escalationSettings]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        const portfolioAssets = portfolioData.assets || {};
        
        setAssets(portfolioAssets);
        setConstants({
          ...portfolioData.constants,
          HOURS_IN_YEAR: 8760,
          DAYS_IN_YEAR: 365,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: escalationSettings.rate || 2.5,
          referenceYear: escalationSettings.referenceYear || 2025,
          scenario: analysisConfig.scenario
        });
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
        // Initialize asset visibility
        const visibility = {};
        Object.values(portfolioAssets).forEach(asset => {
          visibility[asset.name] = true;
        });
        setAssetVisibility(visibility);
        
        // Validate assets
        validateAssets(portfolioAssets);
      } else if (response.status === 404) {
        setAssets({});
        setConstants({});
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEnhancedRevenue = useCallback(async () => {
    if (Object.keys(assets).length === 0 || calculating) return;
    
    setCalculating(true);
    try {
      console.log('Calling enhanced portfolio analysis API...');
      
      // Use the enhanced portfolio analysis API
      const response = await fetch('/api/portfolio-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          portfolioId: currentPortfolio.portfolioId,
          analysisConfig: {
            ...analysisConfig,
            scenario: analysisConfig.scenario,
            includeSensitivity: false // Keep performance focused
          }
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        console.log('Enhanced portfolio analysis results:', results);
        
        setEnhancedResults(results);
        
        // Calculate summary from enhanced results
        calculateSummaryFromEnhanced(results);
        
        console.log('Enhanced revenue calculation completed');
      } else {
        console.error('Enhanced analysis failed:', response.status);
        // Fallback to legacy calculation
        await calculateLegacyRevenue();
      }
    } catch (error) {
      console.error('Error in enhanced calculation:', error);
      // Fallback to legacy calculation
      await calculateLegacyRevenue();
    } finally {
      setCalculating(false);
    }
  }, [assets, constants, analysisConfig, currentUser, currentPortfolio, calculating]);

  const calculateLegacyRevenue = async () => {
    console.log('Using legacy revenue calculation as fallback...');
    
    try {
      // Import legacy functions
      const { 
        generatePortfolioData,
        processPortfolioData,
        calculatePortfolioSummary
      } = await import('@/lib/revenueCalculations');

      const startYear = analysisConfig.startYear;
      let timeIntervals;
      
      if (analysisConfig.intervalType === 'quarterly') {
        timeIntervals = [];
        for (let year = startYear; year < startYear + analysisConfig.periods; year++) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            timeIntervals.push(`${year}-Q${quarter}`);
          }
        }
      } else if (analysisConfig.intervalType === 'monthly') {
        timeIntervals = [];
        for (let year = startYear; year < startYear + analysisConfig.periods; year++) {
          for (let month = 1; month <= 12; month++) {
            timeIntervals.push(`${year}-${month.toString().padStart(2, '0')}`);
          }
        }
      } else {
        timeIntervals = Array.from({ length: analysisConfig.periods }, (_, i) => startYear + i);
      }
      
      const filteredAssets = displayConfig.selectedRegion === 'ALL' 
        ? assets 
        : Object.fromEntries(
            Object.entries(assets).filter(([key, asset]) => asset.state === displayConfig.selectedRegion)
          );
      
      const portfolioData = generatePortfolioData(filteredAssets, timeIntervals, constants, getMerchantPrice);
      const processedData = processPortfolioData(portfolioData, filteredAssets, assetVisibility);
      const summary = calculatePortfolioSummary(portfolioData, filteredAssets);
      
      // Convert to enhanced format
      setEnhancedResults({
        metadata: {
          calculationTimestamp: new Date().toISOString(),
          dataStructureVersion: '2.0-legacy',
          totalAssets: Object.keys(filteredAssets).length,
          timeSeriesLength: processedData.length
        },
        timeSeries: processedData.map(period => ({
          timeDimension: {
            interval: period.timeInterval,
            intervalType: analysisConfig.intervalType,
            year: typeof period.timeInterval === 'string' && period.timeInterval.includes('-') ? 
              parseInt(period.timeInterval.split('-')[0]) : parseInt(period.timeInterval)
          },
          portfolio: {
            totalRevenue: period.total,
            contractedGreenRevenue: period.contractedGreen,
            contractedEnergyRevenue: period.contractedEnergy,
            merchantGreenRevenue: period.merchantGreen,
            merchantEnergyRevenue: period.merchantEnergy,
            totalVolume: period.totalGeneration,
            contractedPercentage: period.weightedGreenPercentage + period.weightedEnergyPercentage
          },
          assets: Object.keys(filteredAssets).reduce((acc, assetName) => {
            acc[assetName] = {
              revenue: {
                totalRevenue: (period[`${assetName} Contracted Green`] || 0) + 
                            (period[`${assetName} Contracted Energy`] || 0) + 
                            (period[`${assetName} Merchant Green`] || 0) + 
                            (period[`${assetName} Merchant Energy`] || 0),
                contractedGreenRevenue: period[`${assetName} Contracted Green`] || 0,
                contractedEnergyRevenue: period[`${assetName} Contracted Energy`] || 0,
                merchantGreenRevenue: period[`${assetName} Merchant Green`] || 0,
                merchantEnergyRevenue: period[`${assetName} Merchant Energy`] || 0
              }
            };
            return acc;
          }, {})
        }))
      });
      
      setPortfolioSummary(summary);
      
    } catch (error) {
      console.error('Legacy calculation error:', error);
    }
  };

  const calculateSummaryFromEnhanced = (results) => {
    if (!results.timeSeries || results.timeSeries.length === 0) {
      setPortfolioSummary({});
      return;
    }

    const totalRevenue = results.timeSeries.reduce((sum, period) => 
      sum + (period.portfolio?.totalRevenue || 0), 0
    );
    
    const totalContracted = results.timeSeries.reduce((sum, period) => 
      sum + ((period.portfolio?.contractedGreenRevenue || 0) + (period.portfolio?.contractedEnergyRevenue || 0)), 0
    );
    
    const totalMerchant = results.timeSeries.reduce((sum, period) => 
      sum + ((period.portfolio?.merchantGreenRevenue || 0) + (period.portfolio?.merchantEnergyRevenue || 0)), 0
    );

    const filteredAssets = displayConfig.selectedRegion === 'ALL' 
      ? assets 
      : Object.fromEntries(
          Object.entries(assets).filter(([key, asset]) => asset.state === displayConfig.selectedRegion)
        );

    const totalCapacity = Object.values(filteredAssets).reduce((sum, asset) => 
      sum + (parseFloat(asset.capacity) || 0), 0
    );

    setPortfolioSummary({
      totalRevenue,
      averageRevenue: totalRevenue / results.timeSeries.length,
      contractedPercentage: totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0,
      merchantPercentage: totalRevenue > 0 ? (totalMerchant / totalRevenue) * 100 : 0,
      totalCapacity,
      assetCount: Object.keys(filteredAssets).length
    });
  };

  const validateAssets = (assetsToValidate) => {
    const results = {};
    Object.values(assetsToValidate).forEach(asset => {
      const errors = [];
      const warnings = [];

      // Basic validations
      if (!asset.name) errors.push('Missing asset name');
      if (!asset.type) errors.push('Missing asset type');
      if (!asset.capacity || asset.capacity <= 0) errors.push('Invalid capacity');
      if (!asset.assetStartDate) errors.push('Missing start date');

      // Type-specific validations
      if (asset.type === 'storage') {
        if (!asset.volume || asset.volume <= 0) warnings.push('Missing storage volume');
      }

      // Contract validations
      if (!asset.contracts || asset.contracts.length === 0) {
        warnings.push('No contracts - merchant revenue only');
      }

      results[asset.name] = {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    });
    
    setValidationResults(results);
  };

  const saveAnalysisConfiguration = async () => {
    try {
      // Save configuration to portfolio
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          portfolioId: currentPortfolio.portfolioId,
          portfolioName,
          assets,
          constants: {
            ...constants,
            revenueAnalysisConfig: analysisConfig,
            revenueDisplayConfig: displayConfig
          }
        })
      });

      if (response.ok) {
        setHasUnsavedChanges(false);
        console.log('Analysis configuration saved');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  const handleConfigChange = (configType, updates) => {
    if (configType === 'analysis') {
      setAnalysisConfig(prev => ({ ...prev, ...updates }));
    } else if (configType === 'display') {
      setDisplayConfig(prev => ({ ...prev, ...updates }));
    }
    setHasUnsavedChanges(true);
  };

  const toggleAssetVisibility = (assetName) => {
    setAssetVisibility(prev => ({
      ...prev,
      [assetName]: !prev[assetName]
    }));
  };

  const exportData = (format) => {
    if (!enhancedResults) return;

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        portfolioName,
        analysisConfig,
        displayConfig
      },
      results: enhancedResults
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${portfolioName}-revenue-analysis.json`;
      a.click();
    } else if (format === 'csv') {
      // Generate CSV
      const csvData = enhancedResults.timeSeries.map(period => ({
        Period: period.timeDimension.interval,
        'Total Revenue ($M)': (period.portfolio?.totalRevenue || 0).toFixed(2),
        'Contracted Green ($M)': (period.portfolio?.contractedGreenRevenue || 0).toFixed(2),
        'Contracted Energy ($M)': (period.portfolio?.contractedEnergyRevenue || 0).toFixed(2),
        'Merchant Green ($M)': (period.portfolio?.merchantGreenRevenue || 0).toFixed(2),
        'Merchant Energy ($M)': (period.portfolio?.merchantEnergyRevenue || 0).toFixed(2)
      }));

      const csv = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${portfolioName}-revenue-analysis.csv`;
      a.click();
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!enhancedResults?.timeSeries) return [];

    return enhancedResults.timeSeries.map(period => {
      const data = {
        period: period.timeDimension.interval,
        year: period.timeDimension.year
      };

      if (displayConfig.revenueFilter === 'all') {
        data.contractedGreen = period.portfolio?.contractedGreenRevenue || 0;
        data.contractedEnergy = period.portfolio?.contractedEnergyRevenue || 0;
        data.merchantGreen = period.portfolio?.merchantGreenRevenue || 0;
        data.merchantEnergy = period.portfolio?.merchantEnergyRevenue || 0;
        data.total = (period.portfolio?.totalRevenue || 0);
      } else if (displayConfig.revenueFilter === 'energy') {
        data.contracted = (period.portfolio?.contractedEnergyRevenue || 0);
        data.merchant = (period.portfolio?.merchantEnergyRevenue || 0);
        data.total = data.contracted + data.merchant;
      } else if (displayConfig.revenueFilter === 'green') {
        data.contracted = (period.portfolio?.contractedGreenRevenue || 0);
        data.merchant = (period.portfolio?.merchantGreenRevenue || 0);
        data.total = data.contracted + data.merchant;
      }

      return data;
    });
  }, [enhancedResults, displayConfig.revenueFilter]);

  // Calculate max revenue for fixed Y-axis
  const maxRevenue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const maxValue = Math.max(...chartData.map(d => d.total || 0));
    return Math.ceil(maxValue * 1.1);
  }, [chartData]);

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

  const filteredAssets = displayConfig.selectedRegion === 'ALL' 
    ? assets 
    : Object.fromEntries(
        Object.entries(assets).filter(([key, asset]) => asset.state === displayConfig.selectedRegion)
      );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Revenue Analysis</h1>
          <p className="text-gray-600">Advanced portfolio revenue modeling with comprehensive analytics</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {
              displayConfig.selectedRegion === 'ALL' 
                ? `${Object.keys(assets).length} assets (All Regions)` 
                : `${Object.values(assets).filter(asset => asset.state === displayConfig.selectedRegion).length} assets (${displayConfig.selectedRegion})`
            } • Price Source: {priceSource}
            {escalationSettings.enabled && ` • Escalation: ${escalationSettings.rate}% p.a.`}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => calculateEnhancedRevenue()}
            disabled={calculating}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
            <span>{calculating ? 'Calculating...' : 'Recalculate'}</span>
          </button>
          
          <div className="relative">
            <select
              onChange={(e) => exportData(e.target.value)}
              className="p-2 border border-gray-300 rounded-md text-sm"
              defaultValue=""
            >
              <option value="" disabled>Export</option>
              <option value="csv">Export CSV</option>
              <option value="json">Export JSON</option>
            </select>
          </div>
        </div>
      </div>

      {/* Enhanced Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Analysis Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Interval Type</label>
            <select
              value={analysisConfig.intervalType}
              onChange={(e) => handleConfigChange('analysis', { intervalType: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Year</label>
            <select
              value={analysisConfig.startYear}
              onChange={(e) => handleConfigChange('analysis', { startYear: parseInt(e.target.value) })}
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
              value={analysisConfig.periods}
              onChange={(e) => handleConfigChange('analysis', { periods: parseInt(e.target.value) })}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Scenario</label>
            <select
              value={analysisConfig.scenario}
              onChange={(e) => handleConfigChange('analysis', { scenario: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="base">Base Case</option>
              <option value="worst">Worst Case</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Filter</label>
            <select
              value={displayConfig.revenueFilter}
              onChange={(e) => handleConfigChange('display', { revenueFilter: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Revenue</option>
              <option value="energy">Energy Only</option>
              <option value="green">Green Only</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Region Focus</label>
            <select
              value={displayConfig.selectedRegion}
              onChange={(e) => handleConfigChange('display', { selectedRegion: e.target.value })}
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

      {/* Enhanced Revenue Projections Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Enhanced Revenue Projections - {
                displayConfig.revenueFilter === 'all' ? 'All Revenue' :
                displayConfig.revenueFilter === 'energy' ? 'Energy Revenue Only' :
                'Green Revenue Only'
              }
            </h3>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleConfigChange('display', { chartType: displayConfig.chartType === 'area' ? 'line' : 'area' })}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {displayConfig.chartType === 'area' ? 'Line Chart' : 'Area Chart'}
              </button>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={400}>
            {displayConfig.chartType === 'area' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period"
                  angle={analysisConfig.intervalType === 'monthly' ? -45 : 0}
                  textAnchor={analysisConfig.intervalType === 'monthly' ? 'end' : 'middle'}
                  height={analysisConfig.intervalType === 'monthly' ? 80 : 60}
                />
                <YAxis 
                  domain={[0, maxRevenue]}
                  tickFormatter={(value) => `${value}M`}
                />
                <Tooltip 
                  formatter={(value, name) => [`$${value.toFixed(2)}M`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                {displayConfig.revenueFilter === 'all' ? (
                  <>
                    <Area type="monotone" dataKey="contractedGreen" stackId="1" stroke="#10B981" fill="#10B981" name="Contracted Green" />
                    <Area type="monotone" dataKey="contractedEnergy" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Contracted Energy" />
                    <Area type="monotone" dataKey="merchantGreen" stackId="1" stroke="#F59E0B" fill="#F59E0B" name="Merchant Green" />
                    <Area type="monotone" dataKey="merchantEnergy" stackId="1" stroke="#EF4444" fill="#EF4444" name="Merchant Energy" />
                  </>
                ) : (
                  <>
                    <Area type="monotone" dataKey="contracted" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Contracted" />
                    <Area type="monotone" dataKey="merchant" stackId="1" stroke="#F59E0B" fill="#F59E0B" name="Merchant" />
                  </>
                )}
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period"
                  angle={analysisConfig.intervalType === 'monthly' ? -45 : 0}
                  textAnchor={analysisConfig.intervalType === 'monthly' ? 'end' : 'middle'}
                  height={analysisConfig.intervalType === 'monthly' ? 80 : 60}
                />
                <YAxis 
                  domain={[0, maxRevenue]}
                  tickFormatter={(value) => `${value}M`}
                />
                <Tooltip 
                  formatter={(value, name) => [`$${value.toFixed(2)}M`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={3} name="Total Revenue" />
                {displayConfig.revenueFilter === 'all' && (
                  <>
                    <Line type="monotone" dataKey="contractedGreen" stroke="#3B82F6" strokeWidth={2} name="Contracted Green" />
                    <Line type="monotone" dataKey="contractedEnergy" stroke="#F59E0B" strokeWidth={2} name="Contracted Energy" />
                    <Line type="monotone" dataKey="merchantGreen" stroke="#EF4444" strokeWidth={2} name="Merchant Green" />
                    <Line type="monotone" dataKey="merchantEnergy" stroke="#8B5CF6" strokeWidth={2} name="Merchant Energy" />
                  </>
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset Visibility Controls */}
      {Object.keys(filteredAssets).length > 1 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Asset Visibility Controls
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.values(filteredAssets).map(asset => {
              const validation = validationResults[asset.name];
              const getAssetIcon = (type) => {
                switch (type) {
                  case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
                  case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
                  case 'storage': return <Battery className="w-4 h-4 text-green-500" />;
                  default: return <Zap className="w-4 h-4 text-gray-500" />;
                }
              };

              return (
                <div key={asset.name} className="flex items-center space-x-2 p-2 border rounded-lg">
                  <button
                    onClick={() => toggleAssetVisibility(asset.name)}
                    className={`p-1 rounded ${assetVisibility[asset.name] ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {assetVisibility[asset.name] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  
                  {getAssetIcon(asset.type)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{asset.name}</div>
                    <div className="text-xs text-gray-500">{asset.capacity}MW • {asset.type}</div>
                  </div>
                  
                  {validation && !validation.isValid && (
                    <AlertCircle className="w-4 h-4 text-red-500" title={validation.errors.join(', ')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enhanced Status Information */}
      <div className={`border rounded-lg p-4 ${calculating ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {calculating ? (
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            <span className={`font-medium ${calculating ? 'text-blue-800' : 'text-green-800'}`}>
              {calculating ? 
                'Enhanced revenue calculation in progress...' : 
                'Enhanced revenue analysis with automatic recalculation'
              }
            </span>
          </div>
          
          <div className={`text-sm ${calculating ? 'text-blue-600' : 'text-green-600'}`}>
            {enhancedResults && (
              <>
                Analysis: {analysisConfig.intervalType} • Scenario: {analysisConfig.scenario} • 
                Period: {analysisConfig.periods} {analysisConfig.intervalType === 'annual' ? 'years' : 'periods'} • 
                Data Version: {enhancedResults.metadata?.dataStructureVersion || 'Enhanced'}
              </>
            )}
          </div>
        </div>
        
        {calculating && (
          <div className="mt-2">
            <div className="text-xs text-blue-700">
              Using enhanced backend calculations with automatic stress testing and comprehensive analysis...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}