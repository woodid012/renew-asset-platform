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
  Zap
} from 'lucide-react';
import Link from 'next/link';

// Import calculations
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';

export default function AssetDetailPage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  const { setHasUnsavedChanges } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [projectMetrics, setProjectMetrics] = useState({});
  
  // Configuration
  const [analysisYears, setAnalysisYears] = useState(30);
  const [selectedRevenueCase] = useState('base');
  const [includeTerminalValue] = useState(true);
  const [solveGearing] = useState(true);

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

  // Calculate metrics when data changes
  useEffect(() => {
    if (Object.keys(assets).length > 0 && constants.assetCosts) {
      calculateMetrics();
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
        
        const updatedConstants = {
          ...portfolioData.constants,
          HOURS_IN_YEAR: 8760,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: 2.5,
          referenceYear: 2025
        };

        if (!updatedConstants.assetCosts && Object.keys(portfolioData.assets || {}).length > 0) {
          updatedConstants.assetCosts = initializeProjectValues(portfolioData.assets || {});
          setHasUnsavedChanges(true);
        }

        setConstants(updatedConstants);
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
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

  const calculateMetrics = () => {
    try {
      if (!constants.assetCosts && Object.keys(assets).length > 0) {
        const updatedConstants = {
          ...constants,
          assetCosts: initializeProjectValues(assets)
        };
        setConstants(updatedConstants);
        setHasUnsavedChanges(true);
        return;
      }
      
      if (Object.keys(assets).length === 0 || !constants.assetCosts) return;
      
      const metrics = calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        solveGearing,
        includeTerminalValue
      );
      
      setProjectMetrics(metrics);
      
    } catch (error) {
      console.error('Error calculating project metrics:', error);
      setProjectMetrics({});
    }
  };

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    if (!selectedAsset || !projectMetrics[selectedAsset]) return null;

    const assetEntry = Object.entries(assets).find(([key, asset]) => asset.name === selectedAsset);
    if (!assetEntry) return null;

    const [assetKey, asset] = assetEntry;
    const assetData = projectMetrics[selectedAsset];
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};

    return {
      assetName: asset.name,
      assetType: asset.type,
      capacity: parseFloat(asset.capacity) || 0,
      state: asset.state || 'N/A',
      assetStartDate: asset.assetStartDate,
      
      totalCapex: assetData.capex || 0,
      calculatedGearing: assetData.calculatedGearing || 0,
      equityAmount: assetData.capex ? assetData.capex * (1 - assetData.calculatedGearing) : 0,
      debtAmount: assetData.debtAmount || 0,
      minDSCR: assetData.minDSCR,
      terminalValue: assetData.terminalValue || 0,
      
      equityIRR: assetData.equityCashFlows ? calculateIRR(assetData.equityCashFlows) * 100 : null,
      
      constructionDuration: assetCosts.constructionDuration || 12,
      interestRate: (assetCosts.interestRate || 0.06) * 100,
      tenorYears: assetCosts.tenorYears || 20,
      equityTimingUpfront: assetData.equityTimingUpfront,
      
      contractCount: asset.contracts?.length || 0,
      hasContracts: (asset.contracts?.length || 0) > 0,
      
      totalRevenue: assetData.cashFlows ? assetData.cashFlows.reduce((sum, cf) => sum + cf.revenue, 0) : 0,
      totalOpex: assetData.cashFlows ? Math.abs(assetData.cashFlows.reduce((sum, cf) => sum + cf.opex, 0)) : 0,
      totalEquityCashFlow: assetData.cashFlows ? assetData.cashFlows.reduce((sum, cf) => sum + cf.equityCashFlow, 0) : 0
    };
  }, [selectedAsset, projectMetrics, assets, constants]);

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

  const exportData = () => {
    if (!selectedAsset || !projectMetrics[selectedAsset]?.cashFlows) return;

    const csvData = [
      ['Year', 'Revenue', 'Contracted', 'Merchant', 'OPEX', 'Operating CF', 'Debt Service', 'DSCR', 'Equity CF', 'Terminal']
    ];

    const assetData = projectMetrics[selectedAsset];
    const asset = Object.values(assets).find(a => a.name === selectedAsset);
    const startYear = asset ? new Date(asset.assetStartDate).getFullYear() : 2025;

    assetData.cashFlows.forEach((cf, index) => {
      csvData.push([
        startYear + index,
        cf.revenue.toFixed(2),
        cf.contractedRevenue.toFixed(2),
        cf.merchantRevenue.toFixed(2),
        cf.opex.toFixed(2),
        cf.operatingCashFlow.toFixed(2),
        (cf.debtService || 0).toFixed(2),
        cf.dscr ? cf.dscr.toFixed(2) : '',
        cf.equityCashFlow.toFixed(2),
        (cf.terminalValue || 0).toFixed(2)
      ]);
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAsset}_operational_cashflows.csv`;
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
          <p className="text-gray-600">Loading asset data...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Asset Detail Analysis</h1>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-center text-gray-500 py-12">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No assets available for analysis</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/pages/finance" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
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

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
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
            <span className="text-sm font-medium text-gray-700">Terminal Value: ✓ Included</span>
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

      {/* Asset Summary */}
      {summaryMetrics && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            {getAssetIcon(summaryMetrics.assetType)}
            <h3 className="text-lg font-semibold">{summaryMetrics.assetName} - Project Summary</h3>
            <span className="text-sm text-gray-500">({summaryMetrics.assetType} • {summaryMetrics.state})</span>
            <div className="ml-4 text-sm text-blue-600">
              IRR: {summaryMetrics.equityIRR ? formatPercent(summaryMetrics.equityIRR) : 'N/A'}
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

      {/* Complete Project Cash Flow Analysis */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Complete Project Cash Flow Analysis</h3>
            <span className="text-sm text-blue-600">(Investment + Operations Timeline)</span>
          </div>
          <div className="text-sm text-gray-500">
            {selectedAsset ? `Asset: ${selectedAsset}` : 'No asset selected'}
          </div>
        </div>

        {selectedAsset && projectMetrics[selectedAsset] && (projectMetrics[selectedAsset].cashFlows || projectMetrics[selectedAsset].equityCashFlows) ? (
          <div>
            {/* Summary Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(Math.abs(summaryMetrics?.equityAmount || 0))}
                </p>
                <p className="text-sm text-red-600">Total Investment</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {projectMetrics[selectedAsset].cashFlows ? formatCurrency(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + cf.revenue, 0)) : '0'}
                </p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {projectMetrics[selectedAsset].cashFlows ? formatCurrency(Math.abs(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + cf.opex, 0))) : '0'}
                </p>
                <p className="text-sm text-gray-600">Total OPEX</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {projectMetrics[selectedAsset].cashFlows ? formatCurrency(projectMetrics[selectedAsset].cashFlows.reduce((sum, cf) => sum + (cf.equityCashFlow - (cf.terminalValue || 0)), 0)) : '0'}
                </p>
                <p className="text-sm text-gray-600">Operating Equity CF</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(summaryMetrics?.terminalValue || 0)}
                </p>
                <p className="text-sm text-gray-600">Terminal Value</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-900">
                  {summaryMetrics?.equityIRR ? `${summaryMetrics.equityIRR.toFixed(1)}%` : 'N/A'}
                </p>
                <p className="text-sm text-purple-600">Equity IRR</p>
              </div>
            </div>

            {/* Complete Cash Flow Table - Construction + Operations */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Year</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Phase</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">Investment CF ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Volume (GWh)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Price ($/MWh)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Revenue ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Contracted ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Merchant ($M)</th>
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
                  {(() => {
                    const asset = Object.values(assets).find(a => a.name === selectedAsset);
                    const assetData = projectMetrics[selectedAsset];
                    const assetCosts = constants.assetCosts?.[selectedAsset] || {};
                    const assetStartDate = asset ? new Date(asset.assetStartDate) : new Date();
                    const assetStartYear = assetStartDate.getFullYear();
                    const constructionDuration = assetCosts.constructionDuration || 12; // months
                    const constructionYears = Math.ceil(constructionDuration / 12);
                    
                    const rows = [];
                    
                    // Construction Phase Rows
                    if (assetData.equityTimingUpfront) {
                      // Year 0 - Upfront equity investment
                      const investmentYear = assetStartYear - constructionYears;
                      const equityInvestment = assetData.capex * (1 - assetData.calculatedGearing);
                      
                      rows.push(
                        <tr key="construction-0" className="border-b border-gray-100 hover:bg-red-25 bg-red-50">
                          <td className="py-2 px-2 font-medium text-gray-900">{investmentYear}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Investment</span>
                          </td>
                          <td className="text-right py-2 px-2 text-red-700 bg-red-50 font-medium">
                            {formatCurrency(-equityInvestment)}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-gray-400">-</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-green-25 font-medium">
                            {formatCurrency(-equityInvestment)}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-orange-25">-</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-blue-25 font-medium">
                            {formatCurrency(-equityInvestment)}
                          </td>
                        </tr>
                      );
                    } else {
                      // Pro-rata equity investment over construction period
                      const equityPerYear = (assetData.capex * (1 - assetData.calculatedGearing)) / constructionYears;
                      
                      for (let i = 0; i < constructionYears; i++) {
                        const investmentYear = assetStartYear - constructionYears + i;
                        
                        rows.push(
                          <tr key={`construction-${i}`} className="border-b border-gray-100 hover:bg-red-25 bg-red-50">
                            <td className="py-2 px-2 font-medium text-gray-900">{investmentYear}</td>
                            <td className="py-2 px-2">
                              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Investment</span>
                            </td>
                            <td className="text-right py-2 px-2 text-red-700 bg-red-50 font-medium">
                              {formatCurrency(-equityPerYear)}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-gray-400">-</td>
                            <td className="text-right py-2 px-2 text-red-700 bg-green-25 font-medium">
                              {formatCurrency(-equityPerYear)}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-orange-25">-</td>
                            <td className="text-right py-2 px-2 text-red-700 bg-blue-25 font-medium">
                              {formatCurrency(-equityPerYear)}
                            </td>
                          </tr>
                        );
                      }
                    }
                    
                    // Operational Phase Rows
                    if (assetData.cashFlows) {
                      assetData.cashFlows.slice(0, Math.min(30, analysisYears)).forEach((cf, index) => {
                        const year = assetStartYear + index;
                        const terminalValue = cf.terminalValue || 0;
                        const operationalEquityCF = cf.equityCashFlow - terminalValue;
                        
                        // Calculate volume and average price using your revenue calculation system
                        const asset = Object.values(assets).find(a => a.name === selectedAsset);
                        
                        // Get volume from revenue calculations (already includes capacity factors, degradation, etc.)
                        const volume = cf.annualGeneration ? cf.annualGeneration / 1000 : 0; // Convert MWh to GWh
                        const avgPrice = volume > 0 ? (cf.revenue * 1000000) / (volume * 1000) : 0; // $/MWh
                        
                        // Net cash flow = Investment CF + Equity CF + Terminal Value
                        const netCashFlow = 0 + operationalEquityCF + terminalValue;
                        
                        rows.push(
                          <tr key={`operational-${index}`} className="border-b border-gray-100 hover:bg-green-25">
                            <td className="py-2 px-2 font-medium text-gray-900">{year}</td>
                            <td className="py-2 px-2">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Operations</span>
                            </td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-red-25">-</td>
                            <td className="text-right py-2 px-2 text-blue-600">
                              {volume.toFixed(1)}
                            </td>
                            <td className="text-right py-2 px-2 text-blue-600">
                              ${avgPrice.toFixed(0)}
                            </td>
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
                            <td className={`text-right py-2 px-2 font-medium bg-green-25 ${
                              operationalEquityCF >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(operationalEquityCF)}
                            </td>
                            <td className="text-right py-2 px-2 text-orange-600 bg-orange-25">
                              {terminalValue ? formatCurrency(terminalValue) : '-'}
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

            {(() => {
              const assetData = projectMetrics[selectedAsset];
              return (assetData?.cashFlows && assetData.cashFlows.length > 30) && (
                <div className="mt-4 text-sm text-gray-500 text-center">
                  Showing first 30 operational years of {assetData.cashFlows.length} total years
                </div>
              );
            })()}

            <div className="mt-4 text-sm text-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Complete Project Timeline:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-red-600">Investment Phase:</span> Construction period equity investments</li>
                    <li>• <span className="text-blue-600">Volume & Price:</span> Annual generation (GWh) and average price ($/MWh)</li>
                    <li>• <span className="text-green-600">Operations Phase:</span> Revenue generation and cash flows</li>
                    <li>• <span className="text-blue-600">Net CF:</span> Total net cash flow (Investment + Equity + Terminal)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Cash Flow Components:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-blue-600">Operating CF:</span> EBITDA (Revenue - OPEX)</li>
                    <li>• <span className="text-purple-600">Debt Service:</span> Principal and interest payments during operations</li>
                    <li>• <span className="text-orange-600">Terminal Value:</span> Asset residual value (final year only)</li>
                    <li>• <span className="font-medium">Equity IRR:</span> {summaryMetrics?.equityIRR ? `${summaryMetrics.equityIRR.toFixed(1)}%` : 'N/A'} based on complete timeline</li>
                  </ul>
                </div>
              </div>
              <div className="mt-2 text-center text-blue-600 bg-blue-50 p-2 rounded">
                ✓ Complete project timeline from initial investment through asset life - showing both construction and operational phases
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No cash flow data available for selected asset</p>
            <p className="text-sm">Ensure project finance calculations are complete</p>
          </div>
        )}
      </div>
    </div>
  );
}