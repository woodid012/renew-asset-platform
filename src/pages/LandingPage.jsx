import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useScenarios } from '@/contexts/ScenarioContext'; // NEW: Import scenarios
import { 
  calculatePlatformPL, 
  calculateCashFlow, 
  generateYears, 
  formatCurrency 
} from '@/components/PlatformPL_Calculations';
import { 
  calculateProjectMetrics, 
  calculateIRR
} from '@/components/ProjectFinance_Calcs';

const SummaryFinancialsLanding = () => {
  const { assets, constants, getMerchantPrice, portfolioName, baseAssets, baseConstants } = usePortfolio();
  
  // NEW: Use global scenarios instead of risk scenarios
  const { scenarios, activeScenario, setActiveScenario } = useScenarios();
  
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);

  // Get current user from session storage
  const currentUser = sessionStorage.getItem('currentUser') || portfolioName || 'Portfolio';

  // Generate years for analysis
  const years = useMemo(() => {
    const startYear = constants.analysisStartYear || new Date().getFullYear();
    const endYear = constants.analysisEndYear || startYear + 30;
    return generateYears(startYear, endYear);
  }, [constants.analysisStartYear, constants.analysisEndYear]);

  // Calculate platform P&L data using scenario-aware data
  const plData = useMemo(() => {
    if (Object.keys(assets).length === 0) return { platformPL: [], quarters: [] };
    
    return calculatePlatformPL(
      assets, // Using scenario-modified assets
      constants, // Using scenario-modified constants
      years,
      getMerchantPrice,
      'base', // Always use base calculation since scenarios are applied to the data itself
      true, // Use portfolio debt
      constants.platformOpex || 4.2,
      constants.platformOpexEscalation || 2.5
    );
  }, [assets, constants, years, getMerchantPrice]);

  // Calculate cash flow data
  const cashFlowData = useMemo(() => {
    if (!plData.platformPL || plData.platformPL.length === 0) {
      return { annual: [] };
    }
    
    return calculateCashFlow(
      plData.platformPL,
      plData.quarters,
      constants.dividendPolicy || 85,
      constants.minimumCashBalance || 5.0
    );
  }, [plData.platformPL, plData.quarters, constants.dividendPolicy, constants.minimumCashBalance]);

  // Calculate project metrics using scenario-aware data
  const projectMetrics = useMemo(() => {
    if (Object.keys(assets).length === 0) return {};
    
    try {
      return calculateProjectMetrics(
        assets, // Using scenario-modified assets
        constants.assetCosts, // Using scenario-modified asset costs
        constants, // Using scenario-modified constants
        getMerchantPrice,
        'base', // Always use base calculation since scenarios are applied to the data itself
        false,
        includeTerminalValue
      );
    } catch (error) {
      console.error("Error calculating project metrics:", error);
      return {};
    }
  }, [assets, constants.assetCosts, constants, getMerchantPrice, includeTerminalValue]);

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

  // Calculate portfolio totals
  const getPortfolioTotals = () => {
    const individualAssets = Object.entries(projectMetrics)
      .filter(([assetName]) => assetName !== 'portfolio');
    
    if (individualAssets.length === 0) return null;
    
    const totals = {
      capex: 0,
      debtAmount: 0,
      annualDebtService: 0,
      terminalValue: 0,
    };
    
    const allEquityCashFlows = [];
    const allDSCRs = [];
    
    individualAssets.forEach(([_, metrics]) => {
      totals.capex += metrics.capex || 0;
      totals.debtAmount += metrics.debtAmount || 0;
      totals.annualDebtService += metrics.annualDebtService || 0;
      totals.terminalValue += metrics.terminalValue || 0;
      
      if (metrics.minDSCR) {
        allDSCRs.push(metrics.minDSCR);
      }
      
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
    
    totals.calculatedGearing = totals.capex > 0 ? totals.debtAmount / totals.capex : 0;
    totals.minDSCR = allDSCRs.length > 0 ? Math.min(...allDSCRs) : null;
    totals.equityCashFlows = allEquityCashFlows;
    
    return totals;
  };

  // Get active scenario name for display
  const getActiveScenarioName = () => {
    const scenario = scenarios.find(s => s.id === activeScenario);
    return scenario ? scenario.name : 'Base';
  };

  if (!assets || Object.keys(assets).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-500">
        <p className="text-lg font-medium">No Portfolio Data Available</p>
        <p className="text-sm">Please load a portfolio or add assets to view financial summary</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with scenario selector */}
      <div className="flex justify-between items-center">

        
  
      </div>

      {/* Income Statement Chart - Simplified without detailed table */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {/* P&L Chart */}
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={plData.platformPL}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period"
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(label) => `Year: ${label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4CAF50" strokeWidth={2} />
                <Line type="monotone" dataKey="assetOpex" name="Asset Opex" stroke="#FF9800" strokeWidth={2} />
                <Line type="monotone" dataKey="platformOpex" name="Platform Opex" stroke="#F44336" strokeWidth={2} />
                <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#2196F3" strokeWidth={2} />
                <Line type="monotone" dataKey="npat" name="NPAT" stroke="#9C27B0" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">
              {getPortfolioTotals()?.equityCashFlows && calculateIRR(getPortfolioTotals()?.equityCashFlows) 
                ? formatPercent(calculateIRR(getPortfolioTotals()?.equityCashFlows)) 
                : 'N/A'}
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Portfolio Equity IRR</p>
            <p className="text-xs text-gray-500">Return on equity investment</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              ${formatNumber(getPortfolioTotals()?.capex || 0)}M
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Total Portfolio CAPEX</p>
            <p className="text-xs text-gray-500">Total capital investment</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-purple-600">
              {formatPercent(getPortfolioTotals()?.calculatedGearing || 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-medium">Portfolio Gearing</p>
            <div className="text-xs text-gray-600 mt-1 space-y-1">
              <div>Debt: ${formatNumber(getPortfolioTotals()?.debtAmount || 0)}M</div>
              <div>Equity: ${formatNumber((getPortfolioTotals()?.capex || 0) - (getPortfolioTotals()?.debtAmount || 0))}M</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Total CAPEX ($M)</TableHead>
                <TableHead>Calculated Gearing (%)</TableHead>
                <TableHead>Debt Amount ($M)</TableHead>
                <TableHead>Annual Debt Service ($M)</TableHead>
                <TableHead>Min DSCR</TableHead>
                <TableHead>Terminal Value ($M)</TableHead>
                <TableHead>Equity IRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(projectMetrics)
                .filter(([assetName]) => assetName !== 'portfolio')
                .map(([assetName, metrics]) => (
                <TableRow key={assetName}>
                  <TableCell>{assetName}</TableCell>
                  <TableCell>${formatNumber(metrics.capex)}</TableCell>
                  <TableCell>{formatPercent(metrics.calculatedGearing)}</TableCell>
                  <TableCell>${formatNumber(metrics.debtAmount)}</TableCell>
                  <TableCell>${formatNumber(metrics.annualDebtService)}</TableCell>
                  <TableCell>{formatDSCR(metrics.minDSCR)}</TableCell>
                  <TableCell>${formatNumber(includeTerminalValue ? metrics.terminalValue : 0)}</TableCell>
                  <TableCell>
                    {calculateIRR(metrics.equityCashFlows) 
                      ? formatPercent(calculateIRR(metrics.equityCashFlows)) 
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
              
              {Object.keys(assets).length >= 2 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Portfolio Total</TableCell>
                  <TableCell>${formatNumber(getPortfolioTotals()?.capex)}</TableCell>
                  <TableCell>{formatPercent(getPortfolioTotals()?.calculatedGearing)}</TableCell>
                  <TableCell>${formatNumber(getPortfolioTotals()?.debtAmount)}</TableCell>
                  <TableCell>${formatNumber(getPortfolioTotals()?.annualDebtService)}</TableCell>
                  <TableCell>{formatDSCR(getPortfolioTotals()?.minDSCR)}</TableCell>
                  <TableCell>${formatNumber(includeTerminalValue ? getPortfolioTotals()?.terminalValue : 0)}</TableCell>
                  <TableCell>
                    {getPortfolioTotals()?.equityCashFlows && calculateIRR(getPortfolioTotals()?.equityCashFlows) 
                      ? formatPercent(calculateIRR(getPortfolioTotals()?.equityCashFlows)) 
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
};

export default SummaryFinancialsLanding;