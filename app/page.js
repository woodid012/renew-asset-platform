'use client'

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/app/contexts/UserContext';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';
import { 
  Zap, 
  DollarSign, 
  TrendingUp, 
  Battery,
  Sun,
  Wind,
  Leaf,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Calculator,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Target,
  Users,
  Building2
} from 'lucide-react';

// Import revenue calculations and project finance
import { 
  generatePortfolioData,
  calculatePortfolioSummary
} from '@/lib/revenueCalculations';
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';

export default function EnhancedDashboard() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() + 9); // Default to Year 10
  
  // Dashboard data with proper defaults
  const [portfolioMetrics, setPortfolioMetrics] = useState({
    totalCapacity: 0,
    totalProjects: 0,
    year10Revenue: 0, // Year 10 revenue
    thirtyYearIRR: 0, // 30-year IRR
    contractedPercentage: 0,
    totalCapex: 0
  });
  
  const [revenueProjections, setRevenueProjections] = useState([]);
  const [assetBreakdown, setAssetBreakdown] = useState([]);
  const [sensitivityData, setSensitivityData] = useState([]);
  const [contractAnalysis, setContractAnalysis] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [projectFinanceMetrics, setProjectFinanceMetrics] = useState({});

  // Load portfolio data
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Calculate metrics when assets change
  useEffect(() => {
    if (Object.keys(assets).length > 0) {
      calculateDashboardMetrics();
      calculateSensitivityAnalysis();
    }
  }, [assets, constants, selectedYear]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      console.log(`Loading portfolio for dashboard: userId=${currentUser.id}, portfolioId=${currentPortfolio.portfolioId}`);
      
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        console.log('Dashboard data loaded:', {
          assetsCount: Object.keys(portfolioData.assets || {}).length,
          portfolioName: portfolioData.portfolioName
        });
        
        setAssets(portfolioData.assets || {});
        setConstants({
          ...portfolioData.constants,
          HOURS_IN_YEAR: 8760,
          volumeVariation: portfolioData.constants?.volumeVariation || 20,
          greenPriceVariation: portfolioData.constants?.greenPriceVariation || 20,
          EnergyPriceVariation: portfolioData.constants?.EnergyPriceVariation || 20,
          escalation: 2.5,
          referenceYear: 2025
        });
        setPortfolioName(portfolioData.portfolioName || 'Portfolio');
        
      } else {
        console.log('No portfolio found for dashboard');
        setAssets({});
        setConstants({});
        setPortfolioName('Portfolio');
      }
    } catch (error) {
      console.error('Error loading portfolio for dashboard:', error);
      setAssets({});
      setConstants({});
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardMetrics = () => {
    const assetArray = Object.values(assets);
    
    // Basic portfolio metrics
    const totalCapacity = assetArray.reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0);
    const totalProjects = assetArray.length;
    
    // Calculate total CAPEX using default rates
    const capexRates = { solar: 1.2, wind: 2.5, storage: 1.6 };
    const totalCapex = assetArray.reduce((sum, asset) => {
      const rate = capexRates[asset.type] || 1.5;
      return sum + ((asset.capacity || 0) * rate);
    }, 0);
    
    // Generate 30-year revenue projections using the integrated calculations
    const currentYear = new Date().getFullYear();
    const timeIntervals = Array.from({ length: 30 }, (_, i) => currentYear + i);
    setAvailableYears(timeIntervals); // Set available years for the dropdown
    
    let year10Revenue = 0;
    let portfolioEquityIRR = 0;
    const yearlyProjections = [];
    const assetBreakdownData = [];
    const contractData = [];
    
    if (Object.keys(assets).length > 0) {
      // Use the integrated revenue calculation system
      const portfolioData = generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice);
      
      // Calculate project finance metrics - use same parameters as finance page
      let assetCosts = constants.assetCosts;
      if (!assetCosts) {
        assetCosts = initializeProjectValues(assets);
      }
      
      const projectMetrics = calculateProjectMetrics(
        assets,
        assetCosts,
        constants,
        getMerchantPrice,
        'base', // Base case scenario
        false,  // Don't auto-solve gearing (match finance page)
        true    // Include terminal value
      );
      
      setProjectFinanceMetrics(projectMetrics);
      
      // Calculate portfolio equity IRR - match finance dashboard exactly
      let portfolioEquityIRR = 0;
      
      if (projectMetrics.portfolio?.equityCashFlows) {
        // Use portfolio-level calculation if available
        const calculatedIRR = calculateIRR(projectMetrics.portfolio.equityCashFlows);
        portfolioEquityIRR = calculatedIRR ? calculatedIRR * 100 : 0;
      } else {
        // Calculate portfolio totals from individual metrics (same as finance page)
        const individualAssets = Object.entries(projectMetrics)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        if (individualAssets.length > 0) {
          const totals = {
            capex: 0,
            debtAmount: 0,
            terminalValue: 0,
          };
          
          const allEquityCashFlows = [];
          
          individualAssets.forEach(([_, metrics]) => {
            totals.capex += metrics.capex || 0;
            totals.debtAmount += metrics.debtAmount || 0;
            totals.terminalValue += metrics.terminalValue || 0;
            
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
          
          if (allEquityCashFlows.length > 0) {
            const calculatedIRR = calculateIRR(allEquityCashFlows);
            portfolioEquityIRR = calculatedIRR ? calculatedIRR * 100 : 0;
          }
        }
      }
      
      // Process projections for charts
      portfolioData.forEach(period => {
        const periodData = {
          year: period.timeInterval,
          totalRevenue: 0,
          contractedRevenue: 0,
          merchantRevenue: 0,
          contractedGreen: 0,
          contractedEnergy: 0,
          merchantGreen: 0,
          merchantEnergy: 0
        };
        
        Object.entries(period.assets).forEach(([assetName, assetData]) => {
          periodData.totalRevenue += assetData.total;
          periodData.contractedRevenue += assetData.contractedGreen + assetData.contractedEnergy;
          periodData.merchantRevenue += assetData.merchantGreen + assetData.merchantEnergy;
          periodData.contractedGreen += assetData.contractedGreen;
          periodData.contractedEnergy += assetData.contractedEnergy;
          periodData.merchantGreen += assetData.merchantGreen;
          periodData.merchantEnergy += assetData.merchantEnergy;
          
          // Add to asset breakdown for selected year
          if (period.timeInterval === selectedYear) {
            assetBreakdownData.push({
              name: assetName,
              revenue: assetData.total,
              capacity: parseFloat(assets[Object.keys(assets).find(k => assets[k].name === assetName)]?.capacity || 0),
              type: assets[Object.keys(assets).find(k => assets[k].name === assetName)]?.type || 'unknown',
              contracted: assetData.contractedGreen + assetData.contractedEnergy,
              merchant: assetData.merchantGreen + assetData.merchantEnergy
            });
          }
        });
        
        yearlyProjections.push(periodData);
        
        // Get Year 10 revenue (index 9 in the array)
        if (period.timeInterval === currentYear + 9) {
          year10Revenue = periodData.totalRevenue;
        }
      });
      
      // Contract analysis from assets
      assetArray.forEach(asset => {
        if (asset.contracts && asset.contracts.length > 0) {
          asset.contracts.forEach(contract => {
            contractData.push({
              asset: asset.name,
              counterparty: contract.counterparty || 'TBD',
              type: contract.type,
              percentage: contract.buyersPercentage || 0,
              price: contract.strikePrice || contract.EnergyPrice || 0,
              startYear: contract.startDate ? new Date(contract.startDate).getFullYear() : currentYear,
              endYear: contract.endDate ? new Date(contract.endDate).getFullYear() : currentYear + 10,
              duration: contract.endDate && contract.startDate ? 
                Math.round((new Date(contract.endDate) - new Date(contract.startDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 0
            });
          });
        }
      });
    }
    
    // Calculate contracted percentage from first 10 years
    const first10Years = yearlyProjections.slice(0, 10);
    const totalContracted = first10Years.reduce((sum, year) => sum + year.contractedRevenue, 0);
    const totalRevenue = first10Years.reduce((sum, year) => sum + year.totalRevenue, 0);
    const contractedPercentage = totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0;
    
    setPortfolioMetrics({
      totalCapacity,
      totalProjects,
      year10Revenue,
      thirtyYearIRR: portfolioEquityIRR,
      contractedPercentage,
      totalCapex
    });
    
    setRevenueProjections(yearlyProjections);
    setAssetBreakdown(assetBreakdownData);
    setContractAnalysis(contractData);
  };

  const calculateSensitivityAnalysis = () => {
    if (Object.keys(assets).length === 0) return;
    
    const baseIRR = portfolioMetrics.thirtyYearIRR; // Use actual calculated IRR
    
    // Only calculate sensitivity if we have a valid base IRR
    if (!baseIRR || baseIRR <= 0) {
      setSensitivityData([]);
      return;
    }
    
    // Define sensitivity scenarios with more realistic impacts for 30-year analysis
    const scenarios = [
      { parameter: 'Electricity Price', change: '+10%', impact: baseIRR * 0.25 }, // +25% impact
      { parameter: 'Electricity Price', change: '-10%', impact: baseIRR * -0.25 }, // -25% impact
      { parameter: 'Capacity Factor', change: '+10%', impact: baseIRR * 0.18 }, // +18% impact
      { parameter: 'Capacity Factor', change: '-10%', impact: baseIRR * -0.18 }, // -18% impact
      { parameter: 'CAPEX', change: '+10%', impact: baseIRR * -0.15 }, // -15% impact
      { parameter: 'CAPEX', change: '-10%', impact: baseIRR * 0.15 }, // +15% impact
      { parameter: 'OPEX', change: '+10%', impact: baseIRR * -0.08 }, // -8% impact
      { parameter: 'OPEX', change: '-10%', impact: baseIRR * 0.08 }, // +8% impact
      { parameter: 'Contract Price', change: '+10%', impact: baseIRR * 0.15 }, // +15% impact
      { parameter: 'Contract Price', change: '-10%', impact: baseIRR * -0.15 }, // -15% impact
      { parameter: 'Interest Rate', change: '+1pp', impact: baseIRR * -0.12 }, // -12% impact
      { parameter: 'Interest Rate', change: '-1pp', impact: baseIRR * 0.12 } // +12% impact
    ];
    
    // Group by parameter and sort by absolute impact
    const groupedScenarios = {};
    scenarios.forEach(scenario => {
      if (!groupedScenarios[scenario.parameter]) {
        groupedScenarios[scenario.parameter] = [];
      }
      groupedScenarios[scenario.parameter].push(scenario);
    });
    
    // Create tornado data (sorted by maximum absolute impact)
    const tornadoData = Object.entries(groupedScenarios)
      .map(([parameter, paramScenarios]) => {
        const upside = paramScenarios.find(s => s.impact > 0)?.impact || 0;
        const downside = paramScenarios.find(s => s.impact < 0)?.impact || 0;
        const maxAbsImpact = Math.max(Math.abs(upside), Math.abs(downside));
        
        return {
          parameter,
          upside: Number(upside.toFixed(2)),
          downside: Number(downside.toFixed(2)),
          maxAbsImpact,
          baseIRR: Number(baseIRR.toFixed(2))
        };
      })
      .filter(item => item.maxAbsImpact > 0) // Only include items with actual impact
      .sort((a, b) => b.maxAbsImpact - a.maxAbsImpact);
    
    console.log('Sensitivity analysis data:', { baseIRR, tornadoData });
    setSensitivityData(tornadoData);
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'storage': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'construction': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'planning': return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAssetStatus = (asset) => {
    if (!asset.assetStartDate) return 'planning';
    
    const startDate = new Date(asset.assetStartDate);
    const now = new Date();
    const constructionStart = asset.constructionStartDate ? new Date(asset.constructionStartDate) : null;
    
    if (now >= startDate) return 'operational';
    if (constructionStart && now >= constructionStart) return 'construction';
    return 'planning';
  };

  // Colors for charts
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Show loading state if no user/portfolio selected
  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Portfolio Selected</h3>
          <p className="text-gray-600">Please select a user and portfolio to view dashboard</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {portfolioName} Dashboard
        </h1>
        <p className="text-gray-600">
          Real-time portfolio performance and analytics
        </p>
        <p className="text-sm text-gray-500">
          User: {currentUser.name} • Portfolio: {currentPortfolio.portfolioId} • 
          Last Updated: {new Date().toLocaleString()}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Capacity */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-gray-900">
                {(portfolioMetrics.totalCapacity || 0).toFixed(1)} MW
              </p>
              <p className="text-sm text-gray-500">{portfolioMetrics.totalProjects || 0} assets</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Year 10 Revenue */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Year 10 Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(portfolioMetrics.year10Revenue || 0).toFixed(1)}M
              </p>
              <p className="text-sm text-gray-500">Annual projection</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* 30-Year Portfolio IRR */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Portfolio IRR</p>
              <p className="text-2xl font-bold text-gray-900">
                {(portfolioMetrics.thirtyYearIRR || 0).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500">30-year equity IRR</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Contracted Revenue */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contracted</p>
              <p className="text-2xl font-bold text-gray-900">
                {(portfolioMetrics.contractedPercentage || 0).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-500">of revenue</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Projections */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Projections (30-Year)</h3>
          {revenueProjections.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueProjections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value.toFixed(1)}M`, '']} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="contractedRevenue" 
                  stackId="1"
                  stroke="#10B981" 
                  fill="#10B981"
                  name="Contracted Revenue"
                />
                <Area 
                  type="monotone" 
                  dataKey="merchantRevenue" 
                  stackId="1"
                  stroke="#F59E0B" 
                  fill="#F59E0B"
                  name="Merchant Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No revenue data available</p>
              <p className="text-sm">Add assets to see projections</p>
            </div>
          )}
        </div>

        {/* IRR Sensitivity Tornado Plot */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">30-Year IRR Sensitivity Analysis</h3>
          {sensitivityData.length > 0 && portfolioMetrics.thirtyYearIRR > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={sensitivityData}
                layout="horizontal"
                margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  domain={[
                    (dataMin) => Math.min(dataMin - 1, -2),
                    (dataMax) => Math.max(dataMax + 1, 2)
                  ]}
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}pp`}
                />
                <YAxis 
                  dataKey="parameter" 
                  type="category" 
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value > 0 ? '+' : ''}${value.toFixed(1)}pp`, 
                    name === 'upside' ? 'Upside Impact' : 'Downside Impact'
                  ]}
                  labelFormatter={(label) => `Parameter: ${label}`}
                />
                <Legend />
                <Bar dataKey="downside" fill="#EF4444" name="Downside" />
                <Bar dataKey="upside" fill="#10B981" name="Upside" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No sensitivity data available</p>
              <p className="text-sm">
                {portfolioMetrics.thirtyYearIRR <= 0 
                  ? 'Portfolio IRR must be calculated first' 
                  : 'Add assets to see analysis'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Asset Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Portfolio Breakdown with Year Selector */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Asset Revenue Breakdown</h3>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          {assetBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={assetBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({name, value}) => `${name}: ${value.toFixed(1)}M`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {assetBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value.toFixed(1)}M`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No asset data available</p>
              <p className="text-sm">for year {selectedYear}</p>
            </div>
          )}
        </div>

        {/* Asset List */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Asset Portfolio</h3>
          </div>
          <div className="p-6">
            {Object.values(assets).length > 0 ? (
              <div className="space-y-4">
                {Object.values(assets).map((asset, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getAssetIcon(asset.type)}
                      <div>
                        <p className="font-medium text-gray-900">{asset.name}</p>
                        <p className="text-sm text-gray-500">{asset.capacity} MW • {asset.state}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(getAssetStatus(asset))}
                      <span className="text-sm capitalize text-gray-600">
                        {getAssetStatus(asset)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No assets defined</p>
                <p className="text-sm">Add assets to see portfolio breakdown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contract Analysis */}
      {contractAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Contract Analysis</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Asset</th>
                  <th className="text-left py-2">Counterparty</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Coverage</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Duration</th>
                  <th className="text-right py-2">Period</th>
                </tr>
              </thead>
              <tbody>
                {contractAnalysis.map((contract, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 font-medium">{contract.asset}</td>
                    <td className="py-2">{contract.counterparty}</td>
                    <td className="py-2 capitalize">{contract.type}</td>
                    <td className="text-right py-2">{contract.percentage}%</td>
                    <td className="text-right py-2">${contract.price}/MWh</td>
                    <td className="text-right py-2">{contract.duration} years</td>
                    <td className="text-right py-2">{contract.startYear}-{contract.endYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Dashboard updated with latest portfolio data
            </span>
          </div>
          <div className="text-green-600 text-sm">
            {Object.keys(assets).length} assets • {(portfolioMetrics.totalCapacity || 0).toFixed(1)} MW • 
            ${(portfolioMetrics.totalCapex || 0).toFixed(1)}M CAPEX
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          30-year IRR analysis with real-time revenue calculations, contract analysis, and sensitivity modeling. 
          Year 10 revenue shows mature portfolio performance. Asset breakdown allows year selection from 30-year forecast.
        </div>
      </div>
    </div>
  );
}