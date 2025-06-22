import { calculateAssetRevenue } from './RevCalculations';
import { calculateStressRevenue } from './ValuationAnalysis_Calcs';

/**
 * Calculates P&L data for the platform and individual assets
 * @param {Object} assets - Asset objects from portfolio context
 * @param {Object} constants - Constants from portfolio context
 * @param {Array} years - Array of years to calculate for
 * @param {Function} getMerchantPrice - Function to get merchant prices
 * @param {String} selectedRevenueCase - Selected revenue case (base, worst, volume, price)
 * @param {Boolean} usePortfolioDebt - Whether to use portfolio debt parameters
 * @param {Number} platformOpex - Annual platform opex
 * @param {Number} platformOpexEscalation - Annual escalation rate for platform opex
 * @returns {Object} Object containing platform P&L, asset P&Ls and quarterly data
 */
/**
 * Helper function to calculate standard amortization payment
 */
const calculateAmortizationPayment = (principal, rate, years) => {
  if (rate === 0) return principal / years; // Handle edge case
  return principal * rate * Math.pow(1 + rate, years) / (Math.pow(1 + rate, years) - 1);
};

export const calculatePlatformPL = (
  assets,
  constants,
  years,
  getMerchantPrice,
  selectedRevenueCase,
  usePortfolioDebt,
  platformOpex,
  platformOpexEscalation
) => {
  if (!assets || Object.keys(assets).length === 0 || years.length === 0) {
    return { assetPL: {}, platformPL: [], quarters: [] };
  }

  const assetPL = {};
  const platformPL = years.map(year => ({
    year,
    period: year.toString(),
    revenue: 0,
    assetOpex: 0,
    platformOpex: 0,
    ebitda: 0,
    depreciation: 0,
    interest: 0,
    ebt: 0,
    tax: 0,
    npat: 0,
    principalRepayment: 0 // Adding principal repayment field
  }));
  
  // Quarterly data structure
  const quarters = [];
  for (let year of years) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      quarters.push({
        period: `${year}-Q${quarter}`,
        year,
        quarter,
        revenue: 0,
        assetOpex: 0,
        platformOpex: 0,
        ebitda: 0,
        depreciation: 0,
        interest: 0,
        principalRepayment: 0, // Adding principal repayment field
        ebt: 0,
        tax: 0,
        npat: 0
      });
    }
  }

  // Calculate P&L for each asset
  Object.values(assets).forEach(asset => {
    const assetStartYear = new Date(asset.assetStartDate).getFullYear();
    const assetLife = parseInt(asset.assetLife) || 30; // Default to 30 years if not specified
    const assetEndYear = assetStartYear + assetLife;
    
    // Get asset costs
    const assetCosts = constants.assetCosts[asset.name] || {};
    const capex = assetCosts.capex || 0;
    const opexBase = assetCosts.operatingCosts || 0;
    const opexEscalation = assetCosts.operatingCostEscalation || 2.5;
    
    // Access shared depreciation settings
    const depreciationPeriod = constants.deprecationPeriods?.[asset.type] || 30;
    const annualDepreciation = capex / depreciationPeriod;

    // Debt parameters - either from individual asset or portfolio based on toggle
    const useDebtParams = usePortfolioDebt && constants.assetCosts.portfolio ? 
      constants.assetCosts.portfolio : assetCosts;
    
    const interestRate = useDebtParams.interestRate || 0.06;
    const calculatedGearing = useDebtParams.calculatedGearing || 0.7;
    const debtAmount = capex * calculatedGearing;
    const tenorYears = useDebtParams.tenorYears || 15;
    
    // Calculate annual debt service from Project Finance tab
    const debtStructure = useDebtParams.debtStructure || 'sculpting';
    
    // Initialize asset P&L array
    assetPL[asset.name] = years.map(year => {
      // Skip years before asset starts or after asset end of life
      if (year < assetStartYear || year >= assetEndYear) {
        return {
          year,
          period: year.toString(),
          revenue: 0,
          opex: 0,
          ebitda: 0,
          depreciation: 0,
          interest: 0,
          principalRepayment: 0,
          ebt: 0,
          tax: 0,
          npat: 0
        };
      }

      // Calculate yearly revenue
      const yearIndex = year - assetStartYear;
      
      // Calculate asset revenue for this year and scenario
      let revenue = 0;
      try {
        // Use the same calculation methods as in other components
        const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
        
        // Apply stress scenario adjustments if needed
        let stressedRevenue = baseRevenue;
        if (selectedRevenueCase !== 'base') {
          stressedRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
        }
        
        // Sum all revenue components
        revenue = stressedRevenue.contractedGreen + 
                 stressedRevenue.contractedEnergy + 
                 stressedRevenue.merchantGreen + 
                 stressedRevenue.merchantEnergy;
                 
        // Also calculate quarterly revenue
        for (let quarter = 1; quarter <= 4; quarter++) {
          const quarterStr = `${year}-Q${quarter}`;
          const quarterBaseRevenue = calculateAssetRevenue(asset, quarterStr, constants, getMerchantPrice);
          const quarterStressedRevenue = selectedRevenueCase !== 'base' ? 
            calculateStressRevenue(quarterBaseRevenue, selectedRevenueCase, constants) : 
            quarterBaseRevenue;
          
          const quarterRevenue = quarterStressedRevenue.contractedGreen + 
                               quarterStressedRevenue.contractedEnergy + 
                               quarterStressedRevenue.merchantGreen + 
                               quarterStressedRevenue.merchantEnergy;
          
          const quarterIndex = quarters.findIndex(q => q.period === quarterStr);
          if (quarterIndex !== -1) {
            quarters[quarterIndex].revenue += quarterRevenue;
          }
        }
      } catch (err) {
        console.error(`Error calculating revenue for ${asset.name} in ${year}:`, err);
        revenue = 0;
      }

      // Calculate opex with escalation
      const opexFactor = Math.pow(1 + opexEscalation / 100, yearIndex);
      const opex = -(opexBase * opexFactor);
      
      // Calculate EBITDA
      const ebitda = revenue + opex;
      
      // Calculate depreciation (only if within depreciation period)
      const depreciation = year < (assetStartYear + depreciationPeriod) ? -annualDepreciation : 0;
      
      // Calculate debt service (only if within loan tenor)
      let interest = 0;
      let principalRepayment = 0;
      
      if (year < (assetStartYear + tenorYears)) {
        // Use Project Finance tab calculations for debt service
        if (debtStructure === 'amortization') {
          // For amortization, use standard formulas
          const yearsRemaining = assetStartYear + tenorYears - year;
          const totalPayment = calculateAmortizationPayment(debtAmount * (yearsRemaining / tenorYears), interestRate, yearsRemaining);
          interest = -(debtAmount * (yearsRemaining / tenorYears) * interestRate);
          principalRepayment = -(totalPayment - Math.abs(interest));
        } else {
          // For sculpting, use a simpler approximation based on years passed
          const yearsSinceStart = year - assetStartYear;
          const remainingPrincipal = debtAmount * (1 - yearsSinceStart / tenorYears);
          interest = -(remainingPrincipal * interestRate);
          principalRepayment = -(debtAmount / tenorYears);
        }
      }
      
      // Calculate EBIT (EBITDA - Depreciation)
      const ebit = ebitda + depreciation;
      
      // Calculate EBT (EBIT - Interest)
      const ebt = ebit + interest;
      
      // Calculate tax using the shared corporate tax rate
      const tax = ebt < 0 ? 0 : -(ebt * constants.corporateTaxRate / 100);
      
      // Calculate NPAT
      const npat = ebt + tax;

      // Add to platform totals
      const platformYearIndex = year - years[0];
      platformPL[platformYearIndex].revenue += revenue;
      platformPL[platformYearIndex].assetOpex += opex;
      platformPL[platformYearIndex].ebitda += ebitda;
      platformPL[platformYearIndex].depreciation += depreciation;
      platformPL[platformYearIndex].interest += interest;
      platformPL[platformYearIndex].principalRepayment += principalRepayment;
      platformPL[platformYearIndex].ebt += ebt;
      
      // Add to quarterly data
      for (let quarter = 1; quarter <= 4; quarter++) {
        const quarterStr = `${year}-Q${quarter}`;
        const quarterIndex = quarters.findIndex(q => q.period === quarterStr);
        if (quarterIndex !== -1) {
          // Divide annual values by 4 for quarterly approximation (except revenue which we calculated separately)
          quarters[quarterIndex].assetOpex += opex / 4;
          quarters[quarterIndex].depreciation += depreciation / 4;
          quarters[quarterIndex].interest += interest / 4;
          quarters[quarterIndex].principalRepayment += principalRepayment / 4;
        }
      }

      return {
        year,
        period: year.toString(),
        revenue,
        opex,
        ebitda,
        depreciation,
        ebit,
        interest,
        principalRepayment,
        ebt,
        tax,
        npat
      };
    });
  });

  // Add platform opex and recalculate platform P&L
  platformPL.forEach((yearData, i) => {
    // Calculate platform opex with escalation
    const platformOpexFactor = Math.pow(1 + platformOpexEscalation / 100, i);
    const yearPlatformOpex = -(platformOpex * platformOpexFactor);
    
    // Update platform opex
    yearData.platformOpex = yearPlatformOpex;
    
    // Recalculate EBITDA explicitly (to avoid accumulation errors)
    yearData.ebitda = yearData.revenue + yearData.assetOpex + yearPlatformOpex;
    
    // Calculate EBIT (EBITDA - Depreciation)
    yearData.ebit = yearData.ebitda + yearData.depreciation;
    
    // Recalculate EBT (EBIT - Interest)
    yearData.ebt = yearData.ebit + yearData.interest;
    
    // Use a default tax rate if undefined
    const corporateTaxRate = constants.corporateTaxRate !== undefined ? constants.corporateTaxRate : 0;
    yearData.tax = yearData.ebt < 0 ? 0 : -(yearData.ebt * corporateTaxRate / 100);
    
    // Calculate NPAT
    yearData.npat = yearData.ebt + yearData.tax;
    
    // Calculate EBITDA margin as EBITDA / Revenue
    yearData.ebitdaMargin = yearData.revenue !== 0 ? yearData.ebitda / yearData.revenue : 0;
  });
  
  // Update quarterly data
  quarters.forEach((quarterData, i) => {
    // Calculate platform opex with escalation (year index)
    const yearIndex = quarterData.year - years[0];
    const quarterPlatformOpexFactor = Math.pow(1 + platformOpexEscalation / 100, yearIndex);
    const quarterPlatformOpex = -(platformOpex * quarterPlatformOpexFactor) / 4; // Divide by 4 for quarterly
    
    // Update platform opex
    quarterData.platformOpex = quarterPlatformOpex;
    
    // Recalculate EBITDA with platform opex
    quarterData.ebitda = quarterData.revenue + quarterData.assetOpex + quarterPlatformOpex;
    
    // Calculate EBIT (EBITDA - Depreciation)
    quarterData.ebit = quarterData.ebitda + quarterData.depreciation;
    
    // Recalculate EBT (EBIT - Interest)
    quarterData.ebt = quarterData.ebit + quarterData.interest;
    
    // Calculate tax using the shared corporate tax rate
    quarterData.tax = quarterData.ebt < 0 ? 0 : -(quarterData.ebt * constants.corporateTaxRate / 100);
    
    // Calculate NPAT
    quarterData.npat = quarterData.ebt + quarterData.tax;
    
    // Calculate EBITDA margin as EBITDA / Revenue
    quarterData.ebitdaMargin = quarterData.revenue !== 0 ? quarterData.ebitda / quarterData.revenue : 0;
  });

  return { assetPL, platformPL, quarters };
};

