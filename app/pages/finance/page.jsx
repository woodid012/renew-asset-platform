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

// Import components - using the real ones now
import SensitivityTornado from './components/SensitivityTornado';
import PortfolioSummary from './components/PortfolioSummary';
import CashFlowAnalysis from './components/CashFlowAnalysis';
import MetricsAndConfiguration from './components/MetricsAndConfiguration';

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
  const [solveGearing, setSolveGearing] = useState(true); // Always true for outputs
  const [showEquityTimingPanel, setShowEquityTimingPanel] = useState(false);
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);
  const [showSensitivityAnalysis, setShowSensitivityAnalysis] = useState(true);
  
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
          showCashFlowTable={showCashFlowTable}
          showSensitivityAnalysis={showSensitivityAnalysis}
          setShowCashFlowTable={setShowCashFlowTable}
          setShowSensitivityAnalysis={setShowSensitivityAnalysis}
        />
      )}

      {activeTab === 'inputs' && (
        <InputsTab
          assets={assets}
          constants={constants}
          portfolioTotals={portfolioTotals}
          portfolioName={portfolioName}
          selectedRevenueCase={selectedRevenueCase}
          setSelectedRevenueCase={setSelectedRevenueCase}
          analysisYears={analysisYears}
          setAnalysisYears={setAnalysisYears}
          includeTerminalValue={includeTerminalValue}
          setIncludeTerminalValue={setIncludeTerminalValue}
          solveGearing={solveGearing}
          setSolveGearing={setSolveGearing}
          showEquityTimingPanel={showEquityTimingPanel}
          setShowEquityTimingPanel={setShowEquityTimingPanel}
          showCashFlowTable={showCashFlowTable}
          setShowCashFlowTable={setShowCashFlowTable}
          showSensitivityAnalysis={showSensitivityAnalysis}
          setShowSensitivityAnalysis={setShowSensitivityAnalysis}
          updateAssetCosts={updateAssetCosts}
          updatePortfolioCosts={updatePortfolioCosts}
          updateAssetEquityTiming={updateAssetEquityTiming}
          updatePortfolioEquityTiming={updatePortfolioEquityTiming}
        />
      )}
    </div>
  );
}

// Inputs Tab Component - now uses MetricsAndConfiguration
function InputsTab({
  assets,
  constants,
  portfolioTotals,
  portfolioName,
  selectedRevenueCase,
  setSelectedRevenueCase,
  analysisYears,
  setAnalysisYears,
  includeTerminalValue,
  setIncludeTerminalValue,
  solveGearing,
  setSolveGearing,
  showEquityTimingPanel,
  setShowEquityTimingPanel,
  showCashFlowTable,
  setShowCashFlowTable,
  showSensitivityAnalysis,
  setShowSensitivityAnalysis,
  updateAssetCosts,
  updatePortfolioCosts,
  updateAssetEquityTiming,
  updatePortfolioEquityTiming
}) {
  return (
    <div className="space-y-6">
      {/* Use MetricsAndConfiguration component */}
      <MetricsAndConfiguration
        portfolioName={portfolioName}
        assets={assets}
        constants={constants}
        portfolioTotals={portfolioTotals}
        analysisYears={analysisYears}
        selectedRevenueCase={selectedRevenueCase}
        includeTerminalValue={includeTerminalValue}
        solveGearing={solveGearing}
        showEquityTimingPanel={showEquityTimingPanel}
        showCashFlowTable={showCashFlowTable}
        showSensitivityAnalysis={showSensitivityAnalysis}
        setAnalysisYears={setAnalysisYears}
        setSelectedRevenueCase={setSelectedRevenueCase}
        setIncludeTerminalValue={setIncludeTerminalValue}
        setSolveGearing={setSolveGearing}
        setShowEquityTimingPanel={setShowEquityTimingPanel}
        setShowCashFlowTable={setShowCashFlowTable}
        setShowSensitivityAnalysis={setShowSensitivityAnalysis}
        updateAssetEquityTiming={updateAssetEquityTiming}
        updatePortfolioEquityTiming={updatePortfolioEquityTiming}
      />

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

// Outputs Tab Component - now uses all the real components
function OutputsTab({
  projectMetrics,
  portfolioTotals,
  assets,
  constants,
  getMerchantPrice,
  analysisYears,
  selectedRevenueCase,
  includeTerminalValue,
  showCashFlowTable,
  showSensitivityAnalysis,
  setShowCashFlowTable,
  setShowSensitivityAnalysis
}) {

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Component */}
      <PortfolioSummary
        projectMetrics={projectMetrics}
        portfolioTotals={portfolioTotals}
        assets={assets}
        includeTerminalValue={includeTerminalValue}
        analysisYears={analysisYears}
      />

      {/* Cash Flow Analysis Component */}
      <CashFlowAnalysis
        projectMetrics={projectMetrics}
        showCashFlowTable={showCashFlowTable}
        analysisYears={analysisYears}
      />

      {/* Toggle Controls */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => setShowCashFlowTable(!showCashFlowTable)}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
            showCashFlowTable 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{showCashFlowTable ? 'Hide Cash Flow Table' : 'Show Cash Flow Table'}</span>
        </button>
        
        <button
          onClick={() => setShowSensitivityAnalysis(!showSensitivityAnalysis)}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
            showSensitivityAnalysis 
              ? 'bg-orange-50 border-orange-200 text-orange-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{showSensitivityAnalysis ? 'Hide Sensitivity Analysis' : 'Show Sensitivity Analysis'}</span>
        </button>
      </div>

      {/* Sensitivity Analysis Component */}
      {showSensitivityAnalysis && (
        <SensitivityTornado
          projectMetrics={projectMetrics}
          assets={assets}
          constants={constants}
          getMerchantPrice={getMerchantPrice}
          analysisYears={analysisYears}
          selectedRevenueCase={selectedRevenueCase}
          includeTerminalValue={includeTerminalValue}
          portfolioTotals={portfolioTotals}
        />
      )}

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