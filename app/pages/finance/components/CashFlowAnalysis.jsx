// components/CashFlowAnalysis.jsx
'use client'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Table, BarChart } from 'lucide-react';

export default function CashFlowAnalysis({
  projectMetrics,
  showCashFlowTable,
  analysisYears
}) {

  // Helper function for formatting currency
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `$${value.toFixed(1)}M`;
  };

  // Helper function for formatting DSCR
  const formatDSCR = (value) => {
    if (value === undefined || value === null || !isFinite(value)) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  // Get cash flows data
  const cashFlows = projectMetrics.portfolio?.cashFlows || [];
  
  if (cashFlows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Cash Flow Analysis</h3>
        <div className="text-center text-gray-500 py-12">
          <BarChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No cash flow data available</p>
          <p className="text-sm">Complete the project finance analysis to see cash flows</p>
        </div>
      </div>
    );
  }

  // Calculate summary metrics
  const getSummaryMetrics = () => {
    const operationalCashFlows = cashFlows.filter(cf => cf.operatingCashFlow > 0);
    const totalRevenue = operationalCashFlows.reduce((sum, cf) => sum + cf.revenue, 0);
    const totalOpex = operationalCashFlows.reduce((sum, cf) => sum + Math.abs(cf.opex), 0);
    const totalDebtService = operationalCashFlows.reduce((sum, cf) => sum + Math.abs(cf.debtService || 0), 0);
    const cumulativeEquityCashFlow = operationalCashFlows.reduce((sum, cf) => sum + cf.equityCashFlow, 0);
    const averageDSCR = operationalCashFlows.length > 0 ? 
      operationalCashFlows.reduce((sum, cf) => sum + (cf.dscr || 0), 0) / operationalCashFlows.length : 0;

    return {
      totalRevenue,
      totalOpex,
      totalDebtService,
      cumulativeEquityCashFlow,
      averageDSCR,
      operationalYears: operationalCashFlows.length
    };
  };

  const summaryMetrics = getSummaryMetrics();

  // Prepare chart data (limit to reasonable number of points for visibility)
  const chartData = cashFlows.slice(0, Math.min(25, analysisYears)).map(cf => ({
    year: cf.year,
    revenue: cf.revenue || 0,
    opex: Math.abs(cf.opex || 0),
    operatingCashFlow: cf.operatingCashFlow || 0,
    debtService: Math.abs(cf.debtService || 0),
    equityCashFlow: cf.equityCashFlow || 0,
    dscr: cf.dscr || null
  }));

  return (
    <div className="space-y-6">
      {/* Cash Flow Chart */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Portfolio Cash Flow Projections</h3>
        </div>
        
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summaryMetrics.totalRevenue)}</p>
            <p className="text-sm text-gray-600">Total Revenue</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summaryMetrics.totalOpex)}</p>
            <p className="text-sm text-gray-600">Total OPEX</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summaryMetrics.totalDebtService)}</p>
            <p className="text-sm text-gray-600">Total Debt Service</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summaryMetrics.cumulativeEquityCashFlow)}</p>
            <p className="text-sm text-gray-600">Cumulative Equity CF</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{summaryMetrics.averageDSCR.toFixed(2)}x</p>
            <p className="text-sm text-gray-600">Average DSCR</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="year" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value.toFixed(0)}M`}
            />
            <Tooltip 
              formatter={(value, name) => [`$${value.toFixed(1)}M`, name]}
              labelFormatter={(year) => `Year: ${year}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              name="Revenue" 
              stroke="#4CAF50" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="opex" 
              name="Operating Costs" 
              stroke="#f44336" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="operatingCashFlow" 
              name="Operating Cash Flow" 
              stroke="#2196F3" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="debtService" 
              name="Debt Service" 
              stroke="#9C27B0" 
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="equityCashFlow" 
              name="Equity Cash Flow" 
              stroke="#FF9800" 
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>
            Showing first {Math.min(25, chartData.length)} years of {cashFlows.length} total projection years. 
            Equity cash flow represents the net cash available to equity investors after all operating costs and debt service.
          </p>
        </div>
      </div>

      {/* Cash Flow Table */}
      {showCashFlowTable && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Table className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Detailed Cash Flow Analysis</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Year</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Revenue ($M)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">OPEX ($M)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Operating CF ($M)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Debt Service ($M)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">DSCR</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Equity CF ($M)</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Phase</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Terminal ($M)</th>
                </tr>
              </thead>
              <tbody>
                {cashFlows.slice(0, Math.min(30, analysisYears)).map((cf, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-900">{cf.year}</td>
                    <td className="text-right py-2 px-2 text-gray-700">{formatCurrency(cf.revenue)}</td>
                    <td className="text-right py-2 px-2 text-red-600">{formatCurrency(Math.abs(cf.opex))}</td>
                    <td className="text-right py-2 px-2 text-blue-700">{formatCurrency(cf.operatingCashFlow)}</td>
                    <td className="text-right py-2 px-2 text-purple-600">{formatCurrency(Math.abs(cf.debtService))}</td>
                    <td className="text-right py-2 px-2 text-gray-700">{formatDSCR(cf.dscr)}</td>
                    <td className={`text-right py-2 px-2 font-medium ${
                      cf.equityCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(cf.equityCashFlow)}
                    </td>
                    <td className="text-left py-2 px-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        cf.refinancePhase === 'individual' ? 'bg-blue-100 text-blue-800' :
                        cf.refinancePhase === 'portfolio' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {cf.refinancePhase || 'individual'}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 text-orange-600">
                      {cf.terminalValue ? formatCurrency(cf.terminalValue) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {cashFlows.length > 30 && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              Showing first 30 years of {cashFlows.length} total years
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Cash Flow Components:</h4>
                <ul className="text-xs space-y-1">
                  <li>• <span className="text-green-600">Revenue:</span> Total annual revenue from all sources</li>
                  <li>• <span className="text-red-600">OPEX:</span> Operating expenses including maintenance</li>
                  <li>• <span className="text-blue-600">Operating CF:</span> Revenue minus OPEX (CFADS)</li>
                  <li>• <span className="text-purple-600">Debt Service:</span> Principal and interest payments</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Key Metrics:</h4>
                <ul className="text-xs space-y-1">
                  <li>• <span className="font-medium">DSCR:</span> Debt Service Coverage Ratio (Operating CF / Debt Service)</li>
                  <li>• <span className="font-medium">Equity CF:</span> Cash flow available to equity investors</li>
                  <li>• <span className="font-medium">Phase:</span> Individual asset debt vs portfolio refinancing</li>
                  <li>• <span className="font-medium">Terminal:</span> Asset residual value at end of analysis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}