/**
 * Default Constants Reference File
 * Path: C:\Projects\renew-asset-performance\src\lib\default_constants.js
 * 
 * This file contains all default values used throughout the portfolio management application.
 * These constants serve as fallback values when user-defined values are not provided.
 */

// Asset Cost Parameters - Default capex and opex rates by technology
export const DEFAULT_CAPEX_RATES = {
  solar: 1.2,     // $M per MW
  wind: 2.5,      // $M per MW
  storage: 1.6,   // $M per MW
  default: 2.0    // $M per MW
};

export const DEFAULT_OPEX_RATES = {
  solar: 0.014,    // $M per MW per annum
  wind: 0.040,     // $M per MW per annum
  storage: 0.015,  // $M per MW per annum
  default: 0.030   // $M per MW per annum
};

// Project Finance Parameters - Default debt and financing assumptions
export const DEFAULT_PROJECT_FINANCE = {
  maxGearing: 70,              // %
  targetDSCRContract: 1.35,    // x
  targetDSCRMerchant: 2.00,    // x
  interestRate: 6.0,           // %
  opexEscalation: 2.5,         // %
  tenorYears: {
    solar: 22,                 // years
    wind: 22,                  // years
    storage: 18,               // years
    default: 20                // years
  }
};

// Platform Management - Corporate-level operational costs and policies
export const DEFAULT_PLATFORM_COSTS = {
  platformOpex: 4.2,           // $M per annum
  otherOpex: 1.0,              // $M per annum
  platformOpexEscalation: 2.5, // %
  dividendPolicy: 85,          // %
  minimumCashBalance: 5.0      // $M
};

// Tax and Depreciation - Corporate tax and asset depreciation settings
export const DEFAULT_TAX_DEPRECIATION = {
  corporateTaxRate: 0,         // %
  deprecationPeriods: {
    solar: 30,                 // years
    wind: 30,                  // years
    storage: 20                // years
  }
};

// Valuation - Discount rates for NPV calculations
export const DEFAULT_DISCOUNT_RATES = {
  contract: 8.0,               // %
  merchant: 10.0               // %
};

// Risk Analysis - Monte Carlo simulation parameters
export const DEFAULT_RISK_PARAMETERS = {
  volumeVariation: 20,         // ±%
  EnergyPriceVariation: 20,    // ±%
  greenPriceVariation: 20      // ±%
};

// Price Settings - Real-to-nominal price conversion
export const DEFAULT_PRICE_SETTINGS = {
  escalation: 2.5,             // %
  referenceYear: new Date().getFullYear()
};

// Asset Performance Parameters - Default degradation and construction periods
export const DEFAULT_ASSET_PERFORMANCE = {
  annualDegradation: {
    solar: 0.4,                // % per year
    wind: 0.3,                 // % per year  
    storage: 0.5               // % per year
  },
  constructionDuration: {
    solar: 12,                 // months
    wind: 18,                  // months
    storage: 12                // months
  },
  assetLife: {
    solar: 35,                 // years
    wind: 30,                  // years
    storage: 20                // years
  },
  volumeLossAdjustment: 95     // % - default MLF/availability
};

// Terminal Value Rates - Default end-of-life asset values
export const DEFAULT_TERMINAL_RATES = {
  solar: 0.15,                 // $M per MW
  wind: 0.20,                  // $M per MW
  storage: 0.10,               // $M per MW
  default: 0.15                // $M per MW
};

// Analysis Parameters - Default analysis period settings
export const DEFAULT_ANALYSIS_SETTINGS = {
  analysisStartYear: new Date().getFullYear(),
  analysisEndYear: new Date().getFullYear() + 30,
  analysisLength: 30           // years
};

// Data Sources - Default price curve sources
export const DEFAULT_DATA_SOURCES = {
  priceCurveSource: 'merchant_price_monthly.csv',
  availableSources: [
    { value: 'merchant_price_monthly.csv', label: 'Monthly Merchant Prices' },
    { value: 'imported', label: 'Imported Prices' }
  ]
};

// System Constants - Fixed technical parameters
export const DEFAULT_SYSTEM_CONSTANTS = {
  HOURS_IN_YEAR: 8760,
  priceAggregation: 'yearly'
};

