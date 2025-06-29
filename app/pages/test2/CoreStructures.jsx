'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { 
  Building2, 
  Calendar,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Download,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// SEGMENT 1: CORE DATA STRUCTURES AND TYPES
// ============================================================================

/**
 * Core data structures for monthly cash flow analysis
 */

// Monthly Cash Flow Period Definition
const createMonthlyPeriod = (year, month, assetStartDate, constructionMonths) => {
  const periodDate = new Date(year, month - 1, 1);
  
  // Ensure assetStartDate is a valid date before proceeding
  if (!assetStartDate || isNaN(new Date(assetStartDate).getTime())) {
    console.warn('Invalid assetStartDate provided to createMonthlyPeriod:', assetStartDate);
    return null; // Or throw an error, depending on desired behavior
  }

  const assetStart = new Date(assetStartDate);
  const constructionStart = new Date(assetStart);
  constructionStart.setMonth(constructionStart.getMonth() - constructionMonths);
  
  // Determine phase
  let phase = 'pre-construction';
  if (periodDate >= constructionStart && periodDate < assetStart) {
    phase = 'construction';
  } else if (periodDate >= assetStart) {
    phase = 'operations';
  }
  
  return {
    year,
    month,
    periodDate,
    periodKey: `${year}-${month.toString().padStart(2, '0')}`,
    quarterKey: `${year}-Q${Math.ceil(month / 3)}`,
    phase,
    monthsFromAssetStart: periodDate >= assetStart ? 
      ((year - assetStart.getFullYear()) * 12 + (month - assetStart.getMonth() - 1)) : null,
    monthsFromConstructionStart: periodDate >= constructionStart ?
      ((year - constructionStart.getFullYear()) * 12 + (month - constructionStart.getMonth() - 1)) : null,
    isPartialMonth: false, // Will be calculated later
    daysInMonth: new Date(year, month, 0).getDate()
  };
};

// Asset Financial Parameters Structure
const createAssetFinancialParams = (asset, assetCosts) => {
  return {
    // Capital Structure
    totalCapex: assetCosts?.capex || 0,
    maxGearing: assetCosts?.maxGearing || 0.70,
    debtAmount: 0, // Will be calculated
    equityAmount: 0, // Will be calculated
    
    // Construction Timing
    constructionDuration: assetCosts?.constructionDuration || 18, // months
    equityTimingUpfront: assetCosts?.equityTimingUpfront !== false,
    
    // Debt Structure
    interestRate: assetCosts?.interestRate || 0.06,
    tenorYears: assetCosts?.tenorYears || 15,
    targetDSCRContract: assetCosts?.targetDSCRContract || 1.35,
    targetDSCRMerchant: assetCosts?.targetDSCRMerchant || 2.00,
    debtStructure: assetCosts?.debtStructure || 'sculpting',
    
    // Operating Costs
    annualOpex: assetCosts?.operatingCosts || 0,
    opexEscalation: assetCosts?.operatingCostEscalation || 2.5,
    
    // Terminal Value
    terminalValue: assetCosts?.terminalValue || 0,
    
    // Asset Specifics
    capacity: parseFloat(asset.capacity) || 0,
    assetLife: parseInt(asset.assetLife) || 25,
    annualDegradation: parseFloat(asset.annualDegradation) || 0.5,
    volumeLossAdjustment: parseFloat(asset.volumeLossAdjustment) || 95
  };
};

// Monthly Cash Flow Record Structure
const createMonthlyCashFlowRecord = () => {
  return {
    // Period Identification
    periodKey: '',
    year: 0,
    month: 0,
    phase: 'pre-construction',
    monthIndex: 0, // 0-based from start of analysis
    
    // Revenue Components (all in $M)
    grossRevenue: 0,
    contractedGreenRevenue: 0,
    contractedEnergyRevenue: 0,
    merchantGreenRevenue: 0,
    merchantEnergyRevenue: 0,
    
    // Volume and Performance
    monthlyGeneration: 0, // MWh
    capacityFactor: 0, // %
    degradationFactor: 1.0,
    
    // Operating Costs
    monthlyOpex: 0,
    
    // Cash Flow Components
    operatingCashFlow: 0, // Revenue - Opex
    
    // Construction Cash Flows
    monthlyCapexSpend: 0,
    monthlyEquityContribution: 0,
    monthlyDebtDrawdown: 0,
    cumulativeCapexSpent: 0,
    
    // Debt Service
    monthlyInterestPayment: 0,
    monthlyPrincipalPayment: 0,
    monthlyDebtService: 0,
    outstandingDebtBalance: 0,
    
    // Financial Ratios
    dscr: null, // Debt Service Coverage Ratio
    
    // Cash Flow Summary
    constructionCashFlow: 0, // -(Equity + Debt Drawdown)
    operationalEquityCashFlow: 0, // Operating CF - Debt Service
    terminalCashFlow: 0, // Terminal value in final period
    netMonthlyCashFlow: 0, // Total net cash flow
    cumulativeEquityCashFlow: 0,
    
    // Metadata
    isPartialMonth: false,
    gracePeriod: false,
    notes: []
  };
};

