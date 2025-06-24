'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../contexts/UserContext';

import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Area,
  AreaChart,
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
  Plus
} from 'lucide-react';

// Import revenue calculation functions
import { calculateAssetRevenue, calculateStressRevenue } from '@/lib/revenueCalculations';

const ProjectFinance = () => {
  const { currentUser, currentPortfolio } = useUser();

  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  
  // Finance configuration
  const [selectedProject, setSelectedProject] = useState('portfolio');
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [analysisYears, setAnalysisYears] = useState(25);
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  
  // Finance structure state
  const [financeStructure, setFinanceStructure] = useState({
    totalCapex: 420,
    debtRatio: 70,
    equityRatio: 30,
    debtRate: 4.5,
    equityReturn: 12.0,
    projectLife: 25,
    constructionPeriod: 2,
    taxRate: 30
  });

  // Results state
  const [returns, setReturns] = useState({
    projectIRR: 0,
    equityIRR: 0,
    debtServiceCoverage: 0,
    npv: 0,
    paybackPeriod: 0,
    leveragedIRR: 0
  });

  const [cashFlowData, setCashFlowData] = useState([]);
  const [revenueProjections, setRevenueProjections] = useState([]);
  const [projects, setProjects] = useState([]);

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Recalculate when dependencies change
  useEffect(() => {
    if (Object.keys(assets).length > 0) {
      calculateFinanceMetrics();
      generateRevenueProjections();
      generateCashFlows();
    }
  }, [assets, constants, financeStructure, selectedProject, selectedRevenueCase, analysisYears, includeTerminalValue]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      console.log(`Loading portfolio: userId=${currentUser.id}, portfolioId=${currentPortfolio.portfolioId}`);
      
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        console.log('Portfolio data loaded:', {
          assetsCount: Object.keys(portfolioData.assets || {}).length,
          portfolioName: portfolioData.portfolioName
        });
        
        setAssets(portfolioData.assets || {});
        setConstants(portfolioData.constants || {});
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
        // Update projects list
        const assetProjects = Object.values(portfolioData.assets || {}).map(asset => ({
          id: asset.id || asset.name,
          name: asset.name,
          type: asset.type,
          capacity: asset.capacity || 0,
          capex: getAssetCapex(asset, portfolioData.constants)
        }));
        
        const totalCapex = assetProjects.reduce((sum, project) => sum + project.capex, 0);
        
        setProjects([
          { id: 'portfolio', name: 'Portfolio Total', capex: totalCapex },
          ...assetProjects
        ]);
        
        // Update finance structure with total capex
        setFinanceStructure(prev => ({
          ...prev,
          totalCapex: totalCapex
        }));
        
      } else if (response.status === 404) {
        console.log('Portfolio not found, starting fresh');
        setAssets({});
        setConstants({});
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get asset CAPEX from constants or calculate default
  const getAssetCapex = (asset, constants) => {
    const assetCosts = constants?.assetCosts?.[asset.name];
    if (assetCosts?.capex) {
      return assetCosts.capex;
    }
    
    // Default CAPEX rates by technology ($/MW)
    const defaultRates = {
      solar: 1.2,
      wind: 2.5,
      storage: 1.6
    };
    
    const rate = defaultRates[asset.type] || 1.5;
    return (asset.capacity || 0) * rate;
  };

  // Mock merchant price function - replace with your actual implementation
  const getMerchantPrice = (assetType, priceType, state, timeInterval) => {
    // This should connect to your price curves API
    const basePrices = {
      solar: { green: 35, energy: 65 },
      wind: { green: 35, energy: 65 },
      storage: { energy: 80 }
    };
    
    return basePrices[assetType]?.[priceType] || 50;
  };

  // Generate revenue projections using the performance calculations
  const generateRevenueProjections = () => {
    if (Object.keys(assets).length === 0) return;
    
    const startYear = new Date().getFullYear();
    const projections = [];
    
    for (let year = startYear; year < startYear + analysisYears; year++) {
      let portfolioRevenue = 0;
      let portfolioOpex = 0;
      const assetRevenues = {};
      
      // Calculate revenue for each asset
      Object.values(assets).forEach(asset => {
        try {
          // Check if asset is operational in this year
          const assetStartYear = new Date(asset.assetStartDate).getFullYear();
          if (year >= assetStartYear) {
            // Calculate base revenue using the performance calculations
            const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
            
            // Apply stress scenarios if selected
            let finalRevenue = baseRevenue;
            if (selectedRevenueCase !== 'base') {
              finalRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
            }
            
            const totalRevenue = finalRevenue.contractedGreen + 
                               finalRevenue.contractedEnergy + 
                               finalRevenue.merchantGreen + 
                               finalRevenue.merchantEnergy;
            
            // Calculate operating costs
            const assetCosts = constants.assetCosts?.[asset.name] || {};
            const yearIndex = year - assetStartYear;
            const opexEscalation = Math.pow(1 + (assetCosts.operatingCostEscalation || 2.5) / 100, yearIndex);
            const yearOpex = (assetCosts.operatingCosts || 0) * opexEscalation;
            
            portfolioRevenue += totalRevenue;
            portfolioOpex += yearOpex;
            assetRevenues[asset.name] = totalRevenue;
          }
        } catch (error) {
          console.error(`Error calculating revenue for ${asset.name} in ${year}:`, error);
          assetRevenues[asset.name] = 0;
        }
      });
      
      projections.push({
        year,
        portfolioRevenue,
        portfolioOpex,
        netRevenue: portfolioRevenue - portfolioOpex,
        assetRevenues,
        ...assetRevenues
      });
    }
    
    setRevenueProjections(projections);
  };

  const calculateFinanceMetrics = () => {
    const { totalCapex, debtRatio, equityRatio, debtRate, projectLife } = financeStructure;
    
    if (totalCapex === 0 || revenueProjections.length === 0) return;
    
    // Calculate debt amounts
    const debtAmount = totalCapex * (debtRatio / 100);
    const equityAmount = totalCapex * (equityRatio / 100);
    
    // Calculate average annual metrics from revenue projections
    const avgAnnualRevenue = revenueProjections.reduce((sum, proj) => sum + proj.portfolioRevenue, 0) / revenueProjections.length;
    const avgAnnualOpex = revenueProjections.reduce((sum, proj) => sum + proj.portfolioOpex, 0) / revenueProjections.length;
    const avgEbitda = avgAnnualRevenue - avgAnnualOpex;
    
    // Debt service calculation
    const annualDebtService = calculateAnnualDebtService(debtAmount, debtRate, projectLife);
    const dscr = avgEbitda / annualDebtService;
    
    // IRR calculations (simplified)
    const projectIRR = ((avgEbitda / totalCapex) * 100);
    const equityIRR = projectIRR * 1.5; // Leveraged return
    
    // NPV calculation
    const discountRate = 0.08;
    const npv = calculateNPV(avgEbitda, totalCapex, discountRate, projectLife);
    
    setReturns({
      projectIRR: Math.round(projectIRR * 10) / 10,
      equityIRR: Math.round(equityIRR * 10) / 10,
      debtServiceCoverage: Math.round(dscr * 100) / 100,
      npv: Math.round(npv),
      paybackPeriod: Math.round((totalCapex / avgEbitda) * 10) / 10,
      leveragedIRR: Math.round(equityIRR * 10) / 10
    });
  };

  const generateCashFlows = () => {
    if (revenueProjections.length === 0) return;
    
    const { totalCapex, debtRatio, debtRate, projectLife, taxRate } = financeStructure;
    const debtAmount = totalCapex * (debtRatio / 100);
    const annualDebtService = calculateAnnualDebtService(debtAmount, debtRate, Math.min(projectLife, 20));
    
    const cashFlows = revenueProjections.map((projection, index) => {
      const { portfolioRevenue, portfolioOpex, year } = projection;
      
      // EBITDA
      const ebitda = portfolioRevenue - portfolioOpex;
      
      // Depreciation (straight line over project life)
      const depreciation = totalCapex / projectLife;
      
      // EBIT
      const ebit = ebitda - depreciation;
      
      // Interest expense
      const interest = debtAmount * (debtRate / 100);
      
      // EBT
      const ebt = ebit - interest;
      
      // Tax
      const tax = ebt > 0 ? ebt * (taxRate / 100) : 0;
      
      // NOPAT
      const nopat = ebt - tax;
      
      // Operating cash flow (add back depreciation)
      const operatingCashFlow = nopat + depreciation;
      
      // Debt service (only for loan period)
      const debtServicePayment = index < 20 ? annualDebtService : 0;
      
      // Free cash flow to equity
      const freeCashFlow = operatingCashFlow - debtServicePayment;
      
      // Terminal value (only in last year if enabled)
      const terminalValue = (index === revenueProjections.length - 1 && includeTerminalValue) ? 
        calculateTerminalValue() : 0;
      
      return {
        year,
        revenue: portfolioRevenue,
        opex: portfolioOpex,
        ebitda,
        depreciation,
        ebit,
        interest,
        ebt,
        tax,
        nopat,
        operatingCashFlow,
        debtService: debtServicePayment,
        freeCashFlow: freeCashFlow + terminalValue,
        terminalValue
      };
    });
    
    setCashFlowData(cashFlows);
  };

  const calculateTerminalValue = () => {
    if (!includeTerminalValue) return 0;
    
    // Calculate terminal value as sum of individual asset terminal values
    return Object.values(assets).reduce((sum, asset) => {
      const assetCosts = constants.assetCosts?.[asset.name] || {};
      return sum + (assetCosts.terminalValue || 0);
    }, 0);
  };

  const calculateAnnualDebtService = (principal, rate, term) => {
    const monthlyRate = rate / 100 / 12;
    const numPayments = term * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
    return monthlyPayment * 12;
  };

  const calculateNPV = (annualCashFlow, initialInvestment, discountRate, years) => {
    let npv = -initialInvestment;
    for (let year = 1; year <= years; year++) {
      npv += annualCashFlow / Math.pow(1 + discountRate, year);
    }
    return npv;
  };

  const handleInputChange = (field, value) => {
    setFinanceStructure(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const capitalStructureData = [
    { name: 'Debt', value: financeStructure.debtRatio, color: '#EF4444' },
    { name: 'Equity', value: financeStructure.equityRatio, color: '#10B981' }
  ];

  // Show loading state if no user/portfolio selected
  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Project Finance</h1>
          <p className="text-gray-600">Integrated revenue analysis and financial modeling</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {Object.keys(assets).length} assets
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => window.location.reload()}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700">
            <Download className="w-4 h-4" />
            <span>Export Model</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} - ${project.capex.toFixed(1)}M
                </option>
              ))}
            </select>
          </div>
          
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
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Project IRR</p>
              <p className="text-2xl font-bold text-gray-900">{returns.projectIRR}%</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Equity IRR</p>
              <p className="text-2xl font-bold text-gray-900">{returns.equityIRR}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Percent className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg DSCR</p>
              <p className="text-2xl font-bold text-gray-900">{returns.debtServiceCoverage}x</p>
            </div>
            <div className={`p-3 rounded-full ${returns.debtServiceCoverage >= 1.25 ? 'bg-green-100' : 'bg-red-100'}`}>
              {returns.debtServiceCoverage >= 1.25 ? 
                <CheckCircle className="w-6 h-6 text-green-600" /> :
                <AlertCircle className="w-6 h-6 text-red-600" />
              }
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">NPV</p>
              <p className="text-2xl font-bold text-gray-900">${returns.npv}M</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Finance Structure & Capital Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Finance Structure Inputs */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            Finance Structure
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total CAPEX ($M)
                </label>
                <input
                  type="number"
                  value={financeStructure.totalCapex}
                  onChange={(e) => handleInputChange('totalCapex', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Life (years)
                </label>
                <input
                  type="number"
                  value={financeStructure.projectLife}
                  onChange={(e) => handleInputChange('projectLife', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Debt Ratio (%)
                </label>
                <input
                  type="number"
                  value={financeStructure.debtRatio}
                  onChange={(e) => {
                    const debt = parseFloat(e.target.value) || 0;
                    handleInputChange('debtRatio', debt);
                    handleInputChange('equityRatio', 100 - debt);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equity Ratio (%)
                </label>
                <input
                  type="number"
                  value={financeStructure.equityRatio}
                  onChange={(e) => {
                    const equity = parseFloat(e.target.value) || 0;
                    handleInputChange('equityRatio', equity);
                    handleInputChange('debtRatio', 100 - equity);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Debt Rate (%)
                </label>
                <input
                  type="number"
                  value={financeStructure.debtRate}
                  onChange={(e) => handleInputChange('debtRate', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={financeStructure.taxRate}
                  onChange={(e) => handleInputChange('taxRate', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Capital Structure Chart */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <PieChartIcon className="w-5 h-5 mr-2" />
            Capital Structure
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={capitalStructureData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {capitalStructureData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Debt Amount:</span>
              <span className="font-medium">
                ${((financeStructure.totalCapex * financeStructure.debtRatio) / 100).toFixed(1)}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Equity Amount:</span>
              <span className="font-medium">
                ${((financeStructure.totalCapex * financeStructure.equityRatio) / 100).toFixed(1)}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payback Period:</span>
              <span className="font-medium">{returns.paybackPeriod} years</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Projections Chart */}
      {revenueProjections.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Projections ({selectedRevenueCase} scenario)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={revenueProjections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value.toFixed(1)}M`, '']} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="portfolioRevenue" 
                stackId="1"
                stroke="#10B981" 
                fill="#10B981"
                fillOpacity={0.6}
                name="Revenue"
              />
              <Area 
                type="monotone" 
                dataKey="portfolioOpex" 
                stackId="2"
                stroke="#EF4444" 
                fill="#EF4444"
                fillOpacity={0.6}
                name="Operating Costs"
              />
              <Line 
                type="monotone" 
                dataKey="netRevenue" 
                stroke="#6366F1" 
                strokeWidth={3}
                name="Net Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cash Flow Analysis */}
      {cashFlowData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Project Cash Flow Analysis</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value.toFixed(1)}M`, '']} />
              <Legend />
              <Bar dataKey="revenue" fill="#4CAF50" name="Revenue" />
              <Bar dataKey="opex" fill="#FF9800" name="OpEx" />
              <Line type="monotone" dataKey="ebitda" stroke="#2196F3" strokeWidth={2} name="EBITDA" />
              <Line type="monotone" dataKey="freeCashFlow" stroke="#9C27B0" strokeWidth={2} name="Free Cash Flow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Financial Summary Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-medium mb-3">Key Returns</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Project IRR:</span>
                <span className="font-medium">{returns.projectIRR}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Equity IRR:</span>
                <span className="font-medium">{returns.equityIRR}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Leveraged IRR:</span>
                <span className="font-medium">{returns.leveragedIRR}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">NPV @ 8%:</span>
                <span className="font-medium">${returns.npv}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payback Period:</span>
                <span className="font-medium">{returns.paybackPeriod} years</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3">Risk Metrics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">DSCR (Average):</span>
                <span className={`font-medium ${returns.debtServiceCoverage >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>
                  {returns.debtServiceCoverage}x
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Debt Term:</span>
                <span className="font-medium">20 years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">LTV Ratio:</span>
                <span className="font-medium">{financeStructure.debtRatio}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Annual Debt Service:</span>
                <span className="font-medium">
                  ${(calculateAnnualDebtService(
                    financeStructure.totalCapex * financeStructure.debtRatio / 100,
                    financeStructure.debtRate,
                    20
                  )).toFixed(1)}M
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Scenario Comparison */}
      {Object.keys(assets).length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Scenario Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['base', 'volume', 'price', 'worst'].map(scenario => {
              // Calculate scenario metrics
              const scenarioRevenue = calculateScenarioMetrics(scenario);
              return (
                <div key={scenario} className={`p-4 border rounded-lg ${selectedRevenueCase === scenario ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <h4 className="font-medium text-gray-900 mb-2 capitalize">
                    {scenario === 'worst' ? 'Combined Downside' : `${scenario} Case`}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Avg Revenue:</span>
                      <span>${scenarioRevenue.avgRevenue.toFixed(1)}M</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Project IRR:</span>
                      <span>{scenarioRevenue.irr.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>NPV:</span>
                      <span>${scenarioRevenue.npv.toFixed(0)}M</span>
                    </div>
                  </div>
                  {selectedRevenueCase !== scenario && (
                    <button
                      onClick={() => setSelectedRevenueCase(scenario)}
                      className="mt-2 w-full text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors"
                    >
                      Select Scenario
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset-Level Revenue Breakdown */}
      {Object.keys(assets).length > 1 && revenueProjections.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Revenue Breakdown</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={revenueProjections.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value.toFixed(1)}M`, '']} />
              <Legend />
              {Object.values(assets).map((asset, index) => (
                <Area
                  key={asset.name}
                  type="monotone"
                  dataKey={asset.name}
                  stackId="1"
                  fill={getAssetColor(index)}
                  name={asset.name}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty State */}
      {Object.keys(assets).length === 0 && (
        <div className="bg-white rounded-lg shadow border p-8">
          <div className="text-center">
            <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Assets to Analyze</h3>
            <p className="text-gray-600 mb-4">
              Add assets to your portfolio to perform financial analysis
            </p>
            <a
              href="/assets"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Assets
            </a>
          </div>
        </div>
      )}

      {/* Status Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-blue-500" />
            <span className="text-blue-800 font-medium">
              Financial analysis using integrated revenue calculations
            </span>
          </div>
          <div className="text-blue-600 text-sm">
            Scenario: {selectedRevenueCase} • Period: {analysisYears} years
          </div>
        </div>
        <div className="mt-2 text-sm text-blue-700">
          Revenue calculations include contract escalation, degradation, merchant price forecasts, and stress scenarios.
          {includeTerminalValue && " Terminal values are included in final year cash flows."}
        </div>
      </div>
    </div>
  );

  // Helper function to calculate scenario metrics
  function calculateScenarioMetrics(scenario) {
    // This would calculate metrics for different scenarios
    // Simplified calculation for demo
    const baseMultiplier = scenario === 'base' ? 1.0 : 
                          scenario === 'volume' ? 0.85 : 
                          scenario === 'price' ? 0.9 : 0.75;
    
    const avgRevenue = revenueProjections.length > 0 ? 
      (revenueProjections.reduce((sum, proj) => sum + proj.portfolioRevenue, 0) / revenueProjections.length) * baseMultiplier : 0;
    
    const irr = returns.projectIRR * baseMultiplier;
    const npv = returns.npv * baseMultiplier;
    
    return { avgRevenue, irr, npv };
  }

  // Helper function to get asset colors
  function getAssetColor(index) {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[index % colors.length];
  }
};

export default ProjectFinance;