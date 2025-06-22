import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortfolio } from '@/contexts/PortfolioContext';
import { formatCurrency } from './PlatformPL_Calculations';

/**
 * CORRECTED DEFERRED TAX FUNCTIONS
 */

/**
 * Calculate tax depreciation for a given period
 */
const calculateTaxDepreciation = (assets, constants, periodIndex) => {
  let totalTaxDepreciation = 0;
  
  Object.values(assets).forEach(asset => {
    const assetCosts = constants.assetCosts[asset.name] || {};
    const capex = assetCosts.capex || 0;
    
    // Get tax depreciation period for this asset type
    const taxDepreciationPeriod = constants.deprecationPeriods?.[asset.type] || 30;
    
    // Calculate asset start period relative to analysis start
    const assetStartYear = new Date(asset.assetStartDate).getFullYear();
    const analysisStartYear = constants.analysisStartYear || new Date().getFullYear();
    const assetStartPeriod = Math.max(0, assetStartYear - analysisStartYear);
    
    // Check if asset is depreciating in this period
    const periodsFromAssetStart = periodIndex - assetStartPeriod;
    
    if (periodsFromAssetStart >= 0 && periodsFromAssetStart < taxDepreciationPeriod) {
      const annualTaxDepreciation = capex / taxDepreciationPeriod;
      totalTaxDepreciation += annualTaxDepreciation;
    }
  });
  
  return totalTaxDepreciation;
};

/**
 * Calculate comprehensive deferred tax with loss carryforwards
 */
const calculateComprehensiveDeferredTax = (pnlData, assets, constants, periodIndex) => {
  const corporateTaxRate = (constants.corporateTaxRate || 30) / 100;
  
  // Calculate cumulative book vs tax depreciation differences
  let cumulativeBookDepreciation = 0;
  let cumulativeTaxDepreciation = 0;
  let cumulativeTaxLosses = 0;
  
  // Sum up differences through current period
  for (let i = 0; i <= periodIndex; i++) {
    const period = pnlData[i];
    if (!period) continue;
    
    // Book depreciation (from P&L)
    const bookDepreciation = Math.abs(period.depreciation || 0);
    cumulativeBookDepreciation += bookDepreciation;
    
    // Tax depreciation
    const taxDepreciation = calculateTaxDepreciation(assets, constants, i);
    cumulativeTaxDepreciation += taxDepreciation;
    
    // Calculate taxable income for loss carryforwards
    const bookEBT = period.ebt || 0;
    const depreciationAdjustment = taxDepreciation - bookDepreciation;
    const taxableIncome = bookEBT + depreciationAdjustment;
    
    // Track tax losses
    if (taxableIncome < 0) {
      cumulativeTaxLosses += Math.abs(taxableIncome);
    } else if (cumulativeTaxLosses > 0) {
      const lossesUsed = Math.min(cumulativeTaxLosses, taxableIncome);
      cumulativeTaxLosses -= lossesUsed;
    }
  }
  
  // Calculate temporary difference and deferred tax
  const temporaryDifference = cumulativeBookDepreciation - cumulativeTaxDepreciation;
  const deferredTaxFromDepreciation = temporaryDifference * corporateTaxRate;
  const lossCarryforwardDTA = cumulativeTaxLosses * corporateTaxRate;
  
  // Separate into assets and liabilities
  const deferredTaxAsset = Math.max(0, -deferredTaxFromDepreciation) + lossCarryforwardDTA;
  const deferredTaxLiability = Math.max(0, deferredTaxFromDepreciation);
  
  return {
    deferredTaxAsset,
    deferredTaxLiability,
    depreciationDTA: Math.max(0, -deferredTaxFromDepreciation),
    depreciationDTL: Math.max(0, deferredTaxFromDepreciation),
    lossCarryforwardDTA,
    unusedTaxLosses: cumulativeTaxLosses,
    debugInfo: {
      corporateTaxRate: corporateTaxRate * 100,
      temporaryDifference,
      cumulativeBookDepreciation,
      cumulativeTaxDepreciation
    }
  };
};

/**
 * Calculate deferred tax for balance sheet
 */
const calculateBalanceSheetDeferredTax = (pnlData, assets, constants, periodIndex) => {
  const deferredTax = calculateComprehensiveDeferredTax(pnlData, assets, constants, periodIndex);
  
  return {
    deferredTaxAssets: deferredTax.deferredTaxAsset,
    deferredTaxLiabilities: deferredTax.deferredTaxLiability,
    deferredTaxBreakdown: {
      depreciationDifferences: {
        asset: deferredTax.depreciationDTA,
        liability: deferredTax.depreciationDTL
      },
      lossCarryforwards: deferredTax.lossCarryforwardDTA,
      unusedLosses: deferredTax.unusedTaxLosses
    },
    deferredTaxDebug: deferredTax.debugInfo
  };
};

