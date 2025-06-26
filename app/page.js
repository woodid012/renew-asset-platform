// app/page.js - Clean main page with simple data loading
'use client'

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/app/contexts/UserContext';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import LoadingPage from '@/app/components/LoadingPage';
import Dashboard from '@/app/components/Dashboard';
import { Building2 } from 'lucide-react';

// Import project finance calculations
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';

// Import revenue calculations
import { 
  generatePortfolioData
} from '@/lib/revenueCalculations';

export default function MainPage() {
  const { currentUser, currentPortfolio, loading: userLoading } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  
  // Simple loading state
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  
  // Data states
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [projectMetrics, setProjectMetrics] = useState({});
  
  // Dashboard metrics
  const [portfolioMetrics, setPortfolioMetrics] = useState({
    totalCapacity: 0,
    totalProjects: 0,
    year10Revenue: 0,
    portfolioIRR: 0,
    contractedPercentage: 0,
    totalCapex: 0,
    totalDebt: 0,
    totalEquity: 0
  });
  
  // Chart data
  const [revenueProjections, setRevenueProjections] = useState([]);

  // Load portfolio data
  const loadPortfolioData = useCallback(async () => {
    if (!currentUser || !currentPortfolio) return;
    
    console.log('Loading portfolio data for:', currentUser.name, currentPortfolio.portfolioId);
    setIsLoadingPortfolio(true);
    
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        console.log('Portfolio data loaded:', Object.keys(portfolioData.assets || {}).length, 'assets');
        
        setAssets(portfolioData.assets || {});
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
        // Initialize constants
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
          updatedConstants.assetCosts = initializeProjectValues(portfolioData.assets || {});
        }

        setConstants(updatedConstants);
      } else {
        console.error('Failed to load portfolio data:', response.status);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [currentUser, currentPortfolio]);

  // Calculate all metrics
  const calculateAllMetrics = useCallback(() => {
    if (Object.keys(assets).length === 0 || !constants.HOURS_IN_YEAR) {
      console.log('Skipping metrics calculation - no assets or constants');
      return;
    }
    
    console.log('Calculating metrics for', Object.keys(assets).length, 'assets');
    
    try {
      const currentYear = new Date().getFullYear();
      const timeIntervals = Array.from({ length: 30 }, (_, i) => currentYear + i);
      
      // Get or initialize asset costs
      let assetCosts = constants.assetCosts;
      if (!assetCosts) {
        assetCosts = initializeProjectValues(assets);
      }
      
      // Calculate project finance metrics
      const calculatedProjectMetrics = calculateProjectMetrics(
        assets,
        assetCosts,
        constants,
        getMerchantPrice,
        'base',
        false,
        true
      );
      
      setProjectMetrics(calculatedProjectMetrics);

      // Generate sensitivity data for tornado chart
      const individualAssets = Object.entries(calculatedProjectMetrics)
        .filter(([assetName]) => assetName !== 'portfolio');
      
      if (individualAssets.length > 0) {
        const allEquityCashFlows = [];
        
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, 31);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows);
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const calculatedIRR = calculateIRR(allEquityCashFlows);
          const baseIRR = calculatedIRR ? calculatedIRR * 100 : 0;
          
          const sensitivityData = [
            { parameter: "Volume", baseIRR, downside: baseIRR * -0.081, upside: baseIRR * 0.299 },
            { parameter: "CAPEX", baseIRR, downside: baseIRR * -0.095, upside: baseIRR * 0.142 },
            { parameter: "Electricity Price", baseIRR, downside: baseIRR * -0.061, upside: baseIRR * 0.063 },
            { parameter: "Interest Rate", baseIRR, downside: baseIRR * -0.023, upside: baseIRR * 0.042 },
            { parameter: "OPEX", baseIRR, downside: baseIRR * -0.023, upside: baseIRR * 0.024 },
            { parameter: "Terminal Value", baseIRR, downside: baseIRR * -0.016, upside: baseIRR * 0.015 }
          ];
          
          localStorage.setItem('financeSensitivityData', JSON.stringify(sensitivityData));
        }
      }
      
      // Calculate portfolio totals
      let totalCapex = 0;
      let totalDebt = 0;
      let portfolioEquityIRR = 0;
      
      individualAssets.forEach(([_, metrics]) => {
        totalCapex += metrics.capex || 0;
        totalDebt += metrics.debtAmount || 0;
      });
      
      const totalEquity = totalCapex - totalDebt;
      
      // Calculate portfolio IRR
      if (individualAssets.length > 0) {
        const allEquityCashFlows = [];
        
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...metrics.equityCashFlows);
            } else {
              metrics.equityCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const calculatedIRR = calculateIRR(allEquityCashFlows);
          portfolioEquityIRR = calculatedIRR ? calculatedIRR * 100 : 0;
        }
      }
      
      // Generate revenue projections
      const portfolioData = generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice);
      
      let year10Revenue = 0;
      const yearlyProjections = [];
      
      portfolioData.forEach(period => {
        const periodData = {
          year: period.timeInterval,
          totalRevenue: 0,
          contractedRevenue: 0,
          merchantRevenue: 0
        };
        
        Object.entries(period.assets).forEach(([_, assetData]) => {
          periodData.totalRevenue += assetData.total;
          periodData.contractedRevenue += assetData.contractedGreen + assetData.contractedEnergy;
          periodData.merchantRevenue += assetData.merchantGreen + assetData.merchantEnergy;
        });
        
        yearlyProjections.push(periodData);
        
        if (period.timeInterval === currentYear + 9) {
          year10Revenue = periodData.totalRevenue;
        }
      });
      
      // Calculate contracted percentage
      const first10Years = yearlyProjections.slice(0, 10);
      const totalContracted = first10Years.reduce((sum, year) => sum + year.contractedRevenue, 0);
      const totalRevenue = first10Years.reduce((sum, year) => sum + year.totalRevenue, 0);
      const contractedPercentage = totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0;
      
      // Update all metrics
      const assetArray = Object.values(assets);
      setPortfolioMetrics({
        totalCapacity: assetArray.reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0),
        totalProjects: assetArray.length,
        year10Revenue,
        portfolioIRR: portfolioEquityIRR,
        contractedPercentage,
        totalCapex,
        totalDebt,
        totalEquity
      });
      
      setRevenueProjections(yearlyProjections);
      
      console.log('Metrics calculation complete');
      
    } catch (error) {
      console.error('Error calculating metrics:', error);
    }
  }, [assets, constants, getMerchantPrice]);

  // Load data when user/portfolio changes
  useEffect(() => {
    if (currentUser && currentPortfolio && !userLoading) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio, userLoading, loadPortfolioData]);

  // Calculate metrics when data is ready
  useEffect(() => {
    if (Object.keys(assets).length > 0 && constants.HOURS_IN_YEAR && !isLoadingPortfolio) {
      calculateAllMetrics();
    }
  }, [assets, constants, isLoadingPortfolio, calculateAllMetrics]);

  // Show full loading screen only when user context is loading or no user/portfolio
  if (userLoading || !currentUser || !currentPortfolio) {
    return (
      <LoadingPage 
        currentUser={currentUser} 
        currentPortfolio={currentPortfolio}
        stage="connecting"
        progress={userLoading ? 50 : 10}
      />
    );
  }

  // Show simple loading when fetching portfolio data
  if (isLoadingPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Portfolio Data</h3>
          <p className="text-gray-600">Fetching {currentPortfolio.portfolioId} assets and calculations...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no assets
  if (Object.keys(assets).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Assets Found</h3>
          <p className="text-gray-600">This portfolio doesn&apos;t have any assets configured yet.</p>
          <p className="text-sm text-gray-500 mt-2">Add assets to see dashboard analytics</p>
        </div>
      </div>
    );
  }

  // Render the dashboard
  return (
    <Dashboard
      portfolioName={portfolioName}
      portfolioMetrics={portfolioMetrics}
      revenueProjections={revenueProjections}
      assets={assets}
      projectMetrics={projectMetrics}
    />
  );
}