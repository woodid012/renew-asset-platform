'use client'

// ============================================================================
// SEGMENT 3: DEBT SIZING & PROJECT FINANCE ENGINE
// ============================================================================

/**
 * Debt Sizing & Project Finance Engine
 * Handles sophisticated debt sizing with:
 * - Monthly debt service calculations
 * - Grace periods during construction
 * - Sculpted debt service profiles
 * - DSCR-constrained debt sizing
 * - Multiple debt structures (amortization vs sculpting)
 */

// Calculate monthly OPEX with escalation
export const calculateMonthlyOpex = (asset, financialParams, year, month, analysisStartYear) => {
  const yearsSinceStart = year - analysisStartYear;
  const monthIndex = (yearsSinceStart * 12) + (month - 1); // 0-based month index from asset start
  
  // Apply escalation factor
  const escalationFactor = Math.pow(1 + financialParams.opexEscalation / 100, monthIndex / 12);
  const monthlyOpex = (financialParams.annualOpex / 12) * escalationFactor;
  
  return {
    monthlyOpex: Number(monthlyOpex.toFixed(6)),
    escalationFactor: Number(escalationFactor.toFixed(4)),
    annualizedOpex: Number((monthlyOpex * 12).toFixed(3))
  };
};

// Determine if month should have grace period
export const shouldApplyGracePeriod = (phase, analysisStartYear, year, month, constructionMonths) => {
  // Grace periods can apply during:
  // 1. Construction phase (always)
  // 2. First partial operational quarter (if asset starts mid-quarter)
  
  if (phase === 'construction') {
    return {
      isGracePeriod: true,
      reason: 'construction_phase',
      description: 'Construction phase - debt service suspended'
    };
  }
  
  if (phase === 'operations') {
    const assetStartDate = new Date(analysisStartYear, 0, 1); // Assuming Jan 1 start for simplicity
    const periodDate = new Date(year, month - 1, 1);
    
    // Check if this is the first operational quarter
    const monthsSinceAssetStart = ((year - assetStartYear) * 12) + (month - 1);
    
    if (monthsSinceAssetStart < 3) { // First 3 months of operations
      return {
        isGracePeriod: true,
        reason: 'ramp_up_period',
        description: 'Operations ramp-up period - partial debt service'
      };
    }
  }
  
  return {
    isGracePeriod: false,
    reason: null,
    description: 'Normal debt service period'
  };
};

// Calculate target DSCR for a given period based on revenue mix
export const calculateTargetDSCR = (revenueData, financialParams) => {
  const totalRevenue = revenueData.totalRevenue;
  
  if (totalRevenue <= 0) {
    return financialParams.targetDSCRMerchant; // Default to merchant DSCR
  }
  
  const contractedRevenue = revenueData.contractedGreenRevenue + revenueData.contractedEnergyRevenue;
  const merchantRevenue = revenueData.merchantGreenRevenue + revenueData.merchantEnergyRevenue;
  
  const contractedShare = contractedRevenue / totalRevenue;
  const merchantShare = merchantRevenue / totalRevenue;
  
  const blendedDSCR = (contractedShare * financialParams.targetDSCRContract) + 
                     (merchantShare * financialParams.targetDSCRMerchant);
  
  return Math.max(blendedDSCR, 1.05); // Minimum DSCR of 1.05x
};

