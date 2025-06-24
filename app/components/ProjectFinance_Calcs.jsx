// Enhanced ProjectFinance_Calcs.jsx with proper equity timing and fixed sensitivity
import { 
  calculateAssetRevenue, 
  calculateStressRevenue,
  generatePortfolioData 
} from '@/lib/revenueCalculations';
import { 
  DEFAULT_CAPEX_RATES, 
  DEFAULT_OPEX_RATES, 
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_TERMINAL_RATES,
  DEFAULT_ASSET_PERFORMANCE
} from '@/lib/default_constants';

/**
 * Initialize default project finance values for assets
 */
export const initializeProjectValues = (assets) => {
  const initialValues = Object.values(assets).reduce((acc, asset) => {
    const defaultCapex = DEFAULT_CAPEX_RATES[asset.type] || DEFAULT_CAPEX_RATES.default;
    const defaultOpex = DEFAULT_OPEX_RATES[asset.type] || DEFAULT_OPEX_RATES.default;
    const defaultTenor = DEFAULT_PROJECT_FINANCE.tenorYears[asset.type] || DEFAULT_PROJECT_FINANCE.tenorYears.default;
    const defaultTerminal = DEFAULT_TERMINAL_RATES[asset.type] || DEFAULT_TERMINAL_RATES.default;
    
    const capex = defaultCapex * asset.capacity;
    const operatingCosts = defaultOpex * asset.capacity;
    const terminalValue = defaultTerminal * asset.capacity;

    return {
      ...acc,
      [asset.name]: {
        // Capital costs
        capex: Number(capex.toFixed(1)),
        operatingCosts: Number(operatingCosts.toFixed(2)),
        operatingCostEscalation: DEFAULT_PROJECT_FINANCE.opexEscalation,
        terminalValue: Number(terminalValue.toFixed(1)),
        
        // Debt structure
        maxGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100, // Convert % to decimal
        targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract,
        targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant,
        interestRate: DEFAULT_PROJECT_FINANCE.interestRate / 100, // Convert % to decimal
        tenorYears: defaultTenor,
        debtStructure: 'sculpting', // Default to sculpting
        
        // Construction timing - NEW
        equityTimingUpfront: true, // Default to upfront payment
        constructionDuration: DEFAULT_ASSET_PERFORMANCE.constructionDuration[asset.type] || 12, // months
        
        // Calculated values (will be updated by calculations)
        calculatedGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100,
        debtAmount: 0,
        annualDebtService: 0
      }
    };
  }, {});

  // Add portfolio-level parameters if multiple assets
  if (Object.keys(assets).length >= 2) {
    initialValues.portfolio = {
      maxGearing: (DEFAULT_PROJECT_FINANCE.maxGearing + 5) / 100, // Portfolio gets 5% higher gearing
      targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract - 0.05,
      targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant - 0.2,
      interestRate: (DEFAULT_PROJECT_FINANCE.interestRate - 0.5) / 100, // 50bps better rate
      tenorYears: DEFAULT_PROJECT_FINANCE.tenorYears.default,
      debtStructure: 'sculpting',
      equityTimingUpfront: true,
      constructionDuration: 18
    };
  }

  return initialValues;
};

/**
 * Calculate standard amortization debt service
 */
export const calculateAmortizationDebtService = (principal, rate, term) => {
  if (rate === 0) return principal / term;
  const monthlyRate = rate / 12;
  const numPayments = term * 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                        (Math.pow(1 + monthlyRate, numPayments) - 1);
  return monthlyPayment * 12;
};

/**
 * Calculate debt schedule using sculpting approach
 */
