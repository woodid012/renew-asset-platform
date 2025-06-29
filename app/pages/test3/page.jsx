'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  DollarSign,
  Calendar,
  Zap,
  BarChart3,
  Table
} from 'lucide-react';

const Test3Page = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [timeAggregation, setTimeAggregation] = useState('monthly'); // monthly, quarterly, fiscalYear, calendarYear
  const [availableAssetIds, setAvailableAssetIds] = useState([]);
  const [equityIrr, setEquityIrr] = useState('N/A');
  const [clientSideIrr, setClientSideIrr] = useState('N/A');
  const [assetInputsSummary, setAssetInputsSummary] = useState([]);

  // Function to calculate IRR (simplified for client-side)
  const calculateClientIRR = (cashFlows) => {
    if (!cashFlows || cashFlows.length < 2) {
      return NaN;
    }

    // Simple Newton-Raphson method for IRR
    const npv = (rate) => {
      let sum = 0;
      for (let i = 0; i < cashFlows.length; i++) {
        sum += cashFlows[i] / Math.pow(1 + rate, i);
      }
      return sum;
    };

    let irr = 0.1; // Initial guess
    let financial_accuracy = 0.00001;
    let max_iterations = 1000;

    for (let i = 0; i < max_iterations; i++) {
      let y0 = npv(irr);
      let y1 = npv(irr + financial_accuracy);
      let slope = (y1 - y0) / financial_accuracy;
      if (slope === 0) {
        break; // Avoid division by zero
      }
      irr = irr - y0 / slope;
      if (Math.abs(y0) < financial_accuracy) {
        break;
      }
    }
    return irr;
  };

  useEffect(() => {
    const fetchAllAssetData = async () => {
      try {
        const response = await fetch('/api/results');
        if (response.ok) {
          const allData = await response.json();
          setData(allData);
          const uniqueAssetIds = [...new Set(allData.map(item => item.asset_id))].sort((a, b) => a - b);
          setAvailableAssetIds(uniqueAssetIds);
          if (uniqueAssetIds.length > 0) {
            setSelectedAsset(uniqueAssetIds[0]);
          }
        } else {
          console.error('Failed to fetch all asset data');
        }
      } catch (error) {
        console.error('Error fetching all asset data:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchEquityIrr = async () => {
      try {
        const response = await fetch('/api/results?assetId=assets_combined'); // Fetch the combined data for IRR
        if (response.ok) {
          const combinedData = await response.json();
          if (combinedData && combinedData.length > 0 && combinedData[0].irr !== undefined) {
            setEquityIrr((combinedData[0].irr * 100).toFixed(2) + '%');
          }
        } else {
          console.error('Failed to fetch combined asset data for IRR');
        }
      } catch (error) {
        console.error('Error fetching combined asset data for IRR:', error);
      }
    };

    const fetchAssetInputsSummary = async () => {
      try {
        const response = await fetch('/api/results?assetId=asset_inputs_summary');
        if (response.ok) {
          const summaryData = await response.json();
          setAssetInputsSummary(summaryData);
        } else {
          console.error('Failed to fetch asset inputs summary');
        }
      } catch (error) {
        console.error('Error fetching asset inputs summary:', error);
      }
    };

    fetchAllAssetData();
    fetchEquityIrr();
    fetchAssetInputsSummary();
  }, []);

  useEffect(() => {
    if (selectedAsset !== null && data.length > 0) {
      const filteredData = data.filter(item => item.asset_id === selectedAsset);
      const equityCashFlows = filteredData.map(item => item.equity_cash_flow);
      const irr = calculateClientIRR(equityCashFlows);
      setClientSideIrr(isNaN(irr) ? 'N/A' : (irr * 100).toFixed(2) + '%');
    }
  }, [data, selectedAsset, calculateClientIRR]);

  const processData = useMemo(() => {
    if (!data || data.length === 0 || selectedAsset === null) return [];

    const filteredData = data.filter(item => item.asset_id === selectedAsset);

    // Helper to aggregate data
    const aggregate = (items, periodType) => {
      const aggregated = {};

      items.forEach(item => {
        const date = new Date(item.date);
        let periodKey;

        if (periodType === 'monthly') {
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        } else if (periodType === 'quarterly') {
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
        } else if (periodType === 'fiscalYear') {
          // Assuming fiscal year starts July 1st
          const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
          periodKey = `FY${year + 1}`;
        } else if (periodType === 'calendarYear') {
          periodKey = `${date.getFullYear()}`;
        }

        if (!aggregated[periodKey]) {
          aggregated[periodKey] = { date: periodKey, revenue: 0, opex: 0, capex: 0, equity_capex: 0, debt_capex: 0, cfads: 0, equity_cash_flow: 0, terminal_value: 0, dscr: 0, period_type: '' };
        }

        aggregated[periodKey].revenue += item.revenue || 0;
        aggregated[periodKey].opex += item.opex || 0;
        aggregated[periodKey].capex += item.capex || 0;
        aggregated[periodKey].equity_capex += item.equity_capex || 0;
        aggregated[periodKey].debt_capex += item.debt_capex || 0;
        aggregated[periodKey].cfads += item.cfads || 0;
        aggregated[periodKey].equity_cash_flow += item.equity_cash_flow || 0;
        aggregated[periodKey].terminal_value += item.terminal_value || 0;
        aggregated[periodKey].dscr = item.dscr || 0;
        // For period_type, if aggregating, we might need a more sophisticated logic
        // For now, we'll just take the last one or assume it's consistent within a period
        aggregated[periodKey].period_type = item.period_type || '';
      });

      return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date));
    };

    return aggregate(filteredData, timeAggregation);
  }, [data, selectedAsset, timeAggregation]);

  const summaryMetrics = useMemo(() => {
    if (!data || data.length === 0 || selectedAsset === null) return {};

    const assetData = data.filter(item => item.asset_id === selectedAsset);

    const totalCapex = assetData.reduce((sum, item) => sum + (item.capex || 0), 0);
    const totalEquityCapex = assetData.reduce((sum, item) => sum + (item.equity_capex || 0), 0);
    const totalDebtCapex = assetData.reduce((sum, item) => sum + (item.debt_capex || 0), 0);

    const consStart = assetData.length > 0 ? new Date(assetData[0].date).toLocaleDateString() : 'N/A';
    const consEnd = assetData.length > 0 ? new Date(assetData[assetData.length - 1].date).toLocaleDateString() : 'N/A';

    // For ops start/end, we need to find when revenue or generation starts/ends
    const operationalData = assetData.filter(item => (item.revenue > 0 || item.monthlyGeneration > 0));
    const opsStart = operationalData.length > 0 ? new Date(operationalData[0].date).toLocaleDateString() : 'N/A';
    const opsEnd = operationalData.length > 0 ? new Date(operationalData[operationalData.length - 1].date).toLocaleDateString() : 'N/A';

    return {
      totalCapex: totalCapex.toFixed(2),
      totalEquity: totalEquityCapex.toFixed(2),
      totalDebt: totalDebtCapex.toFixed(2),
      consStart,
      consEnd,
      opsStart,
      opsEnd,
      irr: equityIrr,
    };
  }, [data, selectedAsset, equityIrr]);

  const selectedAssetInputs = useMemo(() => {
    if (!assetInputsSummary || !assetInputsSummary.asset_inputs) return null;
    return assetInputsSummary.asset_inputs.find(asset => asset.id === selectedAsset);
  }, [assetInputsSummary, selectedAsset]);

  const generalConfig = useMemo(() => {
    if (!assetInputsSummary || !assetInputsSummary.general_config) return null;
    return assetInputsSummary.general_config;
  }, [assetInputsSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Asset Financial Analysis</h1>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Asset</label>
            <select
              value={selectedAsset || ''}
              onChange={(e) => setSelectedAsset(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableAssetIds.map(id => (
                <option key={id} value={id}>Asset {id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Aggregation</label>
            <select
              value={timeAggregation}
              onChange={(e) => setTimeAggregation(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="fiscalYear">Fiscal Year (Jul-Jun)</option>
              <option value="calendarYear">Calendar Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Summary Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capex</p>
              <p className="text-lg font-bold text-gray-900">${summaryMetrics.totalCapex}M</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Equity</p>
              <p className="text-lg font-bold text-gray-900">${summaryMetrics.totalEquity}M</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-red-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Debt</p>
              <p className="text-lg font-bold text-gray-900">${summaryMetrics.totalDebt}M</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Backend Project IRR</p>
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.irr}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Client-Side Project IRR</p>
              <p className="text-lg font-bold text-gray-900">{clientSideIrr}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Construction Start</p>
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.consStart}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Construction End</p>
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.consEnd}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Operations Start</p>
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.opsStart}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Operations End</p>
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.opsEnd}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Inputs Summary */}
      {selectedAssetInputs && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Key Inputs - {selectedAssetInputs.name} (ID: {selectedAssetInputs.id})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <p><strong>Type:</strong> {selectedAssetInputs.type}</p>
            <p><strong>State:</strong> {selectedAssetInputs.state}</p>
            <p><strong>Capacity:</strong> {selectedAssetInputs.capacity} MW</p>
            <p><strong>Asset Life:</strong> {selectedAssetInputs.assetLife} years</p>
            <p><strong>Construction Start:</strong> {selectedAssetInputs.constructionStartDate}</p>
            <p><strong>Operations Start:</strong> {selectedAssetInputs.assetStartDate}</p>
            <p><strong>Capex:</strong> ${selectedAssetInputs.capex}M</p>
            <p><strong>Operating Costs:</strong> ${selectedAssetInputs.operatingCosts}M</p>
            <p><strong>Max Gearing:</strong> {selectedAssetInputs.maxGearing * 100}%</p>
            <p><strong>Interest Rate:</strong> {selectedAssetInputs.interestRate * 100}%</p>
            <p><strong>Tenor Years:</strong> {selectedAssetInputs.tenorYears}</p>
            <p><strong>Terminal Value (Input):</strong> ${selectedAssetInputs.terminalValue}M</p>
          </div>
        </div>
      )}

      {/* General Configuration */}
      {generalConfig && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">General Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <p><strong>Terminal Value Enabled:</strong> {generalConfig.ENABLE_TERMINAL_VALUE ? 'Yes' : 'No'}</p>
            <p><strong>Default Debt Sizing:</strong> {generalConfig.DEFAULT_DEBT_SIZING_METHOD}</p>
            <p><strong>DSCR Calculation Frequency:</strong> {generalConfig.DSCR_CALCULATION_FREQUENCY}</p>
            <p><strong>Default Capex Funding:</strong> {generalConfig.DEFAULT_CAPEX_FUNDING_TYPE}</p>
            <p><strong>Default Debt Repayment:</strong> {generalConfig.DEFAULT_DEBT_REPAYMENT_FREQUENCY}</p>
            <p><strong>Default Debt Grace Period:</strong> {generalConfig.DEFAULT_DEBT_GRACE_PERIOD}</p>
            <p><strong>Terminal Growth Rate:</strong> {(generalConfig.TERMINAL_GROWTH_RATE * 100).toFixed(2)}%</p>
            <p><strong>User Model Start Date:</strong> {generalConfig.USER_MODEL_START_DATE || 'Not Set'}</p>
            <p><strong>User Model End Date:</strong> {generalConfig.USER_MODEL_END_DATE || 'Not Set'}</p>
          </div>
        </div>
      )}

      {/* Capex Chart */}
      {processData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Capex Projections</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={processData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${value.toFixed(2)}M`} />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}M`, '']} />
              <Legend />
              <Area type="monotone" dataKey="equity_capex" stackId="1" stroke="#8884d8" fill="#8884d8" name="Equity Capex" />
              <Area type="monotone" dataKey="debt_capex" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Debt Capex" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue and Opex Chart */}
      {processData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue and Opex Projections</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={processData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${value.toFixed(2)}M`} />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}M`, '']} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="#ffc658" fill="#ffc658" name="Revenue" />
              <Area type="monotone" dataKey="opex" stackId="1" stroke="#ff7300" fill="#ff7300" name="Opex" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data Table */}
      {processData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Detailed Data</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Opex ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Capex ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Equity Capex ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debt Capex ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CFADS ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Equity Cash Flow ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Terminal Value ($M)</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">DSCR</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.period_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.revenue.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.opex.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.capex.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.equity_capex.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.debt_capex.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.cfads.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.equity_cash_flow.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.terminal_value.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.dscr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Test3Page;