// Calculate sculpted debt service for a specific month
export const calculateMonthlyDebtService = (
  outstandingBalance, 
  operatingCashFlow, 
  targetDSCR, 
  interestRate, 
  gracePeriodInfo
) => {
  const monthlyInterestRate = interestRate / 12;
  
  // Calculate monthly interest
  const monthlyInterest = outstandingBalance * monthlyInterestRate;
  
  // Handle grace periods
  if (gracePeriodInfo.isGracePeriod) {
    if (gracePeriodInfo.reason === 'construction_phase') {
      // During construction, interest capitalizes to balance
      return {
        monthlyInterest,
        monthlyPrincipal: 0,
        monthlyDebtService: 0,
        newBalance: outstandingBalance + monthlyInterest, // Interest capitalizes
        actualDSCR: null,
        isCapitalized: true
      };
    } else if (gracePeriodInfo.reason === 'ramp_up_period') {
      // During ramp-up, partial debt service (interest only)
      return {
        monthlyInterest,
        monthlyPrincipal: 0,
        monthlyDebtService: monthlyInterest,
        newBalance: outstandingBalance,
        actualDSCR: operatingCashFlow > 0 ? operatingCashFlow / monthlyInterest : null,
        isCapitalized: false
      };
    }
  }
  
  // Normal operations - sculpted debt service
  if (operatingCashFlow <= 0 || targetDSCR <= 0) {
    // No cash flow or invalid DSCR - interest only
    return {
      monthlyInterest,
      monthlyPrincipal: 0,
      monthlyDebtService: monthlyInterest,
      newBalance: outstandingBalance,
      actualDSCR: null,
      isCapitalized: false
    };
  }
  
  // Calculate maximum allowable debt service based on DSCR
  const maxDebtService = operatingCashFlow / targetDSCR;
  
  // Calculate principal payment (cannot exceed remaining balance)
  const maxPrincipal = Math.max(0, maxDebtService - monthlyInterest);
  const monthlyPrincipal = Math.min(maxPrincipal, outstandingBalance);
  
  const monthlyDebtService = monthlyInterest + monthlyPrincipal;
  const newBalance = outstandingBalance - monthlyPrincipal;
  const actualDSCR = monthlyDebtService > 0 ? operatingCashFlow / monthlyDebtService : null;
  
  return {
    monthlyInterest: Number(monthlyInterest.toFixed(6)),
    monthlyPrincipal: Number(monthlyPrincipal.toFixed(6)),
    monthlyDebtService: Number(monthlyDebtService.toFixed(6)),
    newBalance: Number(Math.max(0, newBalance).toFixed(6)),
    actualDSCR: actualDSCR ? Number(actualDSCR.toFixed(3)) : null,
    isCapitalized: false
  };
};

// Test debt amount for feasibility over full tenor
export const testDebtFeasibility = (
  debtAmount, 
  monthlyRevenueData, 
  financialParams, 
  analysisStartYear,
  constructionMonths
) => {
  const tenorMonths = financialParams.tenorYears * 12;
  let currentBalance = debtAmount;
  let totalDebtService = 0;
  let minDSCR = Infinity;
  let debtServiceSchedule = [];
  let fullyRepaid = false;
  
  // Process each month
  for (let monthIndex = 0; monthIndex < monthlyRevenueData.length; monthIndex++) {
    const monthData = monthlyRevenueData[monthIndex];
    const { year, month, phase } = monthData;
    
    // Calculate monthly OPEX
    const opexData = calculateMonthlyOpex(
      monthData.asset, 
      financialParams, 
      year, 
      month, 
      analysisStartYear
    );
    
    // Calculate operating cash flow
    const operatingCashFlow = monthData.revenueData.totalRevenue - opexData.monthlyOpex;
    
    // Determine grace period status
    const gracePeriodInfo = shouldApplyGracePeriod(
      phase, 
      analysisStartYear, 
      year, 
      month, 
      constructionMonths
    );
    
    // Calculate target DSCR
    const targetDSCR = calculateTargetDSCR(monthData.revenueData, financialParams);
    
    // Calculate debt service for this month
    if (currentBalance > 0.001) { // Only if debt remains
      const debtServiceResult = calculateMonthlyDebtService(
        currentBalance,
        operatingCashFlow,
        targetDSCR,
        financialParams.interestRate,
        gracePeriodInfo
      );
      
      currentBalance = debtServiceResult.newBalance;
      totalDebtService += debtServiceResult.monthlyDebtService;
      
      // Track minimum DSCR (only for operational periods)
      if (phase === 'operations' && debtServiceResult.actualDSCR && 
          debtServiceResult.actualDSCR > 0 && !gracePeriodInfo.isGracePeriod) {
        minDSCR = Math.min(minDSCR, debtServiceResult.actualDSCR);
      }
      
      debtServiceSchedule.push({
        monthIndex,
        year,
        month,
        phase,
        operatingCashFlow,
        targetDSCR,
        ...debtServiceResult,
        gracePeriodInfo
      });
    }
    
    // Stop processing if we've reached the tenor limit
    if (monthIndex >= tenorMonths) {
      break;
    }
  }
  
  fullyRepaid = currentBalance < 0.001;
  const avgDebtService = debtServiceSchedule.length > 0 ? totalDebtService / debtServiceSchedule.length : 0;
  
  return {
    debtAmount,
    fullyRepaid,
    finalBalance: currentBalance,
    totalDebtService,
    avgDebtService,
    minDSCR: minDSCR === Infinity ? null : minDSCR,
    debtServiceSchedule,
    feasible: fullyRepaid && (minDSCR === Infinity || minDSCR >= 1.0)
  };
};

// Solve for optimal debt amount using binary search
export const solveOptimalDebt = (
  monthlyRevenueData,
  financialParams,
  analysisStartYear,
  constructionMonths
) => {
  const maxDebtAmount = financialParams.totalCapex * financialParams.maxGearing;
  
  let lowerBound = 0;
  let upperBound = maxDebtAmount;
  let bestResult = null;
  
  const tolerance = 0.001; // $1k precision
  const maxIterations = 50;
  let iterations = 0;
  
  console.log(`Solving optimal debt for ${financialParams.totalCapex.toFixed(2)}M CAPEX with ${(financialParams.maxGearing * 100).toFixed(1)}% max gearing...`);
  
  while (iterations < maxIterations && (upperBound - lowerBound) > tolerance) {
    const currentDebt = (lowerBound + upperBound) / 2;
    
    testResult = testDebtFeasibility(
        currentDebt,
        monthlyRevenueData,
        financialParams,
        analysisStartYear,
        constructionMonths
      );
    
    if (testResult.feasible) {
      // This debt level works, try higher
      lowerBound = currentDebt;
      bestResult = testResult;
    } else {
      // This debt level doesn't work, try lower
      upperBound = currentDebt;
    }
    
    iterations++;
  }
  
  // If no feasible solution found, use conservative fallback
  if (!bestResult) {
    const conservativeDebt = maxDebtAmount * 0.5;
    bestResult = testDebtFeasibility(
      conservativeDebt,
      monthlyRevenueData,
      financialParams,
      analysisStartYear,
      constructionMonths
    );
  }
  
  const calculatedGearing = bestResult.debtAmount / financialParams.totalCapex;
  
  console.log(`Optimal debt solved: ${bestResult.debtAmount.toFixed(2)}M (${(calculatedGearing * 100).toFixed(1)}% gearing) in ${iterations} iterations`);
  
  return {
    ...bestResult,
    calculatedGearing,
    equityAmount: financialParams.totalCapex - bestResult.debtAmount,
    iterations
  };
};