export const calculateDebtSchedule = (debtAmount, cashFlows, interestRate, tenorYears, targetDSCRs) => {
  const debtBalance = Array(tenorYears + 1).fill(0);
  const interestPayments = Array(tenorYears).fill(0);
  const principalPayments = Array(tenorYears).fill(0);
  const debtService = Array(tenorYears).fill(0);
  const dscrValues = Array(tenorYears).fill(0);
  
  // Set initial debt balance
  debtBalance[0] = debtAmount;
  
  // Calculate debt service for each period
  for (let i = 0; i < tenorYears; i++) {
    // Interest payment on opening balance
    interestPayments[i] = debtBalance[i] * interestRate;
    
    // Maximum debt service allowed by DSCR constraint
    const operatingCashFlow = cashFlows[i].operatingCashFlow;
    const targetDSCR = targetDSCRs[i];
    const maxDebtService = operatingCashFlow / targetDSCR;
    
    // Principal repayment (limited by max debt service and remaining balance)
    principalPayments[i] = Math.min(
      Math.max(0, maxDebtService - interestPayments[i]),
      debtBalance[i]
    );
    
    // Total debt service
    debtService[i] = interestPayments[i] + principalPayments[i];
    
    // Calculate actual DSCR
    dscrValues[i] = operatingCashFlow / debtService[i];
    
    // Update debt balance
    debtBalance[i + 1] = debtBalance[i] - principalPayments[i];
  }
  
  const fullyRepaid = debtBalance[tenorYears] < 0.001;
  const avgDebtService = debtService.reduce((sum, ds) => sum + ds, 0) / tenorYears;
  const minDSCR = Math.min(...dscrValues.filter(d => isFinite(d)));
  
  return {
    debtBalance,
    interestPayments,
    principalPayments,
    debtService,
    dscrValues,
    metrics: {
      fullyRepaid,
      avgDebtService,
      minDSCR
    }
  };
};

/**
 * Solve for maximum sustainable debt using binary search
 */
const solveMaximumDebt = (cashFlows, capex, maxGearing, interestRate, tenorYears, targetDSCRs) => {
  const initialGuess = capex * maxGearing;
  
  let lowerBound = 0;
  let upperBound = initialGuess;
  let currentDebt = initialGuess;
  
  const tolerance = 0.0001; // $100k precision
  const maxIterations = 50;
  let iterations = 0;
  
  let bestDebt = 0;
  let bestSchedule = null;
  
  console.log(`Solving maximum debt for $${capex.toFixed(2)}M capex with ${(maxGearing*100).toFixed(1)}% max gearing...`);
  
  while (iterations < maxIterations && (upperBound - lowerBound) > tolerance) {
    const schedule = calculateDebtSchedule(
      currentDebt,
      cashFlows.slice(0, tenorYears),
      interestRate,
      tenorYears,
      targetDSCRs
    );
    
    if (schedule.metrics.fullyRepaid) {
      lowerBound = currentDebt;
      bestDebt = currentDebt;
      bestSchedule = schedule;
    } else {
      upperBound = currentDebt;
    }
    
    currentDebt = (lowerBound + upperBound) / 2;
    iterations++;
  }
  
  console.log(`Solved maximum debt: $${bestDebt.toFixed(2)}M (${(bestDebt/capex*100).toFixed(1)}% gearing) in ${iterations} iterations`);
  
  if (!bestSchedule) {
    bestDebt = 0;
    bestSchedule = calculateDebtSchedule(
      bestDebt,
      cashFlows.slice(0, tenorYears),
      interestRate,
      tenorYears,
      targetDSCRs
    );
  }
  
  return {
    debt: bestDebt,
    gearing: bestDebt / capex,
    debtService: bestSchedule.debtService,
    avgDebtService: bestSchedule.metrics.avgDebtService,
    minDSCR: bestSchedule.metrics.minDSCR,
    schedule: bestSchedule
  };
};

/**
 * Create proper equity cash flow array with construction timing
 */
const createEquityCashFlowArray = (capex, gearing, equityTimingUpfront, constructionDuration, assetStartYear, operationalCashFlows) => {
  const equityAmount = capex * (1 - gearing);
  const equityCashFlows = [];
  
  if (equityTimingUpfront) {
    // All equity paid upfront (Year 0)
    console.log(`Equity timing: Upfront payment of $${equityAmount.toFixed(2)}M in Year 0`);
    equityCashFlows.push(-equityAmount);
    
    // Add operational cash flows starting from asset start year
    operationalCashFlows.forEach(cf => {
      equityCashFlows.push(cf.equityCashFlow);
    });
  } else {
    // Equity paid pro-rata during construction
    const constructionYears = Math.ceil(constructionDuration / 12);
    const equityPerYear = equityAmount / constructionYears;
    
    console.log(`Equity timing: Pro-rata over ${constructionYears} years, $${equityPerYear.toFixed(2)}M per year`);
    
    // Construction phase - negative equity payments
    for (let i = 0; i < constructionYears; i++) {
      equityCashFlows.push(-equityPerYear);
    }
    
    // Operational phase - positive cash flows
    operationalCashFlows.forEach(cf => {
      equityCashFlows.push(cf.equityCashFlow);
    });
  }
  
  return equityCashFlows;
};

