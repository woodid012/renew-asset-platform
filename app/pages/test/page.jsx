'use client'

import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { useSaveContext } from '../../layout';
import { Calculator, TrendingUp, DollarSign, Clock, FileText, BarChart3 } from 'lucide-react';
import { calculateProjectMetrics, calculateIRR } from '@/app/components/ProjectFinance_Calcs';

export default function SingleAssetAnalysisPage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [projectMetrics, setProjectMetrics] = useState({});
  
  // Analysis configuration
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [analysisYears, setAnalysisYears] = useState(30);
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  const [showMonthlyDetail, setShowMonthlyDetail] = useState(false);

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Calculate metrics when dependencies change
  useEffect(() => {
    if (selectedAsset && Object.keys(assets).length > 0 && constants.assetCosts) {
      calculateSingleAssetMetrics();
    }
  }, [selectedAsset, assets, constants, selectedRevenueCase, analysisYears, includeTerminalValue]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        setAssets(portfolioData.assets || {});
        setConstants(portfolioData.constants || {});
        
        // Auto-select first asset
        const assetNames = Object.keys(portfolioData.assets || {});
        if (assetNames.length > 0) {
          setSelectedAsset(assetNames[0]);
        }
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSingleAssetMetrics = () => {
    try {
      // Create a single-asset portfolio for calculation
      const singleAssetPortfolio = {
        [selectedAsset]: assets[selectedAsset]
      };
      
      const metrics = calculateProjectMetrics(
        singleAssetPortfolio,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        true, // auto-solve gearing
        includeTerminalValue
      );
      
      setProjectMetrics(metrics);
    } catch (error) {
      console.error('Error calculating single asset metrics:', error);
      setProjectMetrics({});
    }
  };

  // Helper functions
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `$${value.toFixed(1)}M`;
  };

  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
          <p className="text-gray-600">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  const assetNames = Object.keys(assets);
  const selectedAssetData = assets[selectedAsset];
  const assetMetrics = projectMetrics[selectedAsset];

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Single Asset Analysis</h1>
          <p className="text-gray-600">Detailed financial analysis with monthly cash flow breakdown</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Asset</option>
            {assetNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedAsset && selectedAssetData && (
        <>
          {/* Asset Overview */}
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold">Asset Overview: {selectedAsset}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900 capitalize">{selectedAssetData.type}</p>
                <p className="text-sm text-gray-600">Asset Type</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{selectedAssetData.capacity}MW</p>
                <p className="text-sm text-gray-600">Capacity</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{selectedAssetData.state}</p>
                <p className="text-sm text-gray-600">Location</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{selectedAssetData.connectionYear || 'TBD'}</p>
                <p className="text-sm text-gray-600">Connection Year</p>
              </div>
            </div>

            {/* Configuration Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Scenario</label>
                <select
                  value={selectedRevenueCase}
                  onChange={(e) => setSelectedRevenueCase(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="base">Base Case</option>
                  <option value="worst">Combined Downside</option>
                  <option value="volume">Volume Stress</option>
                  <option value="price">Price Stress</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Period (Years)</label>
                <select
                  value={analysisYears}
                  onChange={(e) => setAnalysisYears(parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value={15}>15 Years</option>
                  <option value={20}>20 Years</option>
                  <option value={25}>25 Years</option>
                  <option value={30}>30 Years</option>
                  <option value={35}>35 Years</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="terminal-value"
                  checked={includeTerminalValue}
                  onChange={(e) => setIncludeTerminalValue(e.target.checked)}
                  className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="terminal-value" className="text-sm font-medium text-gray-700">
                  Include Terminal Value
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="monthly-detail"
                  checked={showMonthlyDetail}
                  onChange={(e) => setShowMonthlyDetail(e.target.checked)}
                  className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="monthly-detail" className="text-sm font-medium text-gray-700">
                  Monthly Detail
                </label>
              </div>
            </div>
          </div>

          {/* Financial Metrics */}
          {assetMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Equity IRR</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {assetMetrics.equityCashFlows && calculateIRR(assetMetrics.equityCashFlows) 
                        ? formatPercent(calculateIRR(assetMetrics.equityCashFlows)) 
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">{analysisYears}-Year Return</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total CAPEX</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(assetMetrics.capex)}
                    </p>
                    <p className="text-sm text-gray-500">Investment Required</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Debt Gearing</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercent(assetMetrics.calculatedGearing)}
                    </p>
                    <p className="text-sm text-gray-500">Debt/Total CAPEX</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Minimum DSCR</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDSCR(assetMetrics.minDSCR)}
                    </p>
                    <p className="text-sm text-gray-500">Debt Coverage</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-full">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Cash Flow Table Component will go here */}
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold">
                {showMonthlyDetail ? 'Monthly' : 'Annual'} Cash Flow Analysis
              </h3>
            </div>
            
            <div className="text-center text-gray-500 py-8">
              <p>Detailed cash flow table component will be created next</p>
              <p className="text-sm">This will show all variables from construction to terminal value</p>
            </div>
          </div>
        </>
      )}

      {!selectedAsset && (
        <div className="bg-white rounded-lg shadow border p-6 text-center">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Asset</h3>
          <p className="text-gray-600">Choose an asset from the dropdown to see detailed analysis</p>
        </div>
      )}
    </div>
  );
}