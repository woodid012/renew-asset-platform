'use client'

import { useState, useEffect } from 'react';
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
  AreaChart
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
  RefreshCw
} from 'lucide-react';

const ProjectFinance = () => {
  const [selectedProject, setSelectedProject] = useState('portfolio');
  const [financeStructure, setFinanceStructure] = useState({
    totalCapex: 420, // Million AUD
    debtRatio: 70,
    equityRatio: 30,
    debtRate: 4.5,
    equityReturn: 12.0,
    projectLife: 25,
    constructionPeriod: 2,
    taxRate: 30
  });

  const [returns, setReturns] = useState({
    projectIRR: 0,
    equityIRR: 0,
    debtServiceCoverage: 0,
    npv: 0,
    paybackPeriod: 0,
    leveragedIRR: 0
  });

  const [cashFlowData, setCashFlowData] = useState([]);
  const [debtSchedule, setDebtSchedule] = useState([]);
  const [sensitivityData, setSensitivityData] = useState([]);
  const [projects, setProjects] = useState([]);

  // Initialize data
  useEffect(() => {
    setProjects([
      { id: 'portfolio', name: 'Portfolio Total', capex: 420 },
      { id: 1, name: 'Solar Farm Alpha', capex: 120 },
      { id: 2, name: 'Wind Farm Beta', capex: 180 },
      { id: 3, name: 'Battery Storage', capex: 120 }
    ]);

    calculateFinanceMetrics();
    generateCashFlows();
    generateDebtSchedule();
    generateSensitivityAnalysis();
  }, [financeStructure, selectedProject]);

  const calculateFinanceMetrics = () => {
    const { totalCapex, debtRatio, equityRatio, debtRate, projectLife } = financeStructure;
    
    // Basic calculations
    const debtAmount = totalCapex * (debtRatio / 100);
    const equityAmount = totalCapex * (equityRatio / 100);
    
    // Mock revenue calculation (replace with actual revenue model)
    const annualRevenue = totalCapex * 0.15; // 15% of CAPEX as annual revenue
    const annualOpex = annualRevenue * 0.25; // 25% of revenue as OPEX
    const ebitda = annualRevenue - annualOpex;
    
    // Debt service calculation
    const annualDebtService = calculateAnnualDebtService(debtAmount, debtRate, projectLife);
    const dscr = ebitda / annualDebtService;
    
    // IRR calculations (simplified)
    const projectIRR = ((ebitda / totalCapex) * 100);
    const equityIRR = projectIRR * 1.5; // Leveraged return
    
    // NPV calculation
    const discountRate = 0.08;
    const npv = calculateNPV(ebitda, totalCapex, discountRate, projectLife);
    
    setReturns({
      projectIRR: Math.round(projectIRR * 10) / 10,
      equityIRR: Math.round(equityIRR * 10) / 10,
      debtServiceCoverage: Math.round(dscr * 100) / 100,
      npv: Math.round(npv),
      paybackPeriod: Math.round((totalCapex / ebitda) * 10) / 10,
      leveragedIRR: Math.round(equityIRR * 10) / 10
    });
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

  const generateCashFlows = () => {
    const years = Array.from({ length: financeStructure.projectLife }, (_, i) => i + 1);
    const data = years.map(year => {
      const baseRevenue = financeStructure.totalCapex * 0.15;
      const growth = Math.pow(1.02, year - 1); // 2% annual growth
      const degradation = Math.pow(0.995, year - 1); // 0.5% annual degradation
      
      const revenue = baseRevenue * growth * degradation;
      const opex = revenue * 0.25;
      const ebitda = revenue - opex;
      const debtService = year <= 20 ? calculateAnnualDebtService(
        financeStructure.totalCapex * financeStructure.debtRatio / 100,
        financeStructure.debtRate,
        20
      ) : 0;
      const taxes = (ebitda - debtService) * financeStructure.taxRate / 100;
      const netCashFlow = ebitda - debtService - taxes;
      
      return {
        year,
        revenue: Math.round(revenue * 10) / 10,
        opex: Math.round(opex * 10) / 10,
        ebitda: Math.round(ebitda * 10) / 10,
        debtService: Math.round(debtService * 10) / 10,
        taxes: Math.round(taxes * 10) / 10,
        netCashFlow: Math.round(netCashFlow * 10) / 10
      };
    });
    setCashFlowData(data);
  };

  const generateDebtSchedule = () => {
    const debtAmount = financeStructure.totalCapex * financeStructure.debtRatio / 100;
    const annualPayment = calculateAnnualDebtService(debtAmount, financeStructure.debtRate, 20);
    
    let remainingBalance = debtAmount;
    const schedule = [];
    
    for (let year = 1; year <= 20; year++) {
      const interestPayment = remainingBalance * financeStructure.debtRate / 100;
      const principalPayment = annualPayment - interestPayment;
      remainingBalance -= principalPayment;
      
      schedule.push({
        year,
        beginningBalance: Math.round((remainingBalance + principalPayment) * 10) / 10,
        interestPayment: Math.round(interestPayment * 10) / 10,
        principalPayment: Math.round(principalPayment * 10) / 10,
        endingBalance: Math.round(Math.max(0, remainingBalance) * 10) / 10
      });
    }
    setDebtSchedule(schedule);
  };

  const generateSensitivityAnalysis = () => {
    const baseIRR = returns.equityIRR;
    const scenarios = [
      { scenario: 'Base Case', revenueChange: 0, capexChange: 0, irr: baseIRR },
      { scenario: 'Revenue +10%', revenueChange: 10, capexChange: 0, irr: baseIRR + 2.5 },
      { scenario: 'Revenue -10%', revenueChange: -10, capexChange: 0, irr: baseIRR - 2.5 },
      { scenario: 'CAPEX +15%', revenueChange: 0, capexChange: 15, irr: baseIRR - 3.0 },
      { scenario: 'CAPEX -15%', revenueChange: 0, capexChange: -15, irr: baseIRR + 3.0 },
      { scenario: 'Best Case', revenueChange: 15, capexChange: -10, irr: baseIRR + 4.5 },
      { scenario: 'Worst Case', revenueChange: -15, capexChange: 20, irr: baseIRR - 5.5 }
    ];
    setSensitivityData(scenarios);
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

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Finance</h1>
          <p className="text-gray-600">Equity, debt structure and returns calculation</p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
            <span>Recalculate</span>
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

      {/* Project Selection */}
      <div className="bg-white rounded-lg shadow border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} - ${project.capex}M CAPEX
                </option>
              ))}
            </select>
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
              <p className="text-sm font-medium text-gray-600">DSCR</p>
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
                  Target Equity Return (%)
                </label>
                <input
                  type="number"
                  value={financeStructure.equityReturn}
                  onChange={(e) => handleInputChange('equityReturn', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  step="0.1"
                />
              </div>
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

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Project Cash Flows</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip formatter={(value) => [`$${value.toFixed(1)}M`, '']} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stackId="1"
              stroke="#10B981" 
              fill="#10B981"
              fillOpacity={0.6}
              name="Revenue"
            />
            <Area 
              type="monotone" 
              dataKey="opex" 
              stackId="2"
              stroke="#EF4444" 
              fill="#EF4444"
              fillOpacity={0.6}
              name="OPEX"
            />
            <Line 
              type="monotone" 
              dataKey="netCashFlow" 
              stroke="#6366F1" 
              strokeWidth={3}
              name="Net Cash Flow"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sensitivity Analysis */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Sensitivity Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sensitivityData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="scenario" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Equity IRR']} />
            <Bar 
              dataKey="irr" 
              fill={(entry) => entry >= financeStructure.equityReturn ? '#10B981' : '#EF4444'}
              name="Equity IRR"
            >
              {sensitivityData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.irr >= financeStructure.equityReturn ? '#10B981' : '#EF4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
    </div>
  );
};

export default ProjectFinance;