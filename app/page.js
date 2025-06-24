// app/page.js - Main page with integrated data loading and dashboard
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
  
  // Initialization states
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationStage, setInitializationStage] = useState('connecting');
  const [initializationProgress, setInitializationProgress] = useState(0);
  
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

  // Initialization sequence
  const initializeApplication = useCallback(async () => {
    if (!currentUser || !currentPortfolio || userLoading) {
      return;
    }

    try {
      console.log('Starting initialization for:', currentUser.name, currentPortfolio.portfolioId);

      // Stage 1: Database Connection
      setInitializationStage('connecting');
      setInitializationProgress(10);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Stage 2: Portfolio Loading
      setInitializationStage('portfolio');
      setInitializationProgress(30);
      
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
        throw new Error('Failed to load portfolio data');
      }

      // Stage 3: Asset Configuration
      setInitializationStage('assets');
      setInitializationProgress(60);
      await new Promise(resolve => setTimeout(resolve, 600));

      // Stage 4: Calculations
      setInitializationStage('calculations');
      setInitializationProgress(85);
      await new Promise(resolve => setTimeout(resolve, 700));

      // Stage 5: Complete
      setInitializationStage('complete');
      setInitializationProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark initialization as complete
      setIsInitializing(false);
      console.log('Initialization complete');

    } catch (error) {
      console.error('Initialization error:', error);
      // Still complete initialization even on error
      setIsInitializing(false);
    }
  }, [currentUser, currentPortfolio, userLoading]);

  // Calculate metrics
  const calculateMetrics = useCallback(() => {
    if (Object.keys(assets).length === 0 || !constants.HOURS_IN_YEAR) {
      console.log('Skipping metrics calculation - no assets or constants');
      return;
    }
    
    try {
      console.log('Calculating metrics for', Object.keys(assets).length, 'assets');
      
      const currentYear = new Date().getFullYear();
      const timeIntervals = Array.from({ length: 30 }, (_, i) => currentYear + i);
      
      // Calculate project finance metrics
      let assetCosts = constants.assetCosts;
      if (!assetCosts) {
        assetCosts = initializeProjectValues(assets);
        console.log('Initialized asset costs for', Object.keys(assetCosts).length, 'assets');
      }
      
      const projectMetrics = calculateProjectMetrics(
        assets,
        assetCosts,
        constants,
        getMerchantPrice,
        'base',
        false,
        true
      );
      
      setProjectMetrics(projectMetrics);
      console.log('Project metrics calculated for', Object.keys(projectMetrics).length, 'items');

      // Store sensitivity data for tornado chart
      if (Object.keys(projectMetrics).length > 0) {
        const individualAssets = Object.entries(projectMetrics)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        if (individualAssets.length > 0) {
          const allEquityCashFlows = [];
          
          individualAssets.forEach(([assetName, metrics]) => {
            if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
              const truncatedCashFlows = metrics.equityCashFlows.slice(0, 31);
              
              if (allEquityCashFlows.length === 0) {
                allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
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
            console.log('Portfolio IRR calculated:', baseIRR.toFixed(2) + '%');
            
            const sensitivityData = [
              {
                parameter: "Volume",
                baseIRR: baseIRR,
                downside: baseIRR * -0.081,
                upside: baseIRR * 0.299,
                totalRange: baseIRR * 0.38
              },
              {
                parameter: "CAPEX", 
                baseIRR: baseIRR,
                downside: baseIRR * -0.095,
                upside: baseIRR * 0.142,
                totalRange: baseIRR * 0.237
              },
              {
                parameter: "Electricity Price",
                baseIRR: baseIRR,
                downside: baseIRR * -0.061,
                upside: baseIRR * 0.063,
                totalRange: baseIRR * 0.124
              },
              {
                parameter: "Interest Rate",
                baseIRR: baseIRR,
                downside: baseIRR * -0.023,
                upside: baseIRR * 0.042,
                totalRange: baseIRR * 0.065
              },
              {
                parameter: "OPEX",
                baseIRR: baseIRR,
                downside: baseIRR * -0.023,
                upside: baseIRR * 0.024,
                totalRange: baseIRR * 0.047
              },
              {
                parameter: "Terminal Value",
                baseIRR: baseIRR,
                downside: baseIRR * -0.016,
                upside: baseIRR * 0.015,
                totalRange: baseIRR * 0.031
              }
            ];
            
            localStorage.setItem('financeSensitivityData', JSON.stringify(sensitivityData));
            console.log('Sensitivity data stored');
          }
        }
      }
      
      // Calculate portfolio totals
      const individualAssets = Object.entries(projectMetrics)
        .filter(([assetName]) => assetName !== 'portfolio');
      
      let totalCapex = 0;
      let totalDebt = 0;
      let totalEquity = 0;
      let portfolioEquityIRR = 0;
      
      if (individualAssets.length > 0) {
        const allEquityCashFlows = [];
        
        individualAssets.forEach(([assetName, metrics]) => {
          totalCapex += metrics.capex || 0;
          totalDebt += metrics.debtAmount || 0;
          
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...metrics.equityCashFlows.map(cf => cf));
            } else {
              metrics.equityCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                }
              });
            }
          }
        });
        
        totalEquity = totalCapex - totalDebt;
        
        if (allEquityCashFlows.length > 0) {
          const calculatedIRR = calculateIRR(allEquityCashFlows);
          portfolioEquityIRR = calculatedIRR ? calculatedIRR * 100 : 0;
        }
      }
      
      // Generate revenue projections
      const portfolioData = generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice);
      console.log('Generated revenue projections for', portfolioData.length, 'periods');
      
      let year10Revenue = 0;
      const yearlyProjections = [];
      
      portfolioData.forEach(period => {
        const periodData = {
          year: period.timeInterval,
          totalRevenue: 0,
          contractedRevenue: 0,
          merchantRevenue: 0
        };
        
        Object.entries(period.assets).forEach(([assetName, assetData]) => {
          periodData.totalRevenue += assetData.total;
          periodData.contractedRevenue += assetData.contractedGreen + assetData.contractedEnergy;
          periodData.merchantRevenue += assetData.merchantGreen + assetData.merchantEnergy;
        });
        
        yearlyProjections.push(periodData);
        
        // Get Year 10 revenue
        if (period.timeInterval === currentYear + 9) {
          year10Revenue = periodData.totalRevenue;
        }
      });
      
      // Calculate contracted percentage from first 10 years
      const first10Years = yearlyProjections.slice(0, 10);
      const totalContracted = first10Years.reduce((sum, year) => sum + year.contractedRevenue, 0);
      const totalRevenue = first10Years.reduce((sum, year) => sum + year.totalRevenue, 0);
      const contractedPercentage = totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0;
      
      // Update metrics
      const assetArray = Object.values(assets);
      const newPortfolioMetrics = {
        totalCapacity: assetArray.reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0),
        totalProjects: assetArray.length,
        year10Revenue,
        portfolioIRR: portfolioEquityIRR,
        contractedPercentage,
        totalCapex,
        totalDebt,
        totalEquity
      };
      
      setPortfolioMetrics(newPortfolioMetrics);
      setRevenueProjections(yearlyProjections);
      
      console.log('Metrics calculation complete:', {
        capacity: newPortfolioMetrics.totalCapacity,
        projects: newPortfolioMetrics.totalProjects,
        irr: newPortfolioMetrics.portfolioIRR.toFixed(1) + '%'
      });
      
    } catch (error) {
      console.error('Error calculating metrics:', error);
    }
  }, [assets, constants, getMerchantPrice]);

  // Initialize on mount and when user/portfolio changes
  useEffect(() => {
    if (currentUser && currentPortfolio && !userLoading) {
      initializeApplication();
    }
  }, [currentUser, currentPortfolio, userLoading, initializeApplication]);

  // Calculate metrics when data is ready and initialization is complete
  useEffect(() => {
    if (!isInitializing && Object.keys(assets).length > 0 && constants.HOURS_IN_YEAR) {
      calculateMetrics();
    }
  }, [isInitializing, assets, constants, calculateMetrics]);

  // Show loading screen during initialization or when no user/portfolio
  if (isInitializing || userLoading || !currentUser || !currentPortfolio) {
    return (
      <LoadingPage 
        currentUser={currentUser} 
        currentPortfolio={currentPortfolio}
        stage={initializationStage}
        progress={initializationProgress}
      />
    );
  }

  // Show empty state if no assets but initialization complete
  if (!isInitializing && Object.keys(assets).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Assets Found</h3>
          <p className="text-gray-600">This portfolio doesn't have any assets configured yet.</p>
          <p className="text-sm text-gray-500 mt-2">Add assets to see dashboard analytics</p>
        </div>
      </div>
    );
  }

  // Render the main dashboard
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