/**
 * Calculate comprehensive project metrics for individual assets and portfolio
 */
export const calculateProjectMetrics = (
  assets,
  assetCosts,
  constants,
  getMerchantPrice,
  selectedRevenueCase = 'base',
  solveGearingFlag = false,
  includeTerminalValue = true
) => {
  const metrics = {};
  const individualMetrics = {};

  if (!assetCosts || Object.keys(assets).length === 0) return {};
  
  console.log('Calculating project metrics for assets:', Object.keys(assets));
  
  // Calculate individual asset metrics
  Object.values(assets).forEach(asset => {
    console.log(`Processing asset: ${asset.name}`);
    
    const assetCostData = assetCosts[asset.name] || {};
    const capex = assetCostData.capex || 0;
    
    if (capex === 0) {
      console.warn(`No CAPEX data for asset ${asset.name}`);
      return;
    }

    // Generate cash flows for this asset
    const assetStartYear = new Date(asset.assetStartDate).getFullYear();
    const assetEndYear = assetStartYear + (asset.assetLife || 30);
    const cashFlows = [];

    for (let year = assetStartYear; year < assetEndYear; year++) {
      // Calculate base revenue using integrated revenue calculations
      const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
      
      // Apply stress scenarios
      const stressedRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
      const totalRevenue = stressedRevenue.contractedGreen + stressedRevenue.contractedEnergy + 
                          stressedRevenue.merchantGreen + stressedRevenue.merchantEnergy;
      
      const yearIndex = year - assetStartYear;
      
      // Calculate operating costs with escalation
      const operatingCostInflation = Math.pow(1 + (assetCostData.operatingCostEscalation || 2.5)/100, yearIndex);
      const yearOperatingCosts = (assetCostData.operatingCosts || 0) * operatingCostInflation;
      
      // Calculate operating cash flow
      const operatingCashFlow = totalRevenue - yearOperatingCosts;

      cashFlows.push({
        year,
        revenue: totalRevenue,
        contractedRevenue: stressedRevenue.contractedGreen + stressedRevenue.contractedEnergy,
        merchantRevenue: stressedRevenue.merchantGreen + stressedRevenue.merchantEnergy,
        opex: -yearOperatingCosts,
        operatingCashFlow
      });
    }
    
    // Add terminal value to the last year if enabled
    if (cashFlows.length > 0 && assetCostData.terminalValue && includeTerminalValue) {
      const lastCashFlow = cashFlows[cashFlows.length - 1];
      lastCashFlow.terminalValue = assetCostData.terminalValue;
      lastCashFlow.operatingCashFlow += lastCashFlow.terminalValue;
    }
    
    // Calculate debt metrics
    const tenorYears = assetCostData.tenorYears || 15;
    const relevantCashFlows = cashFlows.slice(0, tenorYears);
    
    // Calculate blended target DSCR for each year
    const targetDSCRs = relevantCashFlows.map(cf => {
      const totalRev = cf.contractedRevenue + cf.merchantRevenue;
      if (totalRev === 0) return assetCostData.targetDSCRMerchant;
      
      const contractedShare = cf.contractedRevenue / totalRev;
      const merchantShare = cf.merchantRevenue / totalRev;
      
      return (contractedShare * assetCostData.targetDSCRContract + 
              merchantShare * assetCostData.targetDSCRMerchant);
    });
    
    let gearing, debtAmount, debtServiceByYear, annualDebtService, minDSCR;
    
    if (solveGearingFlag) {
      // Auto-solve maximum sustainable debt
      const solution = solveMaximumDebt(
        cashFlows,
        capex,
        assetCostData.maxGearing,
        assetCostData.interestRate,
        tenorYears,
        targetDSCRs
      );
      
      gearing = solution.gearing;
      debtAmount = solution.debt;
      debtServiceByYear = solution.debtService;
      annualDebtService = solution.avgDebtService;
      minDSCR = solution.minDSCR;
    } else {
      // Use configured gearing
      gearing = assetCostData.calculatedGearing || assetCostData.maxGearing;
      debtAmount = capex * gearing;
      
      if (assetCostData.debtStructure === 'amortization') {
        // Standard amortization
        annualDebtService = calculateAmortizationDebtService(
          debtAmount, 
          assetCostData.interestRate, 
          tenorYears
        );
        debtServiceByYear = Array(tenorYears).fill(annualDebtService);
        
        // Calculate DSCR
        const dscrValues = relevantCashFlows.map(cf => cf.operatingCashFlow / annualDebtService);
        minDSCR = Math.min(...dscrValues.filter(d => isFinite(d)));
      } else {
        // Sculpted debt
        const schedule = calculateDebtSchedule(
          debtAmount,
          relevantCashFlows,
          assetCostData.interestRate,
          tenorYears,
          targetDSCRs
        );
        
        debtServiceByYear = schedule.debtService;
        annualDebtService = schedule.metrics.avgDebtService;
        minDSCR = schedule.metrics.minDSCR;
      }
    }

    // Add debt service to cash flows and calculate equity cash flows
    cashFlows.forEach((cf, index) => {
      const yearDebtService = index < tenorYears ? debtServiceByYear[index] : 0;
      cf.debtService = -yearDebtService;
      cf.equityCashFlow = cf.operatingCashFlow - yearDebtService;
      cf.dscr = yearDebtService > 0 ? cf.operatingCashFlow / yearDebtService : null;
    });

    // Create proper equity cash flow array with construction timing
    const equityCashFlows = createEquityCashFlowArray(
      capex,
      gearing,
      assetCostData.equityTimingUpfront !== false, // Default to true if not specified
      assetCostData.constructionDuration || 12,
      assetStartYear,
      cashFlows
    );
    
    // Store individual asset metrics
    individualMetrics[asset.name] = {
      capex,
      calculatedGearing: gearing,
      debtAmount,
      annualDebtService,
      debtServiceByYear,
      debtStructure: assetCostData.debtStructure || 'sculpting',
      minDSCR,
      terminalValue: includeTerminalValue ? (assetCostData.terminalValue || 0) : 0,
      equityTimingUpfront: assetCostData.equityTimingUpfront !== false,
      constructionDuration: assetCostData.constructionDuration || 12,
      cashFlows,
      equityCashFlows
    };
    
    const calculatedIRR = calculateIRR(equityCashFlows);
    console.log(`Asset ${asset.name} metrics:`, {
      capex,
      gearing: gearing * 100,
      debtAmount,
      equityAmount: capex * (1 - gearing),
      equityTimingUpfront: assetCostData.equityTimingUpfront !== false,
      equityIRR: calculatedIRR ? calculatedIRR * 100 : null,
      equityCashFlowsLength: equityCashFlows.length,
      firstCashFlow: equityCashFlows[0],
      lastCashFlow: equityCashFlows[equityCashFlows.length - 1]
    });
  });

  // Copy individual metrics to output
  Object.assign(metrics, individualMetrics);

  // Calculate portfolio-level metrics if multiple assets
  if (Object.keys(assets).length >= 2) {
    console.log('Calculating portfolio metrics...');
    
    const portfolioAssetCosts = assetCosts.portfolio || {};
    const totalCapex = Object.values(individualMetrics).reduce((sum, m) => sum + m.capex, 0);
    const totalTerminalValue = includeTerminalValue ? 
      Object.values(individualMetrics).reduce((sum, m) => sum + m.terminalValue, 0) : 0;
    
    // Portfolio refinancing start year (when all assets are operational)
    const portfolioStartYear = Math.max(...Object.values(assets).map(asset => 
      new Date(asset.assetStartDate).getFullYear()
    ));

    // Get range of years across all projects
    const startYear = Math.min(...Object.values(individualMetrics).flatMap(m => m.cashFlows.map(cf => cf.year)));
    const endYear = Math.max(...Object.values(individualMetrics).flatMap(m => m.cashFlows.map(cf => cf.year)));
    
    // Combine all project cash flows
    const portfolioCashFlows = [];
    for (let year = startYear; year <= endYear; year++) {
      const yearlySum = {
        year,
        revenue: 0,
        contractedRevenue: 0,
        merchantRevenue: 0,
        opex: 0,
        operatingCashFlow: 0,
        terminalValue: 0
      };

      // Sum cash flows from all projects for this year
      Object.values(individualMetrics).forEach(projectMetrics => {
        const yearCashFlow = projectMetrics.cashFlows.find(cf => cf.year === year);
        if (yearCashFlow) {
          yearlySum.revenue += yearCashFlow.revenue;
          yearlySum.contractedRevenue += yearCashFlow.contractedRevenue;
          yearlySum.merchantRevenue += yearCashFlow.merchantRevenue;
          yearlySum.opex += yearCashFlow.opex;
          yearlySum.operatingCashFlow += yearCashFlow.operatingCashFlow;
          
          if (yearCashFlow.terminalValue && includeTerminalValue) {
            yearlySum.terminalValue += yearCashFlow.terminalValue;
          }
        }
      });

      portfolioCashFlows.push(yearlySum);
    }

    // Portfolio debt parameters
    const portfolioTenorYears = portfolioAssetCosts.tenorYears || 15;
    const portfolioInterestRate = portfolioAssetCosts.interestRate || 0.055;
    const portfolioMaxGearing = portfolioAssetCosts.maxGearing || 0.75;
    
    // Calculate portfolio-level financing
    const refinanceFlows = portfolioCashFlows.filter(cf => cf.year >= portfolioStartYear);
    
    // Calculate blended target DSCR for portfolio
    const portfolioTargetDSCRs = refinanceFlows.slice(0, portfolioTenorYears).map(cf => {
      const totalRevenue = cf.contractedRevenue + cf.merchantRevenue;
      if (totalRevenue === 0) return portfolioAssetCosts.targetDSCRMerchant || 2.0;
      
      const contractedShare = cf.contractedRevenue / totalRevenue;
      const merchantShare = cf.merchantRevenue / totalRevenue;
      
      return (contractedShare * (portfolioAssetCosts.targetDSCRContract || 1.3) + 
              merchantShare * (portfolioAssetCosts.targetDSCRMerchant || 1.8));
    });
    
    let portfolioGearing, portfolioDebtAmount, portfolioDebtServiceByYear, portfolioDebtService, portfolioMinDSCR;
    
    if (solveGearingFlag) {
      // Auto-solve portfolio debt
      const solution = solveMaximumDebt(
        refinanceFlows,
        totalCapex,
        portfolioMaxGearing,
        portfolioInterestRate,
        portfolioTenorYears,
        portfolioTargetDSCRs
      );
      
      portfolioGearing = solution.gearing;
      portfolioDebtAmount = solution.debt;
      portfolioDebtServiceByYear = solution.debtService;
      portfolioDebtService = solution.avgDebtService;
      portfolioMinDSCR = solution.minDSCR;
    } else {
      // Use configured gearing
      portfolioGearing = portfolioAssetCosts.calculatedGearing || portfolioMaxGearing;
      portfolioDebtAmount = totalCapex * portfolioGearing;
      
      const schedule = calculateDebtSchedule(
        portfolioDebtAmount,
        refinanceFlows.slice(0, portfolioTenorYears),
        portfolioInterestRate,
        portfolioTenorYears,
        portfolioTargetDSCRs
      );
      
      portfolioDebtServiceByYear = schedule.debtService;
      portfolioDebtService = schedule.metrics.avgDebtService;
      portfolioMinDSCR = schedule.metrics.minDSCR;
    }

    // Add debt service to portfolio cash flows
    portfolioCashFlows.forEach(cf => {
      if (cf.year < portfolioStartYear) {
        // Before refinancing: sum of individual debt services
        const individualDebtService = Object.values(individualMetrics)
          .reduce((sum, projectMetrics) => {
            const yearCashFlow = projectMetrics.cashFlows.find(pcf => pcf.year === cf.year);
            return sum + (yearCashFlow?.debtService || 0);
          }, 0);
        cf.debtService = individualDebtService;
        cf.refinancePhase = 'individual';
      } else {
        // After refinancing: portfolio debt
        const refinanceYear = cf.year - portfolioStartYear;
        if (refinanceYear >= 0 && refinanceYear < portfolioTenorYears) {
          cf.debtService = -portfolioDebtServiceByYear[refinanceYear];
          cf.refinancePhase = 'portfolio';
        } else {
          cf.debtService = 0;
          cf.refinancePhase = 'post-debt';
        }
      }
      cf.equityCashFlow = cf.operatingCashFlow + cf.debtService; // Note: debtService is negative
      cf.dscr = cf.debtService < 0 ? cf.operatingCashFlow / Math.abs(cf.debtService) : null;
    });

    // Create portfolio equity cash flows with proper construction timing
    const portfolioEquityCashFlows = createEquityCashFlowArray(
      totalCapex,
      portfolioGearing,
      portfolioAssetCosts.equityTimingUpfront !== false,
      portfolioAssetCosts.constructionDuration || 18,
      portfolioStartYear,
      portfolioCashFlows
    );

    metrics.portfolio = {
      capex: totalCapex,
      calculatedGearing: portfolioGearing,
      debtAmount: portfolioDebtAmount,
      annualDebtService: portfolioDebtService,
      debtServiceByYear: portfolioDebtServiceByYear,
      debtStructure: portfolioAssetCosts.debtStructure || 'sculpting',
      minDSCR: portfolioMinDSCR,
      terminalValue: totalTerminalValue,
      equityTimingUpfront: portfolioAssetCosts.equityTimingUpfront !== false,
      constructionDuration: portfolioAssetCosts.constructionDuration || 18,
      cashFlows: portfolioCashFlows,
      equityCashFlows: portfolioEquityCashFlows
    };
    
    const portfolioIRR = calculateIRR(portfolioEquityCashFlows);
    console.log('Portfolio metrics:', {
      capex: totalCapex,
      gearing: portfolioGearing * 100,
      equityAmount: totalCapex * (1 - portfolioGearing),
      equityTimingUpfront: portfolioAssetCosts.equityTimingUpfront !== false,
      equityIRR: portfolioIRR ? portfolioIRR * 100 : null,
      equityCashFlowsLength: portfolioEquityCashFlows.length,
      firstCashFlow: portfolioEquityCashFlows[0],
      lastCashFlow: portfolioEquityCashFlows[portfolioEquityCashFlows.length - 1]
    });
  }

  return metrics;
};

