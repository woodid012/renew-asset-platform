'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useMerchantPrices } from '../../contexts/MerchantPriceProvider';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Percent,
  AlertCircle,
  CheckCircle,
  PieChart as PieChartIcon,
  BarChart3,
  Settings,
  Download,
  RefreshCw,
  Zap,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';

// Import the proper project finance calculations
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';
import { 
  calculateAssetRevenue, 
  generatePortfolioData,
  calculatePortfolioSummary,
  calculateStressRevenue 
} from '@/lib/revenueCalculations';

export default function FixedProjectFinancePage() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice, priceSource } = useMerchantPrices();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  
  // Finance configuration
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [analysisYears, setAnalysisYears] = useState(25);
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  const [showCashFlowTable, setShowCashFlowTable] = useState(false);
  const [solveGearing, setSolveGearing] = useState(false);
  
  // Results state - using proper project finance calculations
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
          
          // Save the updated constants back to MongoDB
          setConstants(updatedConstants);
          await savePortfolioData(updatedConstants);
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
      console.log('Calculating project finance metrics...');
      
      // Ensure we have asset costs initialized
      if (!constants.assetCosts && Object.keys(assets).length > 0) {
        console.log('Asset costs not initialized, creating defaults and saving to MongoDB...');
        const updatedConstants = {
          ...constants,
          assetCosts: initializeProjectValues(assets)
        };
        setConstants(updatedConstants);
        savePortfolioData(updatedConstants); // Save to MongoDB
        return; // Will retrigger with updated constants
      }
      
      // Use the proper project finance calculation
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
      
      // Calculate portfolio summary using revenue calculations
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

  // Function to save updated portfolio data using your existing API
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
        analysisMode: 'simple',
        priceSource: 'merchant_price_monthly.csv',
        exportDate: new Date().toISOString()
      };

      console.log('Saving portfolio to MongoDB:', {
        userId: portfolioData.userId,
        portfolioId: portfolioData.portfolioId,
        assetsCount: Object.keys(portfolioData.assets || {}).length
      });

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Portfolio saved to MongoDB successfully:', result);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Failed to save portfolio to MongoDB:', errorData);
        return false;
      }
    } catch (error) {
      console.error('Error saving portfolio to MongoDB:', error);
      return false;
    }
  };

  // Helper functions for formatting
  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatNumber = (value, digits = 1) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `$${formatNumber(value)}M`;
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
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Finance Analysis</h1>
          <p className="text-gray-600">Comprehensive project finance modeling with proper equity IRR calculations</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {Object.keys(assets).length} assets • Price Source: {priceSource}
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setSolveGearing(!solveGearing)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
              solveGearing 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>{solveGearing ? 'Auto-Solve ON' : 'Auto-Solve OFF'}</span>
          </button>
          <button 
            onClick={() => setShowCashFlowTable(!showCashFlowTable)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
              showCashFlowTable 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {showCashFlowTable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>Cash Flows</span>
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button 
            onClick={() => savePortfolioData()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            <span>Save to DB</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Scenario</label>
            <select
              value={selectedRevenueCase}
              onChange={(e) => setSelectedRevenueCase(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="base">Base Case</option>
              <option value="worst">Combined Downside</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Period</label>
            <select
              value={analysisYears}
              onChange={(e) => setAnalysisYears(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value={20}>20 Years</option>
              <option value={25}>25 Years</option>
              <option value={30}>30 Years</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="terminal-value"
              checked={includeTerminalValue}
              onChange={(e) => setIncludeTerminalValue(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="terminal-value" className="text-sm font-medium text-gray-700">
              Include Terminal Value
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="solve-gearing"
              checked={solveGearing}
              onChange={(e) => setSolveGearing(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="solve-gearing" className="text-sm font-medium text-gray-700">
              Auto-Solve Gearing
            </label>
          </div>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      {portfolioTotals && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Portfolio Equity IRR</p>
                <p className="text-2xl font-bold text-gray-900">
                  {portfolioTotals.equityCashFlows && calculateIRR(portfolioTotals.equityCashFlows) 
                    ? formatPercent(calculateIRR(portfolioTotals.equityCashFlows)) 
                    : 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Leveraged Return</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total CAPEX</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(portfolioTotals.capex)}
                </p>
                <p className="text-sm text-gray-500">Investment Required</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Portfolio Gearing</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPercent(portfolioTotals.calculatedGearing)}
                </p>
                <p className="text-sm text-gray-500">Debt/Total CAPEX</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Percent className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Minimum DSCR</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDSCR(portfolioTotals.minDSCR)}
                </p>
                <p className="text-sm text-gray-500">Debt Coverage</p>
              </div>
              <div className={`p-3 rounded-full ${
                portfolioTotals.minDSCR >= 1.25 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {portfolioTotals.minDSCR >= 1.25 ? 
                  <CheckCircle className="w-6 h-6 text-green-600" /> :
                  <AlertCircle className="w-6 h-6 text-red-600" />
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Summary Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Summary Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Asset</th>
                <th className="text-right py-2">CAPEX ($M)</th>
                <th className="text-right py-2">Gearing (%)</th>
                <th className="text-right py-2">Debt ($M)</th>
                <th className="text-right py-2">Debt Service ($M)</th>
                <th className="text-right py-2">Min DSCR</th>
                <th className="text-right py-2">Terminal ($M)</th>
                <th className="text-right py-2">Equity IRR</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(projectMetrics)
                .filter(([assetName]) => assetName !== 'portfolio')
                .map(([assetName, metrics]) => (
                <tr key={assetName} className="border-b">
                  <td className="py-2 font-medium">{assetName}</td>
                  <td className="text-right py-2">{formatCurrency(metrics.capex)}</td>
                  <td className="text-right py-2">{formatPercent(metrics.calculatedGearing)}</td>
                  <td className="text-right py-2">{formatCurrency(metrics.debtAmount)}</td>
                  <td className="text-right py-2">{formatCurrency(metrics.annualDebtService)}</td>
                  <td className="text-right py-2">{formatDSCR(metrics.minDSCR)}</td>
                  <td className="text-right py-2">{formatCurrency(includeTerminalValue ? metrics.terminalValue : 0)}</td>
                  <td className="text-right py-2">
                    {calculateIRR(metrics.equityCashFlows) 
                      ? formatPercent(calculateIRR(metrics.equityCashFlows)) 
                      : 'N/A'}
                  </td>
                </tr>
              ))}
              
              {portfolioTotals && Object.keys(assets).length >= 2 && (
                <tr className="bg-muted/50 font-semibold border-t-2">
                  <td className="py-2">Portfolio Total</td>
                  <td className="text-right py-2">{formatCurrency(portfolioTotals.capex)}</td>
                  <td className="text-right py-2">{formatPercent(portfolioTotals.calculatedGearing)}</td>
                  <td className="text-right py-2">{formatCurrency(portfolioTotals.debtAmount)}</td>
                  <td className="text-right py-2">{formatCurrency(portfolioTotals.annualDebtService)}</td>
                  <td className="text-right py-2">{formatDSCR(portfolioTotals.minDSCR)}</td>
                  <td className="text-right py-2">{formatCurrency(includeTerminalValue ? portfolioTotals.terminalValue : 0)}</td>
                  <td className="text-right py-2">
                    {portfolioTotals.equityCashFlows && calculateIRR(portfolioTotals.equityCashFlows) 
                      ? formatPercent(calculateIRR(portfolioTotals.equityCashFlows)) 
                      : 'N/A'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Cash Flow Chart */}
      {projectMetrics.portfolio?.cashFlows && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Portfolio Project Cash Flows</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={projectMetrics.portfolio.cashFlows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`$${value.toLocaleString()}M`]}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4CAF50" strokeWidth={2} />
              <Line type="monotone" dataKey="opex" name="Operating Costs" stroke="#f44336" strokeWidth={2} />
              <Line type="monotone" dataKey="operatingCashFlow" name="CFADS" stroke="#2196F3" strokeWidth={2} />
              <Line type="monotone" dataKey="debtService" name="Debt Service" stroke="#9C27B0" strokeWidth={2} />
              <Line type="monotone" dataKey="equityCashFlow" name="Equity Cash Flow" stroke="#FF9800" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* DSCR Analysis */}
      {projectMetrics.portfolio?.cashFlows && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Debt Service Coverage Analysis</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={projectMetrics.portfolio.cashFlows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis yAxisId="left" domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="right" dataKey="debtService" name="Debt Service ($M)" fill="#9C27B0" />
              <Line yAxisId="left" type="monotone" dataKey="dscr" name="DSCR" stroke="#2196F3" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cash Flow Table */}
      {showCashFlowTable && projectMetrics.portfolio?.cashFlows && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Detailed Cash Flow Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Year</th>
                  <th className="text-right py-2">Revenue ($M)</th>
                  <th className="text-right py-2">OPEX ($M)</th>
                  <th className="text-right py-2">CFADS ($M)</th>
                  <th className="text-right py-2">Debt Service ($M)</th>
                  <th className="text-right py-2">DSCR</th>
                  <th className="text-right py-2">Equity CF ($M)</th>
                </tr>
              </thead>
              <tbody>
                {projectMetrics.portfolio.cashFlows.slice(0, 15).map((cf, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{cf.year}</td>
                    <td className="text-right py-2">{formatCurrency(cf.revenue)}</td>
                    <td className="text-right py-2">{formatCurrency(Math.abs(cf.opex))}</td>
                    <td className="text-right py-2">{formatCurrency(cf.operatingCashFlow)}</td>
                    <td className="text-right py-2">{formatCurrency(Math.abs(cf.debtService))}</td>
                    <td className="text-right py-2">{cf.dscr ? cf.dscr.toFixed(2) + 'x' : 'N/A'}</td>
                    <td className="text-right py-2">{formatCurrency(cf.equityCashFlow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analysis Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-900">Project Finance Analysis Notes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Equity IRR Calculation:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Initial equity investment: -(CAPEX × (1 - Gearing))</li>
              <li>• Annual equity cash flows: CFADS - Debt Service</li>
              <li>• Terminal value included in final year if enabled</li>
              <li>• IRR calculated using Newton-Raphson method</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Debt Structuring:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• {solveGearing ? 'Auto-solving' : 'Using configured'} gearing ratios</li>
              <li>• DSCR-based debt sizing when auto-solve enabled</li>
              <li>• Sculpted debt repayment profile</li>
              <li>• Blended DSCR targets for mixed revenue streams</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status Display */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Project finance analysis with proper equity IRR calculations
            </span>
          </div>
          <div className="text-green-600 text-sm">
            Scenario: {selectedRevenueCase} • {solveGearing ? 'Auto-Solve' : 'Manual'} • Updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          Analysis includes initial equity investment, proper debt structuring, DSCR calculations, and leveraged returns to equity.
        </div>
      </div>
    </div>
  );
}