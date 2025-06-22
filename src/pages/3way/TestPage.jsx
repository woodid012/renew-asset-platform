import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, Building2, Layers } from 'lucide-react';
import { usePortfolio } from '@/contexts/PortfolioContext';

import { calculateForecastData, formatCurrency, formatPercent } from './Components/forecastCalculations';
import ProfitLossStatement from './Components/ProfitLossStatement';
import BalanceSheet from './Components/BalanceSheet';
import CashFlowStatement from './Components/CashFlowStatement';

const Australian3WayForecast = () => {
  const { assets, constants, getMerchantPrice, portfolioName } = usePortfolio();
  const [selectedScenario, setSelectedScenario] = useState('base');
  const [viewBy, setViewBy] = useState('portfolio');

  // Calculate comprehensive 3-way forecast data using real portfolio data
  const { forecast: forecastData, assetPLs, portfolioPL } = useMemo(() => {
    if (!assets || Object.keys(assets).length === 0) {
      return { forecast: [], assetPLs: {}, portfolioPL: [] };
    }
    
    return calculateForecastData(
      assets,
      constants,
      getMerchantPrice,
      selectedScenario,
      viewBy
    );
  }, [assets, constants, getMerchantPrice, selectedScenario, viewBy]);

  const years = forecastData.map(item => item.year);
  
  // Get available assets for view selector
  const availableAssets = Object.values(assets);

  const handleExport = () => {
    // Create comprehensive export data
    const exportData = {
      portfolio: portfolioName,
      forecastPeriod: years.length > 0 ? `${years[0]} - ${years[years.length - 1]}` : '',
      scenario: selectedScenario,
      viewBy: viewBy,
      exportDate: new Date().toISOString(),
      
      profitAndLoss: forecastData.map(item => ({
        year: item.year,
        revenue: item.grossRevenue,
        operatingExpenses: item.totalOperatingExpenses,
        ebitda: item.ebitda,
        depreciation: item.annualDepreciation,
        ebit: item.ebit,
        interestExpense: item.interestExpense,
        profitBeforeTax: item.profitBeforeTax,
        taxExpense: item.taxExpense,
        netProfitAfterTax: item.netProfitAfterTax
      })),
      
      balanceSheet: forecastData.map(item => ({
        year: item.year,
        totalCurrentAssets: item.totalCurrentAssets,
        totalNonCurrentAssets: item.totalNonCurrentAssets,
        totalAssets: item.totalAssets,
        totalCurrentLiabilities: item.totalCurrentLiabilities,
        totalNonCurrentLiabilities: item.totalNonCurrentLiabilities,
        totalLiabilities: item.totalLiabilities,
        totalEquity: item.totalEquity
      })),
      
      cashFlow: forecastData.map(item => ({
        year: item.year,
        operatingCashFlow: item.operatingCashFlow,
        investingCashFlow: item.investingCashFlow,
        financingCashFlow: item.financingCashFlow,
        netCashFlow: item.netCashFlow
      })),

      // Include individual asset P&Ls if viewing portfolio
      ...(viewBy === 'portfolio' && {
        individualAssets: Object.entries(assetPLs).reduce((acc, [assetName, assetPL]) => {
          acc[assetName] = assetPL.map(item => ({
            year: item.year,
            revenue: item.revenue,
            operatingExpenses: item.operatingExpenses,
            ebitda: item.ebitda,
            netProfitAfterTax: item.netProfitAfterTax
          }));
          return acc;
        }, {})
      })
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const cleanPortfolioName = portfolioName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const viewSuffix = viewBy === 'portfolio' ? 'portfolio' : viewBy.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const exportFileName = `3way_forecast_${cleanPortfolioName}_${viewSuffix}_${selectedScenario}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  // Show loading state if no data
  if (!assets || Object.keys(assets).length === 0) {
    return (
      <div className="w-full p-6 space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="flex justify-center items-center h-32">
            <p className="text-gray-500">No portfolio data available. Please configure assets first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (forecastData.length === 0) {
    return (
      <div className="w-full p-6 space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="flex justify-center items-center h-32">
            <p className="text-gray-500">Loading forecast data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">3-Way Financial Forecast</h1>
          <p className="text-gray-600 mt-2">
            AASB compliant Profit & Loss, Balance Sheet, and Cash Flow projections for {portfolioName}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">
              Viewing: {viewBy === 'portfolio' ? 'Portfolio Consolidated' : `Asset: ${viewBy}`}
            </span>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-500">
              Scenario: {selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* View By Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">View By:</label>
            <Select value={viewBy} onValueChange={setViewBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portfolio">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Portfolio (Consolidated)
                  </div>
                </SelectItem>
                {availableAssets.map(asset => (
                  <SelectItem key={asset.name} value={asset.name}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {asset.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">&nbsp;</label>
            <Button onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Forecast
            </Button>
          </div>
        </div>
      </div>


      
          {/* Main Forecast Tables */}
      <Tabs defaultValue="profit-loss" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="profit-loss">
          <ProfitLossStatement forecastData={forecastData} years={years} />
        </TabsContent>

        <TabsContent value="balance-sheet">
          <BalanceSheet forecastData={forecastData} years={years} />
        </TabsContent>

        <TabsContent value="cash-flow">
          <CashFlowStatement forecastData={forecastData} years={years} />
        </TabsContent>
      </Tabs>

      {/* Financial Ratios & Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Key Financial Ratios & Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {/* Liquidity Ratios */}
            <div>
              <h4 className="font-semibold text-lg mb-3">Liquidity Ratios</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ratio</TableHead>
                    {years.slice(0, 5).map(year => (
                      <TableHead key={year} className="text-right">{year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Current Ratio</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.currentRatio?.toFixed(2) || '0.00'}x
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell>Cash Ratio</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.totalCurrentLiabilities > 0 ? 
                          (item.cashAndBankBalances / item.totalCurrentLiabilities).toFixed(2) : 
                          '0.00'}x
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Profitability Ratios */}
            <div>
              <h4 className="font-semibold text-lg mb-3">Profitability Ratios</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ratio</TableHead>
                    {years.slice(0, 5).map(year => (
                      <TableHead key={year} className="text-right">{year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>EBITDA Margin</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {formatPercent(item.ebitdaMargin || 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell>Return on Assets</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {formatPercent(item.returnOnAssets || 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell>Return on Equity</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.totalEquity > 0 ? 
                          formatPercent((item.netProfitAfterTax / item.totalEquity) * 100) : 
                          '0.0%'}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Leverage Ratios */}
            <div>
              <h4 className="font-semibold text-lg mb-3">Leverage Ratios</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ratio</TableHead>
                    {years.slice(0, 5).map(year => (
                      <TableHead key={year} className="text-right">{year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Debt-to-Equity</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.debtToEquity?.toFixed(2) || '0.00'}x
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell>Debt-to-Assets</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.totalAssets > 0 ? 
                          (item.totalLiabilities / item.totalAssets).toFixed(2) : 
                          '0.00'}x
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell>Interest Coverage</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.interestExpense > 0 ? 
                          (item.ebit / item.interestExpense).toFixed(2) : 
                          'N/A'}x
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Activity Ratios */}
            <div>
              <h4 className="font-semibold text-lg mb-3">Activity Ratios</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ratio</TableHead>
                    {years.slice(0, 5).map(year => (
                      <TableHead key={year} className="text-right">{year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Asset Turnover</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.totalAssets > 0 ? 
                          (item.grossRevenue / item.totalAssets).toFixed(2) : 
                          '0.00'}x
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell>Receivables Turnover</TableCell>
                    {forecastData.slice(0, 5).map(item => (
                      <TableCell key={item.year} className="text-right">
                        {item.accountsReceivable > 0 ? 
                          (item.grossRevenue / item.accountsReceivable).toFixed(1) : 
                          '0.0'}x
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Notes to Financial Statements */}
      <Card>
        <CardHeader>
          <CardTitle>Notes to the Financial Statements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">1. Basis of Preparation</h4>
            <p className="text-sm text-gray-600">
              These financial statements have been prepared in accordance with Australian Accounting Standards (AASB) 
              and the Corporations Act 2001. The financial statements are presented in Australian dollars and all 
              values are rounded to the nearest million dollars unless otherwise noted.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold">2. Significant Accounting Policies</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Revenue Recognition:</strong> Revenue from energy sales is recognised over time as electricity is generated and delivered.</p>
              <p><strong>Property, Plant & Equipment:</strong> Renewable energy assets are carried at cost less accumulated depreciation.</p>
              <p><strong>Depreciation:</strong> Assets are depreciated on a straight-line basis over their useful economic lives.</p>
              <p><strong>Financial Instruments:</strong> Financial assets and liabilities are initially recognised at fair value.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold">3. Critical Estimates and Judgments</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Useful Lives:</strong> Based on asset configuration - Solar: {constants.deprecationPeriods?.solar || 30} years, Wind: {constants.deprecationPeriods?.wind || 30} years, Storage: {constants.deprecationPeriods?.storage || 20} years</p>
              <p><strong>Revenue Forecasts:</strong> Based on portfolio power purchase agreements and merchant price projections using {selectedScenario} case assumptions</p>
              <p><strong>Impairment:</strong> Assets reviewed for impairment indicators at each reporting date</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold">4. Portfolio Composition</h4>
            <div className="text-sm text-gray-600">
              <p><strong>Assets in Portfolio:</strong> {Object.keys(assets).length} renewable energy assets</p>
              <div className="mt-2 space-y-1">
                {Object.values(assets).map(asset => (
                  <p key={asset.name}>
                    <strong>{asset.name}:</strong> {asset.capacity}MW {asset.type} facility in {asset.state}, operational from {new Date(asset.assetStartDate).getFullYear()}
                  </p>
                ))}
              </div>
              <p className="mt-2"><strong>Current View:</strong> {viewBy === 'portfolio' ? 'Consolidated portfolio view' : `Individual asset view for ${viewBy}`}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex justify-center space-x-4 pt-4">
        <Button 
          variant="outline" 
          onClick={() => setViewBy('portfolio')}
          disabled={viewBy === 'portfolio'}
        >
          <Layers className="w-4 h-4 mr-2" />
          View Portfolio
        </Button>
        {availableAssets.length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => setViewBy(availableAssets[0].name)}
            disabled={viewBy === availableAssets[0].name}
          >
            <Building2 className="w-4 h-4 mr-2" />
            View First Asset
          </Button>
        )}
      </div>
    </div>
  );
};

export default Australian3WayForecast;