/**
 * EXISTING DEBT BALANCE FUNCTIONS (keeping these from previous fix)
 */
const calculateDebtBalances = (index, results, assets, constants, cfPeriod) => {
  if (index === 0) {
    const initialProjectDebt = Object.values(assets).reduce((sum, asset) => {
      const assetCosts = constants.assetCosts[asset.name] || {};
      const gearing = assetCosts.calculatedGearing || assetCosts.maxGearing || 0.7;
      return sum + ((assetCosts.capex || 0) * gearing);
    }, 0);
    
    return {
      projectFinanceDebt: initialProjectDebt,
      portfolioFinanceDebt: 0,
      totalDebt: initialProjectDebt,
      debtComposition: {
        phase: 'project_finance',
        description: 'Individual asset project finance'
      }
    };
  } else {
    const previousDebt = results[index - 1];
    const principalPayment = cfPeriod.principalRepayment || 0;
    const isPortfolioPhase = checkIfPortfolioPhase(index, assets, constants);
    
    if (!isPortfolioPhase) {
      const newProjectDebt = Math.max(0, previousDebt.projectFinanceDebt - Math.abs(principalPayment));
      
      return {
        projectFinanceDebt: newProjectDebt,
        portfolioFinanceDebt: 0,
        totalDebt: newProjectDebt,
        debtComposition: {
          phase: 'project_finance',
          description: 'Individual asset project finance',
          principalPayment: principalPayment
        }
      };
    } else {
      const portfolioDebt = calculatePortfolioRefinancing(previousDebt, principalPayment, constants);
      
      return {
        projectFinanceDebt: 0,
        portfolioFinanceDebt: portfolioDebt,
        totalDebt: portfolioDebt,
        debtComposition: {
          phase: 'portfolio_finance',
          description: 'Portfolio-level refinancing',
          principalPayment: principalPayment
        }
      };
    }
  }
};

const checkIfPortfolioPhase = (periodIndex, assets, constants) => {
  const hasPortfolioFinancing = constants.assetCosts.portfolio && 
                                Object.keys(assets).length >= 2;
  
  if (!hasPortfolioFinancing) return false;
  
  const avgTenor = Object.values(assets).reduce((sum, asset) => {
    const assetCosts = constants.assetCosts[asset.name] || {};
    return sum + (assetCosts.tenorYears || 15);
  }, 0) / Object.values(assets).length;
  
  return periodIndex > avgTenor;
};

const calculatePortfolioRefinancing = (previousDebt, principalPayment, constants) => {
  if (previousDebt.portfolioFinanceDebt === 0) {
    return previousDebt.projectFinanceDebt;
  } else {
    return Math.max(0, previousDebt.portfolioFinanceDebt - Math.abs(principalPayment));
  }
};

const validateDebtBalance = (currentPeriod, previousPeriod, principalPayment) => {
  if (!previousPeriod) return true;
  
  const expectedDebt = previousPeriod.totalDebt - Math.abs(principalPayment);
  const actualDebt = currentPeriod.totalDebt;
  const tolerance = 0.01;
  
  const isValid = Math.abs(expectedDebt - actualDebt) < tolerance;
  
  if (!isValid) {
    console.warn(`Debt balance validation failed for period ${currentPeriod.period}:`);
    console.warn(`Expected: ${expectedDebt.toFixed(2)}M, Actual: ${actualDebt.toFixed(2)}M`);
  }
  
  return isValid;
};

/**
 * MAIN COMPONENT
 */
