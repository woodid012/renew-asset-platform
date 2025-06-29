// IntegrationEngine.js
// ============================================================================
// SEGMENT 4: INTEGRATION ENGINE & RESULTS DISPLAY
// ============================================================================

'use client'

/**
 * Integration Engine & Results Display
 * Combines all previous segments into a complete monthly cash flow analysis
 * with detailed results display and export capabilities
 */

import { useState, useEffect, useMemo } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, FileText, AlertCircle, CheckCircle } from 'lucide-react';

// Import all functions from the revenue calculation engine
import {
  calculateMonthlyAssetRevenue,
  getMonthlyCapacityFactor,
  calculateMonthlyGeneration,
  processMonthlyContracts
} from './RevenueEngine';

// Import all functions from the debt finance engine
import {
  calculateProjectFinanceMetrics,
  solveOptimalDebt,
  calculateEquityCashFlowArray,
  calculateIRR
} from './DebtEngine';

// Main integration function that combines all segments
export const generateCompleteMonthlyCashFlowAnalysis = async (
  asset,
  assetCosts,
  constants,
  getMerchantPrice,
  analysisConfig
) => {
  console.log(`Starting complete monthly analysis for ${asset.name}...`);
  
  try {
    // Phase 1: Create financial parameters
    const financialParams = {
      totalCapex: assetCosts.capex || 0,
      maxGearing: assetCosts.maxGearing || 0.70,
      debtAmount: 0, // Will be calculated
      equityAmount: 0, // Will be calculated
      constructionDuration: assetCosts.constructionDuration || 18,
      equityTimingUpfront: assetCosts.equityTimingUpfront !== false,
      interestRate: assetCosts.interestRate || 0.06,
      tenorYears: assetCosts.tenorYears || 15,
      targetDSCRContract: assetCosts.targetDSCRContract || 1.35,
      targetDSCRMerchant: assetCosts.targetDSCRMerchant || 2.00,
      debtStructure: assetCosts.debtStructure || 'sculpting',
      annualOpex: assetCosts.operatingCosts || 0,
      opexEscalation: assetCosts.operatingCostEscalation || 2.5,
      terminalValue: assetCosts.terminalValue || 0,
      capacity: parseFloat(asset.capacity) || 0,
      assetLife: parseInt(asset.assetLife) || 25,
      annualDegradation: parseFloat(asset.annualDegradation) || 0.5,
      volumeLossAdjustment: parseFloat(asset.volumeLossAdjustment) || 95
    };
    
    // Phase 2: Generate time periods from construction start
    const assetStartDate = new Date(asset.assetStartDate);
    const assetStartYear = assetStartDate.getFullYear();
    const assetStartMonth = assetStartDate.getMonth() + 1; // 1-based month

    // Calculate construction start from actual construction start date if available
    let constructionStartDate;
    let constructionStartYear;
    let constructionStartMonth;
    
    if (asset.constructionStartDate) {
      constructionStartDate = new Date(asset.constructionStartDate);
      constructionStartYear = constructionStartDate.getFullYear();
      constructionStartMonth = constructionStartDate.getMonth() + 1; // 1-based month
    } else {
      // Fallback: calculate from asset start minus construction duration
      constructionStartDate = new Date(assetStartDate);
      constructionStartDate.setMonth(constructionStartDate.getMonth() - financialParams.constructionDuration);
      constructionStartYear = constructionStartDate.getFullYear();
      constructionStartMonth = constructionStartDate.getMonth() + 1; // 1-based month
    }
    
    const analysisStartYear = constructionStartYear;
    
    const analysisEndYear = assetStartYear + analysisConfig.analysisYears;
    
    console.log('Timeline calculation:', {
      assetStartDate: asset.assetStartDate,
      constructionStartDate: asset.constructionStartDate,
      calculatedConstructionStart: constructionStartDate.toISOString().split('T')[0],
      assetStartYear,
      assetStartMonth,
      constructionStartYear,
      constructionStartMonth,
      constructionDuration: financialParams.constructionDuration,
      analysisEndYear
    });
    
    const monthlyPeriods = [];
    let monthIndex = 0;
    
    // Generate all monthly periods from construction start to analysis end
    for (let year = constructionStartYear; year <= analysisEndYear; year++) {
      const startMonth = (year === constructionStartYear) ? constructionStartMonth : 1;
      const endMonth = (year === analysisEndYear) ? 12 : 12; // Could limit this if needed
      
      for (let month = startMonth; month <= endMonth; month++) {
        const periodDate = new Date(year, month - 1, 1);
        
        // Determine phase based on actual dates
        let phase = 'construction';
        if (periodDate >= assetStartDate) {
          phase = 'operations';
        }
        
        // Include all periods from construction start onwards
        monthlyPeriods.push({
          year,
          month,
          periodDate,
          phase,
          periodKey: `${year}-${month.toString().padStart(2, '0')}`,
          monthIndex: monthIndex++
        });
        
        // Stop if we've gone beyond reasonable analysis period
        if (monthIndex > (analysisConfig.analysisYears + 5) * 12) {
          console.log('Reached maximum analysis period, stopping generation');
          break;
        }
      }
      
      if (monthIndex > (analysisConfig.analysisYears + 5) * 12) break;
    }
    
    console.log(`Generated ${monthlyPeriods.length} monthly periods from ${constructionStartYear}-${constructionStartMonth.toString().padStart(2, '0')} to ${analysisEndYear}`);
    console.log('First few periods:', monthlyPeriods.slice(0, 5).map(p => ({ 
      periodKey: p.periodKey, 
      phase: p.phase,
      monthIndex: p.monthIndex 
    })));
    console.log('Phase distribution:', {
      construction: monthlyPeriods.filter(p => p.phase === 'construction').length,
      operations: monthlyPeriods.filter(p => p.phase === 'operations').length
    });
    
    // Phase 3: Calculate monthly revenues for operational periods
    const monthlyRevenueData = [];
    
    for (const period of monthlyPeriods) {
      let revenueData = {
        contractedGreenRevenue: 0,
        contractedEnergyRevenue: 0,
        merchantGreenRevenue: 0,
        merchantEnergyRevenue: 0,
        totalRevenue: 0,
        adjustedVolume: 0
      };
      
      // Only calculate revenue for operational periods
      if (period.phase === 'operations') {
        revenueData = calculateMonthlyAssetRevenue(
          asset,
          period.year,
          period.month,
          analysisStartYear,
          constants,
          getMerchantPrice,
          analysisConfig.scenarioCase
        );
      }
      
      monthlyRevenueData.push({
        ...period,
        asset,
        revenueData
      });
    }
    
    console.log(`Calculated revenue for ${monthlyRevenueData.length} periods`);
    
    // Phase 4: Calculate project finance metrics
    const projectFinanceResults = calculateProjectFinanceMetrics(
      monthlyRevenueData,
      financialParams,
      analysisStartYear,
      analysisConfig
    );
    
    // Phase 5: Build complete monthly cash flow records
    const completeMonthlyCashFlows = [];
    let cumulativeEquityCashFlow = 0;
    let outstandingDebtBalance = 0;
    
    // Process construction phase
    projectFinanceResults.constructionCashFlows.forEach((constructionMonth, index) => {
      const netConstructionCashFlow = -(constructionMonth.monthlyEquityContribution);
      cumulativeEquityCashFlow += netConstructionCashFlow;
      
      completeMonthlyCashFlows.push({
        monthIndex: index,
        periodKey: `${constructionMonth.year}-${constructionMonth.month.toString().padStart(2, '0')}`,
        year: constructionMonth.year,
        month: constructionMonth.month,
        phase: 'construction',
        
        // Revenue (zero during construction)
        grossRevenue: 0,
        contractedGreenRevenue: 0,
        contractedEnergyRevenue: 0,
        merchantGreenRevenue: 0,
        merchantEnergyRevenue: 0,
        
        // Volume and performance
        monthlyGeneration: 0,
        capacityFactor: 0,
        degradationFactor: 1.0,
        
        // Operating costs (zero during construction)
        monthlyOpex: 0,
        operatingCashFlow: 0,
        
        // Construction cash flows
        monthlyCapexSpend: constructionMonth.monthlyCapexSpend,
        monthlyEquityContribution: constructionMonth.monthlyEquityContribution,
        monthlyDebtDrawdown: constructionMonth.monthlyDebtDrawdown,
        cumulativeCapexSpent: constructionMonth.cumulativeCapexSpent,
        
        // Debt service (zero during construction)
        monthlyInterestPayment: 0,
        monthlyPrincipalPayment: 0,
        monthlyDebtService: 0,
        outstandingDebtBalance: constructionMonth.cumulativeDebtDrawdown,
        dscr: null,
        
        // Cash flow summary
        constructionCashFlow: netConstructionCashFlow,
        operationalEquityCashFlow: 0,
        terminalCashFlow: 0,
        netMonthlyCashFlow: netConstructionCashFlow,
        cumulativeEquityCashFlow,
        
        // Metadata
        isPartialMonth: false,
        gracePeriod: true,
        notes: ['Construction phase']
      });
      
      outstandingDebtBalance = constructionMonth.cumulativeDebtDrawdown;
    });
    
    // Process operational phase
    projectFinanceResults.debtServiceSchedule.forEach((debtMonth, index) => {
      const monthlyPeriod = monthlyRevenueData.find(p => 
        p.year === debtMonth.year && p.month === debtMonth.month
      );
      
      if (!monthlyPeriod) return;
      
      // Calculate monthly OPEX with escalation
      const yearsSinceStart = debtMonth.year - analysisStartYear;
      const monthsSinceStart = (yearsSinceStart * 12) + (debtMonth.month - 1);
      const escalationFactor = Math.pow(1 + financialParams.opexEscalation / 100, monthsSinceStart / 12);
      const monthlyOpex = (financialParams.annualOpex / 12) * escalationFactor;
      
      // Operating cash flow
      const operatingCashFlow = monthlyPeriod.revenueData.totalRevenue - monthlyOpex;
      
      // Equity cash flow
      const operationalEquityCashFlow = operatingCashFlow - debtMonth.monthlyDebtService;
      
      // Terminal value (only in final period)
      let terminalCashFlow = 0;
      if (index === projectFinanceResults.debtServiceSchedule.length - 1 && 
          projectFinanceResults.terminalValue > 0) {
        terminalCashFlow = projectFinanceResults.terminalValue;
      }
      
      const netMonthlyCashFlow = operationalEquityCashFlow + terminalCashFlow;
      cumulativeEquityCashFlow += netMonthlyCashFlow;
      
      // Get generation data for display
      const generationData = monthlyPeriod.revenueData.generationData || {};
      
      completeMonthlyCashFlows.push({
        monthIndex: completeMonthlyCashFlows.length,
        periodKey: `${debtMonth.year}-${debtMonth.month.toString().padStart(2, '0')}`,
        year: debtMonth.year,
        month: debtMonth.month,
        phase: 'operations',
        
        // Revenue components
        grossRevenue: monthlyPeriod.revenueData.totalRevenue,
        contractedGreenRevenue: monthlyPeriod.revenueData.contractedGreenRevenue,
        contractedEnergyRevenue: monthlyPeriod.revenueData.contractedEnergyRevenue,
        merchantGreenRevenue: monthlyPeriod.revenueData.merchantGreenRevenue,
        merchantEnergyRevenue: monthlyPeriod.revenueData.merchantEnergyRevenue,
        
        // Volume and performance
        monthlyGeneration: monthlyPeriod.revenueData.adjustedVolume || 0,
        capacityFactor: generationData.capacityFactor || 0,
        degradationFactor: generationData.degradationFactor || 1.0,
        
        // Operating costs
        monthlyOpex,
        operatingCashFlow,
        
        // Construction (zero during operations)
        monthlyCapexSpend: 0,
        monthlyEquityContribution: 0,
        monthlyDebtDrawdown: 0,
        cumulativeCapexSpent: financialParams.totalCapex,
        
        // Debt service
        monthlyInterestPayment: debtMonth.monthlyInterest,
        monthlyPrincipalPayment: debtMonth.monthlyPrincipal,
        monthlyDebtService: debtMonth.monthlyDebtService,
        outstandingDebtBalance: debtMonth.newBalance,
        dscr: debtMonth.actualDSCR,
        
        // Cash flow summary
        constructionCashFlow: 0,
        operationalEquityCashFlow,
        terminalCashFlow,
        netMonthlyCashFlow,
        cumulativeEquityCashFlow,
        
        // Metadata
        isPartialMonth: false,
        gracePeriod: debtMonth.gracePeriodInfo?.isGracePeriod || false,
        notes: debtMonth.gracePeriodInfo?.isGracePeriod ? [debtMonth.gracePeriodInfo.description] : []
      });
    });
    
    // Phase 6: Calculate summary metrics
    const summaryMetrics = {
      // Asset info
      assetName: asset.name,
      assetType: asset.type,
      capacity: financialParams.capacity,
      assetLife: financialParams.assetLife,
      
      // Capital structure
      totalCapex: projectFinanceResults.totalCapex,
      debtAmount: projectFinanceResults.debtAmount,
      equityAmount: projectFinanceResults.equityAmount,
      calculatedGearing: projectFinanceResults.calculatedGearing,
      
      // Financial metrics
      equityIRR: projectFinanceResults.equityIRR,
      minDSCR: projectFinanceResults.minDSCR,
      avgDebtService: projectFinanceResults.avgDebtService,
      equityMultiple: projectFinanceResults.equityMultiple,
      
      // Revenue summary
      totalRevenue: completeMonthlyCashFlows
        .filter(m => m.phase === 'operations')
        .reduce((sum, m) => sum + m.grossRevenue, 0),
      totalOpex: completeMonthlyCashFlows
        .filter(m => m.phase === 'operations')
        .reduce((sum, m) => sum + m.monthlyOpex, 0),
      totalDebtService: completeMonthlyCashFlows
        .filter(m => m.phase === 'operations')
        .reduce((sum, m) => sum + m.monthlyDebtService, 0),
      totalEquityReturns: completeMonthlyCashFlows
        .filter(m => m.netMonthlyCashFlow > 0)
        .reduce((sum, m) => sum + m.netMonthlyCashFlow, 0),
      
      // Construction summary
      constructionDuration: financialParams.constructionDuration,
      equityTimingUpfront: financialParams.equityTimingUpfront,
      totalEquityInvested: Math.abs(completeMonthlyCashFlows
        .filter(m => m.phase === 'construction')
        .reduce((sum, m) => sum + m.constructionCashFlow, 0)),
      
      // Terminal value
      terminalValue: projectFinanceResults.terminalValue,
      
      // Calculation metadata
      totalMonths: completeMonthlyCashFlows.length,
      constructionMonths: completeMonthlyCashFlows.filter(m => m.phase === 'construction').length,
      operationalMonths: completeMonthlyCashFlows.filter(m => m.phase === 'operations').length,
      fullyRepaid: projectFinanceResults.fullyRepaid,
      solved: projectFinanceResults.solved,
      calculationDate: new Date().toISOString()
    };
    
    console.log('Monthly cash flow analysis completed successfully');
    console.log('Summary:', {
      totalMonths: completeMonthlyCashFlows.length,
      constructionMonths: summaryMetrics.constructionMonths,
      operationalMonths: summaryMetrics.operationalMonths,
      equityIRR: summaryMetrics.equityIRR,
      totalRevenue: summaryMetrics.totalRevenue,
      calculatedGearing: summaryMetrics.calculatedGearing * 100
    });
    
    return {
      monthlyCashFlows: completeMonthlyCashFlows,
      summaryMetrics,
      projectFinanceResults,
      financialParams,
      analysisConfig
    };
    
  } catch (error) {
    console.error('Monthly cash flow analysis error:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
};

// Export monthly cash flows to CSV
export const exportMonthlyCashFlowsToCSV = (results) => {
  const headers = [
    'Period', 'Year', 'Month', 'Phase',
    'Revenue ($M)', 'Contracted Green ($M)', 'Contracted Energy ($M)', 
    'Merchant Green ($M)', 'Merchant Energy ($M)',
    'Generation (MWh)', 'Capacity Factor (%)', 'Degradation Factor',
    'OPEX ($M)', 'Operating CF ($M)',
    'Construction CF ($M)', 'Equity Contribution ($M)', 'Debt Drawdown ($M)',
    'Interest Payment ($M)', 'Principal Payment ($M)', 'Debt Service ($M)',
    'Outstanding Debt ($M)', 'DSCR',
    'Operational Equity CF ($M)', 'Terminal Value ($M)', 'Net CF ($M)',
    'Cumulative Equity CF ($M)', 'Grace Period', 'Notes'
  ];
  
  const rows = [headers.join(',')];
  
  results.monthlyCashFlows.forEach(month => {
    const row = [
      month.periodKey,
      month.year,
      month.month,
      month.phase,
      month.grossRevenue.toFixed(3),
      month.contractedGreenRevenue.toFixed(3),
      month.contractedEnergyRevenue.toFixed(3),
      month.merchantGreenRevenue.toFixed(3),
      month.merchantEnergyRevenue.toFixed(3),
      month.monthlyGeneration.toFixed(0),
      (month.capacityFactor * 100).toFixed(1),
      month.degradationFactor.toFixed(4),
      month.monthlyOpex.toFixed(3),
      month.operatingCashFlow.toFixed(3),
      month.constructionCashFlow.toFixed(3),
      month.monthlyEquityContribution.toFixed(3),
      month.monthlyDebtDrawdown.toFixed(3),
      month.monthlyInterestPayment.toFixed(3),
      month.monthlyPrincipalPayment.toFixed(3),
      month.monthlyDebtService.toFixed(3),
      month.outstandingDebtBalance.toFixed(3),
      month.dscr ? month.dscr.toFixed(2) : '',
      month.operationalEquityCashFlow.toFixed(3),
      month.terminalCashFlow.toFixed(3),
      month.netMonthlyCashFlow.toFixed(3),
      month.cumulativeEquityCashFlow.toFixed(3),
      month.gracePeriod ? 'Yes' : 'No',
      `"${month.notes.join('; ')}"`
    ];
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
};

// React component for displaying detailed results
export const MonthlyCashFlowResults = ({ results, onExport }) => {
  const [viewMode, setViewMode] = useState('summary'); // summary, construction, operations, debt
  const [expandedYear, setExpandedYear] = useState(null);
  
  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="text-center text-gray-500 py-8">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No results available</p>
          <p className="text-sm">Run the analysis to see detailed cash flows</p>
        </div>
      </div>
    );
  }
  
  const { monthlyCashFlows, summaryMetrics } = results;
  
  // Group cash flows by year for display
  const cashFlowsByYear = useMemo(() => {
    const grouped = {};
    monthlyCashFlows.forEach(month => {
      if (!grouped[month.year]) {
        grouped[month.year] = [];
      }
      grouped[month.year].push(month);
    });
    return grouped;
  }, [monthlyCashFlows]);
  
  const formatCurrency = (value) => {
    if (Math.abs(value) >= 1) {
      return `$${value.toFixed(1)}M`;
    } else {
      return `$${(value * 1000).toFixed(0)}K`;
    }
  };
  
  const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;
  
  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Analysis Summary</h3>
          <div className="flex items-center space-x-2">
            {summaryMetrics.solved ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <span className="text-sm text-gray-600">
              {summaryMetrics.solved ? 'Solved' : 'Warning'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-lg font-bold text-blue-900">
              {formatCurrency(summaryMetrics.totalCapex)}
            </p>
            <p className="text-xs text-blue-600">Total CAPEX</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-lg font-bold text-purple-900">
              {formatPercent(summaryMetrics.calculatedGearing)}
            </p>
            <p className="text-xs text-purple-600">Calculated Gearing</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-lg font-bold text-green-900">
              {summaryMetrics.equityIRR ? `${summaryMetrics.equityIRR.toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-xs text-green-600">Equity IRR</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-lg font-bold text-yellow-900">
              {formatCurrency(summaryMetrics.totalRevenue)}
            </p>
            <p className="text-xs text-yellow-600">Total Revenue</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-lg font-bold text-red-900">
              {summaryMetrics.minDSCR ? `${summaryMetrics.minDSCR.toFixed(2)}x` : 'N/A'}
            </p>
            <p className="text-xs text-red-600">Min DSCR</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-lg font-bold text-orange-900">
              {summaryMetrics.totalMonths}
            </p>
            <p className="text-xs text-orange-600">Total Months</p>
          </div>
        </div>
      </div>
      
      {/* View Mode Selector */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Monthly Cash Flow Detail</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onExport && onExport(results)}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
        
        <div className="flex space-x-1 mb-4">
          {[
            { key: 'summary', label: 'Summary' },
            { key: 'construction', label: 'Construction' },
            { key: 'operations', label: 'Operations' },
            { key: 'debt', label: 'Debt Schedule' }
          ].map(mode => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key)}
              className={`px-3 py-2 text-sm rounded-md ${
                viewMode === mode.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        
        {/* Cash Flow Table */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-900">Period</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900">Phase</th>
                {viewMode === 'summary' && (
                  <>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Revenue ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">OPEX ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-purple-50">Debt Service ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">Net CF ($M)</th>
                  </>
                )}
                {viewMode === 'construction' && (
                  <>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">CAPEX Spend ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Equity ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">Debt Drawdown ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-purple-50">Net CF ($M)</th>
                  </>
                )}
                {viewMode === 'operations' && (
                  <>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Generation (MWh)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">CF (%)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-yellow-50">Revenue ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">OPEX ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-purple-50">Operating CF ($M)</th>
                  </>
                )}
                {viewMode === 'debt' && (
                  <>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-blue-50">Outstanding ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-yellow-50">Interest ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-green-50">Principal ($M)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900 bg-red-50">DSCR</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {monthlyCashFlows.slice(0, 120).map((month, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-25">
                  <td className="py-2 px-2 font-medium text-gray-900">{month.periodKey}</td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      month.phase === 'construction' 
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {month.phase}
                    </span>
                  </td>
                  
                  {viewMode === 'summary' && (
                    <>
                      <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                        {month.grossRevenue.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-600 bg-red-25">
                        {month.monthlyOpex.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-purple-600 bg-purple-25">
                        {month.monthlyDebtService.toFixed(3)}
                      </td>
                      <td className={`text-right py-2 px-2 font-medium bg-blue-25 ${
                        month.netMonthlyCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {month.netMonthlyCashFlow.toFixed(3)}
                      </td>
                    </>
                  )}
                  
                  {viewMode === 'construction' && (
                    <>
                      <td className="text-right py-2 px-2 text-blue-600 bg-blue-25">
                        {month.monthlyCapexSpend.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                        {month.monthlyEquityContribution.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-600 bg-red-25">
                        {month.monthlyDebtDrawdown.toFixed(3)}
                      </td>
                      <td className={`text-right py-2 px-2 font-medium bg-purple-25 ${
                        month.constructionCashFlow >= 0 ? 'text-purple-600' : 'text-red-600'
                      }`}>
                        {month.constructionCashFlow.toFixed(3)}
                      </td>
                    </>
                  )}
                  
                  {viewMode === 'operations' && (
                    <>
                      <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                        {month.monthlyGeneration.toFixed(0)}
                      </td>
                      <td className="text-right py-2 px-2 text-blue-600 bg-blue-25">
                        {(month.capacityFactor * 100).toFixed(1)}%
                      </td>
                      <td className="text-right py-2 px-2 text-yellow-600 bg-yellow-25">
                        {month.grossRevenue.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-600 bg-red-25">
                        {month.monthlyOpex.toFixed(3)}
                      </td>
                      <td className={`text-right py-2 px-2 font-medium bg-purple-25 ${
                        month.operatingCashFlow >= 0 ? 'text-purple-600' : 'text-red-600'
                      }`}>
                        {month.operatingCashFlow.toFixed(3)}
                      </td>
                    </>
                  )}
                  
                  {viewMode === 'debt' && (
                    <>
                      <td className="text-right py-2 px-2 text-blue-600 bg-blue-25">
                        {month.outstandingDebtBalance.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-yellow-600 bg-yellow-25">
                        {month.monthlyInterestPayment.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-green-600 bg-green-25">
                        {month.monthlyPrincipalPayment.toFixed(3)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-600 bg-red-25">
                        {month.dscr ? `${month.dscr.toFixed(2)}x` : '-'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {monthlyCashFlows.length > 120 && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            Showing first 120 of {monthlyCashFlows.length} months
          </div>
        )}
      </div>
    </div>
  );
};