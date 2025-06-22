import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePortfolio } from '@/contexts/PortfolioContext';

// Import calculation functions
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
import PlatformBalanceSheet from '@/components/PlatformBalanceSheet';

const PortfolioAnalysis = () => {
  const { assets, constants, getMerchantPrice, portfolioName } = usePortfolio();
  
  // Centralized scenario management - this will eventually move to portfolio context
  const [selectedRevenueCase, setSelectedRevenueCase] = useState('base');
  const [includeTerminalValue, setIncludeTerminalValue] = useState(true);
  const [timeView, setTimeView] = useState('annual');
  
  // UI state for expandable sections
  const [showPLTable, setShowPLTable] = useState(false);
  const [showCFTable, setShowCFTable] = useState(false);
  const [expandedPLYears, setExpandedPLYears] = useState(new Set());
  const [expandedCFYears, setExpandedCFYears] = useState(new Set());

  // Generate years for analysis
  const years = useMemo(() => {
    const startYear = constants.analysisStartYear || new Date().getFullYear();
    const endYear = constants.analysisEndYear || startYear + 30;
    return generateYears(startYear, endYear);
  }, [constants.analysisStartYear, constants.analysisEndYear]);

  // Calculate platform P&L data with auto-recalculation
  const plData = useMemo(() => {
    if (Object.keys(assets).length === 0) return { platformPL: [], quarters: [] };
    
    return calculatePlatformPL(
      assets,
      constants,
      years,
      getMerchantPrice,
      selectedRevenueCase,
      true, // Use portfolio debt
      constants.platformOpex || 4.2,
      constants.platformOpexEscalation || 2.5
    );
  }, [assets, constants, years, getMerchantPrice, selectedRevenueCase]);

  // Calculate cash flow data
  const cashFlowData = useMemo(() => {
    if (!plData.platformPL || plData.platformPL.length === 0) {
      return { annual: [], quarterly: [] };
    }
    
    return calculateCashFlow(
      plData.platformPL,
      plData.quarters,
      constants.dividendPolicy || 85,
      constants.minimumCashBalance || 5.0
    );
  }, [plData.platformPL, plData.quarters, constants.dividendPolicy, constants.minimumCashBalance]);

  // Calculate project metrics with auto-recalculation (auto-solve gearing)
  const projectMetrics = useMemo(() => {
    if (Object.keys(assets).length === 0) return {};
    
    try {
      return calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        true, // Auto-solve gearing
        includeTerminalValue
      );
    } catch (error) {
      console.error("Error calculating project metrics:", error);
      return {};
    }
  }, [assets, constants.assetCosts, constants, getMerchantPrice, selectedRevenueCase, includeTerminalValue]);

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

  // Helper functions for expandable tables
  const groupDataByYears = (data, yearsPerGroup = 5) => {
    const groups = [];
    for (let i = 0; i < data.length; i += yearsPerGroup) {
      const groupData = data.slice(i, i + yearsPerGroup);
      if (groupData.length > 0) {
        const startYear = groupData[0].period;
        const endYear = groupData[groupData.length - 1].period;
        groups.push({
          id: `years-${startYear}-${endYear}`,
          label: `Years ${startYear} - ${endYear}`,
          data: groupData
        });
      }
    }
    return groups;
  };

  const toggleYearGroup = (groupId, setExpanded) => {
    setExpanded(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId);
      } else {
        newExpanded.add(groupId);
      }
      return newExpanded;
    });
  };

  // Get current data based on time view
  const getCurrentPLData = () => {
    return timeView === 'quarterly' ? plData.quarters : plData.platformPL;
  };

  const getCurrentCFData = () => {
    return timeView === 'quarterly' ? cashFlowData.quarterly : cashFlowData.annual;
  };

  if (!assets || Object.keys(assets).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-500">
        <p className="text-lg font-medium">No Portfolio Data Available</p>
        <p className="text-sm">Please configure assets in the Portfolio Configuration tab</p>
      </div>
    );
  }

  return (
    <div className="w-full p-4 space-y-6">
      {/* Header with controls */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Portfolio Analysis</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="terminal-value-toggle" 
              checked={includeTerminalValue} 
              onCheckedChange={setIncludeTerminalValue}
            />
            <Label htmlFor="terminal-value-toggle" className="font-medium">
              Include Terminal Value
            </Label>
          </div>
          
          <Select value={timeView} onValueChange={setTimeView}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedRevenueCase} onValueChange={setSelectedRevenueCase}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base Case</SelectItem>
              <SelectItem value="worst">Combined Downside</SelectItem>
              <SelectItem value="volume">Volume Stress</SelectItem>
              <SelectItem value="price">Price Stress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="project">Project Finance</TabsTrigger>
          <TabsTrigger value="financials">Financial Statements</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>

        {/* Executive Summary */}
        <TabsContent value="summary" className="space-y-6">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-blue-600">
                  {getPortfolioTotals()?.equityCashFlows && calculateIRR(getPortfolioTotals()?.equityCashFlows) 
                    ? formatPercent(calculateIRR(getPortfolioTotals()?.equityCashFlows)) 
                    : 'N/A'}
                </div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Portfolio Equity IRR</p>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-green-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-600">
                  ${formatNumber(getPortfolioTotals()?.capex || 0)}M
                </div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Total CAPEX</p>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-purple-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-purple-600">
                  {formatPercent(getPortfolioTotals()?.calculatedGearing || 0)}
                </div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Portfolio Gearing</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-600">
                  {formatDSCR(getPortfolioTotals()?.minDSCR)}
                </div>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Minimum DSCR</p>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Summary Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>CAPEX ($M)</TableHead>
                    <TableHead>Gearing (%)</TableHead>
                    <TableHead>Debt ($M)</TableHead>
                    <TableHead>Debt Service ($M)</TableHead>
                    <TableHead>Min DSCR</TableHead>
                    <TableHead>Terminal ($M)</TableHead>
                    <TableHead>Equity IRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(projectMetrics)
                    .filter(([assetName]) => assetName !== 'portfolio')
                    .map(([assetName, metrics]) => (
                    <TableRow key={assetName}>
                      <TableCell className="font-medium">{assetName}</TableCell>
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
        </TabsContent>

        {/* Project Finance Results */}
        <TabsContent value="project" className="space-y-6">
          {/* Project Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Project Cash Flows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectMetrics.portfolio?.cashFlows || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => `$${value.toLocaleString()}M`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4CAF50" strokeWidth={2} />
                    <Line type="monotone" dataKey="opex" name="Operating Costs" stroke="#f44336" strokeWidth={2} />
                    <Line type="monotone" dataKey="operatingCashFlow" name="CFADS" stroke="#2196F3" strokeWidth={2} />
                    <Line type="monotone" dataKey="debtService" name="Debt Service" stroke="#9C27B0" strokeWidth={2} />
                    <Line type="monotone" dataKey="equityCashFlow" name="Equity Cash Flow" stroke="#FF9800" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* DSCR Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Debt Service Coverage Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectMetrics.portfolio?.cashFlows || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis yAxisId="left" domain={[0, 'auto']} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="right" dataKey="debtService" name="Debt Service ($M)" fill="#9C27B0" />
                    <Line yAxisId="left" type="monotone" dataKey="dscr" name="DSCR" stroke="#2196F3" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Statements */}
        <TabsContent value="financials" className="space-y-6">
          {/* P&L Chart and Table */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Profit & Loss</CardTitle>
            </CardHeader>
            <CardContent>
              {/* P&L Chart */}
              <div className="h-96 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getCurrentPLData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) => `${timeView === 'quarterly' ? 'Quarter' : 'Year'}: ${label}`}
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

              {/* Expandable P&L Table */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowPLTable(!showPLTable)}
                    className="flex items-center gap-2"
                  >
                    {showPLTable ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {showPLTable ? 'Hide' : 'Show'} Detailed P&L Table
                  </Button>
                </div>
                
                {showPLTable && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{timeView === 'quarterly' ? 'Period' : 'Year'}</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Asset Opex</TableHead>
                          <TableHead>Platform Opex</TableHead>
                          <TableHead>EBITDA</TableHead>
                          <TableHead>Depreciation</TableHead>
                          <TableHead>Interest</TableHead>
                          <TableHead>Principal</TableHead>
                          <TableHead>EBT</TableHead>
                          <TableHead>Tax</TableHead>
                          <TableHead>NPAT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupDataByYears(getCurrentPLData()).map((group) => (
                          <React.Fragment key={group.id}>
                            <TableRow className="bg-gray-100 hover:bg-gray-200 cursor-pointer" onClick={() => toggleYearGroup(group.id, setExpandedPLYears)}>
                              <TableCell colSpan={11} className="font-medium">
                                <div className="flex items-center gap-2">
                                  {expandedPLYears.has(group.id) ? 
                                    <ChevronDown className="h-4 w-4" /> : 
                                    <ChevronRight className="h-4 w-4" />
                                  }
                                  {group.label}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedPLYears.has(group.id) && group.data.map((row, index) => (
                              <TableRow key={row.period} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                                <TableCell className="pl-8">{row.period}</TableCell>
                                <TableCell>{formatCurrency(row.revenue)}</TableCell>
                                <TableCell>{formatCurrency(row.assetOpex)}</TableCell>
                                <TableCell>{formatCurrency(row.platformOpex)}</TableCell>
                                <TableCell className="font-medium">{formatCurrency(row.ebitda)}</TableCell>
                                <TableCell>{formatCurrency(row.depreciation)}</TableCell>
                                <TableCell>{formatCurrency(row.interest)}</TableCell>
                                <TableCell>{formatCurrency(row.principalRepayment)}</TableCell>
                                <TableCell>{formatCurrency(row.ebt)}</TableCell>
                                <TableCell>{formatCurrency(row.tax)}</TableCell>
                                <TableCell className="font-medium">{formatCurrency(row.npat)}</TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Chart and Table */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Statement</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Cash Flow Chart */}
              <div className="h-96 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getCurrentCFData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) => `${timeView === 'quarterly' ? 'Quarter' : 'Year'}: ${label}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="operatingCashFlow" name="Operating Cash Flow" stroke="#4CAF50" strokeWidth={2} />
                    <Line type="monotone" dataKey="tax" name="Tax" stroke="#d32f2f" strokeWidth={2} />
                    <Line type="monotone" dataKey="debtService" name="Debt Service" stroke="#FF9800" strokeWidth={2} />
                    <Line type="monotone" dataKey="fcfe" name="FCFE" stroke="#9C27B0" strokeWidth={2} />
                    <Line type="monotone" dataKey="dividend" name="Dividends" stroke="#F44336" strokeWidth={2} />
                    <Line type="monotone" dataKey="cashBalance" name="Cash Balance" stroke="#673AB7" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Expandable Cash Flow Table */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCFTable(!showCFTable)}
                    className="flex items-center gap-2"
                  >
                    {showCFTable ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {showCFTable ? 'Hide' : 'Show'} Detailed Cash Flow Table
                  </Button>
                </div>
                
                {showCFTable && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{timeView === 'quarterly' ? 'Period' : 'Year'}</TableHead>
                          <TableHead>Operating Cash Flow</TableHead>
                          <TableHead>Tax</TableHead>
                          <TableHead>Interest</TableHead>
                          <TableHead>Principal</TableHead>
                          <TableHead>Total Debt Service</TableHead>
                          <TableHead className="font-medium bg-purple-50">FCFE</TableHead>
                          <TableHead>Dividends</TableHead>
                          <TableHead>Net Cash Flow</TableHead>
                          <TableHead>Cash Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupDataByYears(getCurrentCFData()).map((group) => (
                          <React.Fragment key={group.id}>
                            <TableRow className="bg-gray-100 hover:bg-gray-200 cursor-pointer" onClick={() => toggleYearGroup(group.id, setExpandedCFYears)}>
                              <TableCell colSpan={10} className="font-medium">
                                <div className="flex items-center gap-2">
                                  {expandedCFYears.has(group.id) ? 
                                    <ChevronDown className="h-4 w-4" /> : 
                                    <ChevronRight className="h-4 w-4" />
                                  }
                                  {group.label}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedCFYears.has(group.id) && group.data.map((row, index) => (
                              <TableRow key={row.period} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                                <TableCell className="pl-8">{row.period}</TableCell>
                                <TableCell>{formatCurrency(row.operatingCashFlow)}</TableCell>
                                <TableCell>{formatCurrency(row.tax)}</TableCell>
                                <TableCell>{formatCurrency(row.interestPayment)}</TableCell>
                                <TableCell>{formatCurrency(row.principalPayment)}</TableCell>
                                <TableCell>{formatCurrency(row.debtService)}</TableCell>
                                <TableCell className="font-medium bg-purple-50">{formatCurrency(row.fcfe)}</TableCell>
                                <TableCell>{formatCurrency(row.dividend)}</TableCell>
                                <TableCell className="font-medium">{formatCurrency(row.netCashFlow)}</TableCell>
                                <TableCell>{formatCurrency(row.cashBalance)}</TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance" className="space-y-6">
          <PlatformBalanceSheet
            plData={plData}
            cashFlowData={cashFlowData}
            selectedRevenueCase={selectedRevenueCase}
            timeView={timeView}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioAnalysis;