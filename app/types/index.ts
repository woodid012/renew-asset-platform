// app/types/index.ts - Updated with LWP Support and TimeSeriesRow

export interface TimeSeriesDataPoint {
  period: string; // YYYY-MM format
  volume: number; // MWh
  date?: Date;
  lwpPercentage?: number; // LWP percentage from your database (e.g., 0.98 = 98%)
}

export interface SettingsData {
  contractTypes: {
    retail: string[];
    wholesale: string[];
    offtake: string[];
  };
  volumeShapes: { [key: string]: number[] };
  states: string[];
  indexationTypes: string[];
  unitTypes: string[];
}

export interface PriceCurve {
  name: string;
  type: 'forward' | 'historical';
  data: Array<{ date: string; price: number }>;
}

export interface ContractRequirement {
  id: string;
  label: string;
  details: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

// NEW: Time Series Output Row with LWP Support
export interface TimeSeriesRow {
  buysell: string;
  deal_name: string;
  state: string;
  type: string;
  month_start: number;
  year: number;
  fy: number;
  unit: string;
  scenario: string;
  sub_type: string;
  volume_pct: number;
  volume_mwh: string;
  strike_price: number;
  strike_price_x_volume: number;
  market_price: number;
  market_price_x_volume: number;
  lwp_percentage: number; // NEW: LWP percentage field
  lwp_price: number; // NEW: LWP price field
  lwp_value: number; // NEW: LWP value field
  net_mtm: number; // NOW: Based on LWP instead of market price
}

export interface Contract {
  _id?: string;
  id?: number;
  name: string;
  type: 'retail' | 'wholesale' | 'offtake';
  category: string;
  state: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  annualVolume: number;
  strikePrice: number;
  unit: string;
  contractType?: string;
  direction: 'buy' | 'sell'; // Buy or Sell direction
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  indexation: string;
  referenceDate: string;
  pricingType?: 'fixed' | 'escalation' | 'timeseries' | 'custom_time_of_day';
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  productDetail?: 'CY' | 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

  // Enhanced volume fields
  timeSeriesData?: TimeSeriesDataPoint[];
  volumeTimeSeries?: number[]; // Direct volume time series (like priceTimeSeries)
  volumeInterval?: 'monthly' | 'quarterly' | 'yearly'; // Volume interval (like priceInterval)
  tenor?: {
    value: number;
    unit: 'months' | 'years';
  };
  dataSource?: 'manual' | 'csv_import' | 'api_import';
  yearsCovered?: number[];
  totalVolume?: number;
  

  // Time-based pricing
  timeBasedPricing?: {
    periods: Array<{
      id: string;
      name: string;
      price: number;
      startTime: string;
      endTime: string;
      daysOfWeek: boolean[];
    }>;
    defaultPrice: number;
  };

  // Contract requirements
  contractRequirements?: ContractRequirement[];

  // Load Weighted Price (LWP) Configuration
  lwpPercentage?: number; // Default LWP percentage (default: 100%)
  lwpTimeSeries?: number[]; // Future: Monthly LWP percentages [95, 98, 100, 102, ...]
  lwpInterval?: 'monthly' | 'quarterly' | 'yearly'; // Future: LWP interval matching price/volume intervals
  lwpNotes?: string; // Optional notes about LWP configuration
}