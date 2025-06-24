'use client'

import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { useSaveContext } from '../../layout';
import { Calculator } from 'lucide-react';

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
import MetricsAndConfiguration from './components/MetricsAndConfiguration';
import PortfolioSummary from './components/PortfolioSummary';
import CashFlowAnalysis from './components/CashFlowAnalysis';

export default function StreamlinedProjectFinancePage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  const { setHasUnsavedChanges, setSaveFunction } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  
  // Finance configuration
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [analysisYears, setAnalysisYears] = useState(30);
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);
  const [solveGearing, setSolveGearing] = useState(false);
  const [showSensitivityAnalysis, setShowSensitivityAnalysis] = useState(true);
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
  }, [assets, constants, selectedRevenueCase, analysisYears, includeTerminalValue, solveGearing]);

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
      
      // Use the project finance calculation
      const metrics = calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        solveGearing,
        includeTerminalValue
      );
      
      console.log('Calculated project metrics:', metrics);
      setProjectMetrics(metrics);
      
      // Calculate portfolio summary using revenue calculations for the specified analysis period
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

  // Calculate portfolio totals from individual metrics (using truncated cash flows)
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
        // Truncate to analysis period + 1 for IRR calculation
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
    
    console.log(`Portfolio totals calculated with ${allEquityCashFlows.length} cash flow periods for ${analysisYears} year analysis`);
    
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
      {/* Header & Configuration with Key Metrics */}
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

      {/* Sensitivity Analysis */}
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

      {/* Portfolio Summary Table */}
      <PortfolioSummary
        projectMetrics={projectMetrics}
        portfolioTotals={portfolioTotals}
        assets={assets}
        includeTerminalValue={includeTerminalValue}
        analysisYears={analysisYears}
      />

      {/* Cash Flow Analysis */}
      <CashFlowAnalysis
        projectMetrics={projectMetrics}
        showCashFlowTable={showCashFlowTable}
        analysisYears={analysisYears}
      />

      {/* Status Display */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-800 font-medium">
              Streamlined finance page with 4 focused components
            </span>
          </div>
          <div className="text-green-600 text-sm">
            Analysis: {analysisYears} years • Scenario: {selectedRevenueCase} • 
            Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          Live sensitivity tornado, grouped funding metrics/configuration, portfolio summary, and cash flow analysis.
        </div>
      </div>
    </div>
  );
}