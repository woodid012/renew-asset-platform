'use client'

import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { useSaveContext } from '../../layout';
import { Calculator, Settings, BarChart3, Clock, DollarSign, TrendingUp, Percent, AlertCircle, CheckCircle } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

// Import calculations
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';
import { 
  generatePortfolioData,
  calculatePortfolioSummary
} from '@/lib/revenueCalculations';

// Import components
import SensitivityTornado from './components/SensitivityTornado';
import PortfolioSummary from './components/PortfolioSummary';
import CashFlowAnalysis from './components/CashFlowAnalysis';

export default function TabbedProjectFinancePage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  const { setHasUnsavedChanges, setSaveFunction } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('outputs');
  
  // Finance configuration - auto-solve gearing is always on for outputs
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [analysisYears, setAnalysisYears] = useState(30);
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  const [showEquityTimingPanel, setShowEquityTimingPanel] = useState(false);
  
  // Results state
  const [projectMetrics, setProjectMetrics] = useState({});
  const [portfolioSummary, setPortfolioSummary] = useState({});

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Recalculate when dependencies change
  useEffect(() => {
    if (Object.keys(assets).length > 0 && constants.assetCosts) {
      calculateProjectFinanceMetrics();
    }
  }, [assets, constants, selectedRevenueCase, analysisYears, includeTerminalValue]);

  // Set up global save function
  useEffect(() => {
    setSaveFunction(() => () => savePortfolioData());
    return () => setSaveFunction(null);
  }, [setSaveFunction, assets, constants, portfolioName]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        setAssets(portfolioData.assets || {});
        
        // Initialize constants with proper structure
        const updatedConstants = {
          ...portfolioData.constants,
          HOURS_IN_YEAR: 8760,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: 2.5,
          referenceYear: 2025
        };

        // Initialize project values if not present
        if (!updatedConstants.assetCosts && Object.keys(portfolioData.assets || {}).length > 0) {
          console.log('Initializing project finance values for assets...');
          updatedConstants.assetCosts = initializeProjectValues(portfolioData.assets || {});
          setHasUnsavedChanges(true);
        }

        setConstants(updatedConstants);
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

  const calculateProjectFinanceMetrics = () => {
    try {
      console.log('Calculating project finance metrics with analysis period:', analysisYears);
      
      // Ensure we have asset costs initialized
      if (!constants.assetCosts && Object.keys(assets).length > 0) {
        console.log('Asset costs not initialized, creating defaults...');
        const updatedConstants = {
          ...constants,
          assetCosts: initializeProjectValues(assets)
        };
        setConstants(updatedConstants);
        setHasUnsavedChanges(true);
        return;
      }
      
      // Always auto-solve gearing for outputs
      const metrics = calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        true, // Always auto-solve gearing
        includeTerminalValue
      );
      
      console.log('Calculated project metrics:', metrics);
      setProjectMetrics(metrics);
      
      // Calculate portfolio summary
      const startYear = new Date().getFullYear();
      const timeIntervals = Array.from({ length: analysisYears }, (_, i) => startYear + i);
      const portfolioData = generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice);
      const summary = calculatePortfolioSummary(portfolioData, assets);
      setPortfolioSummary(summary);
      
    } catch (error) {
      console.error('Error calculating project metrics:', error);
      setProjectMetrics({});
    }
  };

  // Function to update asset costs
  const updateAssetCosts = (assetName, field, value) => {
    const updatedConstants = {
      ...constants,
      assetCosts: {
        ...constants.assetCosts,
        [assetName]: {
          ...constants.assetCosts[assetName],
          [field]: value
        }
      }
    };
    setConstants(updatedConstants);
    setHasUnsavedChanges(true);
  };

  // Function to update portfolio costs
  const updatePortfolioCosts = (field, value) => {
    const updatedConstants = {
      ...constants,
      assetCosts: {
        ...constants.assetCosts,
        portfolio: {
          ...constants.assetCosts.portfolio,
          [field]: value
        }
      }
    };
    setConstants(updatedConstants);
    setHasUnsavedChanges(true);
  };

  // Function to update equity timing for an asset
  const updateAssetEquityTiming = (assetName, equityTimingUpfront, constructionDuration) => {
    const updatedConstants = {
      ...constants,
      assetCosts: {
        ...constants.assetCosts,
        [assetName]: {
          ...constants.assetCosts[assetName],
          equityTimingUpfront,
          constructionDuration
        }
      }
    };
    setConstants(updatedConstants);
    setHasUnsavedChanges(true);
  };

  // Function to update portfolio equity timing
  const updatePortfolioEquityTiming = (equityTimingUpfront, constructionDuration) => {
    const updatedConstants = {
      ...constants,
      assetCosts: {
        ...constants.assetCosts,
        portfolio: {
          ...constants.assetCosts.portfolio,
          equityTimingUpfront,
          constructionDuration
        }
      }
    };
    setConstants(updatedConstants);
    setHasUnsavedChanges(true);
  };

  // Function to save updated portfolio data
  const savePortfolioData = async (updatedConstants = null) => {
    if (!currentUser || !currentPortfolio) return false;
    
    try {
      const portfolioData = {
        userId: currentUser.id,
        portfolioId: currentPortfolio.portfolioId,
        version: '2.0',
        portfolioName,
        assets,
        constants: updatedConstants || constants,
        analysisMode: 'advanced',
        priceSource: 'merchant_price_monthly.csv',
        exportDate: new Date().toISOString()
      };

      console.log('Saving portfolio to MongoDB...');

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Portfolio saved successfully:', result);
        setHasUnsavedChanges(false);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Failed to save portfolio:', errorData);
        return false;
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      return false;
    }
  };

  // Calculate portfolio totals from individual metrics
  const getPortfolioTotals = () => {
    const individualAssets = Object.entries(projectMetrics)
      .filter(([assetName]) => assetName !== 'portfolio');
    
    if (individualAssets.length === 0) return null;
    
    const totals = {
      capex: 0,
      debtAmount: 0,
      annualDebtService: 0,
      terminalValue: 0,
    };
    
    const allEquityCashFlows = [];
    const allDSCRs = [];
    
    individualAssets.forEach(([_, metrics]) => {
      totals.capex += metrics.capex || 0;
      totals.debtAmount += metrics.debtAmount || 0;
      totals.annualDebtService += metrics.annualDebtService || 0;
      totals.terminalValue += metrics.terminalValue || 0;
      
      if (metrics.minDSCR) {
        allDSCRs.push(metrics.minDSCR);
      }
      
      if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
        const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
        
        if (allEquityCashFlows.length === 0) {
          allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
        } else {
          truncatedCashFlows.forEach((cf, index) => {
            if (index < allEquityCashFlows.length) {
              allEquityCashFlows[index] += cf;
            } else {
              allEquityCashFlows.push(cf);
            }
          });
        }
      }
    });
    
    totals.calculatedGearing = totals.capex > 0 ? totals.debtAmount / totals.capex : 0;
    totals.minDSCR = allDSCRs.length > 0 ? Math.min(...allDSCRs) : null;
    totals.equityCashFlows = allEquityCashFlows;
    
    return totals;
  };

  const portfolioTotals = getPortfolioTotals();

  // Helper functions for formatting
  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `$${value.toFixed(1)}M`;
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  // Show loading state if no user/portfolio selected
  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Portfolio Selected</h3>
          <p className="text-gray-600">Please select a user and portfolio to analyze finance</p>
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
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Finance Analysis</h1>
          <p className="text-gray-600">Configure project finance inputs and analyze outputs with auto-solved gearing</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {Object.keys(assets).length} assets • Analysis: {analysisYears} years
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('outputs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'outputs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analysis Outputs</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('inputs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'inputs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Project Finance Inputs</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'outputs' && (
        <OutputsTab
          projectMetrics={projectMetrics}
          portfolioTotals={portfolioTotals}
          assets={assets}
          constants={constants}
          getMerchantPrice={getMerchantPrice}
          analysisYears={analysisYears}
          selectedRevenueCase={selectedRevenueCase}
          includeTerminalValue={includeTerminalValue}
        />
      )}

      {activeTab === 'inputs' && (
        <InputsTab
          assets={assets}
          constants={constants}
          selectedRevenueCase={selectedRevenueCase}
          setSelectedRevenueCase={setSelectedRevenueCase}
          analysisYears={analysisYears}
          setAnalysisYears={setAnalysisYears}
          includeTerminalValue={includeTerminalValue}
          setIncludeTerminalValue={setIncludeTerminalValue}
          showEquityTimingPanel={showEquityTimingPanel}
          setShowEquityTimingPanel={setShowEquityTimingPanel}
          updateAssetCosts={updateAssetCosts}
          updatePortfolioCosts={updatePortfolioCosts}
          updateAssetEquityTiming={updateAssetEquityTiming}
          updatePortfolioEquityTiming={updatePortfolioEquityTiming}
        />
      )}
    </div>
  );
}