// ============================================================================
// SEGMENT 2: CONFIGURATION AND STATE MANAGEMENT
// ============================================================================

const MonthlyCashFlowAnalysis = () => {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  
  // Core State
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [selectedAsset, setSelectedAsset] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Analysis Configuration
  const [analysisConfig, setAnalysisConfig] = useState({
    startYear: 2024,
    analysisYears: 30,
    includeTerminalValue: true,
    solveOptimalGearing: true,
    monthlyDetail: true,
    includeConstructionPhase: true,
    scenarioCase: 'base' // base, upside, downside, stress
  });
  
  // Results State
  const [monthlyResults, setMonthlyResults] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [calculationStatus, setCalculationStatus] = useState('idle'); // idle, calculating, complete, error
  
  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);
  
  // Auto-select first asset
  useEffect(() => {
    if (Object.keys(assets).length > 0 && !selectedAsset) {
      const firstAsset = Object.values(assets)[0];
      setSelectedAsset(firstAsset?.name || '');
    }
  }, [assets, selectedAsset]);
  
  // Trigger calculations when asset or config changes
  useEffect(() => {
    if (selectedAsset && assets[selectedAsset] && constants.assetCosts) {
      calculateMonthlyCashFlows();
    }
  }, [selectedAsset, assets, constants, analysisConfig]);
  
  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        
        // Convert assets array to object if needed
        const assetsObj = Array.isArray(portfolioData.assets) 
          ? portfolioData.assets.reduce((acc, asset) => ({ ...acc, [asset.name]: asset }), {})
          : portfolioData.assets || {};
        
        setAssets(assetsObj);
        
        const updatedConstants = {
          ...portfolioData.constants,
          HOURS_IN_YEAR: 8760,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: 2.5,
          referenceYear: 2025
        };
        
        // Initialize asset costs if missing
        if (!updatedConstants.assetCosts && Object.keys(assetsObj).length > 0) {
          updatedConstants.assetCosts = initializeAssetCosts(assetsObj);
        }
        
        setConstants(updatedConstants);
        
      } else if (response.status === 404) {
        setAssets({});
        setConstants({});
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
      setError(`Failed to load portfolio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize asset costs with defaults
  const initializeAssetCosts = (assetsObj) => {
    const assetCosts = {};
    
    Object.values(assetsObj).forEach(asset => {
      const capacity = parseFloat(asset.capacity) || 100;
      
      // Default CAPEX rates by technology
      const defaultCapexRates = {
        solar: 1.2, // $M/MW
        wind: 2.5,
        storage: 1.6,
        default: 2.0
      };
      
      // Default OPEX rates by technology
      const defaultOpexRates = {
        solar: 0.014, // $M/MW/year
        wind: 0.040,
        storage: 0.015,
        default: 0.030
      };
      
      const capexRate = defaultCapexRates[asset.type] || defaultCapexRates.default;
      const opexRate = defaultOpexRates[asset.type] || defaultOpexRates.default;
      
      assetCosts[asset.name] = {
        capex: capacity * capexRate,
        operatingCosts: capacity * opexRate,
        operatingCostEscalation: 2.5,
        terminalValue: capacity * 0.15,
        maxGearing: 0.70,
        targetDSCRContract: 1.35,
        targetDSCRMerchant: 2.00,
        interestRate: 0.06,
        tenorYears: asset.type === 'storage' ? 15 : 20,
        debtStructure: 'sculpting',
        equityTimingUpfront: true,
        constructionDuration: asset.type === 'wind' ? 18 : 12
      };
    });
    
    return assetCosts;
  };
  
  // Main calculation function - placeholder for now
  const calculateMonthlyCashFlows = async () => {
    if (!selectedAsset || !assets[selectedAsset]) return;
    
    setCalculationStatus('calculating');
    setError(null);
    
    try {
      console.log(`Starting monthly cash flow calculation for ${selectedAsset}...`);
      
      // Get selected asset and its costs
      const asset = Object.values(assets).find(a => a.name === selectedAsset);
      const assetCosts = constants.assetCosts[selectedAsset];
      
      if (!asset || !assetCosts) {
        throw new Error('Asset or cost data not found');
      }
      
      // Create financial parameters
      const financialParams = createAssetFinancialParams(asset, assetCosts);
      
      // This will be expanded in the next segments
      console.log('Financial parameters:', financialParams);
      
      // Placeholder results
      setMonthlyResults([]);
      setFinancialSummary({
        totalCapex: financialParams.totalCapex,
        calculatedGearing: 0,
        equityIRR: 0,
        totalRevenue: 0,
        totalOpex: 0
      });
      
      setCalculationStatus('complete');
      
    } catch (error) {
      console.error('Monthly cash flow calculation error:', error);
      setError(`Calculation failed: ${error.message}`);
      setCalculationStatus('error');
    }
  };
  
  // Get current asset for display
  const currentAsset = useMemo(() => {
    if (!selectedAsset || !assets) return null;
    return Object.values(assets).find(a => a.name === selectedAsset);
  }, [selectedAsset, assets]);
  
  const currentAssetCosts = useMemo(() => {
    if (!selectedAsset || !constants.assetCosts) return null;
    return constants.assetCosts[selectedAsset];
  }, [selectedAsset, constants.assetCosts]);
  
  // Render loading states
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
          <p className="text-gray-600">Loading portfolio data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Data</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadPortfolioData}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (Object.keys(assets).length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-center text-gray-500 py-12">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No assets available for monthly analysis</p>
            <p className="text-sm mt-2">Configure assets in the Asset Definition page</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Monthly Cash Flow Analysis</h1>
          <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
            Detailed Project Finance
          </span>
        </div>
        
        <div className="text-sm text-gray-500">
          Portfolio: {currentPortfolio?.portfolioId} • {Object.keys(assets).length} assets
        </div>
      </div>
      
      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Asset
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an asset...</option>
              {Object.values(assets).map(asset => (
                <option key={asset.name} value={asset.name}>
                  {asset.name} ({asset.type}, {asset.capacity}MW)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Analysis Period
            </label>
            <select
              value={analysisConfig.analysisYears}
              onChange={(e) => setAnalysisConfig(prev => ({
                ...prev,
                analysisYears: parseInt(e.target.value)
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={20}>20 Years</option>
              <option value={25}>25 Years</option>
              <option value={30}>30 Years</option>
              <option value={35}>35 Years</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scenario Case
            </label>
            <select
              value={analysisConfig.scenarioCase}
              onChange={(e) => setAnalysisConfig(prev => ({
                ...prev,
                scenarioCase: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="base">Base Case</option>
              <option value="upside">Upside Case</option>
              <option value="downside">Downside Case</option>
              <option value="stress">Stress Case</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={analysisConfig.solveOptimalGearing}
                  onChange={(e) => setAnalysisConfig(prev => ({
                    ...prev,
                    solveOptimalGearing: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Solve Optimal Gearing</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={analysisConfig.includeTerminalValue}
                  onChange={(e) => setAnalysisConfig(prev => ({
                    ...prev,
                    includeTerminalValue: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include Terminal Value</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Asset Summary */}
      {currentAsset && currentAssetCosts && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">
            Asset Overview: {currentAsset.name}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{currentAsset.capacity}MW</p>
              <p className="text-xs text-gray-600">Capacity</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-900">
                ${currentAssetCosts.capex.toFixed(1)}M
              </p>
              <p className="text-xs text-blue-600">Total CAPEX</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-900">
                ${currentAssetCosts.operatingCosts.toFixed(2)}M
              </p>
              <p className="text-xs text-green-600">Annual OPEX</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-900">
                {(currentAssetCosts.maxGearing * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-purple-600">Max Gearing</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-lg font-bold text-orange-900">
                {currentAssetCosts.constructionDuration}m
              </p>
              <p className="text-xs text-orange-600">Construction</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-900">
                {currentAsset.assetLife || 25}y
              </p>
              <p className="text-xs text-yellow-600">Asset Life</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Calculation Status */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Calculation Status</h3>
          
          <div className="flex items-center space-x-2">
            {calculationStatus === 'calculating' && (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-600">Calculating...</span>
              </>
            )}
            {calculationStatus === 'complete' && (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">Complete</span>
              </>
            )}
            {calculationStatus === 'error' && (
              <>
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">Error</span>
              </>
            )}
            {calculationStatus === 'idle' && (
              <span className="text-sm text-gray-500">Ready</span>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {selectedAsset ? (
            <>
              Selected asset: <strong>{selectedAsset}</strong> • 
              Analysis period: <strong>{analysisConfig.analysisYears} years</strong> • 
              Scenario: <strong>{analysisConfig.scenarioCase}</strong>
            </>
          ) : (
            'Select an asset to begin analysis'
          )}
        </div>
        
        {calculationStatus === 'complete' && financialSummary && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total CAPEX:</span>
                <div className="font-semibold text-gray-900">
                  ${financialSummary.totalCapex.toFixed(1)}M
                </div>
              </div>
              <div>
                <span className="text-gray-600">Calculated Gearing:</span>
                <div className="font-semibold text-gray-900">
                  {(financialSummary.calculatedGearing * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600">Equity IRR:</span>
                <div className="font-semibold text-gray-900">
                  {financialSummary.equityIRR.toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Revenue:</span>
                <div className="font-semibold text-gray-900">
                  ${financialSummary.totalRevenue.toFixed(1)}M
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Next Segment Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Info className="w-5 h-5 text-blue-600" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Next: Revenue Calculation Engine</h4>
            <p className="text-sm text-blue-700">
              Segment 2 will implement the monthly revenue calculation engine with degradation, 
              capacity factors, contract processing, and merchant price integration.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-blue-600" />
        </div>
      </div>
    </div>
  );
};

export default MonthlyCashFlowAnalysis;