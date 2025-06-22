// Updated forecast calculations with construction ramp-up logic
import { calculateAssetRevenue } from '@/components/RevCalculations';
import { calculateStressRevenue } from '@/components/ValuationAnalysis_Calcs';

// Utility functions for formatting
export const formatCurrency = (value, showMillions = true) => {
  if (value === undefined || value === null || isNaN(value)) return '$0.0';
  const formatted = Math.abs(value).toFixed(1);
  const sign = value < 0 ? '-' : '';
  return `${sign}$${formatted}${showMillions ? 'M' : ''}`;
};

export const formatPercent = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};

/**
 * Calculate construction ramp-up for an asset
 * Returns the cumulative CAPEX invested by a given year
 */
export const calculateConstructionRampUp = (asset, year, constants) => {
  const assetCosts = constants.assetCosts[asset.name] || {};
  const totalCapex = assetCosts.capex || 0;
  
  // Get construction and operation dates
  const assetStartDate = new Date(asset.assetStartDate);
  const operationStartYear = assetStartDate.getFullYear();
  
  // Default construction period (can be made configurable per asset)
  const constructionPeriodYears = assetCosts.constructionPeriodYears || 2;
  const constructionStartYear = operationStartYear - constructionPeriodYears;
  
  // Before construction starts
  if (year < constructionStartYear) {
    return 0;
  }
  
  // After operation starts - full CAPEX invested
  if (year >= operationStartYear) {
    return totalCapex;
  }
  
  // During construction - linear ramp up
  const constructionYearsElapsed = year - constructionStartYear + 1;
  const totalConstructionYears = operationStartYear - constructionStartYear;
  const completionRatio = constructionYearsElapsed / totalConstructionYears;
  
  return totalCapex * completionRatio;
};

/**
 * Calculate annual CAPEX spend for an asset in a given year
 */
export const calculateAnnualCapexSpend = (asset, year, constants) => {
  const currentYearCumulative = calculateConstructionRampUp(asset, year, constants);
  const previousYearCumulative = calculateConstructionRampUp(asset, year - 1, constants);
  
  return currentYearCumulative - previousYearCumulative;
};

/**
 * Calculate individual asset P&L using real portfolio data
 */
