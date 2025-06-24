// components/PortfolioSummary.jsx
'use client'

import { FileText, TrendingUp } from 'lucide-react';
import { calculateIRR } from '@/app/components/ProjectFinance_Calcs';

export default function PortfolioSummary({
  projectMetrics,
  portfolioTotals,
  assets,
  includeTerminalValue,
  analysisYears
}) {

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

  // Calculate additional portfolio metrics
  const getPortfolioInsights = () => {
    if (!portfolioTotals || Object.keys(projectMetrics).length === 0) return null;

    const insights = {
      totalAssets: Object.keys(assets).length,
      totalCapacity: Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0),
      averageGearing: portfolioTotals.calculatedGearing,
      totalEquity: portfolioTotals.capex * (1 - portfolioTotals.calculatedGearing),
      debtServiceCoverage: portfolioTotals.minDSCR,
      portfolioIRR: portfolioTotals.equityCashFlows ? calculateIRR(portfolioTotals.equityCashFlows) * 100 : 0
    };

    // Asset type breakdown
    const assetTypes = {};
    Object.values(assets).forEach(asset => {
      if (!assetTypes[asset.type]) {
        assetTypes[asset.type] = { count: 0, capacity: 0, capex: 0 };
      }
      assetTypes[asset.type].count += 1;
      assetTypes[asset.type].capacity += parseFloat(asset.capacity) || 0;
      
      // Get CAPEX from project metrics
      const assetMetrics = projectMetrics[asset.name];
      if (assetMetrics) {
        assetTypes[asset.type].capex += assetMetrics.capex || 0;
      }
    });

    insights.assetTypes = assetTypes;
    return insights;
  };

  const portfolioInsights = getPortfolioInsights();

  if (!projectMetrics || Object.keys(projectMetrics).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Summary</h3>
        <div className="text-center text-gray-500 py-8">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No portfolio metrics available</p>
          <p className="text-sm">Complete the project finance analysis to see summary</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      {portfolioInsights && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Portfolio Overview</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{portfolioInsights.totalAssets}</p>
              <p className="text-sm text-gray-600">Assets</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{portfolioInsights.totalCapacity.toFixed(0)}MW</p>
              <p className="text-sm text-gray-600">Total Capacity</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(portfolioTotals.capex)}</p>
              <p className="text-sm text-blue-600">Total CAPEX</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-900">{formatCurrency(portfolioInsights.totalEquity)}</p>
              <p className="text-sm text-green-600">Total Equity</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-900">{formatPercent(portfolioInsights.averageGearing)}</p>
              <p className="text-sm text-purple-600">Avg Gearing</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-900">{portfolioInsights.portfolioIRR.toFixed(1)}%</p>
              <p className="text-sm text-orange-600">{analysisYears}Y IRR</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Asset Summary Table */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Asset Summary Metrics</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-900">Asset</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Type</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Capacity (MW)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">CAPEX ($M)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Gearing (%)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Debt ($M)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Debt Service ($M)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Min DSCR</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Terminal ($M)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Equity Timing</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Equity IRR</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(projectMetrics)
                .filter(([assetName]) => assetName !== 'portfolio')
                .map(([assetName, metrics]) => {
                  const asset = Object.values(assets).find(a => a.name === assetName);
                  return (
                    <tr key={assetName} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">{assetName}</td>
                      <td className="text-right py-3 px-2 text-gray-700 capitalize">{asset?.type || '-'}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{asset?.capacity || '0'}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatCurrency(metrics.capex)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatPercent(metrics.calculatedGearing)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatCurrency(metrics.debtAmount)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatCurrency(metrics.annualDebtService)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatDSCR(metrics.minDSCR)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {formatCurrency(includeTerminalValue ? metrics.terminalValue : 0)}
                      </td>
                      <td className="text-right py-3 px-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          metrics.equityTimingUpfront 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {metrics.equityTimingUpfront ? 'Upfront' : 'Pro-rata'}
                        </span>
                      </td>
                      <td className="text-right py-3 px-2 font-medium text-gray-900">
                        {calculateIRR(metrics.equityCashFlows) 
                          ? formatPercent(calculateIRR(metrics.equityCashFlows)) 
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              
              {/* Portfolio Total Row */}
              {portfolioTotals && Object.keys(assets).length >= 2 && (
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                  <td className="py-3 px-2 text-blue-900">Portfolio Total</td>
                  <td className="text-right py-3 px-2 text-blue-700">Mixed</td>
                  <td className="text-right py-3 px-2 text-blue-700">
                    {Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0).toFixed(0)}
                  </td>
                  <td className="text-right py-3 px-2 text-blue-700">{formatCurrency(portfolioTotals.capex)}</td>
                  <td className="text-right py-3 px-2 text-blue-700">{formatPercent(portfolioTotals.calculatedGearing)}</td>
                  <td className="text-right py-3 px-2 text-blue-700">{formatCurrency(portfolioTotals.debtAmount)}</td>
                  <td className="text-right py-3 px-2 text-blue-700">{formatCurrency(portfolioTotals.annualDebtService)}</td>
                  <td className="text-right py-3 px-2 text-blue-700">{formatDSCR(portfolioTotals.minDSCR)}</td>
                  <td className="text-right py-3 px-2 text-blue-700">
                    {formatCurrency(includeTerminalValue ? portfolioTotals.terminalValue : 0)}
                  </td>
                  <td className="text-right py-3 px-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      projectMetrics.portfolio?.equityTimingUpfront 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {projectMetrics.portfolio?.equityTimingUpfront ? 'Upfront' : 'Pro-rata'}
                    </span>
                  </td>
                  <td className="text-right py-3 px-2 font-bold text-blue-900">
                    {portfolioTotals.equityCashFlows && calculateIRR(portfolioTotals.equityCashFlows) 
                      ? formatPercent(calculateIRR(portfolioTotals.equityCashFlows)) 
                      : 'N/A'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            Analysis period: {analysisYears} years • 
            Terminal value: {includeTerminalValue ? 'Included' : 'Excluded'} • 
            Individual asset IRRs calculated with truncated cash flows for comparison
          </p>
        </div>
      </div>
    </div>
  );
}