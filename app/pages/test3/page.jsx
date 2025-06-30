// pages/test3.jsx
'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  DollarSign,
  Calendar,
  BarChart3,
  Download
} from 'lucide-react';

const Test3Page = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [timeAggregation, setTimeAggregation] = useState('monthly');
  const [availableAssetIds, setAvailableAssetIds] = useState([]);
  const [equityIrr, setEquityIrr] = useState('N/A');
  const [clientSideIrr, setClientSideIrr] = useState('N/A');
  const [assetInputsSummary, setAssetInputsSummary] = useState([]);

  // XIRR calculation function
  const calculateXIRR = (dates, cashFlows, guess = 0.1) => {
    if (!dates || !cashFlows || dates.length !== cashFlows.length || dates.length < 2) {
      return NaN;
    }

    // Convert dates to numbers (days since first date)
    const firstDate = new Date(dates[0]);
    const dayNumbers = dates.map(date => {
      const currentDate = new Date(date);
      return (currentDate - firstDate) / (1000 * 60 * 60 * 24); // Days difference
    });

    // XNPV function
    const xnpv = (rate) => {
      return cashFlows.reduce((sum, cashFlow, i) => {
        return sum + cashFlow / Math.pow(1 + rate, dayNumbers[i] / 365.25);
      }, 0);
    };

    // XNPV derivative for Newton-Raphson
    const xnpvDerivative = (rate) => {
      return cashFlows.reduce((sum, cashFlow, i) => {
        const years = dayNumbers[i] / 365.25;
        return sum - (years * cashFlow) / Math.pow(1 + rate, years + 1);
      }, 0);
    };

    // Newton-Raphson method
    let rate = guess;
    const tolerance = 1e-6;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      const npvValue = xnpv(rate);
      const npvDeriv = xnpvDerivative(rate);
      
      if (Math.abs(npvValue) < tolerance) {
        return rate;
      }
      
      if (Math.abs(npvDeriv) < tolerance) {
        break;
      }
      
      const newRate = rate - npvValue / npvDeriv;
      
      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }
      
      rate = newRate;
      
      // Prevent extreme values
      if (rate < -0.99 || rate > 10) {
        break;
      }
    }

    return NaN;
  };

  // Calculate simple IRR from operations cash flows only
  const calculateSimpleIRR = (assetData) => {
    if (!assetData || assetData.length < 2) {
      return NaN;
    }

    // Filter to only operational periods (where revenue > 0)
    const operationalData = assetData
      .filter(item => item.revenue > 0 || item.cfads > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (operationalData.length < 2) {
      return NaN;
    }

    // Extract dates and cash flows for operations only
    const dates = operationalData.map(item => item.date);
    const cashFlows = operationalData.map(item => item.equity_cash_flow || 0);

    // Check if all cash flows are zero
    if (cashFlows.every(cf => cf === 0)) {
      return NaN;
    }

    return calculateXIRR(dates, cashFlows);
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
        const response = await fetch('/api/results?assetId=assets_combined');
        if (response.ok) {
          const combinedData = await response.json();
          if (combinedData && combinedData.length > 0 && combinedData[0].irr !== undefined && combinedData[0].irr !== null) {
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

  const processData = useMemo(() => {
    if (!data || data.length === 0 || selectedAsset === null) return [];

    const filteredData = data.filter(item => item.asset_id === selectedAsset);

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
          const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
          periodKey = `FY${year + 1}`;
        } else if (periodType === 'calendarYear') {
          periodKey = `${date.getFullYear()}`;
        }

        if (!aggregated[periodKey]) {
          aggregated[periodKey] = { 
            date: periodKey, 
            revenue: 0, 
            opex: 0, 
            capex: 0, 
            equity_capex: 0, 
            debt_capex: 0, 
            cfads: 0, 
            equity_cash_flow: 0, 
            terminal_value: 0, 
            dscr: 0, 
            period_type: '',
            interest: 0,
            principal: 0,
            debt_service: 0,
            dscr_count: 0
          };
        }

        aggregated[periodKey].revenue += item.revenue || 0;
        aggregated[periodKey].opex += item.opex || 0;
        aggregated[periodKey].capex += item.capex || 0;
        aggregated[periodKey].equity_capex += item.equity_capex || 0;
        aggregated[periodKey].debt_capex += item.debt_capex || 0;
        aggregated[periodKey].cfads += item.cfads || 0;
        aggregated[periodKey].equity_cash_flow += item.equity_cash_flow || 0;
        aggregated[periodKey].terminal_value += item.terminal_value || 0;
        aggregated[periodKey].interest += item.interest || 0;
        aggregated[periodKey].principal += item.principal || 0;
        aggregated[periodKey].debt_service += (item.interest || 0) + (item.principal || 0);
        
        // Handle DSCR averaging
        if (item.dscr && item.dscr > 0 && isFinite(item.dscr)) {
          aggregated[periodKey].dscr += item.dscr;
          aggregated[periodKey].dscr_count += 1;
        }
        
        aggregated[periodKey].period_type = item.period_type || '';
      });

      return Object.values(aggregated).map(period => {
        // Calculate average DSCR for the period
        if (period.dscr_count > 0) {
          period.dscr = period.dscr / period.dscr_count;
        } else if (period.debt_service > 0 && period.cfads > 0) {
          // Fallback: calculate DSCR from aggregated values
          period.dscr = period.cfads / period.debt_service;
        } else {
          period.dscr = 0;
        }
        
        // Clean up temporary field
        delete period.dscr_count;
        delete period.debt_service;
        
        return period;
      }).sort((a, b) => a.date.localeCompare(b.date));
    };

    return aggregate(filteredData, timeAggregation);
  }, [data, selectedAsset, timeAggregation]);

  const summaryMetrics = useMemo(() => {
    if (!data || data.length === 0 || selectedAsset === null) return {};

    const assetData = data.filter(item => item.asset_id === selectedAsset);

    const totalCapex = assetData.reduce((sum, item) => sum + (item.capex || 0), 0);
    const totalEquityCapex = assetData.reduce((sum, item) => sum + (item.equity_capex || 0), 0);
    const totalDebtCapex = assetData.reduce((sum, item) => sum + (item.debt_capex || 0), 0);
    const totalOpex = assetData.reduce((sum, item) => sum + (item.opex || 0), 0);
    const totalEquityCashFlow = assetData.reduce((sum, item) => sum + (item.equity_cash_flow || 0), 0);

    // Calculate gearing from the asset data
    const gearing = totalCapex > 0 ? ((totalDebtCapex / totalCapex) * 100).toFixed(1) : '0.0';

    const consStart = assetData.length > 0 ? new Date(assetData[0].date).toLocaleDateString() : 'N/A';
    const consEnd = assetData.length > 0 ? new Date(assetData[assetData.length - 1].date).toLocaleDateString() : 'N/A';

    const operationalData = assetData.filter(item => (item.revenue > 0 || item.monthlyGeneration > 0));
    const opsStart = operationalData.length > 0 ? new Date(operationalData[0].date).toLocaleDateString() : 'N/A';
    const opsEnd = operationalData.length > 0 ? new Date(operationalData[operationalData.length - 1].date).toLocaleDateString() : 'N/A';

    return {
      totalCapex: totalCapex.toFixed(2),
      totalEquity: totalEquityCapex.toFixed(2),
      totalDebt: totalDebtCapex.toFixed(2),
      gearing,
      totalOpex: totalOpex.toFixed(2),
      totalEquityCashFlow: totalEquityCashFlow.toFixed(2),
      consStart,
      consEnd,
      opsStart,
      opsEnd
    };
  }, [data, selectedAsset]);

  const selectedAssetInputs = useMemo(() => {
    if (!assetInputsSummary || !assetInputsSummary.asset_inputs) return null;
    return assetInputsSummary.asset_inputs.find(asset => asset.id === selectedAsset);
  }, [assetInputsSummary, selectedAsset]);

  // Calculate simple IRR when data changes
  useEffect(() => {
    if (data.length > 0 && selectedAsset !== null) {
      const assetData = data.filter(item => item.asset_id === selectedAsset);
      const irr = calculateSimpleIRR(assetData);
      if (!isNaN(irr)) {
        setClientSideIrr((irr * 100).toFixed(2) + '%');
      } else {
        setClientSideIrr('N/A');
      }
    }
  }, [data, selectedAsset]);

  const exportToCSV = () => {
    if (processData.length === 0) return;

    const headers = [
      'Period',
      'Type',
      'Capex ($M)',
      'Debt ($M)',
      'Equity ($M)',
      'Revenue ($M)',
      'Opex ($M)',
      'Capex ($M)',
      'Equity Capex ($M)',
      'Debt Capex ($M)',
      'Interest ($M)',
      'Principal ($M)',
      'CFADS ($M)',
      'Equity Cash Flow ($M)',
      'Terminal Value ($M)',
      'DSCR'
    ];

    const csvContent = [
      headers.join(','),
      ...processData.map(row => [
        row.date,
        row.period_type,
        row.capex.toFixed(2),
        row.debt_capex.toFixed(2),
        row.equity_capex.toFixed(2),
        row.revenue.toFixed(2),
        row.opex.toFixed(2),
        row.capex.toFixed(2),
        row.equity_capex.toFixed(2),
        row.debt_capex.toFixed(2),
        row.interest.toFixed(2),
        row.principal.toFixed(2),
        row.cfads.toFixed(2),
        row.equity_cash_flow.toFixed(2),
        row.terminal_value.toFixed(2),
        row.dscr.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `asset_${selectedAsset}_${timeAggregation}_data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      <h1 className="text-2xl font-bold text-gray-900">Asset Financial Analysis - Debug Dashboard</h1>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Key Metrics - Asset {selectedAsset}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Gearing %</p>
              <p className="text-lg font-bold text-gray-900">{summaryMetrics.gearing}%</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Opex</p>
              <p className="text-lg font-bold text-gray-900">${summaryMetrics.totalOpex}M</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Backend IRR</p>
              <p className="text-lg font-bold text-gray-900">{equityIrr}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Client IRR</p>
              <p className="text-lg font-bold text-gray-900">{clientSideIrr}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            <strong>Total Equity Cash Flow:</strong> ${summaryMetrics.totalEquityCashFlow}M | 
            <strong> Construction Start:</strong> {selectedAssetInputs?.constructionStartDate || 'N/A'} | 
            <strong> Operations Start:</strong> {selectedAssetInputs?.OperatingStartDate || selectedAssetInputs?.assetStartDate || 'N/A'} | 
            <strong> Debt Period:</strong> {selectedAssetInputs?.costAssumptions?.tenorYears || 'N/A'} years | 
            <strong> Periods from Construction:</strong> {
              selectedAssetInputs?.constructionStartDate ? 
              data.filter(item => item.asset_id === selectedAsset && new Date(item.date) >= new Date(selectedAssetInputs.constructionStartDate)).length : 
              'N/A'
            }
          </p>
        </div>
      </div>

      {/* Asset Inputs Summary */}
      {selectedAssetInputs && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Inputs - {selectedAssetInputs.name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            <p><strong>Type:</strong> {selectedAssetInputs.type}</p>
            <p><strong>State:</strong> {selectedAssetInputs.state}</p>
            <p><strong>Capacity:</strong> {selectedAssetInputs.capacity} MW</p>
            <p><strong>Asset Life:</strong> {selectedAssetInputs.assetLife} years</p>
            <p><strong>Capex:</strong> ${selectedAssetInputs.costAssumptions?.capex}M</p>
            <p><strong>Operating Costs:</strong> ${selectedAssetInputs.costAssumptions?.operatingCosts}M</p>
            <p><strong>Max Gearing:</strong> {(selectedAssetInputs.costAssumptions?.maxGearing * 100).toFixed(1)}%</p>
            <p><strong>Interest Rate:</strong> {(selectedAssetInputs.costAssumptions?.interestRate * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Equity Cash Flow Chart */}
      {processData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Equity Cash Flow</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={processData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `$${value.toFixed(1)}M`} />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}M`, '']} />
              <Legend />
              <Area type="monotone" dataKey="equity_cash_flow" stroke="#8884d8" fill="#8884d8" name="Equity Cash Flow" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Simplified Data Table */}
      {processData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Financial Data</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Capex</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debt</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opex</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CFADS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg DSCR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Interest</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Principal</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Equity CF</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Terminal Val</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processData.map((row, index) => (
                  <tr key={index} className={row.equity_cash_flow < 0 ? 'bg-red-50' : row.equity_cash_flow > 0 ? 'bg-green-50' : ''}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{row.date}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{row.period_type}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.capex.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.debt_capex.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.equity_capex.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.revenue.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.opex.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.cfads.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.dscr && row.dscr !== 0 && isFinite(row.dscr) ? row.dscr.toFixed(2) : '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.interest.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.principal.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm font-medium text-right">{row.equity_cash_flow.toFixed(1)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">{row.terminal_value.toFixed(1)}</td>
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