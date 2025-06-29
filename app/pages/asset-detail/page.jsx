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
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import Link from 'next/link';

// Import calculations
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';

export default function EnhancedMonthlyAssetDetailPage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  const { setHasUnsavedChanges } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [monthlyMetrics, setMonthlyMetrics] = useState({});
  const [projectMetrics, setProjectMetrics] = useState({});
  const [debugVisible, setDebugVisible] = useState(false);
  
  // Configuration
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
    if (Object.keys(assets).length > 0 && constants.assetCosts && selectedAsset) {
      calculateAllMetrics();
    }
  }, [assets, constants, selectedAsset, selectedRevenueCase, includeTerminalValue, solveGearing]);

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

  const calculateAllMetrics = () => {
    try {
      // Calculate project metrics (for IRR, debt service, etc.)
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

      // Calculate monthly metrics
      calculateMonthlyMetrics();
      
    } catch (error) {
      console.error('Error calculating metrics:', error);
      setProjectMetrics({});
      setMonthlyMetrics({});
    }
  };

  const calculateMonthlyMetrics = () => {
    try {
      if (!selectedAsset || !assets[selectedAsset] && !Object.values(assets).find(a => a.name === selectedAsset)) {
        return;
      }

      const asset = Object.values(assets).find(a => a.name === selectedAsset);
      if (!asset) return;

      // Get asset life for operations period
      const operationsPeriod = asset.assetLife || 25;
      const assetStartDate = new Date(asset.assetStartDate || '2025-01-01');
      const totalMonths = operationsPeriod * 12;
      const capacity = parseFloat(asset.capacity) || 0;

      // Generate monthly timeseries
      const monthlyData = [];
      
      for (let month = 0; month < totalMonths; month++) {
        const currentDate = new Date(assetStartDate);
        currentDate.setMonth(currentDate.getMonth() + month);
        
        const year = currentDate.getFullYear();
        const monthIndex = currentDate.getMonth(); // 0-11
        const quarter = Math.floor(monthIndex / 3) + 1;
        
        // Get quarterly capacity factor and apply it properly
        const qtrCapacityFactor = parseFloat(asset[`qtrCapacityFactor_q${quarter}`]) || 0;
        
        // Calculate monthly generation using capacity factor approach
        // Monthly generation = Capacity (MW) × Hours in Month × Capacity Factor / 100
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const hoursInMonth = daysInMonth * 24;
        const monthlyGenerationFromCF = capacity * hoursInMonth * (qtrCapacityFactor / 100);
        
        // Apply volume loss adjustment
        const volumeLossAdjustment = parseFloat(asset.volumeLossAdjustment) || 100;
        const adjustedGeneration = monthlyGenerationFromCF * (volumeLossAdjustment / 100);
        
        // Apply degradation for this specific month
        const yearsSinceStart = month / 12;
        const degradationFactor = Math.pow(1 - (parseFloat(asset.annualDegradation) || 0.5) / 100, yearsSinceStart);
        const monthlyGeneration = adjustedGeneration * degradationFactor;
        
        // Get merchant price for this month
        const merchantPrice = getMerchantPrice(asset.state, currentDate) || 0;
        
        // Calculate contracted and merchant revenue
        let contractedRevenue = 0;
        let merchantRevenue = 0;
        
        if (asset.contracts && asset.contracts.length > 0) {
          asset.contracts.forEach(contract => {
            const contractStart = new Date(contract.startDate);
            const contractEnd = new Date(contract.endDate);
            
            if (currentDate >= contractStart && currentDate <= contractEnd) {
              // Contract is active this month
              const contractedVolume = monthlyGeneration * (parseFloat(contract.buyersPercentage) || 0) / 100;
              
              // Calculate escalated strike price
              const contractYears = year - (contract.indexationReferenceYear || year);
              const escalationFactor = Math.pow(1 + (parseFloat(contract.indexation) || 2.5) / 100, contractYears);
              const escalatedStrikePrice = (parseFloat(contract.strikePrice) || 0) * escalationFactor;
              
              contractedRevenue += (contractedVolume / 1000) * escalatedStrikePrice / 1000000; // Convert to $M
              
              // Remaining volume goes to merchant
              const merchantVolume = monthlyGeneration - contractedVolume;
              merchantRevenue += (merchantVolume / 1000) * merchantPrice / 1000000; // Convert to $M
            } else {
              // No contract, all merchant
              merchantRevenue += (monthlyGeneration / 1000) * merchantPrice / 1000000; // Convert to $M
            }
          });
        } else {
          // No contracts, all merchant
          merchantRevenue += (monthlyGeneration / 1000) * merchantPrice / 1000000; // Convert to $M
        }
        
        const totalRevenue = contractedRevenue + merchantRevenue;
        
        // Calculate monthly OPEX
        const assetCosts = constants.assetCosts?.[selectedAsset] || {};
        const annualOpex = parseFloat(assetCosts.operatingCosts) || 0;
        const monthlyOpex = annualOpex / 12;
        
        // Calculate escalated OPEX
        const opexEscalationFactor = Math.pow(1 + (parseFloat(assetCosts.operatingCostEscalation) || 2.5) / 100, yearsSinceStart);
        const escalatedMonthlyOpex = monthlyOpex * opexEscalationFactor;
        
        const operatingCashFlow = totalRevenue - escalatedMonthlyOpex;
        
        monthlyData.push({
          date: new Date(currentDate),
          year,
          month: monthIndex + 1,
          quarter,
          monthIndex: month,
          monthlyGeneration, // MWh
          degradationFactor,
          merchantPrice,
          contractedRevenue,
          merchantRevenue,
          totalRevenue,
          monthlyOpex: escalatedMonthlyOpex,
          operatingCashFlow,
          capacity: capacity,
          capacityFactor: qtrCapacityFactor,
          volumeLossAdjustment: volumeLossAdjustment,
          annualDegradation: parseFloat(asset.annualDegradation) || 0.5,
          hoursInMonth,
          daysInMonth
        });
      }
      
      setMonthlyMetrics({
        [selectedAsset]: {
          monthlyData,
          totalRevenue: monthlyData.reduce((sum, data) => sum + data.totalRevenue, 0),
          totalOpex: monthlyData.reduce((sum, data) => sum + data.monthlyOpex, 0),
          totalOperatingCF: monthlyData.reduce((sum, data) => sum + data.operatingCashFlow, 0),
          totalGeneration: monthlyData.reduce((sum, data) => sum + data.monthlyGeneration, 0),
          averageCapacityFactor: monthlyData.reduce((sum, data) => sum + data.capacityFactor, 0) / monthlyData.length,
          operationsPeriod
        }
      });
      
    } catch (error) {
      console.error('Error calculating monthly metrics:', error);
      setMonthlyMetrics({});
    }
  };

  // Export monthly data functionality
  const exportMonthlyData = () => {
    if (!selectedAsset || !monthlyMetrics[selectedAsset]?.monthlyData) return;

    const csvData = [
      ['Date', 'Year', 'Month', 'Quarter', 'Generation (MWh)', 'Capacity Factor (%)', 'Degradation (%)', 'Days', 'Hours', 'Price ($/MWh)', 'Contracted Revenue ($M)', 'Merchant Revenue ($M)', 'Total Revenue ($M)', 'OPEX ($M)', 'Operating CF ($M)']
    ];

    monthlyMetrics[selectedAsset].monthlyData.forEach((data) => {
      csvData.push([
        data.date.toISOString().slice(0, 7), // YYYY-MM format
        data.year,
        data.month,
        data.quarter,
        data.monthlyGeneration.toFixed(2),
        data.capacityFactor.toFixed(2),
        (data.degradationFactor * 100).toFixed(2),
        data.daysInMonth,
        data.hoursInMonth,
        data.merchantPrice.toFixed(2),
        data.contractedRevenue.toFixed(6),
        data.merchantRevenue.toFixed(6),
        data.totalRevenue.toFixed(6),
        data.monthlyOpex.toFixed(6),
        data.operatingCashFlow.toFixed(6)
      ]);
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAsset}_monthly_analysis.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Debug information for linked inputs
  const debugInfo = useMemo(() => {
    if (!selectedAsset || !assets[selectedAsset] && !Object.values(assets).find(a => a.name === selectedAsset)) {
      return null;
    }

    const asset = Object.values(assets).find(a => a.name === selectedAsset);
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};
    
    return {
      // Asset Definition Inputs
      assetName: asset?.name,
      assetType: asset?.type,
      capacity: asset?.capacity,
      state: asset?.state,
      assetLife: asset?.assetLife,
      assetStartDate: asset?.assetStartDate,
      constructionStartDate: asset?.constructionStartDate,
      
      // Volume & Generation Inputs
      assetVolume: asset?.volume,
      qtrCapacityFactor_q1: asset?.qtrCapacityFactor_q1,
      qtrCapacityFactor_q2: asset?.qtrCapacityFactor_q2,
      qtrCapacityFactor_q3: asset?.qtrCapacityFactor_q3,
      qtrCapacityFactor_q4: asset?.qtrCapacityFactor_q4,
      volumeLossAdjustment: asset?.volumeLossAdjustment,
      annualDegradation: asset?.annualDegradation,
      
      // Financial Inputs
      operatingCosts: assetCosts.operatingCosts,
      operatingCostEscalation: assetCosts.operatingCostEscalation,
      capex: assetCosts.capex,
      terminalValue: assetCosts.terminalValue,
      
      // Contract Information
      contractCount: asset?.contracts?.length || 0,
      activeContracts: asset?.contracts?.filter(c => {
        const now = new Date();
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return now >= start && now <= end;
      }).length || 0,
      
      // Calculated Values
      operationsPeriod: asset?.assetLife || 25,
      totalMonths: (asset?.assetLife || 25) * 12,
      
      // Price Source
      priceSource: constants.priceSource || 'merchant_price_monthly.csv'
    };
  }, [selectedAsset, assets, constants]);

  // Summary metrics combining both monthly and project finance
  const summaryMetrics = useMemo(() => {
    if (!selectedAsset || !monthlyMetrics[selectedAsset]) return null;

    const assetEntry = Object.entries(assets).find(([key, asset]) => asset.name === selectedAsset);
    if (!assetEntry) return null;

    const [assetKey, asset] = assetEntry;
    const monthlyData = monthlyMetrics[selectedAsset];
    const assetData = projectMetrics[selectedAsset];
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};

    return {
      assetName: asset.name,
      assetType: asset.type,
      capacity: parseFloat(asset.capacity) || 0,
      state: asset.state,
      assetStartDate: asset.assetStartDate,
      
      operationsPeriod: monthlyData.operationsPeriod,
      totalMonths: monthlyData.operationsPeriod * 12,
      
      // Monthly totals
      totalRevenue: monthlyData.totalRevenue || 0,
      totalOpex: monthlyData.totalOpex || 0,
      totalOperatingCF: monthlyData.totalOperatingCF || 0,
      totalGeneration: monthlyData.totalGeneration || 0,
      averageCapacityFactor: monthlyData.averageCapacityFactor || 0,
      
      // Project finance metrics
      totalCapex: assetData?.capex || assetCosts.capex || 0,
      calculatedGearing: assetData?.calculatedGearing || 0,
      equityAmount: assetData?.capex ? assetData.capex * (1 - (assetData.calculatedGearing || 0)) : 0,
      debtAmount: assetData?.debtAmount || 0,
      minDSCR: assetData?.minDSCR,
      terminalValue: assetData?.terminalValue || assetCosts.terminalValue || 0,
      equityIRR: assetData?.equityCashFlows ? calculateIRR(assetData.equityCashFlows) * 100 : null,
      
      // Construction details
      constructionDuration: assetCosts.constructionDuration || 12,
      interestRate: (assetCosts.interestRate || 0.06) * 100,
      tenorYears: assetCosts.tenorYears || 20,
      equityTimingUpfront: assetData?.equityTimingUpfront,
      
      contractCount: asset.contracts?.length || 0,
      hasContracts: (asset.contracts?.length || 0) > 0,
    };
  }, [selectedAsset, monthlyMetrics, projectMetrics, assets, constants]);

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
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Monthly Asset Analysis</h1>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-center text-gray-500 py-12">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No assets available</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Monthly Asset Analysis</h1>
        </div>
        
        <div className="text-sm text-gray-500">
          Portfolio: {portfolioName} • {Object.keys(assets).length} assets
        </div>
      </div>

      {/* Debug Information Overlay */}
      {debugInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-medium text-blue-900">Input Values & Capacity Factor Debug</h3>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Showing CF Calculation Method</span>
            </div>
            <button
              onClick={() => setDebugVisible(!debugVisible)}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
            >
              {debugVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="text-sm">{debugVisible ? 'Hide' : 'Show'}</span>
            </button>
          </div>
          
          {debugVisible && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Asset Info</div>
                <div className="space-y-1">
                  <div>Name: <span className="font-mono">{debugInfo.assetName}</span></div>
                  <div>Type: <span className="font-mono">{debugInfo.assetType}</span></div>
                  <div>Capacity: <span className="font-mono">{debugInfo.capacity}MW</span></div>
                  <div>State: <span className="font-mono">{debugInfo.state}</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Capacity Factors</div>
                <div className="space-y-1">
                  <div>Q1: <span className="font-mono text-blue-600">{debugInfo.qtrCapacityFactor_q1}%</span></div>
                  <div>Q2: <span className="font-mono text-blue-600">{debugInfo.qtrCapacityFactor_q2}%</span></div>
                  <div>Q3: <span className="font-mono text-blue-600">{debugInfo.qtrCapacityFactor_q3}%</span></div>
                  <div>Q4: <span className="font-mono text-blue-600">{debugInfo.qtrCapacityFactor_q4}%</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Generation Method</div>
                <div className="space-y-1">
                  <div className="text-green-600">✓ Using CF Method</div>
                  <div>Formula: <span className="font-mono text-xs">MW × Hours × CF%</span></div>
                  <div>Loss Adj: <span className="font-mono">{debugInfo.volumeLossAdjustment}%</span></div>
                  <div>Degradation: <span className="font-mono">{debugInfo.annualDegradation}%/y</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Operations</div>
                <div className="space-y-1">
                  <div>Asset Life: <span className="font-mono">{debugInfo.assetLife}y</span></div>
                  <div>Start Date: <span className="font-mono text-xs">{debugInfo.assetStartDate}</span></div>
                  <div>Total Months: <span className="font-mono">{debugInfo.totalMonths}</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Costs</div>
                <div className="space-y-1">
                  <div>OPEX: <span className="font-mono">${debugInfo.operatingCosts}M/y</span></div>
                  <div>Escalation: <span className="font-mono">{debugInfo.operatingCostEscalation}%</span></div>
                  <div>CAPEX: <span className="font-mono">${debugInfo.capex}M</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Contracts</div>
                <div className="space-y-1">
                  <div>Total: <span className="font-mono">{debugInfo.contractCount}</span></div>
                  <div>Active: <span className="font-mono">{debugInfo.activeContracts}</span></div>
                  <div>Price: <span className="font-mono text-xs">{debugInfo.priceSource}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Operations Period</label>
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600">
              {debugInfo ? `${debugInfo.assetLife} years (${debugInfo.totalMonths} months)` : 'N/A'}
            </div>
          </div>

          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700">Method: Capacity Factor + Monthly</span>
          </div>

          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700">Project Finance: ✓ Integrated</span>
          </div>
        </div>
      </div>

      {/* Enhanced Asset Summary */}
      {summaryMetrics && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            {getAssetIcon(summaryMetrics.assetType)}
            <h3 className="text-lg font-semibold">{summaryMetrics.assetName} - Complete Analysis</h3>
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
              <p className="text-xs text-purple-600">Gearing</p>
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
              <h4 className="font-medium text-gray-900 mb-2">Monthly Analysis</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Months:</span>
                  <span>{summaryMetrics.totalMonths}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg CF:</span>
                  <span>{formatPercent(summaryMetrics.averageCapacityFactor)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Generation:</span>
                  <span>{(summaryMetrics.totalGeneration / 1000).toFixed(1)}GWh</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Financial</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Operating CF:</span>
                  <span>{formatCurrency(summaryMetrics.totalOperatingCF)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equity Amount:</span>
                  <span>{formatCurrency(summaryMetrics.equityAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal Value:</span>
                  <span>{formatCurrency(summaryMetrics.terminalValue)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-orange-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Project Finance</h4>
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

        <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Project Finance Cash Flow Timeline</h3>
            <span className="text-sm text-blue-600">(Construction + Operations)</span>
          </div>
          <div className="text-sm text-gray-500">
            {selectedAsset && monthlyMetrics[selectedAsset] ? 
              `${monthlyMetrics[selectedAsset].monthlyData?.length || 0} months` : 
              'No data'
            }
          </div>
        </div>

        {selectedAsset && monthlyMetrics[selectedAsset]?.monthlyData ? (
          <div>
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-900">
                  {(summaryMetrics?.totalGeneration / 1000).toFixed(1)}GWh
                </p>
                <p className="text-sm text-blue-600">Total Generation</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(summaryMetrics?.totalRevenue || 0)}
                </p>
                <p className="text-sm text-green-600">Total Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(summaryMetrics?.totalOpex || 0)}
                </p>
                <p className="text-sm text-red-600">Total OPEX</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-900">
                  {formatCurrency(summaryMetrics?.totalOperatingCF || 0)}
                </p>
                <p className="text-sm text-purple-600">Operating CF</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatPercent(summaryMetrics?.averageCapacityFactor || 0)}
                </p>
                <p className="text-sm text-gray-600">Avg CF</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-900">
                  {formatCurrency(summaryMetrics?.terminalValue || 0)}
                </p>
                <p className="text-sm text-orange-600">Terminal Value</p>
              </div>
            </div>

            {/* Monthly Cash Flow Table - Project Finance Focus */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900 bg-gray-50">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900 bg-gray-50">Year</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">Investing CF ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">(D + E) ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Revenue ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">OPEX ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-yellow-50">CFADS ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-purple-50">Debt P&I ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">CF after Debt ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-orange-50">Terminal Value ($M)</th>
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
                    if (assetData?.equityTimingUpfront) {
                      // Year 0 - Upfront equity investment
                      const investmentYear = assetStartYear - constructionYears;
                      const equityInvestment = (assetData.capex || 0) * (1 - (assetData.calculatedGearing || 0));
                      const debtInvestment = (assetData.capex || 0) * (assetData.calculatedGearing || 0);
                      const totalInvestment = equityInvestment + debtInvestment;
                      
                      rows.push(
                        <tr key="construction-0" className="border-b border-gray-100 hover:bg-red-25 bg-red-50">
                          <td className="py-2 px-2 font-medium text-gray-900">{investmentYear}</td>
                          <td className="py-2 px-2 font-medium text-gray-900">{investmentYear}</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-red-50 font-medium">
                            {formatCurrency(-equityInvestment)}
                          </td>
                          <td className="text-right py-2 px-2 text-blue-700 bg-blue-25 font-medium">
                            {formatCurrency(totalInvestment)}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-green-25">-</td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-red-25">-</td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-yellow-25">-</td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-purple-25">-</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-green-25 font-medium">
                            {formatCurrency(-equityInvestment)}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-400 bg-orange-25">-</td>
                          <td className="text-right py-2 px-2 text-red-700 bg-blue-25 font-medium">
                            {formatCurrency(-equityInvestment)}
                          </td>
                        </tr>
                      );
                    } else if (assetData?.capex) {
                      // Pro-rata equity investment over construction period
                      const equityPerYear = (assetData.capex * (1 - (assetData.calculatedGearing || 0))) / constructionYears;
                      const debtPerYear = (assetData.capex * (assetData.calculatedGearing || 0)) / constructionYears;
                      const totalPerYear = equityPerYear + debtPerYear;
                      
                      for (let i = 0; i < constructionYears; i++) {
                        const investmentYear = assetStartYear - constructionYears + i;
                        
                        rows.push(
                          <tr key={`construction-${i}`} className="border-b border-gray-100 hover:bg-red-25 bg-red-50">
                            <td className="py-2 px-2 font-medium text-gray-900">{investmentYear}</td>
                            <td className="py-2 px-2 font-medium text-gray-900">{investmentYear}</td>
                            <td className="text-right py-2 px-2 text-red-700 bg-red-50 font-medium">
                              {formatCurrency(-equityPerYear)}
                            </td>
                            <td className="text-right py-2 px-2 text-blue-700 bg-blue-25 font-medium">
                              {formatCurrency(totalPerYear)}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-green-25">-</td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-red-25">-</td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-yellow-25">-</td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-purple-25">-</td>
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
                    
                    // Operational Phase Rows - showing monthly data with project finance metrics
                    if (monthlyMetrics[selectedAsset]?.monthlyData) {
                      const monthlyData = monthlyMetrics[selectedAsset].monthlyData;
                      
                      // Display monthly operational data
                      monthlyData.slice(0, 120).forEach((monthData, index) => {
                        const currentDate = monthData.date;
                        const year = monthData.year;
                        const month = monthData.month;
                        
                        // Calculate monthly debt service from annual debt service
                        const yearIndex = Math.floor(index / 12);
                        let monthlyDebtService = 0;
                        let terminalValue = 0;
                        
                        if (assetData?.cashFlows && yearIndex < assetData.cashFlows.length) {
                          const cf = assetData.cashFlows[yearIndex];
                          const annualDebtService = Math.abs(cf.debtService || 0);
                          monthlyDebtService = annualDebtService / 12; // Spread annual debt service across 12 months
                          
                          // Terminal value only in final month of final year
                          if (index === monthlyData.length - 1) {
                            terminalValue = cf.terminalValue || 0;
                          }
                        }
                        
                        const cfads = monthData.operatingCashFlow; // Already calculated as Revenue - OPEX
                        const cfAfterDebt = cfads - monthlyDebtService;
                        const netCF = cfAfterDebt + terminalValue;
                        
                        rows.push(
                          <tr key={`operational-${index}`} className="border-b border-gray-100 hover:bg-green-25">
                            <td className="py-2 px-2 font-medium text-gray-900">{currentDate.toISOString().slice(0, 7)}</td>
                            <td className="py-2 px-2 font-medium text-gray-900">{year}</td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-red-25">-</td>
                            <td className="text-right py-2 px-2 text-gray-400 bg-blue-25">-</td>
                            <td className="text-right py-2 px-2 text-green-700 bg-green-25">
                              {formatCurrency(monthData.totalRevenue)}
                            </td>
                            <td className="text-right py-2 px-2 text-red-600 bg-red-25">
                              {formatCurrency(monthData.monthlyOpex)}
                            </td>
                            <td className="text-right py-2 px-2 text-yellow-700 bg-yellow-25">
                              {formatCurrency(cfads)}
                            </td>
                            <td className="text-right py-2 px-2 text-purple-600 bg-purple-25">
                              {monthlyDebtService > 0 ? formatCurrency(monthlyDebtService) : '-'}
                            </td>
                            <td className={`text-right py-2 px-2 font-medium bg-green-25 ${
                              cfAfterDebt >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(cfAfterDebt)}
                            </td>
                            <td className="text-right py-2 px-2 text-orange-600 bg-orange-25">
                              {terminalValue > 0 ? formatCurrency(terminalValue) : '-'}
                            </td>
                            <td className={`text-right py-2 px-2 font-bold bg-blue-25 ${
                              netCF >= 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(netCF)}
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

            {monthlyMetrics[selectedAsset].monthlyData.length > 120 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Showing first 120 of {monthlyMetrics[selectedAsset].monthlyData.length} monthly cash flows
              </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Monthly Project Finance Cash Flows:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-red-600">Investing CF:</span> Equity investment during construction</li>
                    <li>• <span className="text-blue-600">(D + E):</span> Total debt + equity funding</li>
                    <li>• <span className="text-green-600">Revenue:</span> Monthly revenue from capacity factor calculation</li>
                    <li>• <span className="text-yellow-600">CFADS:</span> Cash Flow Available for Debt Service (Revenue - OPEX)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Monthly Debt & Equity Returns:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-purple-600">Debt P&I:</span> Monthly debt service (annual amount ÷ 12)</li>
                    <li>• <span className="text-green-600">CF after Debt:</span> CFADS - Monthly Debt Service</li>
                    <li>• <span className="text-orange-600">Terminal Value:</span> Asset residual value (final month only)</li>
                    <li>• <span className="text-blue-600">Net CF:</span> Total monthly cash flow to equity</li>
                  </ul>
                </div>
              </div>
              <div className="mt-2 text-center text-blue-600 bg-blue-50 p-2 rounded">
                ✓ True monthly project finance cash flows with monthly revenue calculations
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No monthly data available</p>
          </div>
        )}
      </div>
    </div>
  );
}