export const calculateAssetPL = (
  asset,
  constants,
  years,
  getMerchantPrice,
  selectedRevenueCase = 'base'
) => {
  const assetStartYear = new Date(asset.assetStartDate).getFullYear();
  const assetLife = parseInt(asset.assetLife) || 30;
  const assetEndYear = assetStartYear + assetLife;
  
  // Get asset costs
  const assetCosts = constants.assetCosts[asset.name] || {};
  const totalCapex = assetCosts.capex || 0;
  const opexBase = assetCosts.operatingCosts || 0;
  const opexEscalation = assetCosts.operatingCostEscalation || 2.5;
  
  // Depreciation settings
  const depreciationPeriod = constants.deprecationPeriods?.[asset.type] || 30;
  const annualDepreciation = totalCapex / depreciationPeriod;
  
  // Debt parameters
  const interestRate = assetCosts.interestRate || 0.06;
  const calculatedGearing = assetCosts.calculatedGearing || 0.7;
  const debtAmount = totalCapex * calculatedGearing;
  const tenorYears = assetCosts.tenorYears || 15;
  
  let cumulativeDepreciation = 0;
  let remainingDebt = 0; // Debt starts at 0 and builds up during construction
  
  return years.map((year, yearIndex) => {
    // Calculate construction progress
    const cumulativeCapexInvested = calculateConstructionRampUp(asset, year, constants);
    const annualCapexSpend = calculateAnnualCapexSpend(asset, year, constants);
    
    // Calculate debt drawdown (proportional to CAPEX spend)
    const annualDebtDrawdown = annualCapexSpend * calculatedGearing;
    remainingDebt += annualDebtDrawdown;
    
    // Revenue only starts when asset is operational
    let revenue = 0;
    if (year >= assetStartYear && year < assetEndYear) {
      const assetYearIndex = year - assetStartYear;
      
      try {
        const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
        let stressedRevenue = baseRevenue;
        
        if (selectedRevenueCase !== 'base') {
          stressedRevenue = calculateStressRevenue(baseRevenue, selectedRevenueCase, constants);
        }
        
        revenue = stressedRevenue.contractedGreen + 
                  stressedRevenue.contractedEnergy + 
                  stressedRevenue.merchantGreen + 
                  stressedRevenue.merchantEnergy;
      } catch (err) {
        console.error(`Error calculating revenue for ${asset.name} in ${year}:`, err);
        revenue = 0;
      }
    }

    // Operating expenses only when operational
    let operatingExpenses = 0;
    if (year >= assetStartYear && year < assetEndYear) {
      const assetYearIndex = year - assetStartYear;
      const opexFactor = Math.pow(1 + opexEscalation / 100, assetYearIndex);
      operatingExpenses = opexBase * opexFactor;
    }
    
    // Calculate EBITDA
    const ebitda = revenue - operatingExpenses;
    
    // Calculate depreciation (only if asset is operational and within depreciation period)
    let depreciation = 0;
    if (year >= assetStartYear && year < (assetStartYear + depreciationPeriod)) {
      depreciation = annualDepreciation;
      cumulativeDepreciation += depreciation;
    }
    
    // Calculate EBIT
    const ebit = ebitda - depreciation;
    
    // Calculate debt service (only if debt exists)
    let interestExpense = 0;
    let principalRepayment = 0;
    
    if (remainingDebt > 0) {
      interestExpense = remainingDebt * interestRate;
      
      // Principal repayment starts when asset is operational and within tenor
      if (year >= assetStartYear && year < (assetStartYear + tenorYears)) {
        principalRepayment = Math.min(debtAmount / tenorYears, remainingDebt);
        remainingDebt = Math.max(0, remainingDebt - principalRepayment);
      }
    }
    
    // Calculate EBT and tax
    const profitBeforeTax = ebit - interestExpense;
    const taxExpense = Math.max(0, profitBeforeTax * (constants.corporateTaxRate / 100));
    const netProfitAfterTax = profitBeforeTax - taxExpense;

    return {
      year,
      assetName: asset.name,
      revenue,
      operatingExpenses,
      ebitda,
      depreciation,
      ebit,
      interestExpense,
      profitBeforeTax,
      taxExpense,
      netProfitAfterTax,
      principalRepayment,
      cumulativeDepreciation,
      remainingDebt,
      // Construction tracking
      cumulativeCapexInvested,
      annualCapexSpend,
      annualDebtDrawdown
    };
  });
};

/**
 * Calculate portfolio-level P&L aggregating all assets
 */
export const calculatePortfolioPL = (
  assets,
  constants,
  years,
  getMerchantPrice,
  selectedRevenueCase = 'base'
) => {
  // Calculate P&L for each asset
  const assetPLs = {};
  Object.values(assets).forEach(asset => {
    assetPLs[asset.name] = calculateAssetPL(
      asset, 
      constants, 
      years, 
      getMerchantPrice, 
      selectedRevenueCase
    );
  });

  // Aggregate to portfolio level
  const portfolioPL = years.map((year, yearIndex) => {
    let totalRevenue = 0;
    let totalOperatingExpenses = 0;
    let totalDepreciation = 0;
    let totalInterestExpense = 0;
    let totalPrincipalRepayment = 0;
    let totalCumulativeDepreciation = 0;
    let totalRemainingDebt = 0;
    let totalCumulativeCapexInvested = 0;
    let totalAnnualCapexSpend = 0;
    let totalAnnualDebtDrawdown = 0;

    // Sum across all assets
    Object.values(assetPLs).forEach(assetPL => {
      const yearData = assetPL[yearIndex];
      if (yearData) {
        totalRevenue += yearData.revenue;
        totalOperatingExpenses += yearData.operatingExpenses;
        totalDepreciation += yearData.depreciation;
        totalInterestExpense += yearData.interestExpense;
        totalPrincipalRepayment += yearData.principalRepayment;
        totalCumulativeDepreciation += yearData.cumulativeDepreciation;
        totalRemainingDebt += yearData.remainingDebt;
        totalCumulativeCapexInvested += yearData.cumulativeCapexInvested;
        totalAnnualCapexSpend += yearData.annualCapexSpend;
        totalAnnualDebtDrawdown += yearData.annualDebtDrawdown;
      }
    });

    // Add platform operating expenses
    const platformOpexFactor = Math.pow(1 + (constants.platformOpexEscalation || 2.5) / 100, yearIndex);
    const platformOpex = (constants.platformOpex || 4.2) * platformOpexFactor;
    const totalOpex = totalOperatingExpenses + platformOpex;

    // Calculate portfolio totals
    const ebitda = totalRevenue - totalOpex;
    const ebit = ebitda - totalDepreciation;
    const profitBeforeTax = ebit - totalInterestExpense;
    const taxExpense = Math.max(0, profitBeforeTax * (constants.corporateTaxRate / 100));
    const netProfitAfterTax = profitBeforeTax - taxExpense;

    return {
      year,
      revenue: totalRevenue,
      assetOperatingExpenses: totalOperatingExpenses,
      platformOperatingExpenses: platformOpex,
      totalOperatingExpenses: totalOpex,
      ebitda,
      depreciation: totalDepreciation,
      ebit,
      interestExpense: totalInterestExpense,
      profitBeforeTax,
      taxExpense,
      netProfitAfterTax,
      principalRepayment: totalPrincipalRepayment,
      cumulativeDepreciation: totalCumulativeDepreciation,
      remainingDebt: totalRemainingDebt,
      // Construction tracking
      cumulativeCapexInvested: totalCumulativeCapexInvested,
      annualCapexSpend: totalAnnualCapexSpend,
      annualDebtDrawdown: totalAnnualDebtDrawdown
    };
  });

  return { assetPLs, portfolioPL };
};

/**
 * Calculate comprehensive 3-way forecast using real portfolio data with construction ramp-up
 */