const PlatformBalanceSheet = ({ plData, cashFlowData, selectedRevenueCase, timeView = 'annual' }) => {
  const { assets, constants } = usePortfolio();
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [initialEquity, setInitialEquity] = useState({
    newInvestors: 150,
    zenContribution: 100,
    assetCoRepayment: -50
  });

  // Balance sheet data calculation with CORRECTED DEFERRED TAX
  const balanceSheetData = useMemo(() => {
    if (!plData || !plData.platformPL || !cashFlowData) return [];

    const pnlData = timeView === 'annual' ? plData.platformPL : plData.quarters;
    const cfData = timeView === 'annual' ? cashFlowData.annual : cashFlowData.quarterly;
    
    if (!pnlData || !cfData || pnlData.length === 0 || cfData.length === 0) return [];

    const totalCapex = Object.values(assets).reduce((sum, asset) => {
      const assetCosts = constants.assetCosts[asset.name] || {};
      return sum + (assetCosts.capex || 0);
    }, 0);

    const totalInvestment = initialEquity.newInvestors + initialEquity.zenContribution + 
                          Math.abs(initialEquity.assetCoRepayment);
    const acquisitionPremium = Math.max(0, totalInvestment - totalCapex);

    const results = [];
    
    for (let index = 0; index < pnlData.length; index++) {
      const period = pnlData[index];
      
      const cfPeriod = cfData.find(cf => cf.period === period.period) || {
        cashBalance: 0,
        interestPayment: 0,
        taxPayment: 0,
        dividendPayment: 0,
        principalRepayment: 0
      };

      // Calculate debt balances
      const debtBalances = calculateDebtBalances(index, results, assets, constants, cfPeriod);
      
      // CORRECTED DEFERRED TAX CALCULATION
      const deferredTaxCalc = calculateBalanceSheetDeferredTax(pnlData, assets, constants, index);
      
      if (index > 0) {
        validateDebtBalance(debtBalances, results[index-1], cfPeriod.principalRepayment);
      }

      const balanceSheet = {
        period: period.period,
        
        // ASSETS
        cash: cfPeriod.cashBalance || 0,
        acquisitionPremium: acquisitionPremium,
        totalCurrentAssets: (cfPeriod.cashBalance || 0) + acquisitionPremium,
        
        equityInvestments: totalCapex,
        // CORRECTED DEFERRED TAX ASSETS
        deferredTaxAssets: deferredTaxCalc.deferredTaxAssets,
        totalNonCurrentAssets: totalCapex + deferredTaxCalc.deferredTaxAssets,
        
        // LIABILITIES
        tradePayables: -(period.assetOpex + period.platformOpex) * 0.08,
        interestPayables: (cfPeriod.interestPayment || 0) * 0.25,
        taxPayables: period.tax > 0 ? period.tax * 0.25 : 0,
        dividendPayables: (cfPeriod.dividendPayment || 0) * 0.25,
        
        // Debt tracking
        projectFinanceDebt: debtBalances.projectFinanceDebt,
        portfolioFinanceDebt: debtBalances.portfolioFinanceDebt,
        totalDebt: debtBalances.totalDebt,
        portfolioFinancing: -debtBalances.totalDebt,
        
        // CORRECTED DEFERRED TAX LIABILITIES
        deferredTaxLiabilities: deferredTaxCalc.deferredTaxLiabilities,
        
        // Additional fields for transparency
        deferredTaxBreakdown: deferredTaxCalc.deferredTaxBreakdown,
        deferredTaxDebug: deferredTaxCalc.deferredTaxDebug,
        debtComposition: debtBalances.debtComposition,
      };
      
      // Calculate totals
      balanceSheet.totalCurrentLiabilities = balanceSheet.tradePayables + 
                                           balanceSheet.interestPayables + 
                                           balanceSheet.taxPayables + 
                                           balanceSheet.dividendPayables;
      
      balanceSheet.totalNonCurrentLiabilities = Math.abs(balanceSheet.portfolioFinancing) + 
                                              balanceSheet.deferredTaxLiabilities;
      
      balanceSheet.totalLiabilities = balanceSheet.totalCurrentLiabilities + 
                                    balanceSheet.totalNonCurrentLiabilities;
      
      balanceSheet.totalAssets = balanceSheet.totalCurrentAssets + 
                               balanceSheet.totalNonCurrentAssets;
      
      balanceSheet.netAssets = balanceSheet.totalAssets + balanceSheet.totalLiabilities;
      
      // EQUITY section
      if (index === 0) {
        balanceSheet.newInvestorsCapital = initialEquity.newInvestors;
        balanceSheet.zenContribution = initialEquity.zenContribution;
        balanceSheet.assetCoRepayment = initialEquity.assetCoRepayment;
        balanceSheet.retainedEarnings = 0;
      } else {
        balanceSheet.newInvestorsCapital = results[index-1].newInvestorsCapital;
        balanceSheet.zenContribution = results[index-1].zenContribution;
        balanceSheet.assetCoRepayment = results[index-1].assetCoRepayment;
        balanceSheet.retainedEarnings = results[index-1].retainedEarnings + 
                                      period.npat + 
                                      (cfPeriod.dividendPayment || 0);
      }
      
      balanceSheet.totalEquity = balanceSheet.newInvestorsCapital + 
                               balanceSheet.zenContribution + 
                               balanceSheet.assetCoRepayment + 
                               balanceSheet.retainedEarnings;
      
      balanceSheet.balanceCheck = Math.abs(
        balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)
      ) < 0.01;
      
      results.push(balanceSheet);
    }
    
    return results;
  }, [plData, cashFlowData, assets, constants, initialEquity, timeView]);

  // Set initial selected period when data changes
  useEffect(() => {
    if (balanceSheetData && balanceSheetData.length > 0 && !selectedPeriod) {
      setSelectedPeriod(balanceSheetData[0].period);
    }
  }, [balanceSheetData, selectedPeriod]);

  // Get the selected balance sheet period data
  const selectedBalanceSheet = useMemo(() => {
    if (!balanceSheetData || balanceSheetData.length === 0 || !selectedPeriod) return null;
    return balanceSheetData.find(bs => bs.period === selectedPeriod);
  }, [balanceSheetData, selectedPeriod]);

  // Handle data set on equity split
  const handleEquityChange = (field, value) => {
    setInitialEquity(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  if (!selectedBalanceSheet) {
    return (
      <div className="w-full p-4 space-y-4">
        <Card>
          <CardContent className="flex justify-center items-center h-32">
            <p className="text-gray-500">No balance sheet data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Balance Sheet</CardTitle>
            <div className="flex items-center space-x-4">
              <Select
                value={selectedPeriod}
                onValueChange={setSelectedPeriod}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={`Select ${timeView === 'quarterly' ? 'Quarter' : 'Year'}`} />
                </SelectTrigger>
                <SelectContent>
                  {balanceSheetData.map(period => (
                    <SelectItem key={period.period} value={period.period}>
                      {timeView === 'quarterly' ? `Quarter: ${period.period}` : `Year: ${period.period}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm bg-blue-50 border border-blue-200 px-3 py-1 rounded">
                {selectedRevenueCase.charAt(0).toUpperCase() + selectedRevenueCase.slice(1)} Case
              </div>
              {/* Debug info for debt composition */}
              {selectedBalanceSheet.debtComposition && (
                <div className="text-xs bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                  {selectedBalanceSheet.debtComposition.phase}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Equity Structure Inputs */}
          <div className="mb-8 bg-gray-50 p-4 rounded-md">
            <h3 className="font-medium mb-4">Initial Equity Structure</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>New Investors ($M)</Label>
                <Input
                  type="number"
                  value={initialEquity.newInvestors}
                  onChange={(e) => handleEquityChange('newInvestors', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ZEN Contribution ($M)</Label>
                <Input
                  type="number"
                  value={initialEquity.zenContribution}
                  onChange={(e) => handleEquityChange('zenContribution', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>AssetCo Repayment ($M)</Label>
                <Input
                  type="number"
                  value={initialEquity.assetCoRepayment}
                  onChange={(e) => handleEquityChange('assetCoRepayment', e.target.value)}
                />
                <p className="text-xs text-gray-500">Enter as negative number</p>
              </div>
            </div>
          </div>
          
          {/* Balance Sheet Table */}
          <div className="grid grid-cols-2 gap-6">
            {/* Assets */}
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-lg">Assets</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {/* Current Assets */}
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={2} className="font-medium">Current Assets</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Cash and Cash Equivalents</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.cash)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Acquisition Premium</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.acquisitionPremium)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium pl-4">Total Current Assets</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(selectedBalanceSheet.totalCurrentAssets)}</TableCell>
                    </TableRow>
                    
                    {/* Non-Current Assets */}
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={2} className="font-medium">Non-Current Assets</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Equity Investments</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.equityInvestments)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Deferred Tax Assets</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.deferredTaxAssets)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium pl-4">Total Non-Current Assets</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(selectedBalanceSheet.totalNonCurrentAssets)}</TableCell>
                    </TableRow>
                    
                    {/* Total Assets */}
                    <TableRow className="bg-blue-50 border-t-2 border-b-2">
                      <TableCell className="font-bold">TOTAL ASSETS</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(selectedBalanceSheet.totalAssets)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            {/* Liabilities and Equity */}
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-lg">Liabilities and Equity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {/* Current Liabilities */}
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={2} className="font-medium">Current Liabilities</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Trade Payables</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.tradePayables)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Interest Payables</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.interestPayables)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Tax Payables</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.taxPayables)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Dividend Payables</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.dividendPayables)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium pl-4">Total Current Liabilities</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(selectedBalanceSheet.totalCurrentLiabilities)}</TableCell>
                    </TableRow>
                    
                    {/* Non-Current Liabilities */}
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={2} className="font-medium">Non-Current Liabilities</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Project Finance Debt</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.projectFinanceDebt)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Portfolio Finance Debt</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.portfolioFinanceDebt)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 font-medium">Total Debt</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(selectedBalanceSheet.totalDebt)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Deferred Tax Liabilities</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.deferredTaxLiabilities)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium pl-4">Total Non-Current Liabilities</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(selectedBalanceSheet.totalNonCurrentLiabilities)}</TableCell>
                    </TableRow>
                    
                    {/* Total Liabilities */}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold pl-4">TOTAL LIABILITIES</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(selectedBalanceSheet.totalLiabilities)}</TableCell>
                    </TableRow>
                    
                    {/* Net Assets */}
                    <TableRow className="bg-purple-50 border-t-2 border-b-2">
                      <TableCell className="font-bold">NET ASSETS</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(selectedBalanceSheet.netAssets)}</TableCell>
                    </TableRow>
                    
                    {/* Equity */}
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={2} className="font-medium">Equity</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Contributed Capital - New Investors</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.newInvestorsCapital)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Contributed Capital - ZEN</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.zenContribution)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Repayment of Contributed Capital - AssetCo</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.assetCoRepayment)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Retained Earnings</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedBalanceSheet.retainedEarnings)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-blue-50">
                      <TableCell className="font-bold">TOTAL EQUITY</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(selectedBalanceSheet.totalEquity)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          {/* Balance Check */}
          <div className={`mt-4 p-2 text-center rounded ${selectedBalanceSheet.balanceCheck ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {selectedBalanceSheet.balanceCheck 
              ? '✅ Balance Sheet Balanced: Assets = Liabilities + Equity' 
              : '❌ Warning: Balance Sheet Unbalanced!'}
          </div>
          
          {/* Enhanced Debug Information */}
          <div className="mt-4 space-y-3">
            {/* Debt Composition */}
            {selectedBalanceSheet.debtComposition && (
              <div className="p-3 bg-gray-50 border rounded text-sm">
                <p><strong>Debt Composition:</strong> {selectedBalanceSheet.debtComposition.description}</p>
                <p><strong>Phase:</strong> {selectedBalanceSheet.debtComposition.phase}</p>
                {selectedBalanceSheet.debtComposition.principalPayment && (
                  <p><strong>Principal Payment:</strong> {formatCurrency(selectedBalanceSheet.debtComposition.principalPayment)}</p>
                )}
              </div>
            )}
            
            {/* Deferred Tax Breakdown */}
            {selectedBalanceSheet.deferredTaxBreakdown && (
              <div className="p-3 bg-blue-50 border rounded text-sm">
                <p className="font-medium mb-2">Deferred Tax Analysis:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Depreciation Differences:</strong></p>
                    <p>• DT Asset: {formatCurrency(selectedBalanceSheet.deferredTaxBreakdown.depreciationDifferences.asset)}</p>
                    <p>• DT Liability: {formatCurrency(selectedBalanceSheet.deferredTaxBreakdown.depreciationDifferences.liability)}</p>
                  </div>
                  <div>
                    <p><strong>Tax Loss Carryforwards:</strong></p>
                    <p>• DT Asset: {formatCurrency(selectedBalanceSheet.deferredTaxBreakdown.lossCarryforwards)}</p>
                    <p>• Unused Losses: {formatCurrency(selectedBalanceSheet.deferredTaxBreakdown.unusedLosses)}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Technical Debug Info */}
            {selectedBalanceSheet.deferredTaxDebug && (
              <div className="p-3 bg-yellow-50 border rounded text-xs">
                <p className="font-medium mb-1">Technical Details:</p>
                <p>Tax Rate: {selectedBalanceSheet.deferredTaxDebug.corporateTaxRate}%</p>
                <p>Book Depreciation: {formatCurrency(selectedBalanceSheet.deferredTaxDebug.cumulativeBookDepreciation)}</p>
                <p>Tax Depreciation: {formatCurrency(selectedBalanceSheet.deferredTaxDebug.cumulativeTaxDepreciation)}</p>
                <p>Temporary Difference: {formatCurrency(selectedBalanceSheet.deferredTaxDebug.temporaryDifference)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformBalanceSheet;