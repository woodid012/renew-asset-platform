import { calculateAssetRevenue } from './RevCalculations';
import { calculateStressRevenue } from './ValuationAnalysis_Calcs';

export const DEFAULT_CAPEX = {
  solar: 1.2,  // $M per MW
  wind: 2.5,   // $M per MW
  storage: 1.6, // $M per MW
  default: 2.0  // $M per MW
};

export const DEFAULT_OPEX = {
  solar: 0.014,    // $M per MW (midpoint of 8-20k)
  wind: 0.040,     // $M per MW (midpoint of 30-50k)
  storage: 0.015,  // $M per MW (midpoint of 10-20k)
  default: 0.030   // $M per MW
};

export const DEFAULT_PROJECT_FINANCE = {
  maxGearing: 0.70,
  targetDSCRMerchant: 2.00,
  targetDSCRContract: 1.35,
  interestRate: 0.060,
  opexEscalation: 2.5,
  structuring: 0.01,
  commitment: 0.005,
};

export const DEFAULT_TENORS = {
  solar: 22,
  wind: 22,
  storage: 18,
  default: 20
};

export const initializeProjectValues = (assets) => {
  const initialValues = Object.values(assets).reduce((acc, asset) => {
    const defaultCapex = DEFAULT_CAPEX[asset.type] || DEFAULT_CAPEX.default;
    const defaultOpex = DEFAULT_OPEX[asset.type] || DEFAULT_OPEX.default;
    const defaultTenor = DEFAULT_TENORS[asset.type] || DEFAULT_TENORS.default;
    const capex = defaultCapex * asset.capacity;

    return {
      ...acc,
      [asset.name]: {
        capex: Number(capex.toFixed(1)),
        maxGearing: DEFAULT_PROJECT_FINANCE.maxGearing,
        targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant,
        targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract,
        interestRate: DEFAULT_PROJECT_FINANCE.interestRate,
        tenorYears: defaultTenor,
        opex: Number((defaultOpex * asset.capacity).toFixed(1)),
        opexEscalation: DEFAULT_PROJECT_FINANCE.opexEscalation,
        calculatedGearing: DEFAULT_PROJECT_FINANCE.maxGearing,
        debtStructure: 'sculpting' // Default to sculpting
      }
    };
  }, {});

  if (Object.keys(assets).length >= 2) {
    initialValues.portfolio = {
      maxGearing: DEFAULT_PROJECT_FINANCE.maxGearing + 0.05,
      targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant - 0.2,
      targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract - 0.05,
      interestRate: DEFAULT_PROJECT_FINANCE.interestRate - 0.005,
      tenorYears: DEFAULT_TENORS.default,
      capex: 0,  // This will be calculated from sum of assets
      calculatedGearing: (DEFAULT_PROJECT_FINANCE.maxGearing + 0.05),  // Initialize to max
      debtStructure: 'sculpting' // Default to sculpting
    };
  }

  return initialValues;
};

/**
 * Calculate standard amortization debt service
 * @param {number} principal - Loan principal amount
 * @param {number} rate - Annual interest rate (decimal)
 * @param {number} years - Loan term in years
 * @returns {number} - Annual debt service amount
 */
export const calculateAmortizationDebtService = (principal, rate, years) => {
  const r = rate;
  const n = years;
  if (r === 0) return principal / n; // Edge case
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
};

/**
 * Calculate a complete debt schedule based on the Excel approach
 * @param {number} debtAmount - Total debt amount
 * @param {Array} cashFlows - Array of cash flow objects with operating cash flow
 * @param {number} interestRate - Annual interest rate
 * @param {number} tenorYears - Debt tenor in years
 * @param {Array} targetDSCRs - Target DSCR for each year
 * @returns {Object} - Complete debt schedule and metrics
 */