export const calculateForecastData = (
  assets,
  constants,
  getMerchantPrice,
  scenario = 'base',
  viewBy = 'portfolio' // 'portfolio' or specific asset name
) => {
  const years = Array.from(
    { length: constants.analysisEndYear - constants.analysisStartYear + 1 },
    (_, i) => constants.analysisStartYear + i
  );

  // Calculate P&L data
  const { assetPLs, portfolioPL } = calculatePortfolioPL(
    assets,
    constants,
    years,
    getMerchantPrice,
    scenario
  );

  // Determine which P&L data to use based on viewBy
  let plData;
  if (viewBy === 'portfolio') {
    plData = portfolioPL;
  } else {
    // Show specific asset
    plData = assetPLs[viewBy] || [];
  }

  let cumulativeRetainedEarnings = 0;
  let cumulativeCashFlow = constants.minimumCashBalance || 5.0;
  let cumulativeEquityInvested = 0;

  const forecast = plData.map((plItem, index) => {
    const year = plItem.year;
    
    // === PROFIT & LOSS (already calculated) ===
    const grossRevenue = plItem.revenue || 0;
    const totalOperatingExpenses = viewBy === 'portfolio' ? 
      plItem.totalOperatingExpenses : plItem.operatingExpenses;
    const ebitda = plItem.ebitda || (grossRevenue - totalOperatingExpenses);
    const annualDepreciation = plItem.depreciation || 0;
    const ebit = plItem.ebit || (ebitda - annualDepreciation);
    const interestExpense = plItem.interestExpense || 0;
    const profitBeforeTax = plItem.profitBeforeTax || (ebit - interestExpense);
    const taxExpense = plItem.taxExpense || 0;
    const netProfitAfterTax = plItem.netProfitAfterTax || (profitBeforeTax - taxExpense);
    const principalRepayment = plItem.principalRepayment || 0;

    // Calculate annual equity investment (proportional to CAPEX spend)
    const annualCapexSpend = plItem.annualCapexSpend || 0;
    const annualDebtDrawdown = plItem.annualDebtDrawdown || 0;
    const annualEquityInvestment = annualCapexSpend - annualDebtDrawdown;
    cumulativeEquityInvested += annualEquityInvestment;

    // === BALANCE SHEET ===
    
    // Assets - using construction ramp-up data
    const cashAndBankBalances = cumulativeCashFlow;
    const accountsReceivable = grossRevenue * 0.083; // 1 month of revenue
    const totalCurrentAssets = cashAndBankBalances + accountsReceivable;
    
    // Property, plant and equipment based on cumulative CAPEX invested minus depreciation
    const cumulativeCapexInvested = plItem.cumulativeCapexInvested || 0;
    const cumulativeDepreciation = plItem.cumulativeDepreciation || 0;
    const propertyPlantEquipment = Math.max(0, cumulativeCapexInvested - cumulativeDepreciation);
    const totalNonCurrentAssets = propertyPlantEquipment;
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    
    // Liabilities
    const accountsPayable = totalOperatingExpenses * 0.083; // 1 month of expenses
    const accruals = taxExpense * 0.25; // Quarterly tax payments
    const totalCurrentLiabilities = accountsPayable + accruals;
    
    const longTermDebt = plItem.remainingDebt || 0;
    const totalNonCurrentLiabilities = longTermDebt;
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    
    // Equity - built up progressively during construction
    cumulativeRetainedEarnings += netProfitAfterTax;
    const dividendsPaid = Math.max(0, netProfitAfterTax * (constants.dividendPolicy || 85) / 100);
    cumulativeRetainedEarnings -= dividendsPaid;
    
    const shareCapital = cumulativeEquityInvested; // Progressive equity investment
    const totalEquity = shareCapital + cumulativeRetainedEarnings;
    
    // === CASH FLOW STATEMENT ===
    
    // Operating activities
    const operatingCashFlow = ebitda - taxExpense;
    
    // Investing activities - annual CAPEX spend
    const investingCashFlow = -annualCapexSpend;
    
    // Financing activities - progressive equity and debt investment
    const debtProceeds = annualDebtDrawdown;
    const equityRaised = annualEquityInvestment; // Equity invested this year
    const financingCashFlow = debtProceeds + equityRaised - principalRepayment - interestExpense - dividendsPaid;
    
    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
    cumulativeCashFlow += netCashFlow;

    return {
      year,
      viewBy,
      
      // P&L
      grossRevenue,
      totalOperatingExpenses,
      ebitda,
      annualDepreciation,
      ebit,
      interestExpense,
      profitBeforeTax,
      taxExpense,
      netProfitAfterTax,
      
      // Balance Sheet - Assets
      cashAndBankBalances,
      accountsReceivable,
      totalCurrentAssets,
      propertyPlantEquipment,
      totalNonCurrentAssets,
      totalAssets,
      
      // Balance Sheet - Liabilities
      accountsPayable,
      accruals,
      totalCurrentLiabilities,
      longTermDebt,
      totalNonCurrentLiabilities,
      totalLiabilities,
      
      // Balance Sheet - Equity
      shareCapital,
      retainedEarnings: cumulativeRetainedEarnings,
      totalEquity,
      
      // Cash Flow Statement
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      netCashFlow,
      cumulativeCashFlow,
      
      // Additional data
      dividendsPaid,
      principalRepayment,
      
      // Construction tracking
      cumulativeCapexInvested,
      annualCapexSpend: annualCapexSpend,
      annualEquityInvestment,
      cumulativeEquityInvested,
      
      // Key ratios
      debtToEquity: totalLiabilities > 0 ? totalLiabilities / Math.max(totalEquity, 1) : 0,
      currentRatio: totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : 0,
      ebitdaMargin: grossRevenue > 0 ? (ebitda / grossRevenue) * 100 : 0,
      returnOnAssets: totalAssets > 0 ? (netProfitAfterTax / totalAssets) * 100 : 0
    };
  });

  return { forecast, assetPLs, portfolioPL };
};