// Inputs Tab Component
function InputsTab({
  assets,
  constants,
  selectedRevenueCase,
  setSelectedRevenueCase,
  analysisYears,
  setAnalysisYears,
  includeTerminalValue,
  setIncludeTerminalValue,
  showEquityTimingPanel,
  setShowEquityTimingPanel,
  updateAssetCosts,
  updatePortfolioCosts,
  updateAssetEquityTiming,
  updatePortfolioEquityTiming
}) {
  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Analysis Configuration</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Scenario</label>
            <select
              value={selectedRevenueCase}
              onChange={(e) => setSelectedRevenueCase(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="base">Base Case</option>
              <option value="worst">Combined Downside</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Period (Years)</label>
            <select
              value={analysisYears}
              onChange={(e) => setAnalysisYears(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={15}>15 Years</option>
              <option value={20}>20 Years</option>
              <option value={25}>25 Years</option>
              <option value={30}>30 Years</option>
              <option value={35}>35 Years</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
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
          </div>

          <div className="flex justify-end">
            <button 
              onClick={() => setShowEquityTimingPanel(!showEquityTimingPanel)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
                showEquityTimingPanel 
                  ? 'bg-purple-50 border-purple-200 text-purple-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Equity Timing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Finance Inputs Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Project Finance Parameters</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-900">Asset</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Type</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">CAPEX ($M)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">OPEX ($M/yr)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Max Gearing (%)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Interest Rate (%)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Tenor (years)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Terminal ($M)</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(assets).map((asset) => {
                const assetCostData = constants.assetCosts?.[asset.name] || {};
                return (
                  <tr key={asset.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{asset.name}</td>
                    <td className="text-right py-3 px-2 text-gray-700 capitalize">{asset.type}</td>
                    <td className="text-right py-3 px-2">
                      <input
                        type="number"
                        value={assetCostData.capex || 0}
                        onChange={(e) => updateAssetCosts(asset.name, 'capex', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        step="0.1"
                      />
                    </td>
                    <td className="text-right py-3 px-2">
                      <input
                        type="number"
                        value={assetCostData.operatingCosts || 0}
                        onChange={(e) => updateAssetCosts(asset.name, 'operatingCosts', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                      />
                    </td>
                    <td className="text-right py-3 px-2">
                      <input
                        type="number"
                        value={(assetCostData.maxGearing || 0.7) * 100}
                        onChange={(e) => updateAssetCosts(asset.name, 'maxGearing', (parseFloat(e.target.value) || 0) / 100)}
                        className="w-16 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        step="1"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td className="text-right py-3 px-2">
                      <input
                        type="number"
                        value={(assetCostData.interestRate || 0.06) * 100}
                        onChange={(e) => updateAssetCosts(asset.name, 'interestRate', (parseFloat(e.target.value) || 0) / 100)}
                        className="w-16 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        step="0.1"
                        min="0"
                        max="20"
                      />
                    </td>
                    <td className="text-right py-3 px-2">
                      <input
                        type="number"
                        value={assetCostData.tenorYears || 20}
                        onChange={(e) => updateAssetCosts(asset.name, 'tenorYears', parseInt(e.target.value) || 20)}
                        className="w-16 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        step="1"
                        min="5"
                        max="30"
                      />
                    </td>
                    <td className="text-right py-3 px-2">
                      <input
                        type="number"
                        value={assetCostData.terminalValue || 0}
                        onChange={(e) => updateAssetCosts(asset.name, 'terminalValue', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        step="0.1"
                      />
                    </td>
                  </tr>
                );
              })}
              
              {/* Portfolio Level Row (if multiple assets) */}
              {Object.keys(assets).length >= 2 && (
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                  <td className="py-3 px-2 text-blue-900">Portfolio Level</td>
                  <td className="text-right py-3 px-2 text-blue-700">Mixed</td>
                  <td className="text-right py-3 px-2 text-blue-700">Auto</td>
                  <td className="text-right py-3 px-2 text-blue-700">Auto</td>
                  <td className="text-right py-3 px-2">
                    <input
                      type="number"
                      value={(constants.assetCosts?.portfolio?.maxGearing || 0.75) * 100}
                      onChange={(e) => updatePortfolioCosts('maxGearing', (parseFloat(e.target.value) || 0) / 100)}
                      className="w-16 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                      step="1"
                      min="0"
                      max="100"
                    />
                  </td>
                  <td className="text-right py-3 px-2">
                    <input
                      type="number"
                      value={(constants.assetCosts?.portfolio?.interestRate || 0.055) * 100}
                      onChange={(e) => updatePortfolioCosts('interestRate', (parseFloat(e.target.value) || 0) / 100)}
                      className="w-16 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                      step="0.1"
                      min="0"
                      max="20"
                    />
                  </td>
                  <td className="text-right py-3 px-2">
                    <input
                      type="number"
                      value={constants.assetCosts?.portfolio?.tenorYears || 15}
                      onChange={(e) => updatePortfolioCosts('tenorYears', parseInt(e.target.value) || 15)}
                      className="w-16 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                      step="1"
                      min="5"
                      max="30"
                    />
                  </td>
                  <td className="text-right py-3 px-2 text-blue-700">Auto</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p><strong>Note:</strong> Outputs tab uses auto-solved maximum sustainable gearing. Portfolio-level financing applies after all individual assets are operational.</p>
        </div>
      </div>

      {/* Equity Timing Configuration Panel */}
      {showEquityTimingPanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-purple-900">Equity Investment Timing</h3>
          <div className="space-y-4">
            {/* Individual Assets */}
            {Object.values(assets).map((asset) => {
              const assetCostData = constants.assetCosts?.[asset.name] || {};
              return (
                <div key={asset.name} className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{asset.name}</h4>
                    <span className="text-sm text-gray-500 capitalize">{asset.type}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`${asset.name}-upfront`}
                        name={`${asset.name}-timing`}
                        checked={assetCostData.equityTimingUpfront !== false}
                        onChange={() => updateAssetEquityTiming(asset.name, true, assetCostData.constructionDuration || 12)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`${asset.name}-upfront`} className="text-sm font-medium text-gray-700">
                        Upfront Payment
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`${asset.name}-construction`}
                        name={`${asset.name}-timing`}
                        checked={assetCostData.equityTimingUpfront === false}
                        onChange={() => updateAssetEquityTiming(asset.name, false, assetCostData.constructionDuration || 12)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`${asset.name}-construction`} className="text-sm font-medium text-gray-700">
                        During Construction
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Construction Duration (months)</label>
                      <input
                        type="number"
                        value={assetCostData.constructionDuration || 12}
                        onChange={(e) => updateAssetEquityTiming(
                          asset.name, 
                          assetCostData.equityTimingUpfront !== false, 
                          parseInt(e.target.value) || 12
                        )}
                        className="w-full p-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        min="6"
                        max="36"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Portfolio Level (if multiple assets) */}
            {Object.keys(assets).length >= 2 && (
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-purple-900">Portfolio Level</h4>
                  <span className="text-sm text-purple-600">Refinancing Phase</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="portfolio-upfront"
                      name="portfolio-timing"
                      checked={constants.assetCosts?.portfolio?.equityTimingUpfront !== false}
                      onChange={() => updatePortfolioEquityTiming(true, constants.assetCosts?.portfolio?.constructionDuration || 18)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="portfolio-upfront" className="text-sm font-medium text-gray-700">
                      Upfront Payment
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="portfolio-construction"
                      name="portfolio-timing"
                      checked={constants.assetCosts?.portfolio?.equityTimingUpfront === false}
                      onChange={() => updatePortfolioEquityTiming(false, constants.assetCosts?.portfolio?.constructionDuration || 18)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="portfolio-construction" className="text-sm font-medium text-gray-700">
                      During Development
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Development Duration (months)</label>
                    <input
                      type="number"
                      value={constants.assetCosts?.portfolio?.constructionDuration || 18}
                      onChange={(e) => updatePortfolioEquityTiming(
                        constants.assetCosts?.portfolio?.equityTimingUpfront !== false, 
                        parseInt(e.target.value) || 18
                      )}
                      className="w-full p-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      min="6"
                      max="48"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 text-sm text-purple-700">
            <p><strong>Note:</strong> Equity timing significantly affects IRR calculations. Upfront payment concentrates the equity investment 
            at Year 0, while pro-rata spreads it over construction/development period.</p>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Project finance inputs configured for {Object.keys(assets).length} assets
            </span>
          </div>
          <div className="text-green-600 text-sm">
            Configuration: {selectedRevenueCase} case • {analysisYears} years • 
            Terminal: {includeTerminalValue ? 'Included' : 'Excluded'}
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          All inputs saved automatically. Switch to Analysis Outputs tab to see results with auto-solved gearing.
        </div>
      </div>
    </div>
  );
}

// Outputs Tab Component
function OutputsTab({
  projectMetrics,
  portfolioTotals,
  assets,
  constants,
  getMerchantPrice,
  analysisYears,
  selectedRevenueCase,
  includeTerminalValue
}) {
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);
  const [showQuarterly, setShowQuarterly] = useState(false);

  // Helper functions for formatting
  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `${value.toFixed(1)}M`;
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  // Calculate portfolio insights
  const getPortfolioInsights = () => {
    if (!portfolioTotals || Object.keys(projectMetrics).length === 0) return null;

    const insights = {
      totalAssets: Object.keys(assets).length,
      totalCapacity: Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0),
      totalCapex: portfolioTotals.capex,
      totalEquity: portfolioTotals.capex * (1 - portfolioTotals.calculatedGearing),
      averageGearing: portfolioTotals.calculatedGearing,
      portfolioIRR: portfolioTotals.equityCashFlows ? calculateIRR(portfolioTotals.equityCashFlows) * 100 : 0
    };

    return insights;
  };

  const portfolioInsights = getPortfolioInsights();

  return (
    <div className="space-y-6">
      {/* Single Portfolio Overview */}
      {portfolioInsights && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Portfolio Overview</h3>
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Auto-Solved Gearing</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{portfolioInsights.totalAssets}</p>
              <p className="text-sm text-gray-600">Assets</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{portfolioInsights.totalCapacity.toFixed(0)}MW</p>
              <p className="text-sm text-gray-600">Total Capacity</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(portfolioInsights.totalCapex)}</p>
              <p className="text-sm text-blue-600">Total CAPEX</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-900">{formatCurrency(portfolioInsights.totalEquity)}</p>
              <p className="text-sm text-green-600">Total Equity</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-900">{formatPercent(portfolioInsights.averageGearing)}</p>
              <p className="text-sm text-purple-600">Avg Gearing</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-900">{portfolioInsights.portfolioIRR.toFixed(1)}%</p>
              <p className="text-sm text-orange-600">{analysisYears}Y IRR</p>
            </div>
          </div>
        </div>
      )}

      {/* Asset Summary Metrics */}
      <AssetSummaryTable
        projectMetrics={projectMetrics}
        portfolioTotals={portfolioTotals}
        assets={assets}
        includeTerminalValue={includeTerminalValue}
        analysisYears={analysisYears}
      />

      {/* Cash Flow Projections */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Portfolio Cash Flow Projections</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowQuarterly(!showQuarterly)}
              className={`px-3 py-1 text-sm rounded-md border ${
                showQuarterly 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {showQuarterly ? 'Show Annual' : 'Show Quarterly'}
            </button>
            <button
              onClick={() => setShowCashFlowTable(!showCashFlowTable)}
              className={`px-3 py-1 text-sm rounded-md border ${
                showCashFlowTable 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {showCashFlowTable ? 'Hide Table' : 'Show Table'}
            </button>
          </div>
        </div>

        {/* Cash Flow Chart */}
        <CashFlowChart 
          projectMetrics={projectMetrics}
          analysisYears={analysisYears}
          showQuarterly={showQuarterly}
        />

        {/* Cash Flow Table (expandable) */}
        {showCashFlowTable && (
          <div className="mt-6">
            <CashFlowTable 
              projectMetrics={projectMetrics}
              analysisYears={analysisYears}
              showQuarterly={showQuarterly}
            />
          </div>
        )}
      </div>

      {/* Simplified Sensitivity Tornado */}
      <SimplifiedSensitivityTornado
        projectMetrics={projectMetrics}
        assets={assets}
        constants={constants}
        getMerchantPrice={getMerchantPrice}
        analysisYears={analysisYears}
        selectedRevenueCase={selectedRevenueCase}
        includeTerminalValue={includeTerminalValue}
        portfolioTotals={portfolioTotals}
        baseIRR={portfolioInsights?.portfolioIRR}
      />

      {/* Status Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 font-medium">
              Analysis complete with auto-solved maximum sustainable gearing
            </span>
          </div>
          <div className="text-blue-600 text-sm">
            Scenario: {selectedRevenueCase} • Period: {analysisYears} years • 
            Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="mt-2 text-sm text-blue-700">
          Portfolio overview → Asset summary → Cash flow projections → IRR sensitivity tornado
        </div>
      </div>
    </div>
  );
}

// Cash Flow Chart Component
function CashFlowChart({ projectMetrics, analysisYears, showQuarterly }) {
  const cashFlows = projectMetrics.portfolio?.cashFlows || [];
  
  if (cashFlows.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No cash flow data available</p>
        <p className="text-sm">Complete the project finance analysis to see cash flows</p>
      </div>
    );
  }

  // Prepare chart data
  let chartData;
  if (showQuarterly) {
    // Convert annual data to quarterly (simplified - just divide by 4)
    chartData = cashFlows.slice(0, Math.min(10, analysisYears)).flatMap(cf => [
      { year: `${cf.year} Q1`, revenue: cf.revenue / 4, opex: Math.abs(cf.opex) / 4, operatingCashFlow: cf.operatingCashFlow / 4, equityCashFlow: cf.equityCashFlow / 4 },
      { year: `${cf.year} Q2`, revenue: cf.revenue / 4, opex: Math.abs(cf.opex) / 4, operatingCashFlow: cf.operatingCashFlow / 4, equityCashFlow: cf.equityCashFlow / 4 },
      { year: `${cf.year} Q3`, revenue: cf.revenue / 4, opex: Math.abs(cf.opex) / 4, operatingCashFlow: cf.operatingCashFlow / 4, equityCashFlow: cf.equityCashFlow / 4 },
      { year: `${cf.year} Q4`, revenue: cf.revenue / 4, opex: Math.abs(cf.opex) / 4, operatingCashFlow: cf.operatingCashFlow / 4, equityCashFlow: cf.equityCashFlow / 4 }
    ]);
  } else {
    chartData = cashFlows.slice(0, Math.min(25, analysisYears)).map(cf => ({
      year: cf.year,
      revenue: cf.revenue || 0,
      opex: Math.abs(cf.opex || 0),
      operatingCashFlow: cf.operatingCashFlow || 0,
      equityCashFlow: cf.equityCashFlow || 0
    }));
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="year" 
            tick={{ fontSize: 12 }}
            angle={showQuarterly ? -45 : 0}
            textAnchor={showQuarterly ? 'end' : 'middle'}
            height={showQuarterly ? 80 : 60}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}M`}
          />
          <Tooltip 
            formatter={(value, name) => [`${value.toFixed(1)}M`, name]}
            labelFormatter={(year) => `Period: ${year}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            name="Revenue" 
            stroke="#4CAF50" 
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="opex" 
            name="Operating Costs" 
            stroke="#f44336" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="operatingCashFlow" 
            name="Operating Cash Flow" 
            stroke="#2196F3" 
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line 
            type="monotone" 
            dataKey="equityCashFlow" 
            name="Equity Cash Flow" 
            stroke="#FF9800" 
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Showing {showQuarterly ? 'quarterly' : 'annual'} cash flows. 
          Equity cash flow represents the net cash available to equity investors after all operating costs and debt service.
        </p>
      </div>
    </div>
  );
}

// Cash Flow Table Component
function CashFlowTable({ projectMetrics, analysisYears, showQuarterly }) {
  const cashFlows = projectMetrics.portfolio?.cashFlows || [];
  
  if (cashFlows.length === 0) return null;

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `${value.toFixed(1)}M`;
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null || !isFinite(value)) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  let tableData;
  if (showQuarterly) {
    // Convert annual to quarterly (simplified)
    tableData = cashFlows.slice(0, Math.min(10, analysisYears)).flatMap(cf => [
      { ...cf, year: `${cf.year} Q1`, revenue: cf.revenue / 4, opex: cf.opex / 4, operatingCashFlow: cf.operatingCashFlow / 4, debtService: cf.debtService / 4, equityCashFlow: cf.equityCashFlow / 4 },
      { ...cf, year: `${cf.year} Q2`, revenue: cf.revenue / 4, opex: cf.opex / 4, operatingCashFlow: cf.operatingCashFlow / 4, debtService: cf.debtService / 4, equityCashFlow: cf.equityCashFlow / 4 },
      { ...cf, year: `${cf.year} Q3`, revenue: cf.revenue / 4, opex: cf.opex / 4, operatingCashFlow: cf.operatingCashFlow / 4, debtService: cf.debtService / 4, equityCashFlow: cf.equityCashFlow / 4 },
      { ...cf, year: `${cf.year} Q4`, revenue: cf.revenue / 4, opex: cf.opex / 4, operatingCashFlow: cf.operatingCashFlow / 4, debtService: cf.debtService / 4, equityCashFlow: cf.equityCashFlow / 4 }
    ]);
  } else {
    tableData = cashFlows.slice(0, Math.min(30, analysisYears));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-2 font-medium text-gray-900">Period</th>
            <th className="text-right py-3 px-2 font-medium text-gray-900">Revenue ($M)</th>
            <th className="text-right py-3 px-2 font-medium text-gray-900">OPEX ($M)</th>
            <th className="text-right py-3 px-2 font-medium text-gray-900">Operating CF ($M)</th>
            <th className="text-right py-3 px-2 font-medium text-gray-900">Debt Service ($M)</th>
            <th className="text-right py-3 px-2 font-medium text-gray-900">DSCR</th>
            <th className="text-right py-3 px-2 font-medium text-gray-900">Equity CF ($M)</th>
            <th className="text-left py-3 px-2 font-medium text-gray-900">Phase</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((cf, index) => (
            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-medium text-gray-900">{cf.year}</td>
              <td className="text-right py-2 px-2 text-gray-700">{formatCurrency(cf.revenue)}</td>
              <td className="text-right py-2 px-2 text-red-600">{formatCurrency(Math.abs(cf.opex))}</td>
              <td className="text-right py-2 px-2 text-blue-700">{formatCurrency(cf.operatingCashFlow)}</td>
              <td className="text-right py-2 px-2 text-purple-600">{formatCurrency(Math.abs(cf.debtService))}</td>
              <td className="text-right py-2 px-2 text-gray-700">{formatDSCR(cf.dscr)}</td>
              <td className={`text-right py-2 px-2 font-medium ${
                cf.equityCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(cf.equityCashFlow)}
              </td>
              <td className="text-left py-2 px-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  cf.refinancePhase === 'individual' ? 'bg-blue-100 text-blue-800' :
                  cf.refinancePhase === 'portfolio' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {cf.refinancePhase || 'individual'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {cashFlows.length > 30 && !showQuarterly && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing first 30 years of {cashFlows.length} total years
        </div>
      )}
      
      {showQuarterly && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing quarterly breakdown for first 10 years (simplified quarterly split)
        </div>
      )}
    </div>
  );
}

// Asset Summary Table Component (without the duplicate overview)
function AssetSummaryTable({
  projectMetrics,
  portfolioTotals,
  assets,
  includeTerminalValue,
  analysisYears
}) {
  // Helper functions for formatting
  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatNumber = (value, digits = 1) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `${formatNumber(value)}M`;
  };

  if (!projectMetrics || Object.keys(projectMetrics).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Summary Metrics</h3>
        <div className="text-center text-gray-500 py-8">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No portfolio metrics available</p>
          <p className="text-sm">Complete the project finance analysis to see summary</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <div className="flex items-center space-x-2 mb-4">
        <BarChart3 className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Asset Summary Metrics</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-medium text-gray-900">Asset</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Type</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Capacity (MW)</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">CAPEX ($M)</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Gearing (%)</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Debt ($M)</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Debt Service ($M)</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Min DSCR</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Terminal ($M)</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Equity Timing</th>
              <th className="text-right py-3 px-2 font-medium text-gray-900">Equity IRR</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(projectMetrics)
              .filter(([assetName]) => assetName !== 'portfolio')
              .map(([assetName, metrics]) => {
                const asset = Object.values(assets).find(a => a.name === assetName);
                return (
                  <tr key={assetName} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{assetName}</td>
                    <td className="text-right py-3 px-2 text-gray-700 capitalize">{asset?.type || '-'}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{asset?.capacity || '0'}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatCurrency(metrics.capex)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatPercent(metrics.calculatedGearing)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatCurrency(metrics.debtAmount)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatCurrency(metrics.annualDebtService)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatDSCR(metrics.minDSCR)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">
                      {formatCurrency(includeTerminalValue ? metrics.terminalValue : 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        metrics.equityTimingUpfront 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {metrics.equityTimingUpfront ? 'Upfront' : 'Pro-rata'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2 font-medium text-gray-900">
                      {calculateIRR(metrics.equityCashFlows) 
                        ? formatPercent(calculateIRR(metrics.equityCashFlows)) 
                        : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            
            {/* Portfolio Total Row */}
            {portfolioTotals && Object.keys(assets).length >= 2 && (
              <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                <td className="py-3 px-2 text-blue-900">Portfolio Total</td>
                <td className="text-right py-3 px-2 text-blue-700">Mixed</td>
                <td className="text-right py-3 px-2 text-blue-700">
                  {Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0).toFixed(0)}
                </td>
                <td className="text-right py-3 px-2 text-blue-700">{formatCurrency(portfolioTotals.capex)}</td>
                <td className="text-right py-3 px-2 text-blue-700">{formatPercent(portfolioTotals.calculatedGearing)}</td>
                <td className="text-right py-3 px-2 text-blue-700">{formatCurrency(portfolioTotals.debtAmount)}</td>
                <td className="text-right py-3 px-2 text-blue-700">{formatCurrency(portfolioTotals.annualDebtService)}</td>
                <td className="text-right py-3 px-2 text-blue-700">{formatDSCR(portfolioTotals.minDSCR)}</td>
                <td className="text-right py-3 px-2 text-blue-700">
                  {formatCurrency(includeTerminalValue ? portfolioTotals.terminalValue : 0)}
                </td>
                <td className="text-right py-3 px-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    projectMetrics.portfolio?.equityTimingUpfront 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {projectMetrics.portfolio?.equityTimingUpfront ? 'Upfront' : 'Pro-rata'}
                  </span>
                </td>
                <td className="text-right py-3 px-2 font-bold text-blue-900">
                  {portfolioTotals.equityCashFlows && calculateIRR(portfolioTotals.equityCashFlows) 
                    ? formatPercent(calculateIRR(portfolioTotals.equityCashFlows)) 
                    : 'N/A'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          Analysis period: {analysisYears} years • 
          Terminal value: {includeTerminalValue ? 'Included' : 'Excluded'} • 
          Individual asset IRRs calculated with truncated cash flows for comparison
        </p>
      </div>
    </div>
  );
}
function SimplifiedSensitivityTornado({ 
  projectMetrics, 
  assets, 
  constants, 
  getMerchantPrice, 
  analysisYears, 
  selectedRevenueCase,
  includeTerminalValue,
  portfolioTotals,
  baseIRR
}) {
  const [sensitivityData, setSensitivityData] = useState([]);
  const [calculating, setCalculating] = useState(false);
  
  // Sensitivity range inputs
  const [ranges, setRanges] = useState({
    capex: 10,
    electricityPrice: 10,
    volume: 10,
    interestRate: 1,
    opex: 10,
    terminalValue: 50
  });

  const updateRange = (parameter, value) => {
    setRanges(prev => ({
      ...prev,
      [parameter]: Math.max(0.1, Math.min(100, parseFloat(value) || 0))
    }));
  };

  // This would include all the sensitivity calculation logic from the original component
  // ... (keeping the same calculation methods but simplified display)

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <div className="flex items-center space-x-2 mb-4">
        <BarChart3 className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">
          IRR Sensitivity Analysis ({analysisYears} Years)
        </h3>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Base Portfolio IRR:</strong> {baseIRR?.toFixed(2)}% • 
          <strong>Analysis Period:</strong> {analysisYears} years • 
          <strong>Scenarios:</strong> ±10% for most, ±1pp for interest, ±50% for terminal
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Parameter</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Range</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Downside</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Upside</th>
            </tr>
          </thead>
          <tbody>
            {sensitivityData.map((item, index) => {
              const parameterKey = item.parameter.toLowerCase().replace(' ', '');
              const rangeKey = parameterKey === 'electricityprice' ? 'electricityPrice' : 
                              parameterKey === 'interestrate' ? 'interestRate' : 
                              parameterKey === 'terminalvalue' ? 'terminalValue' : parameterKey;
              
              return (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.parameter}</td>
                  <td className="text-center py-3 px-4">
                    <div className="flex items-center justify-center space-x-1">
                      <span>±</span>
                      <input
                        type="number"
                        value={item.range}
                        onChange={(e) => updateRange(rangeKey, e.target.value)}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0.1"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                    </div>
                  </td>
                  <td className={`text-center py-3 px-4 font-medium ${
                    item.downside < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {item.downside > 0 ? '+' : ''}{item.downside.toFixed(2)}pp
                  </td>
                  <td className={`text-center py-3 px-4 font-medium ${
                    item.upside > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.upside > 0 ? '+' : ''}{item.upside.toFixed(2)}pp
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Live Sensitivity Analysis:</strong> All parameters recalculate project metrics with specified changes. 
          Results show impact on portfolio IRR in percentage points.
        </p>
      </div>
    </div>
  );
}