// Calculate construction cash flows
export const calculateConstructionCashFlows = (
  financialParams,
  analysisStartYear,
  constructionMonths,
  debtAmount
) => {
  const constructionCashFlows = [];
  const monthlyCapexSpend = financialParams.totalCapex / constructionMonths;
  const monthlyDebtDrawdown = debtAmount / constructionMonths;
  const equityAmount = financialParams.totalCapex - debtAmount;
  
  if (financialParams.equityTimingUpfront) {
    // Upfront equity payment in first month
    constructionCashFlows.push({
      monthIndex: 0,
      year: analysisStartYear - Math.ceil(constructionMonths / 12),
      month: 1,
      phase: 'construction',
      monthlyCapexSpend,
      monthlyDebtDrawdown,
      monthlyEquityContribution: equityAmount, // All equity in first month
      cumulativeCapexSpent: monthlyCapexSpend,
      cumulativeEquityContributed: equityAmount,
      cumulativeDebtDrawdown: monthlyDebtDrawdown
    });
    
    // Remaining construction months with debt drawdown only
    for (let i = 1; i < constructionMonths; i++) {
      const prevMonth = constructionCashFlows[i - 1];
      constructionCashFlows.push({
        monthIndex: i,
        year: prevMonth.year + Math.floor((prevMonth.month + 1 - 1) / 12),
        month: ((prevMonth.month) % 12) + 1,
        phase: 'construction',
        monthlyCapexSpend,
        monthlyDebtDrawdown,
        monthlyEquityContribution: 0, // No additional equity
        cumulativeCapexSpent: prevMonth.cumulativeCapexSpent + monthlyCapexSpend,
        cumulativeEquityContributed: prevMonth.cumulativeEquityContributed,
        cumulativeDebtDrawdown: prevMonth.cumulativeDebtDrawdown + monthlyDebtDrawdown
      });
    }
  } else {
    // Pro-rata equity during construction
    const monthlyEquityContribution = equityAmount / constructionMonths;
    
    for (let i = 0; i < constructionMonths; i++) {
      const year = analysisStartYear - Math.ceil((constructionMonths - i) / 12);
      const month = 12 - ((constructionMonths - i - 1) % 12);
      
      constructionCashFlows.push({
        monthIndex: i,
        year,
        month,
        phase: 'construction',
        monthlyCapexSpend,
        monthlyDebtDrawdown,
        monthlyEquityContribution,
        cumulativeCapexSpent: (i + 1) * monthlyCapexSpend,
        cumulativeEquityContributed: (i + 1) * monthlyEquityContribution,
        cumulativeDebtDrawdown: (i + 1) * monthlyDebtDrawdown
      });
    }
  }
  
  return constructionCashFlows;
};

// Calculate equity cash flows incorporating construction timing
export const calculateEquityCashFlowArray = (
  constructionCashFlows,
  operationalResults,
  financialParams,
  includeTerminalValue = true
) => {
  const equityCashFlows = [];
  
  // Construction phase cash flows
  constructionCashFlows.forEach(month => {
    // Equity cash flow = -(Equity Contribution) + Debt Drawdown
    // Note: This represents the net cash requirement from equity investors
    const netEquityCashFlow = -month.monthlyEquityContribution + month.monthlyDebtDrawdown;
    equityCashFlows.push(netEquityCashFlow);
  });
  
  // Operational phase cash flows
  operationalResults.debtServiceSchedule.forEach((month, index) => {
    // Equity cash flow = Operating Cash Flow - Debt Service
    const equityCashFlow = month.operatingCashFlow - month.monthlyDebtService;
    
    // Add terminal value in the final operational period
    let terminalValue = 0;
    if (includeTerminalValue && 
        index === operationalResults.debtServiceSchedule.length - 1 && 
        financialParams.terminalValue > 0) {
      terminalValue = financialParams.terminalValue;
    }
    
    equityCashFlows.push(equityCashFlow + terminalValue);
  });
  
  return equityCashFlows;
};

// Calculate IRR using Newton-Raphson method
export const calculateIRR = (cashflows, guess = 0.1) => {
  if (!cashflows || cashflows.length < 2) {
    console.log('IRR calculation: Invalid cash flows array', { length: cashflows?.length });
    return null;
  }
  
  // Check for any negative initial flows (investments)
  const hasNegativeFlows = cashflows.some(cf => cf < 0);
  const hasPositiveFlows = cashflows.some(cf => cf > 0);
  
  if (!hasNegativeFlows || !hasPositiveFlows) {
    console.warn('IRR calculation: Need both negative and positive cash flows');
    return null;
  }
  
  const maxIterations = 1000;
  const tolerance = 0.000001;
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivativeNPV = 0;
    
    for (let j = 0; j < cashflows.length; j++) {
      const factor = Math.pow(1 + rate, j);
      npv += cashflows[j] / factor;
      if (j > 0) {
        derivativeNPV -= (j * cashflows[j]) / (factor * (1 + rate));
      }
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate;
    }
    
    if (Math.abs(derivativeNPV) < tolerance) {
      break;
    }
    
    const newRate = rate - npv / derivativeNPV;
    
    if (newRate < -0.99 || newRate > 5.0) {
      break;
    }
    
    rate = newRate;
  }
  
  console.log('IRR calculation failed to converge');
  return null;
};

