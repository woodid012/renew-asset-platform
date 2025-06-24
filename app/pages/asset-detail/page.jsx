'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { useSaveContext } from '../../layout';
import { 
  Building2, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Calculator,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  Settings,
  Download,
  Eye,
  Info,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Sun,
  Wind,
  Battery
} from 'lucide-react';
import Link from 'next/link';

// Import calculations - using your exact ones
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';

export default function AssetDetailPage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  const { setHasUnsavedChanges, setSaveFunction } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [projectMetrics, setProjectMetrics] = useState({});
  
  // View configuration
  const [timeView, setTimeView] = useState('quarterly'); // 'quarterly', 'yearly'
  const [analysisYears, setAnalysisYears] = useState(30);
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  const [solveGearing, setSolveGearing] = useState(true); // Always true to match your finance page
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Initialize selected asset - fix for numeric keys
  useEffect(() => {
    if (Object.keys(assets).length > 0 && !selectedAsset) {
      // Get the first asset key (which might be numeric)
      const firstAssetKey = Object.keys(assets)[0];
      const firstAsset = assets[firstAssetKey];
      console.log('Setting selected asset:', firstAssetKey, 'with name:', firstAsset?.name);
      setSelectedAsset(firstAsset?.name || firstAssetKey);
    }
  }, [assets, selectedAsset]);

  // Calculate project metrics when data changes - using your exact function
  useEffect(() => {
    if (Object.keys(assets).length > 0 && constants.assetCosts) {
      calculateProjectFinanceMetrics();
    }
  }, [assets, constants, selectedRevenueCase, analysisYears, includeTerminalValue, solveGearing]);

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
      console.log('=== Asset Detail: Calculating project finance metrics ===');
      console.log('Assets:', Object.keys(assets));
      console.log('Constants available:', Object.keys(constants));
      console.log('Asset costs available:', !!constants.assetCosts);
      
      // Ensure we have asset costs initialized
      if (!constants.assetCosts && Object.keys(assets).length > 0) {
        console.log('Initializing asset costs...');
        const updatedConstants = {
          ...constants,
          assetCosts: initializeProjectValues(assets)
        };
        console.log('Initialized asset costs:', updatedConstants.assetCosts);
        setConstants(updatedConstants);
        setHasUnsavedChanges(true);
        return;
      }
      
      if (Object.keys(assets).length === 0) {
        console.log('No assets available');
        return;
      }
      
      if (!constants.assetCosts) {
        console.log('No asset costs available');
        return;
      }
      
      console.log('Using parameters:');
      console.log('- selectedRevenueCase:', selectedRevenueCase);
      console.log('- solveGearing:', solveGearing);
      console.log('- includeTerminalValue:', includeTerminalValue);
      console.log('- analysisYears:', analysisYears);
      
      // Use your exact calculateProjectMetrics function
      const metrics = calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        solveGearing,
        includeTerminalValue
      );
      
      console.log('=== Calculated metrics result ===');
      console.log('Metrics keys:', Object.keys(metrics));
      if (selectedAsset && metrics[selectedAsset]) {
        console.log(`Selected asset (${selectedAsset}) metrics:`, {
          capex: metrics[selectedAsset].capex,
          calculatedGearing: metrics[selectedAsset].calculatedGearing,
          debtAmount: metrics[selectedAsset].debtAmount,
          cashFlowsLength: metrics[selectedAsset].cashFlows?.length,
          equityCashFlowsLength: metrics[selectedAsset].equityCashFlows?.length,
          firstEquityCF: metrics[selectedAsset].equityCashFlows?.[0],
          lastEquityCF: metrics[selectedAsset].equityCashFlows?.[metrics[selectedAsset].equityCashFlows?.length - 1]
        });
      }
      
      setProjectMetrics(metrics);
      
    } catch (error) {
      console.error('Error calculating project metrics:', error);
      console.error('Error stack:', error.stack);
      setProjectMetrics({});
    }
  };

  // Generate quarterly breakdown from your existing annual cash flows
  const quarterlyData = useMemo(() => {
    if (!selectedAsset || !projectMetrics[selectedAsset] || !assets[selectedAsset]) {
      return [];
    }

    const assetData = projectMetrics[selectedAsset];
    const asset = assets[selectedAsset];
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};
    
    console.log('Creating quarterly data for:', selectedAsset);
    console.log('Asset data from your calcs:', assetData);
    console.log('Asset costs:', assetCosts);
    
    const data = [];
    
    // Construction phase - handle equity timing from your calcs
    const constructionDuration = assetCosts.constructionDuration || 12; // months
    const constructionQuarters = Math.ceil(constructionDuration / 3);
    const assetStartDate = new Date(asset.assetStartDate);
    const assetStartYear = assetStartDate.getFullYear();
    
    // Add construction quarters based on your equity timing logic
    const equityAmount = assetData.capex * (1 - assetData.calculatedGearing);
    const debtAmount = assetData.capex * assetData.calculatedGearing;
    const quarterlyCapex = assetData.capex / constructionQuarters;
    
    for (let q = 0; q < constructionQuarters; q++) {
      const constructionYear = assetStartYear - Math.ceil(constructionDuration / 12);
      const quarter = (q % 4) + 1;
      const year = constructionYear + Math.floor(q / 4);
      
      let quarterData = {
        period: `${year}-Q${quarter}`,
        year,
        quarter,
        phase: 'construction',
        operationalYear: null,
        
        // Construction flows
        revenue: 0,
        contractedRevenue: 0,
        merchantRevenue: 0,
        opex: 0,
        operatingCashFlow: 0,
        capexSpend: quarterlyCapex,
        equityInvestment: 0,
        debtDrawdown: quarterlyCapex * assetData.calculatedGearing,
        interestPayment: 0,
        principalPayment: 0,
        debtService: 0,
        equityCashFlow: 0,
        dscr: null,
        debtBalance: 0,
        terminalValue: 0
      };
      
      // Equity timing from your calculations
      if (assetData.equityTimingUpfront) {
        if (q === 0) {
          quarterData.equityInvestment = -equityAmount; // All upfront
        }
      } else {
        quarterData.equityInvestment = -equityAmount / constructionQuarters; // Pro-rata
      }
      
      quarterData.equityCashFlow = quarterData.equityInvestment;
      data.push(quarterData);
    }
    
    // Operational phase - use your exact cash flows
    if (assetData.cashFlows && assetData.cashFlows.length > 0) {
      assetData.cashFlows.forEach((yearCF, operationalYear) => {
        // Split annual cash flows into quarters
        for (let quarter = 1; quarter <= 4; quarter++) {
          const year = assetStartYear + operationalYear;
          
          let quarterData = {
            period: `${year}-Q${quarter}`,
            year,
            quarter,
            phase: 'operational',
            operationalYear,
            
            // Split your annual cash flows by 4
            revenue: yearCF.revenue / 4,
            contractedRevenue: yearCF.contractedRevenue / 4,
            merchantRevenue: yearCF.merchantRevenue / 4,
            opex: yearCF.opex / 4,
            operatingCashFlow: yearCF.operatingCashFlow / 4,
            capexSpend: 0,
            equityInvestment: 0,
            debtDrawdown: 0,
            interestPayment: 0,
            principalPayment: 0,
            debtService: yearCF.debtService / 4,
            equityCashFlow: yearCF.equityCashFlow / 4,
            dscr: yearCF.dscr,
            debtBalance: 0, // Would need debt schedule for this
            terminalValue: 0
          };
          
          // Add terminal value in final quarter if it exists
          if (includeTerminalValue && operationalYear === assetData.cashFlows.length - 1 && quarter === 4) {
            if (yearCF.terminalValue) {
              quarterData.terminalValue = yearCF.terminalValue;
              quarterData.equityCashFlow += yearCF.terminalValue / 4; // Add to final quarter
            }
          }
          
          data.push(quarterData);
        }
      });
    }
    
    console.log('Generated quarterly data from your calcs:', data.slice(0, 8));
    return data;
  }, [selectedAsset, projectMetrics, assets, constants, includeTerminalValue]);

  // Aggregate to yearly if needed
  const displayData = useMemo(() => {
    if (timeView === 'quarterly') {
      return quarterlyData;
    }

    // Aggregate to yearly
    const yearlyData = [];
    const yearGroups = {};
    
    quarterlyData.forEach(quarter => {
      if (!yearGroups[quarter.year]) {
        yearGroups[quarter.year] = {
          period: quarter.year.toString(),
          year: quarter.year,
          phase: quarter.phase,
          operationalYear: quarter.operationalYear,
          quarters: []
        };
      }
      yearGroups[quarter.year].quarters.push(quarter);
    });

    Object.values(yearGroups).forEach(yearGroup => {
      const quarters = yearGroup.quarters;
      const yearData = {
        ...yearGroup,
        revenue: quarters.reduce((sum, q) => sum + q.revenue, 0),
        contractedRevenue: quarters.reduce((sum, q) => sum + q.contractedRevenue, 0),
        merchantRevenue: quarters.reduce((sum, q) => sum + q.merchantRevenue, 0),
        opex: quarters.reduce((sum, q) => sum + q.opex, 0),
        operatingCashFlow: quarters.reduce((sum, q) => sum + q.operatingCashFlow, 0),
        capexSpend: quarters.reduce((sum, q) => sum + q.capexSpend, 0),
        equityInvestment: quarters.reduce((sum, q) => sum + q.equityInvestment, 0),
        debtDrawdown: quarters.reduce((sum, q) => sum + q.debtDrawdown, 0),
        interestPayment: quarters.reduce((sum, q) => sum + q.interestPayment, 0),
        principalPayment: quarters.reduce((sum, q) => sum + q.principalPayment, 0),
        debtService: quarters.reduce((sum, q) => sum + q.debtService, 0),
        equityCashFlow: quarters.reduce((sum, q) => sum + q.equityCashFlow, 0),
        terminalValue: quarters.reduce((sum, q) => sum + (q.terminalValue || 0), 0),
        dscr: quarters.find(q => q.dscr)?.dscr || null,
        debtBalance: quarters[quarters.length - 1]?.debtBalance || 0
      };
      yearlyData.push(yearData);
    });

    return yearlyData;
  }, [quarterlyData, timeView]);

  // Calculate summary metrics using your exact data
  const summaryMetrics = useMemo(() => {
    console.log('=== Calculating summary metrics ===');
    console.log('selectedAsset:', selectedAsset);
    console.log('Has projectMetrics for asset:', !!projectMetrics[selectedAsset]);
    
    if (!selectedAsset || !projectMetrics[selectedAsset]) {
      console.log('Missing data for summary metrics');
      return null;
    }

    // Find the actual asset by name since keys might be numeric
    const assetEntry = Object.entries(assets).find(([key, asset]) => asset.name === selectedAsset);
    if (!assetEntry) {
      console.log('Selected asset not found by name in assets for summary');
      return null;
    }

    const [assetKey, asset] = assetEntry;
    const assetData = projectMetrics[selectedAsset];
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};

    console.log('Building summary from:', {
      assetDataKeys: Object.keys(assetData),
      assetKeys: Object.keys(asset),
      assetCostsKeys: Object.keys(assetCosts)
    });

    const summary = {
      assetName: asset.name,
      assetType: asset.type,
      capacity: parseFloat(asset.capacity) || 0,
      state: asset.state || 'N/A',
      assetStartDate: asset.assetStartDate,
      
      // Use your exact calculated values
      totalCapex: assetData.capex || 0,
      calculatedGearing: assetData.calculatedGearing || 0,
      equityAmount: assetData.capex ? assetData.capex * (1 - assetData.calculatedGearing) : 0,
      debtAmount: assetData.debtAmount || 0,
      annualDebtService: assetData.annualDebtService || 0,
      minDSCR: assetData.minDSCR,
      terminalValue: assetData.terminalValue || 0,
      
      // IRR from your exact equity cash flows
      equityIRR: assetData.equityCashFlows ? calculateIRR(assetData.equityCashFlows) * 100 : null,
      
      // Financing terms
      constructionDuration: assetCosts.constructionDuration || 12,
      interestRate: (assetCosts.interestRate || 0.06) * 100,
      tenorYears: assetCosts.tenorYears || 20,
      equityTimingUpfront: assetData.equityTimingUpfront,
      
      // Contract information
      contractCount: asset.contracts?.length || 0,
      hasContracts: (asset.contracts?.length || 0) > 0,
      
      // Totals from your cash flows
      totalRevenue: assetData.cashFlows ? assetData.cashFlows.reduce((sum, cf) => sum + cf.revenue, 0) : 0,
      totalOpex: assetData.cashFlows ? Math.abs(assetData.cashFlows.reduce((sum, cf) => sum + cf.opex, 0)) : 0,
      totalEquityCashFlow: assetData.cashFlows ? assetData.cashFlows.reduce((sum, cf) => sum + cf.equityCashFlow, 0) : 0
    };
    
    console.log('Generated summary metrics:', summary);
    return summary;
  }, [selectedAsset, projectMetrics, assets, constants]);

  // Format currency
  const formatCurrency = (value) => {
    if (Math.abs(value) >= 1) {
      return `$${value.toFixed(1)}M`;
    } else {
      return `$${(value * 1000).toFixed(0)}K`;
    }
  };

  // Format percentage
  const formatPercent = (value) => `${value.toFixed(1)}%`;

  // Get asset icon
  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'storage': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  // Export data function
  const exportData = () => {
    const csvData = [
      ['Period', 'Phase', 'Revenue', 'OPEX', 'Operating CF', 'CAPEX', 'Equity Investment', 'Debt Drawdown', 'Debt Service', 'Equity CF', 'DSCR']
    ];

    displayData.forEach(row => {
      csvData.push([
        row.period,
        row.phase,
        row.revenue.toFixed(2),
        row.opex.toFixed(2),
        row.operatingCashFlow.toFixed(2),
        row.capexSpend.toFixed(2),
        row.equityInvestment.toFixed(2),
        row.debtDrawdown.toFixed(2),
        row.debtService.toFixed(2),
        row.equityCashFlow.toFixed(2),
        row.dscr ? row.dscr.toFixed(2) : ''
      ]);
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAsset}_cashflows_${timeView}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Show loading state if no user/portfolio selected
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
          <p className="text-gray-600">Loading asset data...</p>
        </div>
      </div>
    );
  }

  if (Object.keys(assets).length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link 
            href="/pages/finance" 
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Finance</span>
          </Link>
          <div className="h-6 border-l border-gray-300"></div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Detail Analysis</h1>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-center text-gray-500 py-12">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No assets available for analysis</p>
            <p className="text-sm mt-2">Configure assets in the Asset Definition page</p>
            <Link 
              href="/pages/assets" 
              className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Go to Asset Definition
            </Link>
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
          <Link 
            href="/pages/finance" 
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Finance</span>
          </Link>
          <div className="h-6 border-l border-gray-300"></div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Detail Analysis</h1>
        </div>
        
        <div className="text-sm text-gray-500">
          Portfolio: {portfolioName} • {Object.keys(assets).length} assets
        </div>
      </div>

      {/* Debug Panel - Remove this once working */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">Debug Info</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <strong>Assets:</strong> {Object.keys(assets).length}
            <br />
            {Object.keys(assets).slice(0, 3).join(', ')}
          </div>
          <div>
            <strong>Selected:</strong> {selectedAsset || 'None'}
            <br />
            <strong>In Assets:</strong> {selectedAsset && Object.values(assets).some(a => a.name === selectedAsset) ? '✓' : '✗'}
          </div>
          <div>
            <strong>Project Metrics:</strong> {Object.keys(projectMetrics).length}
            <br />
            <strong>For Selected:</strong> {selectedAsset && projectMetrics[selectedAsset] ? '✓' : '✗'}
          </div>
          <div>
            <strong>Asset Costs:</strong> {constants.assetCosts ? Object.keys(constants.assetCosts).length : 0}
            <br />
            <strong>Quarterly Data:</strong> {quarterlyData.length} points
          </div>
        </div>
        {selectedAsset && projectMetrics[selectedAsset] && (
          <div className="mt-2 text-xs text-gray-600">
            Selected asset data: CAPEX={projectMetrics[selectedAsset].capex}, 
            Gearing={projectMetrics[selectedAsset].calculatedGearing}, 
            Cash Flows={projectMetrics[selectedAsset].cashFlows?.length || 0}
          </div>
        )}
        <div className="mt-2 text-xs text-blue-600">
          <strong>Asset Names Available:</strong> {Object.values(assets).map(a => a.name).join(', ')}
        </div>
        <div className="mt-1 text-xs text-purple-600">
          <strong>Project Metric Keys:</strong> {Object.keys(projectMetrics).join(', ')}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Time View</label>
            <div className="flex rounded-md border border-gray-300">
              <button
                onClick={() => setTimeView('quarterly')}
                className={`px-3 py-2 text-sm font-medium ${
                  timeView === 'quarterly' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Quarterly
              </button>
              <button
                onClick={() => setTimeView('yearly')}
                className={`px-3 py-2 text-sm font-medium border-l ${
                  timeView === 'yearly' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Case</label>
            <select
              value={selectedRevenueCase}
              onChange={(e) => setSelectedRevenueCase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="base">Base Case</option>
              <option value="worst">Combined Downside</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Period</label>
            <select
              value={analysisYears}
              onChange={(e) => setAnalysisYears(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              Terminal Value
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={exportData}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Asset Summary - using your exact calculated values */}
      {summaryMetrics && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            {getAssetIcon(summaryMetrics.assetType)}
            <h3 className="text-lg font-semibold">{summaryMetrics.assetName} - Project Summary</h3>
            <span className="text-sm text-gray-500">
              ({summaryMetrics.assetType} • {summaryMetrics.state})
            </span>
            <div className="ml-4 text-sm text-blue-600">
              Using Project Finance Calcs - IRR: {summaryMetrics.equityIRR ? formatPercent(summaryMetrics.equityIRR) : 'N/A'}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.capacity}MW</p>
              <p className="text-xs text-gray-600">Capacity</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-900">{formatCurrency(summaryMetrics.totalCapex)}</p>
              <p className="text-xs text-blue-600">Total CAPEX</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-900">{formatPercent(summaryMetrics.calculatedGearing * 100)}</p>
              <p className="text-xs text-purple-600">Calculated Gearing</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-900">
                {summaryMetrics.equityIRR ? formatPercent(summaryMetrics.equityIRR) : 'N/A'}
              </p>
              <p className="text-xs text-green-600">Equity IRR</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-900">{formatCurrency(summaryMetrics.totalRevenue)}</p>
              <p className="text-xs text-yellow-600">Total Revenue</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-900">
                {summaryMetrics.minDSCR ? `${summaryMetrics.minDSCR.toFixed(2)}x` : 'N/A'}
              </p>
              <p className="text-xs text-red-600">Min DSCR</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Construction</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{summaryMetrics.constructionDuration} months</span>
                </div>
                <div className="flex justify-between">
                  <span>Start Date:</span>
                  <span>{new Date(summaryMetrics.assetStartDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equity:</span>
                  <span>{formatCurrency(summaryMetrics.equityAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Debt:</span>
                  <span>{formatCurrency(summaryMetrics.debtAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equity Timing:</span>
                  <span>{summaryMetrics.equityTimingUpfront ? 'Upfront' : 'Pro-rata'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Operations</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total OPEX:</span>
                  <span>{formatCurrency(summaryMetrics.totalOpex)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Annual Debt Service:</span>
                  <span>{formatCurrency(summaryMetrics.annualDebtService)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equity Cash Flow:</span>
                  <span>{formatCurrency(summaryMetrics.totalEquityCashFlow)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal Value:</span>
                  <span>{formatCurrency(summaryMetrics.terminalValue)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-orange-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Financing</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Interest Rate:</span>
                  <span>{formatPercent(summaryMetrics.interestRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tenor:</span>
                  <span>{summaryMetrics.tenorYears} years</span>
                </div>
                <div className="flex justify-between">
                  <span>Contracts:</span>
                  <span className="flex items-center space-x-1">
                    {summaryMetrics.hasContracts ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span>{summaryMetrics.contractCount}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Analysis - Direct from Project Finance */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Annual Cash Flow Analysis</h3>
            <span className="text-sm text-blue-600">(From Project Finance Calculations)</span>
          </div>
          <div className="text-sm text-gray-500">
            {selectedAsset ? `Asset: ${selectedAsset}` : 'No asset selected'}
          </div>
        </div>

        {selectedAsset && projectMetrics[selectedAsset] && projectMetrics[selectedAsset].cashFlows ? (
          <div>
            {/* Summary Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + cf.revenue, 0))}
                </p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(Math.abs(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + cf.opex, 0)))}
                </p>
                <p className="text-sm text-gray-600">Total OPEX</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(Math.abs(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + (cf.debtService || 0), 0)))}
                </p>
                <p className="text-sm text-gray-600">Total Debt Service</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + cf.equityCashFlow, 0))}
                </p>
                <p className="text-sm text-gray-600">Cumulative Equity CF</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {projectMetrics[selectedAsset].minDSCR ? `${projectMetrics[selectedAsset].minDSCR.toFixed(2)}x` : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Min DSCR</p>
              </div>
            </div>

            {/* Cash Flow Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Year</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Revenue ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Contracted ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Merchant ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">OPEX ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Operating CF ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Debt Service ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">DSCR</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Equity CF ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Terminal ($M)</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMetrics[selectedAsset].cashFlows.slice(0, Math.min(30, analysisYears)).map((cf, index) => {
                    const asset = Object.values(assets).find(a => a.name === selectedAsset);
                    const startYear = asset ? new Date(asset.assetStartDate).getFullYear() : 2025;
                    const year = startYear + index;
                    
                    return (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-gray-900">{year}</td>
                        <td className="text-right py-2 px-2 text-green-700">
                          {formatCurrency(cf.revenue)}
                        </td>
                        <td className="text-right py-2 px-2 text-green-600">
                          {formatCurrency(cf.contractedRevenue)}
                        </td>
                        <td className="text-right py-2 px-2 text-green-500">
                          {formatCurrency(cf.merchantRevenue)}
                        </td>
                        <td className="text-right py-2 px-2 text-red-600">
                          {formatCurrency(Math.abs(cf.opex))}
                        </td>
                        <td className="text-right py-2 px-2 text-blue-700">
                          {formatCurrency(cf.operatingCashFlow)}
                        </td>
                        <td className="text-right py-2 px-2 text-purple-600">
                          {cf.debtService ? formatCurrency(Math.abs(cf.debtService)) : '-'}
                        </td>
                        <td className="text-right py-2 px-2 text-gray-700">
                          {cf.dscr ? `${cf.dscr.toFixed(2)}x` : '-'}
                        </td>
                        <td className={`text-right py-2 px-2 font-medium ${
                          cf.equityCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(cf.equityCashFlow)}
                        </td>
                        <td className="text-right py-2 px-2 text-orange-600">
                          {cf.terminalValue ? formatCurrency(cf.terminalValue) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {projectMetrics[selectedAsset].cashFlows.length > 30 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Showing first 30 years of {projectMetrics[selectedAsset].cashFlows.length} total years
              </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Cash Flow Components:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-green-600">Revenue:</span> Total annual revenue from all sources</li>
                    <li>• <span className="text-green-600">Contracted:</span> Fixed price contract revenue</li>
                    <li>• <span className="text-green-500">Merchant:</span> Market price revenue</li>
                    <li>• <span className="text-red-600">OPEX:</span> Operating expenses including maintenance</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Key Metrics:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-blue-600">Operating CF:</span> EBITDA (Revenue - OPEX)</li>
                    <li>• <span className="text-purple-600">Debt Service:</span> Principal and interest payments</li>
                    <li>• <span className="font-medium">DSCR:</span> Debt Service Coverage Ratio</li>
                    <li>• <span className="font-medium">Equity CF:</span> Net cash flow to equity investors</li>
                  </ul>
                </div>
              </div>
              <div className="mt-2 text-center text-blue-600">
                Data sourced directly from Project Finance calculations - IRR: {summaryMetrics?.equityIRR ? formatPercent(summaryMetrics.equityIRR) : 'N/A'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No cash flow data available for selected asset</p>
            <p className="text-sm">Ensure project finance calculations are complete</p>
            {selectedAsset && (
              <div className="mt-2 text-xs text-red-600">
                Debug: Selected="{selectedAsset}", 
                HasMetrics={!!projectMetrics[selectedAsset]}, 
                HasCashFlows={!!(projectMetrics[selectedAsset]?.cashFlows)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}