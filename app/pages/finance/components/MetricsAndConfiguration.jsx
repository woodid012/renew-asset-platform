// components/MetricsAndConfiguration.jsx
'use client'

import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Percent,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  BarChart3,
  Settings
} from 'lucide-react';
import { calculateIRR } from '@/app/components/ProjectFinance_Calcs';

export default function MetricsAndConfiguration({
  portfolioName,
  assets,
  constants,
  portfolioTotals,
  analysisYears,
  selectedRevenueCase,
  includeTerminalValue,
  solveGearing,
  showEquityTimingPanel,
  showCashFlowTable,
  showSensitivityAnalysis,
  setAnalysisYears,
  setSelectedRevenueCase,
  setIncludeTerminalValue,
  setSolveGearing,
  setShowEquityTimingPanel,
  setShowCashFlowTable,
  setShowSensitivityAnalysis,
  updateAssetEquityTiming,
  updatePortfolioEquityTiming
}) {

  // Helper functions for formatting
  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.0M';
    return `$${value.toFixed(1)}M`;
  };

  const formatDSCR = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2) + 'x';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Finance Analysis</h1>
          <p className="text-gray-600">Live IRR calculations with comprehensive sensitivity analysis</p>
          <p className="text-sm text-gray-500">
            Portfolio: {portfolioName} • {Object.keys(assets).length} assets • Analysis: {analysisYears} years
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
            onClick={() => setShowEquityTimingPanel(!showEquityTimingPanel)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
              showEquityTimingPanel 
                ? 'bg-purple-50 border-purple-200 text-purple-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Equity Timing</span>
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
            onClick={() => setShowSensitivityAnalysis(!showSensitivityAnalysis)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 border ${
              showSensitivityAnalysis 
                ? 'bg-orange-50 border-orange-200 text-orange-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Sensitivity</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Analysis Configuration</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Scenario</label>
            <select
              value={selectedRevenueCase}
              onChange={(e) => setSelectedRevenueCase(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="base">Base Case</option>
              <option value="worst">Combined Downside</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Period (Years)</label>
            <select
              value={analysisYears}
              onChange={(e) => setAnalysisYears(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={15}>15 Years</option>
              <option value={20}>20 Years</option>
              <option value={25}>25 Years</option>
              <option value={30}>30 Years</option>
              <option value={35}>35 Years</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="terminal-value"
                checked={includeTerminalValue}
                onChange={(e) => setIncludeTerminalValue(e.target.checked)}
                className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="terminal-value" className="text-sm font-medium text-gray-700">
                Include Terminal Value
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="solve-gearing"
                checked={solveGearing}
                onChange={(e) => setSolveGearing(e.target.checked)}
                className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="solve-gearing" className="text-sm font-medium text-gray-700">
                Auto-Solve Gearing
              </label>
            </div>
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
                <p className="text-sm text-gray-500">{analysisYears}-Year Return</p>
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

      {/* Equity Timing Configuration Panel */}
      {showEquityTimingPanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-purple-900">Equity Investment Timing</h3>
          <div className="space-y-4">
            {/* Individual Assets */}
            {Object.values(assets).map((asset) => {
              const assetCostData = constants.assetCosts?.[asset.name] || {};
              return (
                <div key={asset.name} className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{asset.name}</h4>
                    <span className="text-sm text-gray-500 capitalize">{asset.type}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`${asset.name}-upfront`}
                        name={`${asset.name}-timing`}
                        checked={assetCostData.equityTimingUpfront !== false}
                        onChange={() => updateAssetEquityTiming(asset.name, true, assetCostData.constructionDuration || 12)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`${asset.name}-upfront`} className="text-sm font-medium text-gray-700">
                        Upfront Payment
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`${asset.name}-construction`}
                        name={`${asset.name}-timing`}
                        checked={assetCostData.equityTimingUpfront === false}
                        onChange={() => updateAssetEquityTiming(asset.name, false, assetCostData.constructionDuration || 12)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`${asset.name}-construction`} className="text-sm font-medium text-gray-700">
                        During Construction
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Construction Duration (months)</label>
                      <input
                        type="number"
                        value={assetCostData.constructionDuration || 12}
                        onChange={(e) => updateAssetEquityTiming(
                          asset.name, 
                          assetCostData.equityTimingUpfront !== false, 
                          parseInt(e.target.value) || 12
                        )}
                        className="w-full p-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        min="6"
                        max="36"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Portfolio Level (if multiple assets) */}
            {Object.keys(assets).length >= 2 && (
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-purple-900">Portfolio Level</h4>
                  <span className="text-sm text-purple-600">Refinancing Phase</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="portfolio-upfront"
                      name="portfolio-timing"
                      checked={constants.assetCosts?.portfolio?.equityTimingUpfront !== false}
                      onChange={() => updatePortfolioEquityTiming(true, constants.assetCosts?.portfolio?.constructionDuration || 18)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="portfolio-upfront" className="text-sm font-medium text-gray-700">
                      Upfront Payment
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="portfolio-construction"
                      name="portfolio-timing"
                      checked={constants.assetCosts?.portfolio?.equityTimingUpfront === false}
                      onChange={() => updatePortfolioEquityTiming(false, constants.assetCosts?.portfolio?.constructionDuration || 18)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="portfolio-construction" className="text-sm font-medium text-gray-700">
                      During Development
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Development Duration (months)</label>
                    <input
                      type="number"
                      value={constants.assetCosts?.portfolio?.constructionDuration || 18}
                      onChange={(e) => updatePortfolioEquityTiming(
                        constants.assetCosts?.portfolio?.equityTimingUpfront !== false, 
                        parseInt(e.target.value) || 18
                      )}
                      className="w-full p-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      min="6"
                      max="48"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 text-sm text-purple-700">
            <p><strong>Note:</strong> Equity timing significantly affects IRR calculations. Upfront payment concentrates the equity investment 
            at Year 0, while pro-rata spreads it over construction/development period.</p>
          </div>
        </div>
      )}
    </div>
  );
}