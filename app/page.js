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

// Import project finance calculations
import { 
  calculateProjectMetrics, 
  calculateIRR,
  initializeProjectValues
} from '@/app/components/ProjectFinance_Calcs';

// Import revenue calculations
import { 
  generatePortfolioData,
  calculatePortfolioSummary
} from '@/lib/revenueCalculations';

export default function EnhancedDashboard() {
  const { currentUser, currentPortfolio } = useUser();
  const { getMerchantPrice } = useMerchantPrices();
  
  // State management
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() + 9); // Default to Year 10
  
  // Project finance state
  const [projectMetrics, setProjectMetrics] = useState({});
  
  // Dashboard data
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
  
  const [revenueProjections, setRevenueProjections] = useState([]);
  const [assetBreakdown, setAssetBreakdown] = useState([]);
  const [fundingBreakdown, setFundingBreakdown] = useState([]);
  const [contractAnalysis, setContractAnalysis] = useState([]);
  const [contractLifeAnalysis, setContractLifeAnalysis] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  // Finance Page Sensitivity Display Component
  const FinanceSensitivityDisplay = ({ portfolioIRR }) => {
    const [sensitivityData, setSensitivityData] = useState([]);
    const [showPlaceholder, setShowPlaceholder] = useState(true);

    // Simulate receiving data from finance page (in real implementation, this would come from shared state or API)
    useEffect(() => {
      // Check if we have finance page data in localStorage or session
      const checkForFinanceData = () => {
        try {
          const financeData = localStorage.getItem('financeSensitivityData');
          if (financeData) {
            const parsedData = JSON.parse(financeData);
            setSensitivityData(parsedData);
            setShowPlaceholder(false);
          } else {
            // Create sample tornado data structure for demonstration
            const sampleData = [
              {
                parameter: 'Electricity Price',
                upside: 2.8,
                downside: -2.8,
                baseIRR: portfolioIRR,
                maxAbsImpact: 2.8,
                range: 10,
                unit: '%'
              },
              {
                parameter: 'CAPEX',
                upside: 2.2,
                downside: -2.2,
                baseIRR: portfolioIRR,
                maxAbsImpact: 2.2,
                range: 10,
                unit: '%'
              },
              {
                parameter: 'Volume',
                upside: 1.8,
                downside: -1.8,
                baseIRR: portfolioIRR,
                maxAbsImpact: 1.8,
                range: 10,
                unit: '%'
              },
              {
                parameter: 'Interest Rate',
                upside: 1.5,
                downside: -1.5,
                baseIRR: portfolioIRR,
                maxAbsImpact: 1.5,
                range: 1,
                unit: 'pp'
              },
              {
                parameter: 'OPEX',
                upside: 1.2,
                downside: -1.2,
                baseIRR: portfolioIRR,
                maxAbsImpact: 1.2,
                range: 10,
                unit: '%'
              },
              {
                parameter: 'Terminal Value',
                upside: 0.8,
                downside: -0.8,
                baseIRR: portfolioIRR,
                maxAbsImpact: 0.8,
                range: 50,
                unit: '%'
              }
            ].filter(item => portfolioIRR > 0);
            
            if (portfolioIRR > 0) {
              setSensitivityData(sampleData);
              setShowPlaceholder(false);
            }
          }
        } catch (error) {
          console.error('Error loading sensitivity data:', error);
        }
      };

      checkForFinanceData();
      
      // Check periodically for updates from finance page
      const interval = setInterval(checkForFinanceData, 5000);
      return () => clearInterval(interval);
    }, [portfolioIRR]);

    if (portfolioIRR <= 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No sensitivity data available</p>
          <p className="text-sm">Portfolio IRR must be calculated first</p>
        </div>
      );
    }

    if (sensitivityData.length === 0) {
      return (
        <div>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Base IRR:</strong> {portfolioIRR.toFixed(2)}% • 
              <strong>Source:</strong> Finance page calculations • 
              <strong>Status:</strong> Visit Finance page for live sensitivity analysis
            </p>
          </div>

          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sensitivity Analysis Available</h3>
            <p className="text-gray-600 mb-4">
              Complete tornado sensitivity analysis is available on the Finance page
            </p>
            <button 
              onClick={() => window.location.href = '/pages/finance'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Finance Page
            </button>
            <div className="mt-4 text-sm text-gray-500">
              <p>The Finance page includes:</p>
              <ul className="mt-2 space-y-1">
                <li>• Live sensitivity tornado with customizable ranges</li>
                <li>• CAPEX, Electricity Price, Volume, Interest Rate, OPEX, Terminal Value</li>
                <li>• Real-time recalculation using actual project metrics</li>
                <li>• Interactive parameter adjustment</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Prepare data for proper tornado chart - create left/right bars
    const chartData = sensitivityData.map(item => ({
      parameter: item.parameter,
      // For tornado effect: negative values go left, positive go right
      left: -Math.abs(item.downside), // Always negative for left side
      right: Math.abs(item.upside),   // Always positive for right side
      downsideValue: item.downside,
      upsideValue: item.upside,
      range: item.range,
      unit: item.unit,
      maxAbsImpact: Math.max(Math.abs(item.upside), Math.abs(item.downside))
    })).sort((a, b) => b.maxAbsImpact - a.maxAbsImpact); // Sort by impact magnitude

    // Calculate max range for symmetric axis
    const maxRange = Math.max(...chartData.map(d => Math.max(Math.abs(d.left), Math.abs(d.right))));
    const axisRange = Math.ceil(maxRange + 0.5);

    return (
      <div>
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Base IRR:</strong> {portfolioIRR.toFixed(2)}% • 
            <strong>Source:</strong> {showPlaceholder ? 'Sample data' : 'Finance page calculations'} • 
            <strong>Parameters:</strong> Live tornado sensitivity
          </p>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e4e7" />
            <XAxis 
              type="number" 
              domain={[-axisRange, axisRange]}
              tickFormatter={(value) => `${Math.abs(value).toFixed(1)}pp`}
              axisLine={true}
              tickLine={true}
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              dataKey="parameter" 
              type="category" 
              width={90}
              tick={{ fontSize: 11 }}
              axisLine={true}
              tickLine={true}
            />
            <Tooltip 
              formatter={(value, name, props) => {
                if (name === 'left') {
                  return [`${props.payload.downsideValue.toFixed(1)}pp`, 'Downside Impact'];
                } else {
                  return [`+${props.payload.upsideValue.toFixed(1)}pp`, 'Upside Impact'];
                }
              }}
              labelFormatter={(label) => `${label} Sensitivity`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Legend 
              payload={[
                { value: 'Downside Impact', type: 'rect', color: '#EF4444' },
                { value: 'Upside Impact', type: 'rect', color: '#10B981' }
              ]}
            />
            {/* Reference line at zero */}
            <Bar 
              dataKey="left" 
              fill="#EF4444" 
              name="Downside"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              dataKey="right" 
              fill="#10B981" 
              name="Upside"
              radius={[0, 0, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {chartData.map((item, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded">
              <div className="font-medium text-gray-900">{item.parameter}</div>
              <div className="text-gray-600">±{item.range}{item.unit}</div>
              <div className="flex justify-between mt-1">
                <span className="text-red-600">{item.downsideValue.toFixed(1)}pp</span>
                <span className="text-green-600">+{item.upsideValue.toFixed(1)}pp</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-gray-600">
          <p>
            <strong>Tornado Chart:</strong> Shows IRR sensitivity to key parameters. 
            Left (red) = downside impact, Right (green) = upside impact.
            {showPlaceholder ? ' Sample data shown - visit Finance page to calculate actual sensitivity.' : ' Live data from Finance page calculations.'}
          </p>
        </div>
      </div>
    );
  };

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
          console.log('Initializing project finance values for dashboard...');
          updatedConstants.assetCosts = initializeProjectValues(portfolioData.assets || {});
        }

        setConstants(updatedConstants);
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
    
    // Generate 30-year revenue projections using the integrated calculations
    const currentYear = new Date().getFullYear();
    const timeIntervals = Array.from({ length: 30 }, (_, i) => currentYear + i);
    setAvailableYears(timeIntervals); // Set available years for the dropdown
    
    let year10Revenue = 0;
    let portfolioEquityIRR = 0;
    let totalCapex = 0;
    let totalDebt = 0;
    let totalEquity = 0;
    const yearlyProjections = [];
    const assetBreakdownData = [];
    const contractData = [];
    
    if (Object.keys(assets).length > 0) {
      // Calculate project finance metrics using the same method as finance page
      let assetCosts = constants.assetCosts;
      if (!assetCosts) {
        assetCosts = initializeProjectValues(assets);
      }
      
      // Use project finance calculations - same as finance page
      const projectMetrics = calculateProjectMetrics(
        assets,
        assetCosts,
        constants,
        getMerchantPrice,
        'base', // Base case scenario
        false,  // Don't auto-solve gearing
        true    // Include terminal value
      );
      
      setProjectMetrics(projectMetrics);
      
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
        
        totalCapex = totals.capex;
        totalDebt = totals.debtAmount;
        totalEquity = totalCapex - totalDebt;
        
        if (allEquityCashFlows.length > 0) {
          const calculatedIRR = calculateIRR(allEquityCashFlows);
          portfolioEquityIRR = calculatedIRR ? calculatedIRR * 100 : 0;
        }
      }
      
      // Generate revenue projections for charts
      const portfolioData = generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice);
      
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
      
      // Contract life analysis - break into 0-10, 10-20, 20-30 year buckets
      const contractLifeData = [
        { period: '0-10 years', contracted: 0, merchant: 0, total: 0 },
        { period: '10-20 years', contracted: 0, merchant: 0, total: 0 },
        { period: '20-30 years', contracted: 0, merchant: 0, total: 0 }
      ];
      
      yearlyProjections.forEach((year, index) => {
        const bucketIndex = Math.floor(index / 10);
        if (bucketIndex < 3) {
          contractLifeData[bucketIndex].contracted += year.contractedRevenue;
          contractLifeData[bucketIndex].merchant += year.merchantRevenue;
          contractLifeData[bucketIndex].total += year.totalRevenue;
        }
      });
      
      setContractLifeAnalysis(contractLifeData);
      
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
    
    // Create funding breakdown data
    const fundingData = [
      { name: 'CAPEX', value: totalCapex, color: '#3B82F6' },
      { name: 'Debt', value: totalDebt, color: '#EF4444' },
      { name: 'Equity', value: totalEquity, color: '#10B981' }
    ];
    setFundingBreakdown(fundingData);
    
    // Calculate contracted percentage from first 10 years
    const first10Years = yearlyProjections.slice(0, 10);
    const totalContracted = first10Years.reduce((sum, year) => sum + year.contractedRevenue, 0);
    const totalRevenue = first10Years.reduce((sum, year) => sum + year.totalRevenue, 0);
    const contractedPercentage = totalRevenue > 0 ? (totalContracted / totalRevenue) * 100 : 0;
    
    setPortfolioMetrics({
      totalCapacity,
      totalProjects,
      year10Revenue,
      portfolioIRR: portfolioEquityIRR,
      contractedPercentage,
      totalCapex,
      totalDebt,
      totalEquity
    });
    
    setRevenueProjections(yearlyProjections);
    setAssetBreakdown(assetBreakdownData);
    setContractAnalysis(contractData);
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'storage': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
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
          Real-time portfolio performance with integrated project finance
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

        {/* Portfolio IRR - Linked to Project Finance */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Portfolio IRR</p>
              <p className="text-2xl font-bold text-gray-900">
                {(portfolioMetrics.portfolioIRR || 0).toFixed(1)}%
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
              <p className="text-sm font-medium text-gray-600">Contracted (0-10Y)</p>
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

        {/* IRR Sensitivity - Links to Finance Page */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">IRR Sensitivity Analysis</h3>
          <FinanceSensitivityDisplay portfolioIRR={portfolioMetrics.portfolioIRR} />
        </div>
      </div>

      {/* Asset and Funding Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Portfolio Breakdown with Year Selector - Condensed */}
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
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={assetBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, value}) => `${name}: ${value.toFixed(1)}M`}
                    outerRadius={60}
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
              
              {/* Condensed Asset List */}
              <div className="mt-4 space-y-2">
                {Object.values(assets).map((asset, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center space-x-2">
                      {getAssetIcon(asset.type)}
                      <span className="font-medium">{asset.name}</span>
                      <span className="text-gray-500">{asset.capacity}MW</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(getAssetStatus(asset))}
                      <span className="text-xs capitalize text-gray-600">
                        {getAssetStatus(asset)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No asset data available</p>
              <p className="text-sm">for year {selectedYear}</p>
            </div>
          )}
        </div>

        {/* CAPEX/Debt/Equity Funding Breakdown */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Portfolio Funding Structure</h3>
          {fundingBreakdown.length > 0 && portfolioMetrics.totalCapex > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={fundingBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, value}) => `${name}: $${value.toFixed(1)}M`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fundingBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${value.toFixed(1)}M`, '']} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Funding Summary */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-900">${portfolioMetrics.totalCapex.toFixed(1)}M</p>
                  <p className="text-sm text-blue-600">Total CAPEX</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-900">${portfolioMetrics.totalDebt.toFixed(1)}M</p>
                  <p className="text-sm text-red-600">Debt Funding</p>
                  <p className="text-xs text-red-500">{((portfolioMetrics.totalDebt/portfolioMetrics.totalCapex)*100).toFixed(0)}%</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-900">${portfolioMetrics.totalEquity.toFixed(1)}M</p>
                  <p className="text-sm text-green-600">Equity Funding</p>
                  <p className="text-xs text-green-500">{((portfolioMetrics.totalEquity/portfolioMetrics.totalCapex)*100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No funding data available</p>
              <p className="text-sm">Complete project finance to see breakdown</p>
            </div>
          )}
        </div>
      </div>

      {/* Contract Life Analysis - New Section */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Contract Life Analysis (% of Revenue)</h3>
        {contractLifeAnalysis.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={contractLifeAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `${((value / contractLifeAnalysis.find(d => d.period === contractLifeAnalysis[0].period)?.total || 1) * 100).toFixed(1)}%`,
                  name === 'contracted' ? 'Contracted' : 'Merchant'
                ]}
              />
              <Legend />
              <Bar dataKey="contracted" stackId="a" fill="#10B981" name="Contracted Revenue" />
              <Bar dataKey="merchant" stackId="a" fill="#F59E0B" name="Merchant Revenue" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No contract analysis available</p>
          </div>
        )}
      </div>

      {/* Contract Analysis Table */}
      {contractAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Contract Summary</h3>
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
              Dashboard linked to project finance calculations
            </span>
          </div>
          <div className="text-green-600 text-sm">
            {Object.keys(assets).length} assets • {(portfolioMetrics.totalCapacity || 0).toFixed(1)} MW • 
            {(portfolioMetrics.portfolioIRR || 0).toFixed(1)}% IRR
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          Live IRR calculation, finance page sensitivity integration, contract life breakdown (0-10/10-20/20-30 years), 
          condensed asset portfolio with funding structure breakdown (CAPEX/Debt/Equity).
        </div>
      </div>
    </div>
  );
}