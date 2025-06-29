import sys
import os

# Add the backend directory to the Python path for module imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import json
import os
import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from config import DATE_FORMAT, OUTPUT_DATE_FORMAT, DEFAULT_CAPEX_FUNDING_TYPE, DEFAULT_DEBT_REPAYMENT_FREQUENCY, DEFAULT_DEBT_GRACE_PERIOD, TERMINAL_GROWTH_RATE, USER_MODEL_START_DATE, USER_MODEL_END_DATE, DEFAULT_DEBT_SIZING_METHOD, DSCR_CALCULATION_FREQUENCY
from core.input_processor import load_asset_data, load_price_data
from calculations.revenue import calculate_revenue_timeseries
from calculations.expenses import calculate_opex_timeseries, calculate_capex_timeseries
from calculations.debt import calculate_debt_schedule
from calculations.cashflow import aggregate_cashflows
from core.output_generator import generate_asset_and_platform_output
from core.summary_generator import generate_summary_data
from core.equity_irr import calculate_equity_irr

# Load real data
ASSETS, ASSET_COST_ASSUMPTIONS = load_asset_data('public/zebre_2025-01-13.json')
MONTHLY_PRICES, YEARLY_SPREADS = load_price_data('public/merchant_price_monthly.csv', 'public/merchant_yearly_spreads.csv')

def run_cashflow_model():
    """
    Main function to run the cash flow model.

    Returns:
        str: JSON representation of the final cash flow DataFrame.
    """
    # Determine model start and end dates
    if USER_MODEL_START_DATE and USER_MODEL_END_DATE:
        start_date = datetime.strptime(USER_MODEL_START_DATE, DATE_FORMAT)
        end_date = datetime.strptime(USER_MODEL_END_DATE, DATE_FORMAT)
    else:
        earliest_construction_start = pd.to_datetime('2050-01-01') # Initialize with a future date
        latest_ops_end = pd.to_datetime('1900-01-01') # Initialize with a past date

        for asset in ASSETS:
            # Use 'constructionStartDate' for the earliest start
            if 'constructionStartDate' in asset and asset['constructionStartDate']:
                current_start = pd.to_datetime(asset['constructionStartDate'])
                if current_start < earliest_construction_start:
                    earliest_construction_start = current_start
            
            # Calculate end date based on assetStartDate + assetLife
            if 'assetStartDate' in asset and asset['assetStartDate'] and 'assetLife' in asset and asset['assetLife']:
                ops_start_date = pd.to_datetime(asset['assetStartDate'])
                asset_life_years = int(asset['assetLife'])
                current_ops_end = ops_start_date + relativedelta(years=asset_life_years)
                
                if current_ops_end > latest_ops_end:
                    latest_ops_end = current_ops_end
            elif 'operationsEndDate' in asset and asset['operationsEndDate']:
                current_end = pd.to_datetime(asset['operationsEndDate'])
                if current_end > latest_ops_end:
                    latest_ops_end = current_end

        start_date = earliest_construction_start
        end_date = latest_ops_end

        if start_date == pd.to_datetime('2050-01-01') or end_date == pd.to_datetime('1900-01-01'):
            raise ValueError("Could not determine valid model start or end dates from asset data. Please check 'constructionStartDate', 'assetStartDate' and 'assetLife' (or 'operationsEndDate') in your asset data, or set USER_MODEL_START_DATE and USER_MODEL_END_DATE in config.py.")

    # 1. Calculate Revenue
    revenue_df = calculate_revenue_timeseries(ASSETS, MONTHLY_PRICES, YEARLY_SPREADS, start_date, end_date)

    # 2. Calculate Expenses
    opex_df = calculate_opex_timeseries(ASSETS, ASSET_COST_ASSUMPTIONS, start_date, end_date)
    capex_df = calculate_capex_timeseries(ASSETS, ASSET_COST_ASSUMPTIONS, start_date, end_date, capex_funding_type=DEFAULT_CAPEX_FUNDING_TYPE)

    # 3. Calculate Debt Schedule (dependent on cash flow for sizing)
    # First, a preliminary CFADS calculation is needed for debt sizing.
    # This is a simplification. A real model would have a more iterative process.
    prelim_cash_flow = pd.merge(revenue_df, opex_df, on=['asset_id', 'date'])
    prelim_cash_flow['cfads'] = prelim_cash_flow['revenue'] - prelim_cash_flow['opex']

    debt_df = calculate_debt_schedule(ASSETS, ASSET_COST_ASSUMPTIONS, capex_df, prelim_cash_flow, start_date, end_date, repayment_frequency=DEFAULT_DEBT_REPAYMENT_FREQUENCY, grace_period=DEFAULT_DEBT_GRACE_PERIOD, debt_sizing_method=DEFAULT_DEBT_SIZING_METHOD, dscr_calculation_frequency=DSCR_CALCULATION_FREQUENCY)

    # 4. Aggregate into Final Cash Flow
    final_cash_flow = aggregate_cashflows(revenue_df, opex_df, capex_df, debt_df, end_date, ASSETS, ASSET_COST_ASSUMPTIONS)

    # Assign period type (Construction or Operations)
    def assign_period_type(df, assets_data):
        df['period_type'] = ''
        df['date'] = pd.to_datetime(df['date'])

        for asset_info in assets_data:
            asset_id = asset_info['id']
            asset_df = df[df['asset_id'] == asset_id]
            
            construction_start = pd.to_datetime(asset_info.get('constructionStartDate')) if asset_info.get('constructionStartDate') else None
            ops_start = pd.to_datetime(asset_info.get('assetStartDate')) if asset_info.get('assetStartDate') else None

            if construction_start and ops_start:
                df.loc[(df['asset_id'] == asset_id) & (df['date'] >= construction_start) & (df['date'] < ops_start), 'period_type'] = 'C'
                df.loc[(df['asset_id'] == asset_id) & (df['date'] >= ops_start), 'period_type'] = 'O'
            elif ops_start:
                # If no construction start, assume operations from assetStartDate
                df.loc[(df['asset_id'] == asset_id) & (df['date'] >= ops_start), 'period_type'] = 'O'
            # If neither is available, period_type remains empty or can be set to a default like 'U' for unknown

        return df

    final_cash_flow = assign_period_type(final_cash_flow, ASSETS)

    # Calculate Equity IRR
    # Assuming 'equity_cash_flow' column exists in final_cash_flow
    # You might need to adjust this based on how equity cash flows are defined
    equity_cash_flows_for_irr = final_cash_flow['equity_cash_flow'].tolist()
    irr = calculate_equity_irr(equity_cash_flows_for_irr)
    print(f"Calculated Equity IRR: {irr:.2%}")

    # Generate summary data
    summary_data = generate_summary_data(final_cash_flow)
    print("Generated summary data:")
    for key, df in summary_data.items():
        print(f"  {key}:\n{df.head()}") # Print head of each summary for verification

    # Save to JSON file
    output_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results')
    generate_asset_and_platform_output(final_cash_flow, irr, output_directory)

    def generate_asset_inputs_summary(assets, asset_cost_assumptions, config_values, output_dir):
        asset_summaries = []
        for asset in assets:
            asset_id = asset.get('id')
            asset_name = asset.get('name')
            
            # Include all direct asset properties
            asset_data = {k: v for k, v in asset.items()}
            
            # Include cost assumptions for the asset
            asset_data['costAssumptions'] = asset_cost_assumptions.get(asset_name, {})
            
            asset_summaries.append(asset_data)
        
        full_summary = {
            "asset_inputs": asset_summaries,
            "general_config": config_values
        }
        
        output_path = os.path.join(output_dir, "asset_inputs_summary.json")
        with open(output_path, 'w') as f:
            json.dump(full_summary, f, indent=4)
        print(f"Saved asset inputs summary to {output_path}")

    # Extract all relevant config values
    config_values = {
        "DATE_FORMAT": DATE_FORMAT,
        "OUTPUT_DATE_FORMAT": OUTPUT_DATE_FORMAT,
        "DEFAULT_CAPEX_FUNDING_TYPE": DEFAULT_CAPEX_FUNDING_TYPE,
        "DEFAULT_DEBT_REPAYMENT_FREQUENCY": DEFAULT_DEBT_REPAYMENT_FREQUENCY,
        "DEFAULT_DEBT_GRACE_PERIOD": DEFAULT_DEBT_GRACE_PERIOD,
        "TERMINAL_GROWTH_RATE": TERMINAL_GROWTH_RATE,
        "ENABLE_TERMINAL_VALUE": ENABLE_TERMINAL_VALUE,
        "DEFAULT_DEBT_SIZING_METHOD": DEFAULT_DEBT_SIZING_METHOD,
        "DSCR_CALCULATION_FREQUENCY": DSCR_CALCULATION_FREQUENCY,
        "USER_MODEL_START_DATE": USER_MODEL_START_DATE,
        "USER_MODEL_END_DATE": USER_MODEL_END_DATE
    }
    generate_asset_inputs_summary(ASSETS, ASSET_COST_ASSUMPTIONS, config_values, output_directory)

    return "Cash flow model run complete. Outputs saved and summaries generated."

import sys

if __name__ == '__main__':
    final_cashflows_json = run_cashflow_model()

    print(final_cashflows_json)