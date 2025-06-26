'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { useSaveContext } from '../../layout';
import { 
  Building2, 
  Calendar,
  DollarSign,
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

// Import enhanced calculations
import { 
  calculateEnhancedAssetRevenue,
  generateTimeIntervals,
  parseTimePeriod
} from '@/lib/enhancedCalculations';

export default function MonthlyAssetDetailPage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice, getMonthlyTimeSeries } = useMerchantPrices();
  const { setHasUnsavedChanges } = useSaveContext();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [monthlyMetrics, setMonthlyMetrics] = useState({});
  const [debugVisible, setDebugVisible] = useState(true);
  
  // Configuration - using asset life instead of fixed analysis years
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

  // Calculate monthly metrics when data changes
  useEffect(() => {
    if (Object.keys(assets).length > 0 && constants.assetCosts && selectedAsset) {
      calculateMonthlyMetrics();
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

      // Generate monthly timeseries
      const monthlyData = [];
      
      for (let month = 0; month < totalMonths; month++) {
        const currentDate = new Date(assetStartDate);
        currentDate.setMonth(currentDate.getMonth() + month);
        
        const year = currentDate.getFullYear();
        const monthIndex = currentDate.getMonth(); // 0-11
        const quarter = Math.floor(monthIndex / 3) + 1;
        
        // Need to get the capacity and quarter for display
        const capacity = parseFloat(asset.capacity) || 0;
        const qtrCapacityFactor = asset[`qtrCapacityFactor_q${quarter}`] || 0;

        // Use the asset's volume directly - this should already include all adjustments
        const assetVolume = parseFloat(asset.volume) || 0; // This is annual volume in MWh
        
        // Calculate monthly volume as proportion of annual
        const monthlyVolume = assetVolume / 12;
        
        // Apply degradation for this specific month
        const yearsSinceStart = month / 12;
        const degradationFactor = Math.pow(1 - (asset.annualDegradation || 0.5) / 100, yearsSinceStart);
        const monthlyGeneration = monthlyVolume * degradationFactor;
        
        // Get merchant price for this month
        const merchantPrice = getMerchantPrice(asset.state, currentDate) || 0;
        
        // Calculate contracted and merchant revenue using asset volume
        let contractedRevenue = 0;
        let merchantRevenue = 0;
        
        if (asset.contracts && asset.contracts.length > 0) {
          asset.contracts.forEach(contract => {
            const contractStart = new Date(contract.startDate);
            const contractEnd = new Date(contract.endDate);
            
            if (currentDate >= contractStart && currentDate <= contractEnd) {
              // Contract is active this month
              const contractedVolume = monthlyGeneration * (contract.buyersPercentage / 100);
              
              // Calculate escalated strike price
              const contractYears = (year - (contract.indexationReferenceYear || year)) || 0;
              const escalationFactor = Math.pow(1 + (contract.indexation || 2.5) / 100, contractYears);
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
        const annualOpex = assetCosts.operatingCosts || 0;
        const monthlyOpex = annualOpex / 12;
        
        // Calculate escalated OPEX
        const opexEscalationFactor = Math.pow(1 + (assetCosts.operatingCostEscalation || 2.5) / 100, yearsSinceStart);
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
          volumeLossAdjustment: asset.volumeLossAdjustment || 100,
          annualDegradation: asset.annualDegradation || 0.5,
          assetVolume: assetVolume
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

  // Debug information for linked inputs
  const debugInfo = useMemo(() => {
    if (!selectedAsset || !assets[selectedAsset] && !Object.values(assets).find(a => a.name === selectedAsset)) {
      return null;
    }

    const asset = Object.values(assets).find(a => a.name === selectedAsset);
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};
    
    return {
      // Asset Definition Inputs
      assetName: asset?.name || 'N/A',
      assetType: asset?.type || 'N/A',
      capacity: asset?.capacity || 'N/A',
      state: asset?.state || 'N/A',
      assetLife: asset?.assetLife || 'N/A',
      assetStartDate: asset?.assetStartDate || 'N/A',
      constructionStartDate: asset?.constructionStartDate || 'N/A',
      
      // Volume & Generation Inputs
      assetVolume: asset?.volume || 'N/A',
      qtrCapacityFactor_q1: asset?.qtrCapacityFactor_q1 || 'N/A',
      qtrCapacityFactor_q2: asset?.qtrCapacityFactor_q2 || 'N/A',
      qtrCapacityFactor_q3: asset?.qtrCapacityFactor_q3 || 'N/A',
      qtrCapacityFactor_q4: asset?.qtrCapacityFactor_q4 || 'N/A',
      volumeLossAdjustment: asset?.volumeLossAdjustment || 'N/A',
      annualDegradation: asset?.annualDegradation || 'N/A',
      
      // Financial Inputs
      operatingCosts: assetCosts.operatingCosts || 'N/A',
      operatingCostEscalation: assetCosts.operatingCostEscalation || 'N/A',
      capex: assetCosts.capex || 'N/A',
      terminalValue: assetCosts.terminalValue || 'N/A',
      
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

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    if (!selectedAsset || !monthlyMetrics[selectedAsset]) return null;

    const assetEntry = Object.entries(assets).find(([key, asset]) => asset.name === selectedAsset);
    if (!assetEntry) return null;

    const [assetKey, asset] = assetEntry;
    const monthlyData = monthlyMetrics[selectedAsset];
    const assetCosts = constants.assetCosts?.[selectedAsset] || {};

    return {
      assetName: asset.name,
      assetType: asset.type,
      capacity: parseFloat(asset.capacity) || 0,
      state: asset.state || 'N/A',
      assetStartDate: asset.assetStartDate,
      
      operationsPeriod: monthlyData.operationsPeriod,
      totalMonths: monthlyData.operationsPeriod * 12,
      
      totalRevenue: monthlyData.totalRevenue || 0,
      totalOpex: monthlyData.totalOpex || 0,
      totalOperatingCF: monthlyData.totalOperatingCF || 0,
      totalGeneration: monthlyData.totalGeneration || 0,
      averageCapacityFactor: monthlyData.averageCapacityFactor || 0,
      
      totalCapex: assetCosts.capex || 0,
      terminalValue: assetCosts.terminalValue || 0,
      
      contractCount: asset.contracts?.length || 0,
      hasContracts: (asset.contracts?.length || 0) > 0,
    };
  }, [selectedAsset, monthlyMetrics, assets, constants]);

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
          <h1 className="text-2xl font-bold text-gray-900">Monthly Asset Analysis</h1>
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
          <h1 className="text-2xl font-bold text-gray-900">Monthly Asset Analysis</h1>
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
              <h3 className="text-sm font-medium text-blue-900">Linked Input Values Debug</h3>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Asset Definition → Monthly Analysis</span>
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
                <div className="font-medium text-gray-700 mb-1">Operations</div>
                <div className="space-y-1">
                  <div>Asset Life: <span className="font-mono">{debugInfo.assetLife}y</span></div>
                  <div>Start Date: <span className="font-mono">{debugInfo.assetStartDate}</span></div>
                  <div>Construction: <span className="font-mono">{debugInfo.constructionStartDate}</span></div>
                  <div>Total Months: <span className="font-mono">{debugInfo.totalMonths}</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Capacity Factors</div>
                <div className="space-y-1">
                  <div>Q1: <span className="font-mono">{debugInfo.qtrCapacityFactor_q1}%</span></div>
                  <div>Q2: <span className="font-mono">{debugInfo.qtrCapacityFactor_q2}%</span></div>
                  <div>Q3: <span className="font-mono">{debugInfo.qtrCapacityFactor_q3}%</span></div>
                  <div>Q4: <span className="font-mono">{debugInfo.qtrCapacityFactor_q4}%</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Volume Source</div>
                <div className="space-y-1">
                  <div>Asset Volume: <span className="font-mono">{debugInfo.assetVolume}MWh/y</span></div>
                  <div>Monthly Vol: <span className="font-mono">{(debugInfo.assetVolume / 12).toFixed(0)}MWh/m</span></div>
                  <div>Degradation: <span className="font-mono">{debugInfo.annualDegradation}%/y</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Costs</div>
                <div className="space-y-1">
                  <div>OPEX: <span className="font-mono">${debugInfo.operatingCosts}M/y</span></div>
                  <div>Escalation: <span className="font-mono">{debugInfo.operatingCostEscalation}%</span></div>
                  <div>CAPEX: <span className="font-mono">${debugInfo.capex}M</span></div>
                  <div>Terminal: <span className="font-mono">${debugInfo.terminalValue}M</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Contracts & Price</div>
                <div className="space-y-1">
                  <div>Total: <span className="font-mono">{debugInfo.contractCount}</span></div>
                  <div>Active: <span className="font-mono">{debugInfo.activeContracts}</span></div>
                  <div>Price Source: <span className="font-mono text-xs">{debugInfo.priceSource}</span></div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-700 mb-1">Enhanced Calcs</div>
                <div className="space-y-1">
                  <div>Source: <span className="font-mono text-xs">lib/enhancedCalculations</span></div>
                  <div>Method: <span className="font-mono text-xs">calculateEnhancedAssetRevenue</span></div>
                  <div>Intervals: <span className="font-mono">{debugInfo.totalMonths}m</span></div>
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
            <span className="text-sm font-medium text-gray-700">Terminal Value: ✓ Included</span>
          </div>

          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700">Monthly Timeseries: ✓ Enabled</span>
          </div>
        </div>
      </div>

      {/* Asset Summary */}
      {summaryMetrics && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            {getAssetIcon(summaryMetrics.assetType)}
            <h3 className="text-lg font-semibold">{summaryMetrics.assetName} - Monthly Analysis Summary</h3>
            <span className="text-sm text-gray-500">({summaryMetrics.assetType} • {summaryMetrics.state})</span>
            <span className="text-sm text-blue-600">Operations: {summaryMetrics.operationsPeriod} years</span>
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
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-900">{formatCurrency(summaryMetrics.totalRevenue)}</p>
              <p className="text-xs text-green-600">Total Revenue</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-900">{formatCurrency(summaryMetrics.totalOpex)}</p>
              <p className="text-xs text-red-600">Total OPEX</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-900">{formatCurrency(summaryMetrics.totalOperatingCF)}</p>
              <p className="text-xs text-purple-600">Operating CF</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-900">{(summaryMetrics.totalGeneration / 1000).toFixed(1)}GWh</p>
              <p className="text-xs text-yellow-600">Total Generation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Asset Configuration</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Operations Period:</span>
                  <span>{summaryMetrics.operationsPeriod} years</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Months:</span>
                  <span>{summaryMetrics.totalMonths} months</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Capacity Factor:</span>
                  <span>{formatPercent(summaryMetrics.averageCapacityFactor)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Revenue</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span>{formatCurrency(summaryMetrics.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Monthly:</span>
                  <span>{formatCurrency(summaryMetrics.totalRevenue / summaryMetrics.totalMonths)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Revenue/MWh:</span>
                  <span>${((summaryMetrics.totalRevenue * 1000000) / summaryMetrics.totalGeneration).toFixed(0)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-orange-25 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">Contracts</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Contracts:</span>
                  <span className="flex items-center space-x-1">
                    {summaryMetrics.hasContracts ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span>{summaryMetrics.contractCount}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal Value:</span>
                  <span>{formatCurrency(summaryMetrics.terminalValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Analysis Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Monthly Operations Analysis</h3>
            <span className="text-sm text-blue-600">(Monthly Timeseries)</span>
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
            {/* Monthly Data Table */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900 bg-gray-50">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-900 bg-gray-50">Year</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">Generation (MWh)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">CF (%)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-gray-50">Degradation</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-yellow-50">Price ($/MWh)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Contracted ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Merchant ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Total Rev ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">OPEX ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-purple-50">Operating CF ($M)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyMetrics[selectedAsset].monthlyData.slice(0, 120).map((data, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-25">
                      <td className="py-2 px-2 font-medium text-gray-900">{data.date.toISOString().slice(0, 7)}</td>
                      <td className="py-2 px-2 text-gray-600">{data.year}</td>
                      <td className="text-right py-2 px-2 text-blue-600 bg-blue-25">
                        {data.monthlyGeneration.toFixed(0)}
                      </td>
                      <td className="text-right py-2 px-2 text-blue-600 bg-blue-25">
                        {data.capacityFactor.toFixed(1)}%
                      </td>
                      <td className="text-right py-2 px-2 text-gray-600 bg-gray-25">
                        {(data.degradationFactor * 100).toFixed(1)}%
                      </td>
                      <td className="text-right py-2 px-2 text-yellow-600 bg-yellow-25">
                        ${data.merchantPrice.toFixed(0)}
                      </td>
                      <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                        {data.contractedRevenue.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                        {data.merchantRevenue.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-green-700 bg-green-25 font-medium">
                        {data.totalRevenue.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-600 bg-red-25">
                        {data.monthlyOpex.toFixed(3)}
                      </td>
                      <td className={`text-right py-2 px-2 font-medium bg-purple-25 ${
                        data.operatingCashFlow >= 0 ? 'text-purple-600' : 'text-red-600'
                      }`}>
                        {data.operatingCashFlow.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {monthlyMetrics[selectedAsset].monthlyData.length > 120 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Showing first 120 of {monthlyMetrics[selectedAsset].monthlyData.length} months
              </div>
            )}


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