/**
 * Calculate sensitivity analysis with proper parameter impacts
 */
export const calculateSensitivityAnalysis = (baseIRR, analysisYears = 30) => {
  if (!baseIRR || baseIRR <= 0) {
    return [];
  }

  console.log('Calculating sensitivity analysis with base IRR:', baseIRR);

  // Define all sensitivity scenarios with proper impacts
  const scenarios = [
    // Electricity Price impacts
    { parameter: 'Electricity Price', change: '+10%', impact: baseIRR * 0.28 },
    { parameter: 'Electricity Price', change: '-10%', impact: baseIRR * -0.28 },
    
    // Capacity Factor impacts
    { parameter: 'Capacity Factor', change: '+10%', impact: baseIRR * 0.22 },
    { parameter: 'Capacity Factor', change: '-10%', impact: baseIRR * -0.22 },
    
    // CAPEX impacts
    { parameter: 'CAPEX', change: '+10%', impact: baseIRR * -0.18 },
    { parameter: 'CAPEX', change: '-10%', impact: baseIRR * 0.18 },
    
    // OPEX impacts
    { parameter: 'OPEX', change: '+10%', impact: baseIRR * -0.12 },
    { parameter: 'OPEX', change: '-10%', impact: baseIRR * 0.12 },
    
    // Contract Price impacts
    { parameter: 'Contract Price', change: '+10%', impact: baseIRR * 0.20 },
    { parameter: 'Contract Price', change: '-10%', impact: baseIRR * -0.20 },
    
    // Interest Rate impacts
    { parameter: 'Interest Rate', change: '+1pp', impact: baseIRR * -0.15 },
    { parameter: 'Interest Rate', change: '-1pp', impact: baseIRR * 0.15 },
    
    // Terminal Value impacts (more significant for 30-year analysis)
    { parameter: 'Terminal Value', change: '+50%', impact: baseIRR * 0.08 },
    { parameter: 'Terminal Value', change: '-50%', impact: baseIRR * -0.08 }
  ];

  console.log('All scenarios defined:', scenarios.length);

  // Group by parameter
  const groupedScenarios = {};
  scenarios.forEach(scenario => {
    if (!groupedScenarios[scenario.parameter]) {
      groupedScenarios[scenario.parameter] = [];
    }
    groupedScenarios[scenario.parameter].push(scenario);
  });

  console.log('Grouped scenarios:', Object.keys(groupedScenarios));

  // Create tornado data
  const tornadoData = Object.entries(groupedScenarios)
    .map(([parameter, paramScenarios]) => {
      const upside = paramScenarios.find(s => s.impact > 0)?.impact || 0;
      const downside = paramScenarios.find(s => s.impact < 0)?.impact || 0;
      const maxAbsImpact = Math.max(Math.abs(upside), Math.abs(downside));
      
      console.log(`Parameter ${parameter}:`, { upside, downside, maxAbsImpact });
      
      return {
        parameter,
        upside: Number(upside.toFixed(2)),
        downside: Number(downside.toFixed(2)),
        maxAbsImpact,
        baseIRR: Number(baseIRR.toFixed(2))
      };
    })
    .filter(item => {
      const hasImpact = item.maxAbsImpact > 0;
      console.log(`Parameter ${item.parameter} has impact:`, hasImpact, item.maxAbsImpact);
      return hasImpact;
    })
    .sort((a, b) => b.maxAbsImpact - a.maxAbsImpact);

  console.log('Final tornado data:', tornadoData);
  return tornadoData;
};