// Main debt sizing and project finance function
export const calculateProjectFinanceMetrics = (
  monthlyRevenueData,
  financialParams,
  analysisStartYear,
  analysisConfig
) => {
  const constructionMonths = financialParams.constructionDuration;
  
  console.log('Starting project finance calculations...');
  console.log('Financial parameters:', {
    totalCapex: financialParams.totalCapex,
    maxGearing: financialParams.maxGearing * 100 + '%',
    constructionMonths,
    equityTimingUpfront: financialParams.equityTimingUpfront
  });
  
  let debtResults;
  
  if (analysisConfig.solveOptimalGearing) {
    // Solve for optimal debt amount
    debtResults = solveOptimalDebt(
      monthlyRevenueData,
      financialParams,
      analysisStartYear,
      constructionMonths
    );
  } else {
    // Use configured gearing
    const configuredDebtAmount = financialParams.totalCapex * financialParams.maxGearing;
    debtResults = testDebtFeasibility(
      configuredDebtAmount,
      monthlyRevenueData,
      financialParams,
      analysisStartYear,
      constructionMonths
    );
    debtResults.calculatedGearing = configuredDebtAmount / financialParams.totalCapex;
    debtResults.equityAmount = financialParams.totalCapex - configuredDebtAmount;
  }
  
  // Calculate construction cash flows
  const constructionCashFlows = calculateConstructionCashFlows(
    financialParams,
    assetStartYear,
    constructionMonths,
    debtResults.debtAmount
  );
  
  // Calculate equity cash flow array
  const equityCashFlows = calculateEquityCashFlowArray(
    constructionCashFlows,
    debtResults,
    financialParams,
    analysisConfig.includeTerminalValue
  );
  
  // Calculate financial metrics
  const equityIRR = calculateIRR(equityCashFlows);
  const totalEquityInvested = Math.abs(equityCashFlows.filter(cf => cf < 0).reduce((sum, cf) => sum + cf, 0));
  const totalEquityReturns = equityCashFlows.filter(cf => cf > 0).reduce((sum, cf) => sum + cf, 0);
  
  return {
    // Capital structure
    totalCapex: financialParams.totalCapex,
    debtAmount: debtResults.debtAmount,
    equityAmount: debtResults.equityAmount,
    calculatedGearing: debtResults.calculatedGearing,
    
    // Debt metrics
    fullyRepaid: debtResults.fullyRepaid,
    minDSCR: debtResults.minDSCR,
    avgDebtService: debtResults.avgDebtService,
    debtServiceSchedule: debtResults.debtServiceSchedule,
    
    // Construction metrics
    constructionCashFlows,
    constructionMonths,
    equityTimingUpfront: financialParams.equityTimingUpfront,
    
    // Equity returns
    equityCashFlows,
    equityIRR: equityIRR ? equityIRR * 100 : null,
    totalEquityInvested,
    totalEquityReturns,
    equityMultiple: totalEquityInvested > 0 ? totalEquityReturns / totalEquityInvested : 0,
    
    // Terminal value
    terminalValue: analysisConfig.includeTerminalValue ? financialParams.terminalValue : 0,
    
    // Calculation metadata
    iterations: debtResults.iterations || 0,
    solved: debtResults.feasible,
    calculationDate: new Date().toISOString()
  };
};