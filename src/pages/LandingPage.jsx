'use client'

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from '@/components/ui/tabs';
import { LogOut, User, Lock } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ClientLayout from '../../app/client-layout';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useScenarios } from '@/contexts/ScenarioContext';
import { 
  calculatePlatformPL, 
  calculateCashFlow, 
  generateYears, 
  formatCurrency 
} from '@/lib/platformCalculations';

// Define users with their credentials and default portfolios
const USERS = {
  'ZEBRE': {
    password: '**',
    portfolioFile: 'zebre_2025-01-13.json',
    portfolioId: 'zebre',
    portfolioName: 'ZEBRE'
  },
  'AULA': {
    password: '**',
    portfolioFile: 'aula_2025-01-13.json',
    portfolioId: 'aula',
    portfolioName: 'Aula'
  },
  'ACCIONA': {
    password: '**',
    portfolioFile: 'acciona_merchant_2025-01-13.json',
    portfolioId: 'acciona',
    portfolioName: 'Acciona Merchant'
  }
};

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const user = USERS[username.toUpperCase()];
    if (user && password === user.password) {
      // Store user info in session storage for the app to use
      sessionStorage.setItem('currentUser', username.toUpperCase());
      sessionStorage.setItem('userPortfolioFile', user.portfolioFile);
      sessionStorage.setItem('userPortfolioId', user.portfolioId);
      sessionStorage.setItem('userPortfolioName', user.portfolioName);
      
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-20">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <Lock className="h-12 w-12 text-blue-500" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Portfolio Earnings Platform</CardTitle>
        <p className="text-center text-gray-500">Please enter your credentials</p>
        <div className="text-center text-xs text-gray-400 mt-2">
          Available users: ZEBRE, AULA, ACCIONA (password: **)
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 ${error ? "border-red-500" : ""}`}
                />
              </div>
              {error && (
                <p className="text-red-500 text-sm">Invalid username or password. Please try again.</p>
              )}
            </div>
            <Button type="submit" className="w-full">Login</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const SummaryFinancialsLanding = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasLoadedPortfolio, setHasLoadedPortfolio] = useState(false);
  
  const { 
    assets, 
    constants, 
    getMerchantPrice, 
    portfolioName, 
    isLoading,
    loadPortfolioFromDB 
  } = usePortfolio();
  
  const { scenarios, activeScenario, setActiveScenario } = useScenarios();
  
  const [includeTerminalValue] = useState(true);

  // Check login status on mount
  useEffect(() => {
    const currentUser = sessionStorage.getItem('currentUser');
    setIsLoggedIn(!!currentUser);
  }, []);

  // Get current user from session storage
  const currentUser = sessionStorage.getItem('currentUser') || 'Guest';
  const userPortfolioName = sessionStorage.getItem('userPortfolioName') || portfolioName || 'Portfolio';

  // Load user's portfolio on mount
  useEffect(() => {
    const loadUserPortfolio = async () => {
      if (isLoggedIn && currentUser !== 'Guest' && !hasLoadedPortfolio && !isLoading) {
        try {
          const userPortfolioId = sessionStorage.getItem('userPortfolioId');
          if (userPortfolioId && loadPortfolioFromDB) {
            await loadPortfolioFromDB(currentUser, userPortfolioId);
            setHasLoadedPortfolio(true);
          }
        } catch (error) {
          console.error('Error loading user portfolio:', error);
        }
      }
    };

    loadUserPortfolio();
  }, [isLoggedIn, currentUser, hasLoadedPortfolio, isLoading, loadPortfolioFromDB]);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('userPortfolioFile');
    sessionStorage.removeItem('userPortfolioId');
    sessionStorage.removeItem('userPortfolioName');
    setIsLoggedIn(false);
    setHasLoadedPortfolio(false);
  };

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
      assets,
      constants,
      years,
      getMerchantPrice,
      'base',
      true,
      constants.platformOpex || 4.2,
      constants.platformOpexEscalation || 2.5
    );
  }, [assets, constants, years, getMerchantPrice]);

  // For now, we'll create a simplified project metrics calculation
  const projectMetrics = useMemo(() => {
    if (Object.keys(assets).length === 0) return {};
    
    const metrics = {};
    Object.values(assets).forEach(asset => {
      const assetCosts = constants.assetCosts?.[asset.name] || {};
      metrics[asset.name] = {
        capex: assetCosts.capex || 0,
        debtAmount: (assetCosts.capex || 0) * (assetCosts.calculatedGearing || 0.7),
        annualDebtService: 0,
        terminalValue: assetCosts.terminalValue || 0,
        calculatedGearing: assetCosts.calculatedGearing || 0.7,
        minDSCR: 1.35,
        equityCashFlows: []
      };
    });
    
    return metrics;
  }, [assets, constants.assetCosts, includeTerminalValue]);

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
    
    individualAssets.forEach(([_, metrics]) => {
      totals.capex += metrics.capex || 0;
      totals.debtAmount += metrics.debtAmount || 0;
      totals.annualDebtService += metrics.annualDebtService || 0;
      totals.terminalValue += metrics.terminalValue || 0;
    });
    
    totals.calculatedGearing = totals.capex > 0 ? totals.debtAmount / totals.capex : 0;
    
    return totals;
  };

  // Get active scenario name for display
  const getActiveScenarioName = () => {
    const scenario = scenarios.find(s => s.id === activeScenario);
    return scenario ? scenario.name : 'Base';
  };

  if (!isLoggedIn) {
    return (
      <ClientLayout>
        <TabsContent value="landingpage">
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <LoginForm onLogin={handleLogin} />
          </div>
        </TabsContent>
      </ClientLayout>
    );
  }

  if (isLoading) {
    return (
      <ClientLayout>
        <TabsContent value="landingpage">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading portfolio data...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </ClientLayout>
    );
  }

  if (!assets || Object.keys(assets).length === 0) {
    return (
      <ClientLayout>
        <TabsContent value="landingpage">
          <div className="space-y-6">
            {/* Header with user info and logout */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser}</h1>
                      <p className="text-gray-600">Portfolio: {userPortfolioName}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <p className="text-lg font-medium text-gray-500">No Portfolio Data Available</p>
                <p className="text-sm text-gray-400 mt-2">
                  Please add assets in the Dashboard tab to view financial summary
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <TabsContent value="landingpage">
        <div className="space-y-6">
          {/* Header with user info, scenario selector, and logout */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser}</h1>
                    <p className="text-gray-600">Portfolio: {userPortfolioName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={activeScenario === 'base' ? 'default' : 'secondary'}>
                        Scenario: {getActiveScenarioName()}
                      </Badge>
                      {scenarios.length > 1 && (
                        <Select value={activeScenario} onValueChange={setActiveScenario}>
                          <SelectTrigger className="w-32 h-6 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {scenarios.map(scenario => (
                              <SelectItem key={scenario.id} value={scenario.id}>
                                {scenario.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Platform P&L Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Profit & Loss</CardTitle>
            </CardHeader>
            <CardContent>
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
                  N/A
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
                      <TableCell>N/A</TableCell>
                    </TableRow>
                  ))}
                  
                  {Object.keys(assets).length >= 2 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Portfolio Total</TableCell>
                      <TableCell>${formatNumber(getPortfolioTotals()?.capex)}</TableCell>
                      <TableCell>{formatPercent(getPortfolioTotals()?.calculatedGearing)}</TableCell>
                      <TableCell>${formatNumber(getPortfolioTotals()?.debtAmount)}</TableCell>
                      <TableCell>${formatNumber(getPortfolioTotals()?.annualDebtService)}</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>${formatNumber(includeTerminalValue ? getPortfolioTotals()?.terminalValue : 0)}</TableCell>
                      <TableCell>N/A</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </ClientLayout>
  );
};

export default SummaryFinancialsLanding;