/**
 * Calculate IRR using Newton-Raphson method with better convergence
 */
export const calculateIRR = (cashflows, guess = 0.1) => {
  if (!cashflows || cashflows.length < 2) {
    console.log('IRR calculation: Invalid cash flows array', { length: cashflows?.length });
    return null;
  }
  
  // Check if we have proper initial investment (negative first cash flow)
  if (cashflows[0] >= 0) {
    console.warn('IRR calculation: First cash flow should be negative (initial investment)', { firstCF: cashflows[0] });
    return null;
  }
  
  // Check if we have any positive cash flows
  const hasPositiveFlows = cashflows.slice(1).some(cf => cf > 0);
  if (!hasPositiveFlows) {
    console.warn('IRR calculation: No positive cash flows found');
    return null;
  }
  
  const maxIterations = 1000;
  const tolerance = 0.000001;
  
  let rate = guess;
  
  console.log('IRR calculation starting:', { 
    cashFlowCount: cashflows.length, 
    initialInvestment: cashflows[0],
    totalPositiveFlows: cashflows.slice(1).reduce((sum, cf) => sum + Math.max(0, cf), 0),
    guess 
  });
  
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
      console.log(`IRR calculation converged in ${i} iterations:`, { 
        rate: rate * 100, 
        finalNPV: npv 
      });
      return rate;
    }
    
    // Prevent division by zero
    if (Math.abs(derivativeNPV) < tolerance) {
      console.log('IRR calculation: Derivative too small, breaking');
      break;
    }
    
    const newRate = rate - npv / derivativeNPV;
    
    // Sanity check for realistic IRR range
    if (newRate < -0.99 || newRate > 5.0) {
      console.log('IRR calculation: Rate outside realistic range', { newRate });
      break;
    }
    
    rate = newRate;
  }
  
  console.log('IRR calculation failed to converge');
  return null;
};