// Capacity Factors - Default generation profiles by technology and region
export const DEFAULT_CAPACITY_FACTORS = {
  annual: {
    solar: { NSW: 0.28, VIC: 0.25, QLD: 0.29, SA: 0.27 },
    wind: { NSW: 0.35, VIC: 0.38, QLD: 0.32, SA: 0.40 }
  },
  quarterly: {
    solar: {
      NSW: { Q1: 0.32, Q2: 0.26, Q3: 0.24, Q4: 0.30 },
      VIC: { Q1: 0.29, Q2: 0.23, Q3: 0.21, Q4: 0.27 },
      QLD: { Q1: 0.33, Q2: 0.28, Q3: 0.25, Q4: 0.30 },
      SA:  { Q1: 0.31, Q2: 0.25, Q3: 0.23, Q4: 0.29 }
    },
    wind: {
      NSW: { Q1: 0.32, Q2: 0.35, Q3: 0.38, Q4: 0.35 },
      VIC: { Q1: 0.35, Q2: 0.38, Q3: 0.42, Q4: 0.37 },
      QLD: { Q1: 0.29, Q2: 0.32, Q3: 0.35, Q4: 0.32 },
      SA:  { Q1: 0.37, Q2: 0.40, Q3: 0.44, Q4: 0.39 }
    }
  }
};

// Utility Functions for working with defaults
export const getDefaultValue = (category, key, assetType = null) => {
  const categoryMap = {
    capex: DEFAULT_CAPEX_RATES,
    opex: DEFAULT_OPEX_RATES,
    finance: DEFAULT_PROJECT_FINANCE,
    platform: DEFAULT_PLATFORM_COSTS,
    tax: DEFAULT_TAX_DEPRECIATION,
    discount: DEFAULT_DISCOUNT_RATES,
    risk: DEFAULT_RISK_PARAMETERS,
    price: DEFAULT_PRICE_SETTINGS,
    data: DEFAULT_DATA_SOURCES,
    performance: DEFAULT_ASSET_PERFORMANCE,
    terminal: DEFAULT_TERMINAL_RATES,
    analysis: DEFAULT_ANALYSIS_SETTINGS,
    system: DEFAULT_SYSTEM_CONSTANTS,
    capacity: DEFAULT_CAPACITY_FACTORS
  };

  const categoryDefaults = categoryMap[category];
  if (!categoryDefaults) return null;

  if (assetType && categoryDefaults[assetType] !== undefined) {
    return categoryDefaults[assetType];
  }

  return categoryDefaults[key] || categoryDefaults.default;
};

// Asset type validation
export const VALID_ASSET_TYPES = ['solar', 'wind', 'storage'];

export const isValidAssetType = (assetType) => {
  return VALID_ASSET_TYPES.includes(assetType);
};

// Formatting utilities
export const formatPercent = (value) => `${value}%`;
export const formatCurrency = (value) => `$${value}M`;
export const formatRate = (value) => `$${value}M/MW`;
export const formatMultiplier = (value) => `${value}x`;
export const formatYears = (value) => `${value} years`;

// Constants for UI consistency
export const UI_CONSTANTS = {
  colors: {
    defaultValue: 'text-blue-600',
    userValue: 'text-black',
    tableHeader: 'font-medium'
  },
  spacing: {
    cardGap: 'space-y-6',
    contentPadding: 'p-4',
    gridGap: 'gap-6'
  }
};

export default {
  DEFAULT_CAPEX_RATES,
  DEFAULT_OPEX_RATES,
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_PLATFORM_COSTS,
  DEFAULT_TAX_DEPRECIATION,
  DEFAULT_DISCOUNT_RATES,
  DEFAULT_RISK_PARAMETERS,
  DEFAULT_PRICE_SETTINGS,
  DEFAULT_DATA_SOURCES,
  DEFAULT_ASSET_PERFORMANCE,
  DEFAULT_TERMINAL_RATES,
  DEFAULT_ANALYSIS_SETTINGS,
  DEFAULT_SYSTEM_CONSTANTS,
  DEFAULT_CAPACITY_FACTORS,
  getDefaultValue,
  VALID_ASSET_TYPES,
  isValidAssetType,
  formatPercent,
  formatCurrency,
  formatRate,
  formatMultiplier,
  formatYears,
  UI_CONSTANTS
};