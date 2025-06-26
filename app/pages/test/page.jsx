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
  
  // State for monthly timeline data
  const [monthlyTimeline, setMonthlyTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  
  // Configuration
  const [selectedRevenueCase] = useState('base');
  const [includeTerminalValue] = useState(true);
  const [solveGearing] = useState(true);
  
  // Updated configuration options
  const [debtPaymentFrequency, setDebtPaymentFrequency] = useState('quarterly'); // monthly/quarterly
  const [summaryPeriod, setSummaryPeriod] = useState('annual'); // annual/quarterly
  const [gracePeriodTreatment, setGracePeriodTreatment] = useState('prorated'); // prorated/free

  // FIXED: Calculate operations period from selected asset
  const operationsPeriod = useMemo(() => {
    if (!selectedAsset || !assets[selectedAsset]) return 30;
    
    const asset = Object.values(assets).find(a => a.name === selectedAsset);
    if (!asset?.assetStartDate) return 30;
    
    // Use the assetLife from the asset data, fallback to 30
    const assetLife = asset.assetLife || asset.projectLife || 30;
    return assetLife;
  }, [selectedAsset, assets]);

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
  }, [assets, constants, selectedRevenueCase, operationsPeriod, includeTerminalValue, solveGearing]);

  // Load monthly timeline when asset is selected
  useEffect(() => {
    if (selectedAsset && currentUser && currentPortfolio) {
      loadMonthlyTimeline();
    }
  }, [selectedAsset, currentUser, currentPortfolio]);

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

        // FIXED: Initialize asset costs using actual asset data
        if (!updatedConstants.assetCosts && Object.keys(portfolioData.assets || {}).length > 0) {
          updatedConstants.assetCosts = initializeAssetCostsFromAssets(portfolioData.assets || {});
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

  // FIXED: Initialize asset costs from actual asset data
  const initializeAssetCostsFromAssets = (portfolioAssets) => {
    const assetCosts = {};
    
    Object.values(portfolioAssets).forEach(asset => {
      // Get construction duration from asset data
      const constructionDuration = asset.constructionDuration || getDefaultConstructionDuration(asset.type);
      
      // Calculate default costs based on capacity and type
      const defaultCosts = getDefaultAssetCosts(asset.type, parseFloat(asset.capacity) || 0);
      
      assetCosts[asset.name] = {
        ...defaultCosts,
        // FIXED: Use construction duration from asset
        constructionDuration: constructionDuration,
        equityTimingUpfront: true, // Default
        lastUpdated: new Date().toISOString()
      };
    });
    
    return assetCosts;
  };

  const loadMonthlyTimeline = async () => {
    if (!currentUser || !currentPortfolio || !selectedAsset) return;
    
    setTimelineLoading(true);
    try {
      const response = await fetch('/api/portfolio-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          portfolioId: currentPortfolio.portfolioId,
          analysisConfig: {
            intervalType: 'monthly',
            periods: operationsPeriod,
            includeConstructionPhase: true,
            constructionStartOffset: 24,
            scenario: selectedRevenueCase,
            includeProjectFinance: true
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Find the last operational period across all data
        const operationalPeriods = data.monthlyTimeSeries
          .map((period, index) => ({ period, index }))
          .filter(item => item.period.assets[selectedAsset]?.phaseInfo?.phase === 'operations');
        
        const lastOperationalIndex = operationalPeriods.length > 0 ? 
          operationalPeriods[operationalPeriods.length - 1].index : -1;
        
        console.log(`Found ${operationalPeriods.length} operational periods, last at index ${lastOperationalIndex}`);
        
        // Filter timeline to selected asset only and add phase information
        const assetTimeline = data.monthlyTimeSeries
          .map((period, index) => {
            const assetData = period.assets[selectedAsset];
            if (!assetData) return null;
            
            const isLastOperationalPeriod = index === lastOperationalIndex && 
                                           assetData.phaseInfo?.phase === 'operations';
            
            let terminalValue = 0;
            if (isLastOperationalPeriod && summaryMetrics?.terminalValue) {
              terminalValue = summaryMetrics.terminalValue;
              console.log(`Adding terminal value ${terminalValue} to period ${period.timeDimension.interval}`);
            }
            
            return {
              month: period.timeDimension.interval,
              year: period.timeDimension.year,
              monthName: period.timeDimension.periodLabel || `${period.timeDimension.month}/${period.timeDimension.year}`,
              phase: assetData.phaseInfo?.phase || 'unknown',
              
              // Construction data
              monthlyInvestment: assetData.construction?.monthlyInvestment || 0,
              monthlyEquityInvestment: assetData.construction?.monthlyEquityInvestment || 0,
              monthlyDebtDrawdown: assetData.construction?.monthlyDebtDrawdown || 0,
              cumulativeInvestment: assetData.construction?.cumulativeInvestment || 0,
              constructionProgress: assetData.phaseInfo?.constructionProgress || 0,
              
              // Operations data
              totalRevenue: assetData.revenue?.totalRevenue || 0,
              contractedRevenue: (assetData.revenue?.contractedGreenRevenue || 0) + (assetData.revenue?.contractedEnergyRevenue || 0),
              merchantRevenue: (assetData.revenue?.merchantGreenRevenue || 0) + (assetData.revenue?.merchantEnergyRevenue || 0),
              volume: assetData.volume?.adjustedVolume || 0,
              
              isLastOperationalPeriod,
              terminalValue,
              
              // Net cash flow (positive for revenue, negative for investment)
              netCashFlow: (assetData.revenue?.totalRevenue || 0) - (assetData.construction?.monthlyInvestment || 0)
            };
          })
          .filter(period => period !== null);
        
        setMonthlyTimeline(assetTimeline);
        console.log(`Loaded ${assetTimeline.length} months of timeline for ${selectedAsset}`);
        
        // Log terminal value info
        const terminalPeriods = assetTimeline.filter(p => p.terminalValue > 0);
        console.log(`Terminal value periods:`, terminalPeriods.map(p => `${p.monthName}: ${p.terminalValue}`));
      }
    } catch (error) {
      console.error('Error loading monthly timeline:', error);
    } finally {
      setTimelineLoading(false);
    }
  };

  const calculateMetrics = () => {
    try {
      if (!constants.assetCosts && Object.keys(assets).length > 0) {
        const updatedConstants = {
          ...constants,
          assetCosts: initializeAssetCostsFromAssets(assets)
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
      
      // FIXED: Use construction duration from asset data
      constructionDuration: asset.constructionDuration || assetCosts.constructionDuration || 12,
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

  // Update monthly timeline when summaryMetrics changes to add terminal value
  useEffect(() => {
    if (monthlyTimeline.length > 0 && summaryMetrics?.terminalValue && summaryMetrics.terminalValue > 0) {
      console.log(`Updating timeline with terminal value: ${summaryMetrics.terminalValue}`);
      
      // Find the last operational period
      const operationalPeriods = monthlyTimeline
        .map((period, index) => ({ period, index }))
        .filter(item => item.period.phase === 'operations');
      
      if (operationalPeriods.length === 0) {
        console.log('No operational periods found for terminal value');
        return;
      }
      
      const lastOperationalIndex = operationalPeriods[operationalPeriods.length - 1].index;
      const lastOperationalPeriod = monthlyTimeline[lastOperationalIndex];
      
      console.log(`Adding terminal value to period at index ${lastOperationalIndex}: ${lastOperationalPeriod.monthName}`);
      
      // Check if terminal value is already set to avoid infinite updates
      if (lastOperationalPeriod.terminalValue === summaryMetrics.terminalValue) {
        console.log('Terminal value already set, skipping update');
        return;
      }
      
      setMonthlyTimeline(prevTimeline => 
        prevTimeline.map((month, index) => {
          if (index === lastOperationalIndex) {
            console.log(`Setting terminal value ${summaryMetrics.terminalValue} for ${month.monthName}`);
            return {
              ...month,
              terminalValue: summaryMetrics.terminalValue,
              isLastOperationalPeriod: true
            };
          }
          return month;
        })
      );
    }
  }, [summaryMetrics?.terminalValue]);

  // Helper function to get operational months in a quarter for an asset
  const getOperationalMonthsInQuarter = (year, quarter, assetName) => {
    const asset = Object.values(assets).find(a => a.name === assetName);
    if (!asset?.assetStartDate) return 0;
    
    const assetStartDate = new Date(asset.assetStartDate);
    const assetStartYear = assetStartDate.getFullYear();
    const assetStartMonth = assetStartDate.getMonth() + 1; // 1-12
    
    // Calculate quarter months
    const quarterStartMonth = (quarter - 1) * 3 + 1;
    const quarterEndMonth = quarter * 3;
    
    // If asset hasn't started yet in this year/quarter
    if (year < assetStartYear || (year === assetStartYear && quarterEndMonth < assetStartMonth)) {
      return 0;
    }
    
    // If asset started before this quarter
    if (year > assetStartYear || (year === assetStartYear && quarterStartMonth >= assetStartMonth)) {
      return 3; // Full quarter
    }
    
    // Asset starts during this quarter
    if (year === assetStartYear && assetStartMonth >= quarterStartMonth && assetStartMonth <= quarterEndMonth) {
      return quarterEndMonth - assetStartMonth + 1; // Partial quarter
    }
    
    return 0;
  };

  // Helper function to check if this is the first partial quarter of operations
  const isFirstPartialQuarter = (year, quarter, assetName) => {
    const asset = Object.values(assets).find(a => a.name === assetName);
    if (!asset?.assetStartDate) return false;
    
    const assetStartDate = new Date(asset.assetStartDate);
    const assetStartYear = assetStartDate.getFullYear();
    const assetStartMonth = assetStartDate.getMonth() + 1; // 1-12
    
    const quarterStartMonth = (quarter - 1) * 3 + 1;
    const quarterEndMonth = quarter * 3;
    
    // This is the first partial quarter if:
    // 1. Asset starts in this year/quarter
    // 2. Asset doesn't start on the first month of the quarter
    return (year === assetStartYear && 
            assetStartMonth >= quarterStartMonth && 
            assetStartMonth <= quarterEndMonth &&
            assetStartMonth > quarterStartMonth);
  };

  const getMonthlyOpex = (month, assetName) => {
    if (!projectMetrics[assetName]?.cashFlows) {
      // Fallback: 15% of revenue assumption
      return (month.totalRevenue || 0) * 0.15;
    }
    
    const year = month.year;
    const assetStartYear = new Date(Object.values(assets).find(a => a.name === assetName)?.assetStartDate).getFullYear();
    const operationalYear = year - assetStartYear;
    
    if (operationalYear < 0 || operationalYear >= projectMetrics[assetName].cashFlows.length) {
      return (month.totalRevenue || 0) * 0.15; // Fallback
    }
    
    const annualOpex = Math.abs(projectMetrics[assetName].cashFlows[operationalYear]?.opex || 0);
    return annualOpex / 12; // Monthly OPEX
  };

  // Helper function to calculate DSCR based on trailing period with pro-rating
  const calculateDSCR = (monthlyData, currentIndex, assetName) => {
    if (!monthlyData || currentIndex < 0) return 0;
    
    const currentMonth = monthlyData[currentIndex];
    if (!currentMonth || currentMonth.phase !== 'operations') return 0;
    
    const lookbackMonths = debtPaymentFrequency === 'quarterly' ? 3 : 1;
    const startIndex = Math.max(0, currentIndex - lookbackMonths + 1);
    const endIndex = currentIndex;
    
    let totalOperatingCF = 0;
    let totalDebtService = 0;
    
    for (let i = startIndex; i <= endIndex; i++) {
      const month = monthlyData[i];
      if (month && month.phase === 'operations') {
        const monthlyOpex = getMonthlyOpex(month, assetName);
        const operatingCF = (month.totalRevenue || 0) - monthlyOpex;
        totalOperatingCF += operatingCF;
        
        // Only count debt service in payment months
        if (debtPaymentFrequency === 'quarterly') {
          const monthNum = parseInt(month.month.split('-')[1]);
          if (monthNum % 3 === 0) { // Payment month
            const debtService = calculateQuarterlyDebtService(month, assetName);
            totalDebtService += debtService;
          }
        } else {
          totalDebtService += calculateMonthlyDebtService(month, assetName);
        }
      }
    }
    
    // For quarterly payments, we need to consider the operational period for DSCR
    if (debtPaymentFrequency === 'quarterly' && totalDebtService > 0) {
      const currentMonthNum = parseInt(currentMonth.month.split('-')[1]);
      const quarter = Math.ceil(currentMonthNum / 3);
      const operationalMonths = getOperationalMonthsInQuarter(currentMonth.year, quarter, assetName);
      const isPartialQuarter = isFirstPartialQuarter(currentMonth.year, quarter, assetName);
      
      if (isPartialQuarter && gracePeriodTreatment === 'prorated') {
        // Adjust operating cash flow for partial quarter comparison
        const quarterlyOperatingCF = totalOperatingCF;
        const adjustedOperatingCF = quarterlyOperatingCF; // Use actual operating CF
        return adjustedOperatingCF / totalDebtService;
      } else if (isPartialQuarter && gracePeriodTreatment === 'free') {
        // No debt service in free quarter, so DSCR is effectively infinite
        return totalDebtService === 0 ? 0 : Infinity;
      }
    }
    
    return totalDebtService > 0 ? totalOperatingCF / totalDebtService : 0;
  };

  // Calculate debt service payments with pro-rating support
  const calculateQuarterlyDebtService = (month, assetName) => {
    if (!projectMetrics[assetName]?.cashFlows) return 0;
    
    const year = month.year;
    const monthNum = parseInt(month.month.split('-')[1]);
    const quarter = Math.ceil(monthNum / 3);
    
    const assetStartYear = new Date(Object.values(assets).find(a => a.name === assetName)?.assetStartDate).getFullYear();
    const operationalYear = year - assetStartYear;
    
    if (operationalYear < 0 || operationalYear >= projectMetrics[assetName].cashFlows.length) return 0;
    
    const annualDebtService = projectMetrics[assetName].cashFlows[operationalYear]?.debtService || 0;
    const quarterlyDebtService = Math.abs(annualDebtService) / 4; // Base quarterly payment
    
    // Check if this is a partial quarter and apply treatment
    if (debtPaymentFrequency === 'quarterly') {
      const operationalMonths = getOperationalMonthsInQuarter(year, quarter, assetName);
      const isPartialQuarter = isFirstPartialQuarter(year, quarter, assetName);
      
      if (isPartialQuarter) {
        if (gracePeriodTreatment === 'free') {
          // No payment in first partial quarter
          return 0;
        } else if (gracePeriodTreatment === 'prorated') {
          // Pro-rate based on operational months
          return quarterlyDebtService * (operationalMonths / 3);
        }
      }
    }
    
    return quarterlyDebtService;
  };

  const calculateMonthlyDebtService = (month, assetName) => {
    if (!projectMetrics[assetName]?.cashFlows) return 0;
    
    const year = month.year;
    const assetStartYear = new Date(Object.values(assets).find(a => a.name === assetName)?.assetStartDate).getFullYear();
    const operationalYear = year - assetStartYear;
    
    if (operationalYear < 0 || operationalYear >= projectMetrics[assetName].cashFlows.length) return 0;
    
    const annualDebtService = projectMetrics[assetName].cashFlows[operationalYear]?.debtService || 0;
    return Math.abs(annualDebtService) / 12; // Monthly payment
  };

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

  // Helper functions for defaults
  function getDefaultConstructionDuration(assetType) {
    const defaults = { solar: 12, wind: 18, storage: 12 };
    return defaults[assetType] || 12;
  }

  function getDefaultAssetCosts(assetType, capacity) {
    const capexRates = { solar: 1.2, wind: 2.5, storage: 1.6 };
    const opexRates = { solar: 0.01, wind: 0.02, storage: 0.03 };
    
    const capex = (capexRates[assetType] || 1.0) * (capacity || 100);
    const operatingCosts = (opexRates[assetType] || 0.02) * (capacity || 100);
    
    return {
      capex: Math.round(capex * 10) / 10,
      operatingCosts: Math.round(operatingCosts * 100) / 100,
      operatingCostEscalation: 2.5,
      terminalValue: assetType === 'storage' ? Math.round(capacity * 0.5) : 0,
      maxGearing: assetType === 'solar' ? 0.7 : 0.65,
      targetDSCRContract: 1.4,
      targetDSCRMerchant: 1.8,
      interestRate: 0.06,
      tenorYears: 20,
      debtStructure: 'sculpting'
    };
  }

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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
              {operationsPeriod} Years
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Debt Payment Frequency</label>
            <select
              value={debtPaymentFrequency}
              onChange={(e) => setDebtPaymentFrequency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period Treatment</label>
            <select
              value={gracePeriodTreatment}
              onChange={(e) => setGracePeriodTreatment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={debtPaymentFrequency === 'monthly'}
            >
              <option value="prorated">Pro-rated Payment</option>
              <option value="free">Free Grace Period</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary Period</label>
            <select
              value={summaryPeriod}
              onChange={(e) => setSummaryPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Asset Summary */}
      {summaryMetrics && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            {getAssetIcon(summaryMetrics.assetType)}
            <h3 className="text-lg font-semibold">{summaryMetrics.assetName} - Project Summary</h3>
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
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-lg font-bold text-orange-900">{formatCurrency(summaryMetrics.terminalValue)}</p>
              <p className="text-xs text-orange-600">Terminal Value</p>
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
                  <span className="font-bold text-orange-600">{formatCurrency(summaryMetrics.terminalValue)}</span>
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


      {/* Monthly Timeline Analysis */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Monthly Cashflows</h3>
            <span className="text-sm text-blue-600">(Investment → Revenue Timeline)</span>
          </div>
          <div className="text-sm text-gray-500">
            {selectedAsset ? `Asset: ${selectedAsset}` : 'No asset selected'} • {monthlyTimeline.length} months
          </div>
        </div>

        {timelineLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading monthly timeline...</span>
          </div>
        ) : selectedAsset && monthlyTimeline.length > 0 ? (
          <div>
            {/* Timeline Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-lg font-bold text-red-900">
                  {monthlyTimeline.filter(m => m.phase === 'construction').length}
                </p>
                <p className="text-sm text-red-600">Construction Months</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-900">
                  {monthlyTimeline.filter(m => m.phase === 'operations' || m.terminalValue > 0).length}
                </p>
                <p className="text-sm text-green-600">Operations Months</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(Math.abs(monthlyTimeline.reduce((sum, m) => sum + (m.monthlyEquityInvestment || 0), 0)))}
                </p>
                <p className="text-sm text-blue-600">Total Equity Investment</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-900">
                  {formatCurrency(monthlyTimeline.reduce((sum, m) => sum + (m.totalRevenue || 0), 0))}
                </p>
                <p className="text-sm text-purple-600">Total Revenue</p>
              </div>
            </div>

            {/* Monthly Timeline Table */}
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-2 font-medium text-gray-900">Month</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-900">Phase</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900 bg-red-50">Investment ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900 bg-blue-50">Equity ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900 bg-orange-50">Debt ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900 bg-yellow-50">Cumulative ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Volume (MWh)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Revenue ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Contracted ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Merchant ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">OPEX ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Operating CF ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Debt Service ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">DSCR</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Op CF - Debt ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900">Terminal ($M)</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-900 bg-green-50">Net Equity CF ($M)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTimeline.slice(0, 1200).map((month, index) => (
                    <tr key={month.month} className={`border-b border-gray-100 hover:bg-gray-25 ${
                      month.phase === 'construction' ? 'bg-red-25' : month.phase === 'operations' ? 'bg-green-25' : ''
                    }`}>
                      <td className="py-2 px-2 font-medium text-gray-900">{month.monthName}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          month.phase === 'construction' 
                            ? 'bg-red-100 text-red-800' 
                            : month.phase === 'operations'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {month.phase === 'construction' ? 'Construction' : 
                           month.phase === 'operations' ? 'Operations' : 
                           month.phase}
                        </span>
                        {month.phase === 'construction' && month.constructionProgress > 0 && (
                          <div className="mt-1">
                            <div className="w-16 h-1 bg-gray-200 rounded">
                              <div 
                                className="h-1 bg-red-500 rounded" 
                                style={{ width: `${month.constructionProgress * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{(month.constructionProgress * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </td>
                      
                      {/* Investment columns - only show during construction */}
                      <td className={`text-right py-2 px-2 bg-red-25 ${
                        month.monthlyInvestment !== 0 ? 'text-red-700 font-medium' : 'text-gray-400'
                      }`}>
                        {month.monthlyInvestment !== 0 ? formatCurrency(Math.abs(month.monthlyInvestment)) : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 bg-blue-25 ${
                        month.monthlyEquityInvestment !== 0 ? 'text-blue-700 font-medium' : 'text-gray-400'
                      }`}>
                        {month.monthlyEquityInvestment !== 0 ? formatCurrency(Math.abs(month.monthlyEquityInvestment)) : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 bg-orange-25 ${
                        month.monthlyDebtDrawdown !== 0 ? 'text-orange-700 font-medium' : 'text-gray-400'
                      }`}>
                        {month.monthlyDebtDrawdown !== 0 ? formatCurrency(Math.abs(month.monthlyDebtDrawdown)) : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 bg-yellow-25 ${
                        month.cumulativeInvestment !== 0 ? 'text-yellow-800 font-medium' : 'text-gray-400'
                      }`}>
                        {month.cumulativeInvestment !== 0 ? formatCurrency(month.cumulativeInvestment) : '-'}
                      </td>
                      
                      {/* Operations columns - only show during operations */}
                      <td className={`text-right py-2 px-2 ${
                        month.volume > 0 ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        {month.volume > 0 ? (month.volume / 1000).toFixed(1) + ' GWh' : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 ${
                        month.totalRevenue > 0 ? 'text-green-700 font-medium' : 'text-gray-400'
                      }`}>
                        {month.totalRevenue > 0 ? formatCurrency(month.totalRevenue) : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 ${
                        month.contractedRevenue > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {month.contractedRevenue > 0 ? formatCurrency(month.contractedRevenue) : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 ${
                        month.merchantRevenue > 0 ? 'text-green-500' : 'text-gray-400'
                      }`}>
                        {month.merchantRevenue > 0 ? formatCurrency(month.merchantRevenue) : '-'}
                      </td>
                      
                      {/* New columns - OPEX, Operating CF, Debt Service, DSCR, Equity CF, Terminal */}
                      <td className={`text-right py-2 px-2 ${
                        month.totalRevenue > 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {month.totalRevenue > 0 ? formatCurrency(getMonthlyOpex(month, selectedAsset)) : '-'}
                      </td>
                      <td className={`text-right py-2 px-2 ${
                        month.totalRevenue > 0 ? 'text-blue-700' : 'text-gray-400'
                      }`}>
                        {month.totalRevenue > 0 ? formatCurrency((month.totalRevenue || 0) - getMonthlyOpex(month, selectedAsset)) : '-'}
                      </td>
                      
                      {/* Debt Service - only show in payment months with pro-rating */}
                      <td className={`text-right py-2 px-2 ${
                        month.phase === 'operations' ? 'text-purple-600' : 'text-gray-400'
                      }`}>
                        {(() => {
                          if (month.phase !== 'operations') return '-';
                          
                          const monthNum = parseInt(month.month.split('-')[1]);
                          const isPaymentMonth = debtPaymentFrequency === 'quarterly' 
                            ? (monthNum % 3 === 0) // March, June, Sept, Dec
                            : true; // Every month
                          
                          if (isPaymentMonth) {
                            const debtService = debtPaymentFrequency === 'quarterly'
                              ? calculateQuarterlyDebtService(month, selectedAsset)
                              : calculateMonthlyDebtService(month, selectedAsset);
                            
                            if (debtService > 0) {
                              // Check if this is pro-rated or free quarter
                              if (debtPaymentFrequency === 'quarterly') {
                                const quarter = Math.ceil(monthNum / 3);
                                const operationalMonths = getOperationalMonthsInQuarter(month.year, quarter, selectedAsset);
                                const isPartialQuarter = isFirstPartialQuarter(month.year, quarter, selectedAsset);
                                
                                if (isPartialQuarter) {
                                  if (gracePeriodTreatment === 'free') {
                                    return '0';
                                  } else if (gracePeriodTreatment === 'prorated') {
                                    return `${formatCurrency(debtService)} (${operationalMonths}/3)`;
                                  }
                                }
                              }
                              return formatCurrency(debtService);
                            }
                            return debtService === 0 ? '-' : '-';
                          }
                          return '-';
                        })()}
                      </td>
                      
                      {/* DSCR - based on trailing period */}
                      <td className={`text-right py-2 px-2 ${
                        month.phase === 'operations' ? 'text-gray-700' : 'text-gray-400'
                      }`}>
                        {(() => {
                          if (month.phase !== 'operations') return '-';
                          
                          const monthNum = parseInt(month.month.split('-')[1]);
                          const isPaymentMonth = debtPaymentFrequency === 'quarterly' 
                            ? (monthNum % 3 === 0) 
                            : true;
                          
                          if (isPaymentMonth) {
                            const currentIndex = monthlyTimeline.indexOf(month);
                            const dscr = calculateDSCR(monthlyTimeline, currentIndex, selectedAsset);
                            return dscr > 0 ? `${dscr.toFixed(2)}x` : '-';
                          }
                          return '-';
                        })()}
                      </td>
                      
                      {/* Op CF - Debt */}
                      <td className={`text-right py-2 px-2 ${
                        month.phase === 'operations' ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {(() => {
                          if (month.phase !== 'operations') return '-';
                          
                          const monthlyOpex = getMonthlyOpex(month, selectedAsset);
                          const operatingCF = (month.totalRevenue || 0) - monthlyOpex;
                          const monthNum = parseInt(month.month.split('-')[1]);
                          const isPaymentMonth = debtPaymentFrequency === 'quarterly' 
                            ? (monthNum % 3 === 0) 
                            : true;
                          
                          let debtService = 0;
                          if (isPaymentMonth) {
                            debtService = debtPaymentFrequency === 'quarterly'
                              ? calculateQuarterlyDebtService(month, selectedAsset)
                              : calculateMonthlyDebtService(month, selectedAsset);
                          }
                          
                          const equityCF = operatingCF - debtService;
                          return equityCF !== 0 ? formatCurrency(equityCF) : '-';
                        })()}
                      </td>
                      
                      {/* Terminal Value - show when terminalValue > 0 */}
                      <td className={`text-right py-2 px-2 ${
                        month.terminalValue > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'
                      }`}>
                        {month.terminalValue > 0 ? formatCurrency(month.terminalValue) : '-'}
                      </td>
                      
                      {/* Net Equity Cash Flow */}
                      <td className={`text-right py-2 px-2 font-bold bg-green-25 ${
                        month.netCashFlow > 0 ? 'text-green-600' : 
                        month.netCashFlow < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {(() => {
                          const investment = month.monthlyEquityInvestment || 0;
                          let operatingCF = 0;
                          let debtService = 0;
                          let terminal = month.terminalValue || 0; // FIXED: Use month's terminal value
                          
                          if (month.phase === 'operations') {
                            const monthlyOpex = getMonthlyOpex(month, selectedAsset);
                            operatingCF = (month.totalRevenue || 0) - monthlyOpex;
                            const monthNum = parseInt(month.month.split('-')[1]);
                            const isPaymentMonth = debtPaymentFrequency === 'quarterly' 
                              ? (monthNum % 3 === 0) 
                              : true;
                            
                            if (isPaymentMonth) {
                              debtService = debtPaymentFrequency === 'quarterly'
                                ? calculateQuarterlyDebtService(month, selectedAsset)
                                : calculateMonthlyDebtService(month, selectedAsset);
                            }
                          }
                          
                          const netEquityCF = operatingCF - debtService + terminal - Math.abs(investment);
                          return netEquityCF !== 0 ? formatCurrency(netEquityCF) : '-';
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {monthlyTimeline.length > 120 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Showing first 120 months of {monthlyTimeline.length} total months
              </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Monthly Timeline Phases:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="text-red-600">Construction:</span> Monthly equity + debt investments until operations start</li>
                    <li>• <span className="text-green-600">Operations:</span> Monthly revenue generation from asset start date</li>
                    <li>• <span className="text-purple-600">Debt Service:</span> {debtPaymentFrequency === 'quarterly' ? 'Quarterly' : 'Monthly'} debt payments</li>
                    <li>• <span className="text-blue-600">DSCR:</span> Based on trailing {debtPaymentFrequency === 'quarterly' ? '3-month' : '1-month'} period</li>
                    <li>• <span className="text-orange-600">Terminal:</span> Shows in final operational month</li>
                    <li>• <span className="text-yellow-600">Net Equity CF:</span> Operating CF - Debt Service + Terminal - Equity Investment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Key Insights:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• <span className="font-medium">Construction Period:</span> {monthlyTimeline.filter(m => m.phase === 'construction').length} months of capital deployment</li>
                    <li>• <span className="font-medium">First Revenue:</span> {monthlyTimeline.find(m => m.totalRevenue > 0)?.monthName || 'Not found'}</li>
                    <li>• <span className="font-medium">Investment Total:</span> {formatCurrency(Math.abs(monthlyTimeline.reduce((sum, m) => sum + (m.monthlyInvestment || 0), 0)))}</li>
                    <li>• <span className="font-medium">Terminal Value:</span> {formatCurrency(monthlyTimeline.reduce((sum, m) => sum + (m.terminalValue || 0), 0))}</li>
                    <li>• <span className="font-medium">Payback Indicator:</span> Monthly revenue vs investment timing clearly visible</li>
                  </ul>
                </div>
              </div>
              <div className="mt-2 text-center text-blue-600 bg-blue-50 p-2 rounded">
                ✓ Monthly view shows construction timeline with {operationsPeriod}-year operations period from asset settings
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No monthly timeline data available for selected asset</p>
            <p className="text-sm">Select an asset to view construction + operations timeline</p>
          </div>
        )}
      </div>



    </div>
  );
}