/**
 * Calculates cash flow data based on the P&L results
 * @param {Array} platformPL - Platform P&L data
 * @param {Array} quarters - Quarterly P&L data
 * @param {Number} dividendPolicy - Dividend payout ratio (%)
 * @param {Number} minimumCashBalance - Minimum cash balance to maintain ($M)
 * @returns {Object} Annual and quarterly cash flow data
 */
/**
 * CORRECTED Cash Flow Calculation Function
 * 
 * Key fixes:
 * 1. Fixed FCFE calculation to properly subtract outflows
 * 2. Improved cash flow logic and documentation
 * 3. Better handling of cash flow signs and calculations
 */

/**
 * Calculates cash flow data based on the P&L results - CORRECTED VERSION
 * @param {Array} platformPL - Platform P&L data
 * @param {Array} quarters - Quarterly P&L data
 * @param {Number} dividendPolicy - Dividend payout ratio (%)
 * @param {Number} minimumCashBalance - Minimum cash balance to maintain ($M)
 * @returns {Object} Annual and quarterly cash flow data
 */
export const calculateCashFlow = (
  platformPL,
  quarters,
  dividendPolicy,
  minimumCashBalance
) => {
  if (!platformPL || platformPL.length === 0) {
    return { annual: [], quarterly: [] };
  }
  
  // Transform P&L data to cash flow format
  let cashBalance = minimumCashBalance; // Start with the minimum cash balance
  let retainedEarnings = 0;
  
  const annualCashFlow = platformPL.map((yearData, index) => {
    // Operating cash flow is EBITDA (positive inflow)
    const operatingCashFlow = yearData.ebitda || 0;
    
    // CORRECTED: Tax, interest, and principal are cash OUTFLOWS
    // P&L stores these as negative values, so we need to handle them correctly
    const taxPayment = yearData.tax || 0; // Already negative in P&L
    const interestPayment = yearData.interest || 0; // Already negative in P&L  
    const principalPayment = yearData.principalRepayment || 0; // Already negative in P&L
    
    // Total debt service (both components are negative, so sum gives total outflow)
    const totalDebtService = interestPayment + principalPayment;
    
    // CORRECTED FCFE CALCULATION:
    // Since tax and debt service are already negative in P&L, we add them
    // This effectively subtracts the outflows from operating cash flow
    const fcfe = operatingCashFlow + taxPayment + totalDebtService;
    
    // Alternative clearer calculation (same result):
    // const fcfe = operatingCashFlow - Math.abs(taxPayment) - Math.abs(totalDebtService);
    
    // Update cash balance before dividend calculation
    const potentialCashBalance = cashBalance + fcfe;
    
    // Calculate potential dividend
    let dividend = 0;
    if (yearData.npat > 0 && potentialCashBalance > minimumCashBalance) {
      // Dividend is limited by both policy and available cash above minimum
      const policyDividend = yearData.npat * (dividendPolicy / 100);
      const cashConstrainedDividend = potentialCashBalance - minimumCashBalance;
      dividend = Math.min(policyDividend, cashConstrainedDividend);
      dividend = Math.max(0, dividend); // Ensure non-negative
      
      console.log(`Year ${yearData.year}: NPAT=${yearData.npat.toFixed(2)}M, FCFE=${fcfe.toFixed(2)}M, Cash=${potentialCashBalance.toFixed(2)}M, Dividend=${dividend.toFixed(2)}M`);
    } else {
      // Log reason for no dividend
      if (yearData.npat <= 0) {
        console.log(`Year ${yearData.year}: No dividend - NPAT is ${yearData.npat.toFixed(2)}M (must be positive)`);
      } else if (potentialCashBalance <= minimumCashBalance) {
        console.log(`Year ${yearData.year}: No dividend - Cash ${potentialCashBalance.toFixed(2)}M ≤ minimum ${minimumCashBalance.toFixed(2)}M`);
      }
    }
    
    // Net cash flow and final cash balance
    const netCashFlow = fcfe - dividend;
    cashBalance = potentialCashBalance - dividend;
    
    // Update retained earnings (cumulative NPAT minus cumulative dividends)
    retainedEarnings = retainedEarnings + yearData.npat - dividend;
    
    return {
      year: yearData.year,
      period: yearData.period,
      
      // Cash flow components (formatted for clarity)
      operatingCashFlow: operatingCashFlow,
      taxPayment: taxPayment, // Negative (outflow)
      interestPayment: interestPayment, // Negative (outflow)
      principalPayment: principalPayment, // Negative (outflow)
      totalDebtService: totalDebtService, // Negative (total debt outflow)
      
      // Key cash flow metrics
      fcfe: fcfe, // Free Cash Flow to Equity
      dividendPayment: -dividend, // Negative (outflow) for consistency
      netCashFlow: netCashFlow,
      cashBalance: cashBalance,
      retainedEarnings: retainedEarnings,
      
      // Legacy fields for backward compatibility
      tax: taxPayment,
      interest: interestPayment,
      principalRepayment: principalPayment,
      debtService: totalDebtService,
      dividend: -dividend
    };
  });
  
  // Create quarterly cash flow data with same corrected logic
  cashBalance = minimumCashBalance;
  retainedEarnings = 0;
  
  const quarterlyCashFlow = quarters.map((quarterData, index) => {
    // Operating cash flow is EBITDA
    const operatingCashFlow = quarterData.ebitda || 0;
    
    // Cash outflows (already negative in P&L)
    const taxPayment = quarterData.tax || 0;
    const interestPayment = quarterData.interest || 0;
    const principalPayment = quarterData.principalRepayment || 0;
    const totalDebtService = interestPayment + principalPayment;
    
    // CORRECTED FCFE calculation
    const fcfe = operatingCashFlow + taxPayment + totalDebtService;
    
    // Update cash balance before dividend
    const potentialCashBalance = cashBalance + fcfe;
    
    // Calculate quarterly dividend (annual policy / 4)
    let dividend = 0;
    if (quarterData.npat > 0 && potentialCashBalance > minimumCashBalance) {
      // Quarterly dividend policy
      const quarterlyDividendRate = dividendPolicy / 4 / 100; // Annual rate divided by 4
      const policyDividend = quarterData.npat * quarterlyDividendRate;
      const cashConstrainedDividend = potentialCashBalance - minimumCashBalance;
      dividend = Math.min(policyDividend, cashConstrainedDividend);
      dividend = Math.max(0, dividend);
      
      console.log(`Quarter ${quarterData.period}: NPAT=${quarterData.npat.toFixed(2)}M, FCFE=${fcfe.toFixed(2)}M, Cash=${potentialCashBalance.toFixed(2)}M, Dividend=${dividend.toFixed(2)}M`);
    } else {
      if (quarterData.npat <= 0) {
        console.log(`Quarter ${quarterData.period}: No dividend - NPAT is ${quarterData.npat.toFixed(2)}M`);
      } else if (potentialCashBalance <= minimumCashBalance) {
        console.log(`Quarter ${quarterData.period}: No dividend - Cash ${potentialCashBalance.toFixed(2)}M ≤ minimum ${minimumCashBalance.toFixed(2)}M`);
      }
    }
    
    // Update cash balance and retained earnings
    const netCashFlow = fcfe - dividend;
    cashBalance = potentialCashBalance - dividend;
    retainedEarnings = retainedEarnings + quarterData.npat - dividend;
    
    return {
      year: quarterData.year,
      quarter: quarterData.quarter,
      period: quarterData.period,
      
      // Cash flow components
      operatingCashFlow: operatingCashFlow,
      taxPayment: taxPayment,
      interestPayment: interestPayment,
      principalPayment: principalPayment,
      totalDebtService: totalDebtService,
      
      // Key metrics
      fcfe: fcfe,
      dividendPayment: -dividend,
      netCashFlow: netCashFlow,
      cashBalance: cashBalance,
      retainedEarnings: retainedEarnings,
      
      // Legacy fields for backward compatibility
      tax: taxPayment,
      interest: interestPayment,
      principalRepayment: principalPayment,
      debtService: totalDebtService,
      dividend: -dividend
    };
  });
  
  return { annual: annualCashFlow, quarterly: quarterlyCashFlow };
};

