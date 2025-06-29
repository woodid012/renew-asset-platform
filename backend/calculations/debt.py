
import pandas as pd
import numpy_financial as npf
from datetime import datetime
from dateutil.relativedelta import relativedelta
from config import DEFAULT_DEBT_REPAYMENT_FREQUENCY, DEFAULT_DEBT_GRACE_PERIOD, DEFAULT_DEBT_SIZING_METHOD, DSCR_CALCULATION_FREQUENCY

def calculate_debt_schedule(assets, debt_assumptions, capex_schedule, cash_flow_df, start_date, end_date, repayment_frequency=DEFAULT_DEBT_REPAYMENT_FREQUENCY, grace_period=DEFAULT_DEBT_GRACE_PERIOD, debt_sizing_method=DEFAULT_DEBT_SIZING_METHOD, dscr_calculation_frequency=DSCR_CALCULATION_FREQUENCY):
    """
    Calculates the debt schedule for each asset, including drawdowns, interest, and principal repayment.

    Args:
        assets (list): A list of asset dictionaries.
        debt_assumptions (dict): A dictionary with debt assumptions.
        capex_schedule (pd.DataFrame): A DataFrame with the CAPEX for each asset over time.
        cash_flow_df (pd.DataFrame): DataFrame with operating cash flow.
        start_date (datetime): The start date of the analysis period.
        end_date (datetime): The end date of the analysis period.

    Returns:
        pd.DataFrame: A DataFrame with the detailed debt schedule for all assets.
    """
    all_debt_schedules = []
    date_range = pd.date_range(start=start_date, end=end_date, freq='MS')

    for asset in assets:
        asset_assumptions = debt_assumptions.get(asset['name'], {})
        gearing = asset_assumptions.get('maxGearing', 0.7)
        debt_term = asset_assumptions.get('debtTerm', 18)
        interest_rate_input = asset_assumptions.get('debtRate', 0.055)
        target_dscr = asset_assumptions.get('targetDSCR', 1.2) # Default target DSCR

        # Determine if interest_rate is a fixed value or a time-series
        if isinstance(interest_rate_input, (int, float)):
            # Fixed interest rate
            interest_rate_series = pd.Series(interest_rate_input, index=date_range)
        elif isinstance(interest_rate_input, list):
            # Assuming time-series is provided as a list of dicts with 'date' and 'rate'
            # Convert to DataFrame and then to Series, aligning with date_range
            interest_rate_df = pd.DataFrame(interest_rate_input)
            interest_rate_df['date'] = pd.to_datetime(interest_rate_df['date'])
            interest_rate_df.set_index('date', inplace=True)
            interest_rate_series = interest_rate_df['rate'].reindex(date_range, method='ffill').fillna(0)
        else:
            raise ValueError("debtRate must be a fixed value (int/float) or a list of time-series data.")

        asset_capex = capex_schedule[capex_schedule['asset_id'] == asset['id']]
        # Get debt capex from the capex schedule
        asset_debt_capex = capex_schedule[capex_schedule['asset_id'] == asset['id']]
        total_debt_drawn = asset_debt_capex['debt_capex'].sum()

        # If no debt drawn, skip this asset
        if total_debt_drawn == 0:
            continue

        # Get asset COD (Commercial Operation Date)
        cod = pd.to_datetime(asset['assetStartDate'])

        # Filter cash_flow_df for the current asset and relevant period
        asset_cash_flow = cash_flow_df[cash_flow_df['asset_id'] == asset['id']].set_index('date')
        
        # Determine total_debt_drawn based on sizing method
        if debt_sizing_method == 'dscr':
            # Calculate maximum debt based on DSCR
            # This is a simplified approach. A full DSCR sizing would be iterative.
            # Here, we calculate the present value of the maximum allowable debt service.
            
            # Filter CFADS for operational period
            operational_cfads = asset_cash_flow[asset_cash_flow.index >= cod]['cfads']
            
            if operational_cfads.empty:
                total_debt_drawn = 0
            else:
                # Resample CFADS based on DSCR_CALCULATION_FREQUENCY
                if dscr_calculation_frequency == 'monthly':
                    periodic_cfads = operational_cfads
                    periods_per_year = 12
                elif dscr_calculation_frequency == 'quarterly':
                    periodic_cfads = operational_cfads.resample('QS').sum() # Quarter start frequency
                    periods_per_year = 4
                else:
                    raise ValueError(f"Unknown dscr_calculation_frequency: {dscr_calculation_frequency}. Must be 'monthly' or 'quarterly'.")

                # Calculate maximum periodic debt service based on target DSCR
                max_periodic_debt_service = periodic_cfads / target_dscr
                
                # Discount these back to the COD to get debt capacity
                # Use the first interest rate for discounting for simplicity
                discount_rate = interest_rate_series.iloc[0] 
                
                debt_capacity = 0
                for period_end_date, periodic_ds in max_periodic_debt_service.items():
                    # Calculate years from COD to period_end_date
                    years_from_cod = (period_end_date - cod).days / 365.25
                    if years_from_cod >= 0: # Only consider future cash flows
                        debt_capacity += periodic_ds / ((1 + discount_rate) ** years_from_cod)
                
                # The actual debt drawn is the minimum of the required capex debt and the debt capacity
                total_debt_drawn = min(asset_debt_capex['debt_capex'].sum(), debt_capacity)
                
        elif debt_sizing_method == 'annuity':
            total_debt_drawn = asset_debt_capex['debt_capex'].sum()
        else:
            raise ValueError(f"Unknown debt_sizing_method: {debt_sizing_method}. Must be 'dscr' or 'annuity'.")

        # If no debt drawn, skip this asset
        if total_debt_drawn == 0:
            continue

        # Create the schedule DataFrame for the asset
        schedule = pd.DataFrame(index=date_range)
        schedule['asset_id'] = asset['id']
        schedule['beginning_balance'] = 0.0
        schedule['drawdowns'] = 0.0
        schedule['interest'] = 0.0
        schedule['principal'] = 0.0
        schedule['ending_balance'] = 0.0

        # Populate drawdowns from capex_schedule (only up to total_debt_drawn)
        current_drawn = 0
        for idx, row in asset_debt_capex.iterrows():
            if row['date'] in schedule.index:
                drawdown_amount = min(row['debt_capex'], total_debt_drawn - current_drawn)
                schedule.at[row['date'], 'drawdowns'] = drawdown_amount
                current_drawn += drawdown_amount
                if current_drawn >= total_debt_drawn:
                    break

        # Debt repayment calculations
        balance = 0.0
        debt_service_start_date = None

        # Determine debt service start date based on grace period
        if grace_period == 'full_period':
            # Find the first full period after COD
            if repayment_frequency == 'monthly':
                debt_service_start_date = cod + relativedelta(months=1)
            elif repayment_frequency == 'quarterly':
                # Find the start of the next quarter after COD
                if cod.month in [1, 2, 3]: # Q1
                    debt_service_start_date = datetime(cod.year, 4, 1)
                elif cod.month in [4, 5, 6]: # Q2
                    debt_service_start_date = datetime(cod.year, 7, 1)
                elif cod.month in [7, 8, 9]: # Q3
                    debt_service_start_date = datetime(cod.year, 10, 1)
                else: # Q4
                    debt_service_start_date = datetime(cod.year + 1, 1, 1)
        else: # 'none' or pro-rated
            debt_service_start_date = cod

        # Calculate total number of payments and period rate
        if repayment_frequency == 'monthly':
            num_payments = debt_term * 12
            period_rate_for_pmt = interest_rate_series.iloc[0] / 12
            payment_interval_months = 1
        elif repayment_frequency == 'quarterly':
            num_payments = debt_term * 4
            period_rate_for_pmt = interest_rate_series.iloc[0] / 4
            payment_interval_months = 3 # Payments every 3 months
        else:
            raise ValueError("Invalid repayment_frequency. Must be 'monthly' or 'quarterly'.")

        # Calculate fixed payment amount (per payment interval)
        if period_rate_for_pmt > 0:
            fixed_payment = npf.pmt(period_rate_for_pmt, num_payments, -total_debt_drawn)
        else:
            fixed_payment = total_debt_drawn / num_payments if num_payments > 0 else 0

        # Running total for accrued interest for quarterly payments
        accrued_interest = 0.0

        for i, current_date in enumerate(schedule.index):
            schedule.at[current_date, 'beginning_balance'] = balance
            balance += schedule.at[current_date, 'drawdowns']

            if current_date >= debt_service_start_date and balance > 0:
                monthly_interest = balance * (interest_rate_series.loc[current_date] / 12)
                accrued_interest += monthly_interest

                if repayment_frequency == 'monthly':
                    principal_payment = fixed_payment - monthly_interest
                    principal_payment = min(principal_payment, balance) # Don't overpay
                    schedule.at[current_date, 'interest'] = monthly_interest
                    schedule.at[current_date, 'principal'] = principal_payment
                    balance -= principal_payment
                elif repayment_frequency == 'quarterly':
                    # Check if it's a payment month (every 3rd month from start of debt service)
                    # This needs to be relative to debt_service_start_date
                    months_since_start = (current_date.year - debt_service_start_date.year) * 12 + \
                                         (current_date.month - debt_service_start_date.month)
                    
                    if months_since_start >= 0 and (months_since_start % payment_interval_months == 0):
                        # This is a payment month
                        principal_payment = fixed_payment - accrued_interest
                        principal_payment = min(principal_payment, balance) # Don't overpay

                        schedule.at[current_date, 'interest'] = accrued_interest
                        schedule.at[current_date, 'principal'] = principal_payment
                        balance -= principal_payment
                        accrued_interest = 0.0 # Reset accrued interest
                    else:
                        # Not a payment month, only interest accrues
                        pass # accrued_interest already updated
            
            schedule.at[current_date, 'ending_balance'] = balance

        all_debt_schedules.append(schedule.reset_index().rename(columns={'index': 'date'}))

    if not all_debt_schedules:
        return pd.DataFrame()

    return pd.concat(all_debt_schedules, ignore_index=True)
