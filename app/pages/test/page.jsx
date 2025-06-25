'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { useSaveContext } from '../../layout';
import { 
  Building2, 
  Calendar,
  DollarSign,
  Download,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Sun,
  Wind,
  Battery,
  Zap,
  TrendingUp,
  BarChart3,
  Settings,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function EnhancedAssetDetailPage() {
  const { currentUser, currentPortfolio } = useUser();
  const { escalationSettings, getMerchantPrice } = useMerchantPrices();
  const { setHasUnsavedChanges } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('');
  
  // Enhanced analysis results
  const [enhancedResults, setEnhancedResults] = useState(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [errorState, setErrorState] = useState(null);
  
  // Configuration
  const [analysisConfig, setAnalysisConfig] = useState({
    intervalType: 'annual',
    startYear: new Date().getFullYear(),
    periods: 30,
    includeProjectFinance: true,
    includeSensitivity: true,
    scenario: 'base'
  });

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Set first asset as selected
  useEffect(() => {
    if (Object.keys(assets).length > 0 && !selectedAsset) {
      const firstAsset = Object.values(assets)[0];
      setSelectedAsset(firstAsset?.name);
    }
  }, [assets, selectedAsset]);

  // Calculate enhanced analysis when data changes
  useEffect(() => {
    if (Object.keys(assets).length > 0 && selectedAsset) {
      calculateEnhancedAnalysis();
    }
  }, [selectedAsset, analysisConfig, escalationSettings]);

  // Debug logging
  useEffect(() => {
    console.log('Enhanced Results:', enhancedResults);
    console.log('Portfolio Analysis:', portfolioAnalysis);
    console.log('Selected Asset:', selectedAsset);
    console.log('Escalation Settings:', escalationSettings);
    console.log('Merchant Price Function Available:', !!getMerchantPrice);
    
    // Test merchant price function
    if (selectedAsset && assets[selectedAsset]) {
      const asset = Object.values(assets).find(a => a.name === selectedAsset);
      if (asset && getMerchantPrice) {
        const testYear = new Date().getFullYear();
        const testGreenPrice = getMerchantPrice(asset.type, 'green', asset.state, testYear);
        const testEnergyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, testYear);
        console.log(`Test Merchant Prices for ${asset.name} (${asset.type}, ${asset.state}) in ${testYear}:`, {
          green: testGreenPrice,
          energy: testEnergyPrice
        });
      }
    }
  }, [enhancedResults, portfolioAnalysis, selectedAsset, escalationSettings, getMerchantPrice, assets]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    setErrorState(null);
    
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        setAssets(portfolioData.assets || {});
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
        // Update analysis config start year based on portfolio
        if (portfolioData.assets && Object.keys(portfolioData.assets).length > 0) {
          const earliestYear = Math.min(
            ...Object.values(portfolioData.assets).map(asset => 
              new Date(asset.assetStartDate).getFullYear()
            )
          );
          setAnalysisConfig(prev => ({
            ...prev,
            startYear: Math.max(earliestYear, new Date().getFullYear())
          }));
        }
        
      } else if (response.status === 404) {
        setAssets({});
        setErrorState('Portfolio not found');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
      setErrorState('Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const calculateEnhancedAnalysis = async () => {
    if (!selectedAsset || !currentUser || !currentPortfolio) return;
    
    setCalculating(true);
    setErrorState(null);
    
    try {
      console.log('Starting enhanced portfolio analysis...');
      console.log('Current escalation settings:', escalationSettings);
      
      // Call the enhanced portfolio analysis API
      const analysisResponse = await fetch('/api/portfolio-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          portfolioId: currentPortfolio.portfolioId,
          analysisConfig: {
            ...analysisConfig,
            // Add escalation settings to the analysis
            escalationSettings: escalationSettings,
            // Also pass merchant price test data for debugging
            debugMode: true
          }
        }),
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const analysisResults = await analysisResponse.json();
      console.log('Enhanced analysis completed:', analysisResults);
      
      // Debug the time series data structure
      if (analysisResults.timeSeries && analysisResults.timeSeries.length > 0) {
        console.log('Sample time series data:', analysisResults.timeSeries[0]);
        console.log('Sample asset data:', analysisResults.timeSeries[0]?.assets?.[selectedAsset]);
      }
      
      setPortfolioAnalysis(analysisResults);
      
      // Extract asset-specific results from the correct structure
      if (analysisResults.projectFinance?.assetFinance?.[selectedAsset]) {
        const assetFinanceData = analysisResults.projectFinance.assetFinance[selectedAsset];
        setEnhancedResults(assetFinanceData);
        console.log('Set enhanced results for', selectedAsset, ':', assetFinanceData);
      } else {
        console.log('No project finance data found for asset:', selectedAsset);
        console.log('Available assets:', Object.keys(analysisResults.projectFinance?.assetFinance || {}));
        setEnhancedResults(null);
      }
      
    } catch (error) {
      console.error('Enhanced analysis error:', error);
      setErrorState(`Analysis failed: ${error.message}`);
    } finally {
      setCalculating(false);
    }
  };

  // Asset summary metrics using enhanced results
  const assetSummaryMetrics = useMemo(() => {
    if (!selectedAsset || !enhancedResults || !assets) return null;

    const asset = Object.values(assets).find(a => a.name === selectedAsset);
    if (!asset) return null;

    const results = enhancedResults;
    console.log('Building summary metrics from results:', results);
    
    return {
      // Basic asset info
      assetName: asset.name,
      assetType: asset.type,
      capacity: parseFloat(asset.capacity) || 0,
      state: asset.state || 'N/A',
      assetStartDate: asset.assetStartDate,
      
      // Enhanced financial metrics - fix the data access paths
      totalCapex: results.capitalStructure?.totalCapex || results.capex || 0,
      calculatedGearing: results.capitalStructure?.calculatedGearing || results.calculatedGearing || 0,
      equityAmount: results.capitalStructure?.equityAmount || 
                   ((results.capitalStructure?.totalCapex || results.capex || 0) * 
                    (1 - (results.capitalStructure?.calculatedGearing || results.calculatedGearing || 0))),
      debtAmount: results.capitalStructure?.debtAmount || results.debtAmount || 0,
      
      // Enhanced debt metrics - fix the data access paths
      minDSCR: results.debtAnalysis?.minDSCR || results.minDSCR || null,
      avgDebtService: results.debtAnalysis?.averageDebtService || results.avgDebtService || 0,
      debtStructure: results.debtAnalysis?.structure || results.debtStructure || 'sculpting',
      tenorYears: results.debtAnalysis?.tenorYears || results.tenorYears || 20,
      interestRate: results.debtAnalysis?.interestRate || (results.interestRate * 100) || 6.0,
      
      // Enhanced equity metrics - fix the data access paths
      equityIRR: results.returns?.equityIRR || results.equityIRR || null,
      equityNPV: results.returns?.equityNPV || results.equityNPV || 0,
      projectIRR: results.returns?.projectIRR || results.projectIRR || null,
      paybackPeriod: results.returns?.paybackPeriod || results.paybackPeriod || null,
      
      // Enhanced operating metrics - fix the data access paths
      totalRevenue: results.operatingMetrics?.totalRevenue || 
                   (results.cashFlowAnalysis ? results.cashFlowAnalysis.reduce((sum, cf) => sum + (cf.revenue || 0), 0) : 0),
      totalOpex: results.operatingMetrics?.totalOpex || 
                (results.cashFlowAnalysis ? results.cashFlowAnalysis.reduce((sum, cf) => sum + Math.abs(cf.opex || 0), 0) : 0),
      averageEBITDA: results.operatingMetrics?.averageEBITDA || 
                    (results.cashFlowAnalysis ? 
                     results.cashFlowAnalysis.reduce((sum, cf) => sum + (cf.operatingCashFlow || 0), 0) / results.cashFlowAnalysis.length : 0),
      terminalValue: results.operatingMetrics?.terminalValue || results.terminalValue || 0,
      
      // Enhanced construction metrics - fix the data access paths
      equityTimingUpfront: results.equityAnalysis?.timingStructure === 'upfront' || results.equityTimingUpfront !== false,
      constructionDuration: results.equityAnalysis?.constructionDuration || results.constructionDuration || 12,
      
      // Contract info
      contractCount: asset.contracts?.length || 0,
      hasContracts: (asset.contracts?.length || 0) > 0
    };
  }, [selectedAsset, enhancedResults, assets]);

  // Helper functions for time period display and volume calculation
  const generateTimePeriodLabel = (year, intervalType, index) => {
    switch (intervalType) {
      case 'quarterly':
        const quarter = (index % 4) + 1;
        return `${year}-Q${quarter}`;
      case 'monthly':
        const month = (index % 12) + 1;
        return `${year}-${month.toString().padStart(2, '0')}`;
      default:
        return year.toString();
    }
  };

  const calculateVolumeForPeriod = (year, index) => {
    // FIXED: Try to get volume from enhanced portfolio analysis time series
    if (portfolioAnalysis?.timeSeries) {
      const timePeriod = portfolioAnalysis.timeSeries.find(ts => ts.timeDimension?.year === year);
      if (timePeriod?.assets?.[selectedAsset]) {
        const assetData = timePeriod.assets[selectedAsset];
        
        // Check multiple possible volume field locations from enhanced structure
        const volume = assetData.volume?.adjustedVolume || 
                      assetData.legacy?.annualGeneration ||
                      assetData.volume?.baseAnnualGeneration ||
                      assetData.volume?.basePeriodGeneration ||
                      0;
                      
        console.log(`Volume lookup for ${selectedAsset} year ${year}:`, {
          adjustedVolume: assetData.volume?.adjustedVolume,
          annualGeneration: assetData.legacy?.annualGeneration,
          baseAnnualGeneration: assetData.volume?.baseAnnualGeneration,
          finalVolume: volume
        });
        
        if (volume > 0) {
          return volume; // Already in MWh from backend
        }
      }
    }
    
    // FIXED: Enhanced fallback calculation using asset quarterly capacity factors
    const asset = Object.values(assets).find(a => a.name === selectedAsset);
    if (asset) {
      const capacity = parseFloat(asset.capacity) || 0;
      const HOURS_IN_YEAR = 8760;
      const degradation = parseFloat(asset.annualDegradation) || 0.5;
      const degradationFactor = Math.pow(1 - degradation/100, index);
      const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 95;
      
      // FIXED: Use enhanced capacity factor logic
      let capacityFactor = 0.25; // Default
      
      // Try to get quarterly capacity factors and average them
      const quarters = ['q1', 'q2', 'q3', 'q4'];
      const availableFactors = quarters
        .map(q => asset[`qtrCapacityFactor_${q}`])
        .filter(factor => factor !== undefined && factor !== '' && factor !== null)
        .map(factor => parseFloat(factor) / 100);
      
      if (availableFactors.length > 0) {
        capacityFactor = availableFactors.reduce((sum, f) => sum + f, 0) / availableFactors.length;
      } else {
        // Enhanced default capacity factors by technology and region
        const defaultFactors = {
          solar: { NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27, WA: 0.26, TAS: 0.23 },
          wind: { NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40, WA: 0.37, TAS: 0.42 }
        };
        capacityFactor = defaultFactors[asset.type]?.[asset.state] || 
                        (asset.type === 'solar' ? 0.25 : 0.35);
      }
      
      // FIXED: Proper volume calculation in MWh (no division by 1000)
      const baseVolume = capacity * HOURS_IN_YEAR * capacityFactor; // MWh
      const finalVolume = baseVolume * degradationFactor * (volumeLossAdjustment / 100);
      
      console.log(`Fallback volume calculation for ${selectedAsset}:`, {
        capacity,
        capacityFactor: (capacityFactor * 100).toFixed(1) + '%',
        baseVolume: baseVolume.toFixed(0),
        degradationFactor: degradationFactor.toFixed(4),
        volumeLossAdjustment: volumeLossAdjustment + '%',
        finalVolume: finalVolume.toFixed(0)
      });
      
      return finalVolume;
    }
    
    return 0;
  };

  // Utility functions
  const formatCurrency = (value) => {
    if (Math.abs(value) >= 1) {
      return `$${value.toFixed(1)}M`;
    } else {
      return `$${(value * 1000).toFixed(0)}K`;
    }
  };

  const formatPercent = (value) => `${value.toFixed(1)}%`;

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'storage': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const exportEnhancedData = () => {
    if (!selectedAsset || !enhancedResults) return;

    const csvData = [
      ['Phase', 'Time Period', 'Year Index', 'Volume (GWh)', 'Revenue ($M)', 'Contracted ($M)', 'Merchant ($M)', 'OPEX ($M)', 'Operating CF ($M)', 
       'Debt Service ($M)', 'DSCR', 'Equity CF ($M)', 'Terminal Value ($M)', 'Net CF ($M)']
    ];

    // Add construction phase cash flows
    if (assetSummaryMetrics?.equityTimingUpfront) {
      const constructionYear = enhancedResults.cashFlowAnalysis?.[0]?.year - 1 || 'Y0';
      const equityInvestment = assetSummaryMetrics.equityAmount;
      csvData.push([
        'Investment',
        constructionYear,
        -1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        '',
        -equityInvestment,
        0,
        -equityInvestment
      ]);
    }

    // Add operational cash flows
    if (enhancedResults.cashFlowAnalysis) {
      enhancedResults.cashFlowAnalysis.forEach((cf, index) => {
        const netCashFlow = cf.equityCashFlow + (cf.terminalValue || 0);
        // Calculate volume from the portfolio analysis if available
        const volume = calculateVolumeForPeriod(cf.year, index) / 1000; // Convert MWh to GWh
        
        // Get contracted and merchant revenue from portfolio analysis
        const timePeriod = portfolioAnalysis?.timeSeries?.find(ts => ts.timeDimension?.year === cf.year);
        const assetData = timePeriod?.assets?.[selectedAsset];
        const contractedRevenue = (assetData?.revenue?.contractedGreenRevenue || 0) + 
                                 (assetData?.revenue?.contractedEnergyRevenue || 0);
        const merchantRevenue = (assetData?.revenue?.merchantGreenRevenue || 0) + 
                               (assetData?.revenue?.merchantEnergyRevenue || 0);
        
        csvData.push([
          'Operations',
          generateTimePeriodLabel(cf.year, analysisConfig.intervalType, index),
          cf.yearIndex,
          volume.toFixed(1),
          cf.revenue.toFixed(2),
          contractedRevenue.toFixed(2),
          merchantRevenue.toFixed(2),
          Math.abs(cf.opex).toFixed(2),
          cf.operatingCashFlow.toFixed(2),
          Math.abs(cf.debtService || 0).toFixed(2),
          cf.dscr ? cf.dscr.toFixed(2) : '',
          cf.equityCashFlow.toFixed(2),
          (cf.terminalValue || 0).toFixed(2),
          netCashFlow.toFixed(2)
        ]);
      });
    }

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAsset}_enhanced_cashflows.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Loading states
  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Portfolio Selected</h3>
          <p className="text-gray-600">Please select a user and portfolio to analyze assets</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enhanced asset data...</p>
        </div>
      </div>
    );
  }

  if (Object.keys(assets).length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/pages/finance" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Finance</span>
          </Link>
          <div className="h-6 border-l border-gray-300"></div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Asset Analysis</h1>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-center text-gray-500 py-12">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No assets available for enhanced analysis</p>
            <p className="text-sm mt-2">Configure assets in the Asset Definition page</p>
            <Link href="/pages/assets" className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              Go to Asset Definition
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/pages/finance" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Finance</span>
          </Link>
          <div className="h-6 border-l border-gray-300"></div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Asset Analysis</h1>
          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            v3.0 Enhanced
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          Portfolio: {portfolioName} • {Object.keys(assets).length} assets
          {escalationSettings.enabled && (
            <span className="ml-2 text-blue-600">
              • Escalation: {escalationSettings.rate}% from {escalationSettings.referenceYear}
            </span>
          )}
          {getMerchantPrice && (
            <span className="ml-2 text-green-600">
              • Price Curves: Active
            </span>
          )}
        </div>
      </div>

      {/* Merchant Price Diagnostic Panel */}
      {selectedAsset && getMerchantPrice && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Settings className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-semibold text-yellow-800">Merchant Price Diagnostics</h3>
            <span className="text-xs text-yellow-600">(Debug Panel - Remove in Production)</span>
          </div>
          
          {(() => {
            const asset = Object.values(assets).find(a => a.name === selectedAsset);
            if (!asset) return null;
            
            const currentYear = new Date().getFullYear();
            const testYears = [currentYear, currentYear + 5, currentYear + 10];
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {testYears.map(year => {
                  const greenPrice = getMerchantPrice(asset.type, 'green', asset.state, year);
                  const energyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, year);
                  
                  return (
                    <div key={year} className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900 mb-2">Year {year}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Green:</span>
                          <span className="font-medium">${greenPrice?.toFixed(2) || 'N/A'}/MWh</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Energy:</span>
                          <span className="font-medium">${energyPrice?.toFixed(2) || 'N/A'}/MWh</span>
                        </div>
                        <div className="flex justify-between text-blue-600">
                          <span>Total:</span>
                          <span className="font-medium">${((greenPrice || 0) + (energyPrice || 0)).toFixed(2)}/MWh</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          
          <div className="mt-3 text-xs text-yellow-700">
            <strong>Asset:</strong> {selectedAsset} ({Object.values(assets).find(a => a.name === selectedAsset)?.type}, {Object.values(assets).find(a => a.name === selectedAsset)?.state})
            <br />
            <strong>Escalation:</strong> {escalationSettings.enabled ? `${escalationSettings.rate}% from ${escalationSettings.referenceYear}` : 'Disabled'}
          </div>
        </div>
      )}

      {/* Enhanced Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Enhanced Analysis Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.values(assets).map(asset => (
                <option key={asset.name} value={asset.name}>
                  {asset.name} ({asset.type}, {asset.capacity}MW)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interval Type</label>
            <select
              value={analysisConfig.intervalType}
              onChange={(e) => setAnalysisConfig(prev => ({...prev, intervalType: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Period</label>
            <select
              value={analysisConfig.periods}
              onChange={(e) => setAnalysisConfig(prev => ({...prev, periods: parseInt(e.target.value)}))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={15}>15 Years</option>
              <option value={20}>20 Years</option>
              <option value={25}>25 Years</option>
              <option value={30}>30 Years</option>
              <option value={35}>35 Years</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={exportEnhancedData}
              disabled={!enhancedResults || calculating}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Export Enhanced CSV</span>
            </button>
          </div>
        </div>

        {calculating && (
          <div className="mt-4 flex items-center space-x-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Running enhanced calculations...</span>
          </div>
        )}

        {errorState && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Analysis Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{errorState}</p>
          </div>
        )}
      </div>

      {/* Enhanced Asset Summary */}
      {assetSummaryMetrics && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            {getAssetIcon(assetSummaryMetrics.assetType)}
            <h3 className="text-lg font-semibold">{assetSummaryMetrics.assetName} - Enhanced Analysis</h3>
            <span className="text-sm text-gray-500">({assetSummaryMetrics.assetType} • {assetSummaryMetrics.state})</span>
            {assetSummaryMetrics.equityIRR && (
              <div className="ml-4 text-sm text-blue-600 font-medium">
                Equity IRR: {formatPercent(assetSummaryMetrics.equityIRR)}
              </div>
            )}
          </div>
          
          {/* Enhanced KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{assetSummaryMetrics.capacity}MW</p>
              <p className="text-xs text-gray-600">Capacity</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-900">{formatCurrency(assetSummaryMetrics.totalCapex)}</p>
              <p className="text-xs text-blue-600">Total CAPEX</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-900">{formatPercent(assetSummaryMetrics.calculatedGearing * 100)}</p>
              <p className="text-xs text-purple-600">Optimal Gearing</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-900">
                {assetSummaryMetrics.equityIRR ? formatPercent(assetSummaryMetrics.equityIRR) : 'N/A'}
              </p>
              <p className="text-xs text-green-600">Equity IRR</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-lg font-bold text-orange-900">
                {assetSummaryMetrics.projectIRR ? formatPercent(assetSummaryMetrics.projectIRR) : 'N/A'}
              </p>
              <p className="text-xs text-orange-600">Project IRR</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-900">{formatCurrency(assetSummaryMetrics.totalRevenue)}</p>
              <p className="text-xs text-yellow-600">Total Revenue</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-900">
                {assetSummaryMetrics.minDSCR ? `${assetSummaryMetrics.minDSCR.toFixed(2)}x` : 'N/A'}
              </p>
              <p className="text-xs text-red-600">Min DSCR</p>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <p className="text-lg font-bold text-indigo-900">
                {assetSummaryMetrics.paybackPeriod ? `${assetSummaryMetrics.paybackPeriod}y` : 'N/A'}
              </p>
              <p className="text-xs text-indigo-600">Payback</p>
            </div>
          </div>

          {/* Enhanced Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                <Building2 className="w-4 h-4" />
                <span>Capital Structure</span>
              </h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Equity Amount:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.equityAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Debt Amount:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.debtAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equity Timing:</span>
                  <span className="font-medium">{assetSummaryMetrics.equityTimingUpfront ? 'Upfront' : 'Progressive'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Construction:</span>
                  <span className="font-medium">{assetSummaryMetrics.constructionDuration} months</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span>Financial Returns</span>
              </h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Equity NPV:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.equityNPV)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg EBITDA:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.averageEBITDA)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal Value:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.terminalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total OPEX:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.totalOpex)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Debt Analysis</span>
              </h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Interest Rate:</span>
                  <span className="font-medium">{formatPercent(assetSummaryMetrics.interestRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tenor:</span>
                  <span className="font-medium">{assetSummaryMetrics.tenorYears} years</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Debt Service:</span>
                  <span className="font-medium">{formatCurrency(assetSummaryMetrics.avgDebtService)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contracts:</span>
                  <span className="flex items-center space-x-1">
                    {assetSummaryMetrics.hasContracts ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span className="font-medium">{assetSummaryMetrics.contractCount}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Cash Flow Analysis */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Enhanced Project Cash Flow Analysis</h3>
            <span className="text-sm text-blue-600">(Complete Investment Timeline)</span>
          </div>
          <div className="text-sm text-gray-500">
            {selectedAsset ? `Asset: ${selectedAsset}` : 'No asset selected'}
          </div>
        </div>

        {selectedAsset && enhancedResults ? (
          <div>
            {/* Enhanced Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(Math.abs(assetSummaryMetrics?.equityAmount || 0))}
                </p>
                <p className="text-sm text-red-600">Total Investment</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(assetSummaryMetrics?.totalRevenue || 0)}
                </p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(assetSummaryMetrics?.totalOpex || 0)}
                </p>
                <p className="text-sm text-gray-600">Total OPEX</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(assetSummaryMetrics?.equityNPV || 0)}
                </p>
                <p className="text-sm text-green-600">Equity NPV</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-900">
                  {formatCurrency(assetSummaryMetrics?.terminalValue || 0)}
                </p>
                <p className="text-sm text-orange-600">Terminal Value</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-900">
                  {assetSummaryMetrics?.equityIRR ? `${assetSummaryMetrics.equityIRR.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-sm text-purple-600">Equity IRR</p>
              </div>
            </div>

            {/* Enhanced Cash Flow Table WITH CONTRACTED AND MERCHANT COLUMNS */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Time Period</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Index</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Volume (GWh)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Revenue ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Contracted ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-yellow-50">Merchant ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">OPEX ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Operating CF ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Debt Service ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">DSCR</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Equity CF ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-orange-50">Terminal ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">Net CF ($M)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Construction Phase */}
                  {(() => {
                    const rows = [];
                    
                    // Add construction/investment phase
                    if (assetSummaryMetrics?.equityTimingUpfront) {
                      const constructionYear = enhancedResults.cashFlowAnalysis?.[0]?.year - 1 || 'Y0';
                      const equityInvestment = assetSummaryMetrics.equityAmount;
                      
                      rows.push(
                        <tr key="construction-0" className="border-b border-gray-100 hover:bg-red-25 bg-red-50">
                          <td className="py-2 px-2 font-medium text-gray-900">{constructionYear}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Investment</span>
                          </td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-green-25">-</td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-yellow-25">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-green-25 font-medium">
                            {formatCurrency(-Math.abs(equityInvestment))}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-orange-25">-</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-blue-25 font-medium">
                            {formatCurrency(-Math.abs(equityInvestment))}
                          </td>
                        </tr>
                      );
                    }
                    
                    // Add operational phase rows
                    if (enhancedResults.cashFlowAnalysis) {
                      enhancedResults.cashFlowAnalysis.slice(0, Math.min(30, analysisConfig.periods)).forEach((cf, index) => {
                        const netCashFlow = cf.equityCashFlow + (cf.terminalValue || 0);
                        const volume = calculateVolumeForPeriod(cf.year, index);
                        const timePeriodLabel = generateTimePeriodLabel(cf.year, analysisConfig.intervalType, index);
                        
                        // Get contracted and merchant revenue from portfolio analysis
                        const timePeriod = portfolioAnalysis?.timeSeries?.find(ts => ts.timeDimension?.year === cf.year);
                        const assetData = timePeriod?.assets?.[selectedAsset];
                        const contractedRevenue = (assetData?.revenue?.contractedGreenRevenue || 0) + 
                                                 (assetData?.revenue?.contractedEnergyRevenue || 0);
                        const merchantRevenue = (assetData?.revenue?.merchantGreenRevenue || 0) + 
                                               (assetData?.revenue?.merchantEnergyRevenue || 0);
                        
                        rows.push(
                          <tr key={`operational-${index}`} className="border-b border-gray-100 hover:bg-green-25">
                            <td className="py-2 px-2 font-medium text-gray-900">{timePeriodLabel}</td>
                            <td className="py-2 px-2">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Operations</span>
                            </td>
                            <td className="text-right py-2 px-2 text-blue-700">
                              {(volume / 1000).toFixed(1)}
                            </td>
                            <td className="text-right py-2 px-2 text-green-700">
                              {formatCurrency(cf.revenue || 0)}
                            </td>
                            <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                              {formatCurrency(contractedRevenue)}
                            </td>
                            <td className="text-right py-2 px-2 text-yellow-600 bg-yellow-25">
                              {formatCurrency(merchantRevenue)}
                            </td>
                            <td className="text-right py-2 px-2 text-red-600">
                              {formatCurrency(Math.abs(cf.opex || 0))}
                            </td>
                            <td className="text-right py-2 px-2 text-blue-700">
                              {formatCurrency(cf.operatingCashFlow || 0)}
                            </td>
                            <td className="text-right py-2 px-2 text-purple-600">
                              {cf.debtService ? formatCurrency(Math.abs(cf.debtService)) : '-'}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-700">
                              {cf.dscr ? `${cf.dscr.toFixed(2)}x` : '-'}
                            </td>
                            <td className={`text-right py-2 px-2 font-medium bg-green-25 ${
                              (cf.equityCashFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(cf.equityCashFlow || 0)}
                            </td>
                            <td className="text-right py-2 px-2 text-orange-600 bg-orange-25">
                              {cf.terminalValue ? formatCurrency(cf.terminalValue) : '-'}
                            </td>
                            <td className={`text-right py-2 px-2 font-bold bg-blue-25 ${
                              netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(netCashFlow)}
                            </td>
                          </tr>
                        );
                      });
                    }
                    
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>

            {/* Enhanced Analysis Notes */}
            <div className="mt-6 text-sm text-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Enhanced Features:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-blue-600">Auto-Optimized Gearing:</span> Maximum sustainable debt calculated</li>
                    <li>• <span className="text-green-600">Enhanced Escalation:</span> Price escalation from merchant context</li>
                    <li>• <span className="text-purple-600">Sculpted Debt:</span> DSCR-constrained debt service</li>
                    <li>• <span className="text-orange-600">Terminal Value:</span> Asset residual value included</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Revenue Breakdown:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-green-600">✓ Contracted Revenue:</span> Green + Energy contract revenue</li>
                    <li>• <span className="text-yellow-600">✓ Merchant Revenue:</span> Green + Energy merchant revenue</li>
                    <li>• <span className="text-blue-600">✓ Total Revenue:</span> Contracted + Merchant combined</li>
                    <li>• <span className="text-orange-600">✓ Real-time:</span> Live price curves and escalation</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 text-center text-blue-600 bg-blue-50 p-3 rounded">
                <strong>Enhanced Asset Analysis v3.0:</strong> Complete project timeline with detailed revenue breakdown showing contracted vs merchant revenue composition
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No enhanced analysis available for selected asset</p>
            <p className="text-sm">Configure analysis settings and run calculations</p>
          </div>
        )}
      </div>
    </div>
  );
}