/**
 * Utility function to generate years array from start to end year
 * @param {Number} startYear - Start year 
 * @param {Number} endYear - End year
 * @returns {Array} Array of years
 */
export const generateYears = (startYear, endYear) => {
  return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
};

/**
 * Format currency for display
 * @param {Number} value - Value to format 
 * @param {Number} decimals - Number of decimal places
 * @returns {String} Formatted currency string
 */
/**
 * Format currency for display
 * @param {Number} value - Value to format 
 * @param {Number} decimals - Number of decimal places
 * @returns {String} Formatted currency string
 */
export const formatCurrency = (value, decimals = 1) => {
  // Handle undefined, null or NaN values
  if (value === undefined || value === null || isNaN(value)) {
    return '$0.0M';
  }
  return `${value.toFixed(decimals)}M`;
};
export const generateBalanceSheet = (
  plData, 
  cashFlowData, 
  assets, 
  constants, 
  newInvestorsPercentage = 80, 
  zenPercentage = 20
) => {
  // Skip if no data
  if (!plData || !cashFlowData || plData.length === 0 || cashFlowData.length === 0 || !assets) {
    return [];
  }
  
  // Get initial values
  const balanceSheetData = [];
  
  // Calculate total capex from all assets
  const totalCapex = Object.values(assets).reduce((sum, asset) => {
    const assetCosts = constants.assetCosts[asset.name] || {};
    return sum + (assetCosts.capex || 0);
  }, 0);
  
  // Default values for equity structure
  const initialEquity = {
    newInvestors: totalCapex * (newInvestorsPercentage / 100), // New investors percentage of capex
    zenContribution: totalCapex * (zenPercentage / 100), // ZEN percentage of capex
    assetCoRepayment: -50 // Default $50M repayment to AssetCo
  };
  
  // Total initial investment
  const totalInvestment = initialEquity.newInvestors + initialEquity.zenContribution + 
                         Math.abs(initialEquity.assetCoRepayment);
  
  // Calculate acquisition premium (goodwill)
  const acquisitionPremium = Math.max(0, totalInvestment - totalCapex);
  
  let retainedEarnings = 0;
  let cashBalance = constants.minimumCashBalance || 5.0;
  let cumulativeDepreciation = 0; // Track cumulative depreciation for fixed assets calculation
  
  // Get initial debt amounts from project finance data
  const initialDebt = Object.values(assets).reduce((sum, asset) => {
    const assetCosts = constants.assetCosts[asset.name] || {};
    const gearing = assetCosts.calculatedGearing || assetCosts.maxGearing || 0.7;
    return sum + ((assetCosts.capex || 0) * gearing);
  }, 0);
  
  // Iterate through P&L and cashflow data to calculate balance sheet
  for (let i = 0; i < plData.length; i++) {
    const pnlData = plData[i];
    const cfData = cashFlowData.find(cf => cf.period === pnlData.period) || {
      cashBalance: 0,
      interest: 0,
      tax: 0,
      dividend: 0,
      principalRepayment: 0
    };
    
    // Update cumulative depreciation
    cumulativeDepreciation += Math.abs(pnlData.depreciation || 0);
    
    // Calculate balance sheet data
    const balanceSheet = {
      period: pnlData.period,
      year: pnlData.year || parseInt(pnlData.period),
      
      // ASSETS
      cash: cfData.cashBalance || 0,
      receivables: (pnlData.revenue * 0.1), // Assumption: 10% of revenue
      acquisitionPremium: acquisitionPremium,
      fixedAssets: totalCapex - cumulativeDepreciation, // Use cumulative depreciation
      goodwill: acquisitionPremium * 0.5, // Simplified goodwill calculation
      otherAssets: totalCapex * 0.05, // Other assets as percentage of capex
      deferredTaxAssets: Math.max(0, pnlData.tax < 0 ? -pnlData.tax : 0),
      
      // LIABILITIES
      payables: (pnlData.assetOpex + pnlData.platformOpex) * 0.08, // Assume 1 month of opex
      interestPayables: pnlData.interest * 0.25, // Assume one quarter of interest
      taxPayables: pnlData.tax < 0 ? -pnlData.tax * 0.25 : 0,
      dividendPayables: cfData.dividend < 0 ? -cfData.dividend * 0.25 : 0,
      deferredTaxLiabilities: Math.max(0, pnlData.tax > 0 ? pnlData.tax : 0),
    };
    
    // Calculate Senior Debt - Direct from project finance
    if (i === 0) {
      // For first period, use the initial debt - IMPORTANT: store as positive number for liabilities
      balanceSheet.seniorDebt = Math.abs(initialDebt); 
      balanceSheet.portfolioFinancing = 0; // Initial period has no portfolio financing
    } else {
      // For subsequent periods, use debt repayments from cash flow
      const prevSheet = balanceSheetData[i-1];
      
      // Get principal repayment from cash flow data
      const principalPayment = Math.abs(cfData.principalRepayment || 0);
      
      // Debt decreases by principal payment amount
      // The senior debt is stored as positive for liabilities, subtract payments
      balanceSheet.seniorDebt = Math.max(0, prevSheet.seniorDebt - principalPayment);
      
      // Portfolio financing can be added here if needed
      balanceSheet.portfolioFinancing = 0; // Placeholder for portfolio financing
    }
    
    // Calculate totals for assets
    balanceSheet.totalAssets = balanceSheet.cash + 
                             balanceSheet.receivables +
                             balanceSheet.acquisitionPremium +
                             balanceSheet.fixedAssets + 
                             balanceSheet.goodwill +
                             balanceSheet.otherAssets +
                             balanceSheet.deferredTaxAssets;
    
    // Calculate totals for liabilities
    balanceSheet.totalLiabilities = balanceSheet.payables +
                                  balanceSheet.interestPayables +
                                  balanceSheet.taxPayables +
                                  balanceSheet.dividendPayables +
                                  balanceSheet.seniorDebt +
                                  balanceSheet.portfolioFinancing +
                                  balanceSheet.deferredTaxLiabilities;
    
    // Calculate updated retained earnings
    if (i > 0) {
      retainedEarnings += pnlData.npat + (cfData.dividend || 0);
      balanceSheet.retainedEarnings = retainedEarnings;
    } else {
      retainedEarnings = 0;
      balanceSheet.retainedEarnings = 0;
    }
    
    // EQUITY (set on first record, then updated)
    balanceSheet.newInvestorsCapital = initialEquity.newInvestors;
    balanceSheet.zenContribution = initialEquity.zenContribution;
    balanceSheet.assetCoRepayment = initialEquity.assetCoRepayment;
    
    // Calculate total equity
    balanceSheet.totalEquity = balanceSheet.newInvestorsCapital +
                             balanceSheet.zenContribution +
                             balanceSheet.assetCoRepayment +
                             balanceSheet.retainedEarnings;
    
    // Verify balance sheet equation: Assets = Liabilities + Equity
    balanceSheet.balanceCheck = Math.abs(
      balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)
    ) < 0.01; // Allow small rounding errors
    
    balanceSheetData.push(balanceSheet);
  }
  
  return balanceSheetData;
};