export const calculateDebtSchedule = (debtAmount, cashFlows, interestRate, tenorYears, targetDSCRs) => {
  // Create arrays to store schedule
  const debtBalance = Array(tenorYears + 1).fill(0);  // +1 for opening balance
  const interestPayments = Array(tenorYears).fill(0);
  const principalPayments = Array(tenorYears).fill(0);
  const debtService = Array(tenorYears).fill(0);
  const dscrValues = Array(tenorYears).fill(0);
  
  // Set initial debt balance
  debtBalance[0] = debtAmount;
  
  // For each period, calculate debt service components
  for (let i = 0; i < tenorYears; i++) {
    // Calculate interest payment based on opening balance
    interestPayments[i] = debtBalance[i] * interestRate;
    
    // Maximum debt service allowed by DSCR constraint
    const operatingCashFlow = cashFlows[i].operatingCashFlow;
    const targetDSCR = targetDSCRs[i];
    const maxDebtService = operatingCashFlow / targetDSCR;
    
    // Calculate principal repayment (limited by max debt service and remaining balance)
    principalPayments[i] = Math.min(
      Math.max(0, maxDebtService - interestPayments[i]),
      debtBalance[i] // Cannot repay more than remaining balance
    );
    
    // Total debt service for this period
    debtService[i] = interestPayments[i] + principalPayments[i];
    
    // Calculate DSCR
    dscrValues[i] = operatingCashFlow / debtService[i];
    
    // Update debt balance for next period
    debtBalance[i+1] = debtBalance[i] - principalPayments[i];
  }
  
  // Calculate key metrics
  const fullyRepaid = debtBalance[tenorYears] < 0.001;
  const avgDebtService = debtService.reduce((sum, ds) => sum + ds, 0) / tenorYears;
  const minDSCR = Math.min(...dscrValues);
  
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
 * Find the maximum sustainable debt using binary search
 * @param {Array} cashFlows - Array of cash flow objects with operating cash flow
 * @param {number} capex - Total capital expenditure
 * @param {number} maxGearing - Maximum gearing ratio
 * @param {number} interestRate - Annual interest rate
 * @param {number} tenorYears - Debt tenor in years
 * @param {Array} targetDSCRs - Target DSCR for each year
 * @returns {Object} - Maximum sustainable debt and schedule
 */
const solveMaximumDebt = (cashFlows, capex, maxGearing, interestRate, tenorYears, targetDSCRs) => {
  // Initial debt guess - start at maximum gearing
  const initialGuess = capex * maxGearing;
  
  // Bounds for binary search
  let lowerBound = 0;
  let upperBound = initialGuess;
  let currentDebt = initialGuess;
  
  // Binary search parameters
  const tolerance = 0.0001; // $100k precision is sufficient
  const maxIterations = 50;
  let iterations = 0;
  
  // Store the best valid result
  let bestDebt = 0;
  let bestSchedule = null;
  
  console.log(`Solving maximum debt for ${capex.toFixed(2)}M capex with ${maxGearing.toFixed(2)} max gearing...`);
  
  // Binary search loop
  while (iterations < maxIterations && (upperBound - lowerBound) > tolerance) {
    // Calculate debt schedule with current debt amount
    const schedule = calculateDebtSchedule(
      currentDebt,
      cashFlows.slice(0, tenorYears),
      interestRate,
      tenorYears,
      targetDSCRs
    );
    
    // Check if debt is fully repaid
    if (schedule.metrics.fullyRepaid) {
      // Valid result - can try higher debt
      lowerBound = currentDebt;
      // Save this valid result
      bestDebt = currentDebt;
      bestSchedule = schedule;
    } else {
      // Invalid result - debt too high
      upperBound = currentDebt;
    }
    
    // Update current debt for next iteration
    currentDebt = (lowerBound + upperBound) / 2;
    iterations++;
    
    // Debug log every 10 iterations
    if (iterations % 10 === 0) {
      console.log(`Iteration ${iterations}: Testing debt $${currentDebt.toFixed(2)}M, Bounds: $${lowerBound.toFixed(2)}M - $${upperBound.toFixed(2)}M`);
    }
  }
  
  console.log(`Solved maximum debt: $${bestDebt.toFixed(2)}M (${(bestDebt/capex*100).toFixed(1)}% gearing) in ${iterations} iterations`);
  
  // If no valid solution found, calculate schedule with zero debt
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

export const calculateProjectMetrics = (
  assets,
  projectValues,
  constants,
  getMerchantPrice,
  selectedRevenueCase = 'base',
  solveGearingFlag = false,
  includeTerminalValue = true // Add parameter to toggle terminal value
) => {
  const metrics = {};
  const individualMetrics = {};

  if (!projectValues) return {};
  
  // First calculate individual project metrics
  Object.values(assets).forEach(asset => {
    const assetCosts = constants.assetCosts[asset.name] || {};
    const projectValue = projectValues[asset.name] || {};
    
    // Use capex from assetCosts instead of projectValues
    const capex = assetCosts.capex || 0;
    
    const cashFlows = [];
    const assetStartYear = new Date(asset.assetStartDate).getFullYear();
    const assetEndYear = assetStartYear + (asset.assetLife || 30);

    // Calculate cash flows first as we need them for gearing calculation
    for (let year = assetStartYear; year < assetEndYear; year++) {
      const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
      const stressedRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
      const contractedRevenue = stressedRevenue.contractedGreen + stressedRevenue.contractedEnergy;
      const merchantRevenue = stressedRevenue.merchantGreen + stressedRevenue.merchantEnergy;
      const yearRevenue = contractedRevenue + merchantRevenue;
      
      const yearIndex = year - assetStartYear;
      
      // Use unified operating cost fields from assetCosts
      const operatingCostInflation = Math.pow(1 + (assetCosts.operatingCostEscalation || 2.5)/100, yearIndex);
      const yearOperatingCosts = (assetCosts.operatingCosts || 0) * operatingCostInflation;
      
      const operatingCashFlow = yearRevenue - yearOperatingCosts;

      cashFlows.push({
        year,
        revenue: yearRevenue,
        contractedRevenue,
        merchantRevenue,
        opex: -yearOperatingCosts,
        operatingCashFlow
      });
    }
    
    // Add terminal value to the last year's cash flow only if includeTerminalValue is true
    if (cashFlows.length > 0 && assetCosts.terminalValue && includeTerminalValue) {
      const lastCashFlow = cashFlows[cashFlows.length - 1];
      lastCashFlow.terminalValue = assetCosts.terminalValue || 0;
      lastCashFlow.operatingCashFlow += lastCashFlow.terminalValue; // Add terminal value to operating cash flow
    } else if (cashFlows.length > 0) {
      // If terminal value is not included, ensure it's set to 0
      const lastCashFlow = cashFlows[cashFlows.length - 1];
      lastCashFlow.terminalValue = 0;
    }
    
    // Use the debt structure from asset costs
    const debtStructure = assetCosts.debtStructure || 'sculpting';
    const tenorYears = assetCosts.tenorYears || 15;
    
    // Calculate blended target DSCR for each year in debt tenor
    const relevantCashFlows = cashFlows.slice(0, tenorYears);
    const targetDSCRs = relevantCashFlows.map(cf => {
      const totalRevenue = cf.contractedRevenue + cf.merchantRevenue;
      if (totalRevenue === 0) return assetCosts.targetDSCRMerchant;
      
      const contractedShare = cf.contractedRevenue / totalRevenue;
      const merchantShare = cf.merchantRevenue / totalRevenue;
      
      return (contractedShare * assetCosts.targetDSCRContract + 
              merchantShare * assetCosts.targetDSCRMerchant);
    });
    
    let gearing, debtAmount, debtServiceByYear, annualDebtService, minDSCR;
    
    if (solveGearingFlag) {
      // Calculate maximum sustainable debt using the Excel approach
      const solution = solveMaximumDebt(
        cashFlows,
        capex,
        assetCosts.maxGearing,
        assetCosts.interestRate,
        tenorYears,
        targetDSCRs
      );
      
      gearing = solution.gearing;
      debtAmount = solution.debt;
      debtServiceByYear = solution.debtService;
      annualDebtService = solution.avgDebtService;
      minDSCR = solution.minDSCR;
    } else {
      // Use existing gearing
      gearing = projectValue.calculatedGearing || assetCosts.maxGearing;
      debtAmount = capex * gearing;
      
      // Calculate debt service based on structure
      if (debtStructure === 'amortization') {
        // Standard amortization with equal payments
        annualDebtService = calculateAmortizationDebtService(
          debtAmount, 
          assetCosts.interestRate, 
          tenorYears
        );
        
        // Fill array with same value for consistent handling
        debtServiceByYear = Array(tenorYears).fill(annualDebtService);
        
        // Calculate DSCR
        const dscrValues = relevantCashFlows.map(cf => cf.operatingCashFlow / annualDebtService);
        minDSCR = Math.min(...dscrValues.filter(d => d !== Infinity));
      } else {
        // Use Excel-style debt scheduling
        const schedule = calculateDebtSchedule(
          debtAmount,
          relevantCashFlows,
          assetCosts.interestRate,
          tenorYears,
          targetDSCRs
        );
        
        debtServiceByYear = schedule.debtService;
        annualDebtService = schedule.metrics.avgDebtService;
        minDSCR = schedule.metrics.minDSCR;
      }
    }

    // Add debt service to cash flows
    cashFlows.forEach((cf, index) => {
      const yearDebtService = index < tenorYears ? 
        debtServiceByYear[index] : 0;
      
      cf.debtService = -yearDebtService;
      cf.equityCashFlow = cf.operatingCashFlow - yearDebtService;
    });

    // Initialize equity cash flow array with initial investment
    const equityCashFlows = [-capex * (1 - gearing)];
    
    // Add operating years' equity cash flows
    cashFlows.forEach(cf => {
      equityCashFlows.push(cf.equityCashFlow);
    });
    
    individualMetrics[asset.name] = {
      capex,
      calculatedGearing: gearing,
      debtAmount,
      annualDebtService,
      debtServiceByYear,
      debtStructure,
      minDSCR,
      terminalValue: includeTerminalValue ? (assetCosts.terminalValue || 0) : 0,
      cashFlows,
      equityCashFlows
    };
  });

  // Copy individual metrics to the output
  Object.assign(metrics, individualMetrics);

  // Calculate portfolio metrics if there are multiple assets
  if (Object.keys(assets).length >= 2) {
    const portfolioValue = projectValues.portfolio || {};
    const totalCapex = Object.values(individualMetrics).reduce((sum, m) => sum + m.capex, 0);
    const totalTerminalValue = includeTerminalValue ? 
      Object.values(individualMetrics).reduce((sum, m) => sum + m.terminalValue, 0) : 0;
    
    // Determine portfolio refinancing start year (when all assets are operational)
    const portfolioStartYear = Math.max(...Object.values(assets).map(asset => 
      new Date(asset.assetStartDate).getFullYear()
    ));

    // Get the range of years across all projects
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

      // Sum up cash flows from all projects for this year
      Object.values(individualMetrics).forEach(projectMetrics => {
        const yearCashFlow = projectMetrics.cashFlows.find(cf => cf.year === year);
        if (yearCashFlow) {
          yearlySum.revenue += yearCashFlow.revenue;
          yearlySum.contractedRevenue += yearCashFlow.contractedRevenue;
          yearlySum.merchantRevenue += yearCashFlow.merchantRevenue;
          yearlySum.opex += yearCashFlow.opex;
          yearlySum.operatingCashFlow += yearCashFlow.operatingCashFlow;
          
          // Add terminal value if present in the year's cash flow and if includeTerminalValue is true
          if (yearCashFlow.terminalValue && includeTerminalValue) {
            yearlySum.terminalValue += yearCashFlow.terminalValue;
          }
        }
      });

      portfolioCashFlows.push(yearlySum);
    }

    // Get the debt structure from portfolio settings
    const portfolioDebtStructure = constants.assetCosts.portfolio?.debtStructure || 'sculpting';
    const portfolioTenorYears = constants.assetCosts.portfolio?.tenorYears || 15;

    // Calculate total remaining debt at refinancing date by looking at each asset
    const totalRemainingDebt = Object.entries(individualMetrics).reduce((sum, [assetName, metrics]) => {
      // For each asset, find how much debt is remaining at portfolio start year
      const refinanceYearFlow = metrics.cashFlows.find(cf => cf.year === portfolioStartYear);
      if (!refinanceYearFlow) return sum;

      // Calculate remaining principal for this asset
      const assetStartYear = metrics.cashFlows[0].year;
      const yearsToRefinance = portfolioStartYear - assetStartYear;
      
      // If the asset has started by refinance date
      if (yearsToRefinance >= 0) {
        const originalDebt = metrics.debtAmount;
        const rate = constants.assetCosts[assetName]?.interestRate || DEFAULT_PROJECT_FINANCE.interestRate;
        const tenor = constants.assetCosts[assetName]?.tenorYears || DEFAULT_PROJECT_FINANCE.tenorYears;
        
        // Calculate remaining loan balance at refinance date using standard amortization
        const payment = calculateAmortizationDebtService(originalDebt, rate, tenor);
        const remainingPrincipal = originalDebt * 
          Math.pow(1 + rate, yearsToRefinance) - 
          payment * (Math.pow(1 + rate, yearsToRefinance) - 1) / rate;
        
        return sum + Math.max(0, remainingPrincipal);
      }
      return sum;
    }, 0);

    // Get portfolio cash flows starting from refinancing
    const refinanceFlows = portfolioCashFlows.filter(cf => cf.year >= portfolioStartYear);
    
    // Calculate blended target DSCR for portfolio
    const portfolioTargetDSCRs = refinanceFlows.slice(0, portfolioTenorYears).map(cf => {
      const totalRevenue = cf.contractedRevenue + cf.merchantRevenue;
      if (totalRevenue === 0) return portfolioValue.targetDSCRMerchant;
      
      const contractedShare = cf.contractedRevenue / totalRevenue;
      const merchantShare = cf.merchantRevenue / totalRevenue;
      
      return (contractedShare * portfolioValue.targetDSCRContract + 
              merchantShare * portfolioValue.targetDSCRMerchant);
    });
    
    let portfolioGearing, portfolioDebtAmount, portfolioDebtServiceByYear, portfolioDebtService, portfolioMinDSCR;
    
    if (solveGearingFlag) {
      // Calculate maximum sustainable debt for portfolio
      const solution = solveMaximumDebt(
        refinanceFlows,
        totalCapex,
        portfolioValue.maxGearing,
        portfolioValue.interestRate,
        portfolioTenorYears,
        portfolioTargetDSCRs
      );
      
      portfolioGearing = solution.gearing;
      portfolioDebtAmount = solution.debt;
      portfolioDebtServiceByYear = solution.debtService;
      portfolioDebtService = solution.avgDebtService;
      portfolioMinDSCR = solution.minDSCR;
    } else {
      // Use existing gearing
      portfolioGearing = portfolioValue.calculatedGearing || portfolioValue.maxGearing;
      portfolioDebtAmount = Math.min(
        totalRemainingDebt, 
        totalCapex * portfolioGearing
      );
      
      if (portfolioDebtStructure === 'amortization') {
        // Standard amortization
        portfolioDebtService = calculateAmortizationDebtService(
          portfolioDebtAmount,
          portfolioValue.interestRate,
          portfolioTenorYears
        );
        portfolioDebtServiceByYear = Array(portfolioTenorYears).fill(portfolioDebtService);
        
        // Calculate DSCR
        const dscrValues = refinanceFlows.slice(0, portfolioTenorYears)
          .map(cf => cf.operatingCashFlow / portfolioDebtService);
        portfolioMinDSCR = Math.min(...dscrValues.filter(d => isFinite(d)));
      } else {
        // Excel-style debt scheduling
        const schedule = calculateDebtSchedule(
          portfolioDebtAmount,
          refinanceFlows.slice(0, portfolioTenorYears),
          portfolioValue.interestRate,
          portfolioTenorYears,
          portfolioTargetDSCRs
        );
        
        portfolioDebtServiceByYear = schedule.debtService;
        portfolioDebtService = schedule.metrics.avgDebtService;
        portfolioMinDSCR = schedule.metrics.minDSCR;
      }
    }

    // Add debt service to portfolio cash flows
    portfolioCashFlows.forEach(cf => {
      if (cf.year < portfolioStartYear) {
        // Before portfolio refinancing, use sum of individual debt services
        const individualDebtService = Object.values(individualMetrics)
          .reduce((sum, projectMetrics) => {
            const yearCashFlow = projectMetrics.cashFlows.find(pcf => pcf.year === cf.year);
            return sum + (yearCashFlow?.debtService || 0);
          }, 0);
        cf.debtService = individualDebtService;
        cf.refinancePhase = 'individual';
      } else {
        // After portfolio refinancing starts
        const refinanceYear = cf.year - portfolioStartYear;
        if (refinanceYear >= 0 && refinanceYear < portfolioTenorYears) {
          cf.debtService = -portfolioDebtServiceByYear[refinanceYear];
          cf.refinancePhase = 'portfolio';
        } else {
          cf.debtService = 0;
          cf.refinancePhase = 'post-debt';
        }
      }
      cf.equityCashFlow = cf.operatingCashFlow + cf.debtService; // Note: debtService is already negative
    });

    // Create equity cash flows array with initial investment and yearly flows
    const portfolioEquityCashFlows = [-totalCapex * (1 - portfolioGearing)];
    portfolioCashFlows.forEach(cf => {
      portfolioEquityCashFlows.push(cf.equityCashFlow);
    });

    metrics.portfolio = {
      capex: totalCapex,
      calculatedGearing: portfolioGearing,
      debtAmount: portfolioDebtAmount,
      annualDebtService: portfolioDebtService,
      debtServiceByYear: portfolioDebtServiceByYear,
      debtStructure: portfolioDebtStructure,
      minDSCR: portfolioMinDSCR,
      terminalValue: totalTerminalValue,
      cashFlows: portfolioCashFlows,
      equityCashFlows: portfolioEquityCashFlows
    };
  }

  return metrics;
};

export const calculateIRR = (cashflows, guess = 0.1) => {
  if (!cashflows || cashflows.length < 2) return null;
  
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
    
    // Prevent division by zero
    if (Math.abs(derivativeNPV) < tolerance) break;
    
    rate = rate - npv / derivativeNPV;
    
    if (rate < -1 || rate > 100) return null; // Handle unrealistic IRR
  }
  
  return null;
};