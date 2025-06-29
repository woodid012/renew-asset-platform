# backend/calculations/debt.py

import pandas as pd
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from config import DEFAULT_DEBT_REPAYMENT_FREQUENCY, DEFAULT_DEBT_GRACE_PERIOD, DEFAULT_DEBT_SIZING_METHOD, DSCR_CALCULATION_FREQUENCY

def calculate_blended_dscr(contracted_revenue, merchant_revenue, target_dscr_contract, target_dscr_merchant):
    """
    Calculate blended DSCR target based on revenue mix.
    
    Args:
        contracted_revenue (float): Annual contracted revenue
        merchant_revenue (float): Annual merchant revenue
        target_dscr_contract (float): Target DSCR for contracted revenue
        target_dscr_merchant (float): Target DSCR for merchant revenue
    
    Returns:
        float: Blended DSCR target
    """
    total_revenue = contracted_revenue + merchant_revenue
    
    if total_revenue == 0:
        return target_dscr_merchant
    
    contracted_share = contracted_revenue / total_revenue
    merchant_share = merchant_revenue / total_revenue
    
    return contracted_share * target_dscr_contract + merchant_share * target_dscr_merchant

def calculate_annual_debt_schedule(debt_amount, cash_flows, interest_rate, tenor_years, target_dscrs):
    """
    Calculate annual debt schedule using sculpting approach.
    
    Args:
        debt_amount (float): Initial debt amount
        cash_flows (list): Annual operating cash flows (CFADS)
        interest_rate (float): Annual interest rate
        tenor_years (int): Debt term in years
        target_dscrs (list): Target DSCR for each year
    
    Returns:
        dict: Complete debt schedule with metrics
    """
    # Initialize arrays
    debt_balance = [0.0] * (tenor_years + 1)
    interest_payments = [0.0] * tenor_years
    principal_payments = [0.0] * tenor_years
    debt_service = [0.0] * tenor_years
    dscr_values = [0.0] * tenor_years
    
    # Set initial debt balance
    debt_balance[0] = debt_amount
    
    # Calculate debt service for each year
    for year in range(tenor_years):
        if year >= len(cash_flows):
            break
            
        # Interest payment on opening balance
        interest_payments[year] = debt_balance[year] * interest_rate
        
        # Get available cash flow and target DSCR
        operating_cash_flow = cash_flows[year]
        target_dscr = target_dscrs[year] if year < len(target_dscrs) else target_dscrs[-1]
        
        # Maximum debt service allowed by DSCR constraint
        max_debt_service = operating_cash_flow / target_dscr if target_dscr > 0 else 0
        
        # Principal repayment (limited by max debt service and remaining balance)
        principal_payments[year] = min(
            max(0, max_debt_service - interest_payments[year]),
            debt_balance[year]
        )
        
        # Total debt service
        debt_service[year] = interest_payments[year] + principal_payments[year]
        
        # Calculate actual DSCR
        dscr_values[year] = operating_cash_flow / debt_service[year] if debt_service[year] > 0 else float('inf')
        
        # Update debt balance
        debt_balance[year + 1] = debt_balance[year] - principal_payments[year]
    
    # Calculate metrics
    fully_repaid = debt_balance[tenor_years] < 1000  # $1k tolerance
    avg_debt_service = sum(debt_service) / tenor_years if tenor_years > 0 else 0
    valid_dscrs = [d for d in dscr_values if d != float('inf') and d > 0]
    min_dscr = min(valid_dscrs) if valid_dscrs else 0
    
    return {
        'debt_balance': debt_balance,
        'interest_payments': interest_payments,
        'principal_payments': principal_payments,
        'debt_service': debt_service,
        'dscr_values': dscr_values,
        'metrics': {
            'fully_repaid': fully_repaid,
            'avg_debt_service': avg_debt_service,
            'min_dscr': min_dscr,
            'final_balance': debt_balance[tenor_years]
        }
    }

def solve_maximum_debt(capex, cash_flows, target_dscrs, max_gearing, interest_rate, tenor_years, debug=True):
    """
    Find maximum sustainable debt using binary search.
    
    Args:
        capex (float): Total CAPEX
        cash_flows (list): Annual operating cash flows
        target_dscrs (list): Target DSCR for each year
        max_gearing (float): Maximum gearing ratio (0-1)
        interest_rate (float): Annual interest rate
        tenor_years (int): Debt term in years
        debug (bool): Print debug information
    
    Returns:
        dict: Optimal debt solution
    """
    if capex == 0:
        empty_df = pd.DataFrame(columns=['asset_id', 'date', 'beginning_balance', 'drawdowns', 'interest', 'principal', 'ending_balance'])
        return 0, None, None, None, None, None, None, None, None
    
    # Binary search bounds
    lower_bound = 0
    upper_bound = capex * max_gearing
    tolerance = 1000  # $1k precision
    max_iterations = 50
    
    best_debt = 0
    best_schedule = None
    
    if debug:
        print(f"\n=== DEBT SIZING ===")
        print(f"CAPEX: ${capex:,.0f}")
        print(f"Max gearing: {max_gearing:.1%}")
        print(f"Upper bound: ${upper_bound:,.0f}")
        print(f"Cash flows (first 5 years): {[f'${cf:,.0f}' for cf in cash_flows[:5]]}")
        print(f"Target DSCRs (first 5): {[f'{d:.2f}' for d in target_dscrs[:5]]}")
        print(f"Interest rate: {interest_rate:.2%}, Tenor: {tenor_years} years")
    
    iteration = 0
    while iteration < max_iterations and (upper_bound - lower_bound) > tolerance:
        test_debt = (lower_bound + upper_bound) / 2
        
        # Test this debt amount
        schedule = calculate_annual_debt_schedule(
            test_debt, cash_flows, interest_rate, tenor_years, target_dscrs
        )
        
        if debug and iteration < 3:
            print(f"\nIteration {iteration + 1}: Testing ${test_debt:,.0f}")
            print(f"  Fully repaid: {schedule['metrics']['fully_repaid']}")
            print(f"  Final balance: ${schedule['metrics']['final_balance']:,.0f}")
            print(f"  Min DSCR: {schedule['metrics']['min_dscr']:.2f}")
        
        if schedule['metrics']['fully_repaid']:
            # Debt can be repaid - try higher amount
            lower_bound = test_debt
            best_debt = test_debt
            best_schedule = schedule
        else:
            # Debt cannot be repaid - try lower amount
            upper_bound = test_debt
        
        iteration += 1
    
    # Final result
    if best_debt == 0:
        best_schedule = calculate_annual_debt_schedule(0, cash_flows, interest_rate, tenor_years, target_dscrs)
    
    actual_gearing = best_debt / capex if capex > 0 else 0
    
    if debug:
        if best_debt > 0:
            print(f"\n✓ SOLUTION: ${best_debt:,.0f} ({actual_gearing:.1%} gearing)")
            print(f"  Average debt service: ${best_schedule['metrics']['avg_debt_service']:,.0f}")
            print(f"  Minimum DSCR: {best_schedule['metrics']['min_dscr']:.2f}")
        else:
            print(f"\n✗ SOLUTION: No debt viable (100% equity)")
        print("=" * 50)
    
    return {
        'debt': best_debt,
        'gearing': actual_gearing,
        'schedule': best_schedule
    }

def prepare_annual_cash_flows(asset, revenue_df, opex_df):
    """
    Convert monthly cash flows to annual for debt sizing.
    
    Args:
        asset (dict): Asset data
        revenue_df (pd.DataFrame): Monthly revenue data
        opex_df (pd.DataFrame): Monthly OPEX data
    
    Returns:
        tuple: (annual_cash_flows, annual_target_dscrs)
    """
    # Filter data for this asset
    asset_revenue = revenue_df[revenue_df['asset_id'] == asset['id']].copy()
    asset_opex = opex_df[opex_df['asset_id'] == asset['id']].copy()
    
    if asset_revenue.empty or asset_opex.empty:
        return [], []
    
    # Merge revenue and opex
    cash_flow_data = pd.merge(asset_revenue, asset_opex, on=['asset_id', 'date'], how='inner')
    
    # Calculate monthly CFADS
    cash_flow_data['cfads'] = cash_flow_data['revenue'] - cash_flow_data['opex']
    cash_flow_data['year'] = cash_flow_data['date'].dt.year
    
    # Group by year
    annual_data = cash_flow_data.groupby('year').agg({
        'cfads': 'sum',
        'contractedGreenRevenue': 'sum',
        'contractedEnergyRevenue': 'sum',
        'merchantGreenRevenue': 'sum',
        'merchantEnergyRevenue': 'sum'
    }).reset_index()
    
    return annual_data

def iterate_debt_sizing(asset, asset_assumptions, capex_schedule, cash_flow_df, 
                       start_date, end_date, repayment_frequency, grace_period):
    """
    Size debt based on operational cash flows - maintains legacy signature.
    
    Returns:
        tuple: (optimal_debt, debt_service_start_date, period_rate, total_payments, 
                blended_dscr, debt_structure, date_range, cod, interest_rate)
    """
    # Get asset parameters
    capex = asset_assumptions.get('capex', 0)
    max_gearing = asset_assumptions.get('maxGearing', 0.7)
    interest_rate = asset_assumptions.get('interestRate', 0.055)
    tenor_years = asset_assumptions.get('tenorYears', 18)
    target_dscr_contract = asset_assumptions.get('targetDSCRContract', 1.4)
    target_dscr_merchant = asset_assumptions.get('targetDSCRMerchant', 1.8)
    debt_structure = asset_assumptions.get('debtStructure', 'sculpting')
    
    # Calculate legacy parameters for compatibility
    date_range = pd.date_range(start=start_date, end=end_date, freq='MS')
    cod = pd.to_datetime(asset['assetStartDate'])
    
    if capex == 0:
        return 0, None, None, None, None, None, None, None, None
    
    # Determine debt service start date
    if grace_period == 'full_period':
        if repayment_frequency == 'monthly':
            debt_service_start_date = cod + relativedelta(months=1)
        elif repayment_frequency == 'quarterly':
            if cod.month in [1, 2, 3]:
                debt_service_start_date = datetime(cod.year, 4, 1)
            elif cod.month in [4, 5, 6]:
                debt_service_start_date = datetime(cod.year, 7, 1)
            elif cod.month in [7, 8, 9]:
                debt_service_start_date = datetime(cod.year, 10, 1)
            else:
                debt_service_start_date = datetime(cod.year + 1, 1, 1)
    else:
        debt_service_start_date = cod
    
    # Calculate period rate and total payments
    if repayment_frequency == 'monthly':
        period_rate = interest_rate / 12
        total_payments = tenor_years * 12
    else:  # quarterly
        period_rate = interest_rate / 4
        total_payments = tenor_years * 4
    
    # Prepare annual cash flows for debt sizing
    revenue_df = cash_flow_df[['asset_id', 'date', 'revenue', 'contractedGreenRevenue', 
                               'contractedEnergyRevenue', 'merchantGreenRevenue', 'merchantEnergyRevenue']]
    opex_df = cash_flow_df[['asset_id', 'date', 'opex']]
    
    annual_data = prepare_annual_cash_flows(asset, revenue_df, opex_df)
    
    if annual_data.empty:
        # Create empty blended_dscr for compatibility
        blended_dscr = pd.Series([target_dscr_merchant])
        return 0, debt_service_start_date, period_rate, total_payments, blended_dscr, debt_structure, date_range, cod, interest_rate
    
    # Calculate annual cash flows and blended DSCRs
    annual_cash_flows = annual_data['cfads'].tolist()
    annual_target_dscrs = []
    
    for _, row in annual_data.iterrows():
        contracted_revenue = row['contractedGreenRevenue'] + row['contractedEnergyRevenue']
        merchant_revenue = row['merchantGreenRevenue'] + row['merchantEnergyRevenue']
        
        blended_dscr_value = calculate_blended_dscr(
            contracted_revenue, merchant_revenue, 
            target_dscr_contract, target_dscr_merchant
        )
        annual_target_dscrs.append(blended_dscr_value)
    
    print(f"\nAsset {asset.get('name', asset['id'])}: Annual debt sizing")
    print(f"CAPEX: ${capex:,.0f}, Annual periods: {len(annual_cash_flows)}")
    
    # Solve for optimal debt using simplified approach
    solution = solve_maximum_debt(
        capex, annual_cash_flows, annual_target_dscrs, 
        max_gearing, interest_rate, tenor_years, debug=True
    )
    
    optimal_debt = solution['debt']
    
    # Create blended DSCR series for legacy compatibility
    blended_dscr = pd.Series(annual_target_dscrs, index=annual_data['year'])
    
    return optimal_debt, debt_service_start_date, period_rate, total_payments, blended_dscr, debt_structure, date_range, cod, interest_rate

def generate_debt_schedule(debt_amount, asset, asset_capex_df, asset_cash_flow, blended_dscr,
                          debt_service_start_date, period_rate, total_payments, repayment_frequency,
                          debt_structure, date_range, cod, annual_interest_rate):
    """
    Generate monthly debt schedule - maintains legacy signature but uses new logic.
    """
    if debt_amount == 0:
        # Return empty schedule
        schedule = pd.DataFrame({
            'asset_id': asset['id'],
            'date': date_range,
            'beginning_balance': 0.0,
            'drawdowns': 0.0,
            'interest': 0.0,
            'principal': 0.0,
            'ending_balance': 0.0
        })
        return schedule.reset_index(drop=True)
    
    # Initialize schedule
    schedule = pd.DataFrame({
        'asset_id': asset['id'],
        'date': date_range,
        'beginning_balance': 0.0,
        'drawdowns': 0.0,
        'interest': 0.0,
        'principal': 0.0,
        'ending_balance': 0.0
    })
    
    # Calculate actual gearing from debt amount and total CAPEX
    total_capex = asset_capex_df['capex'].sum()
    if total_capex > 0:
        actual_gearing = debt_amount / total_capex
        
        # Populate debt drawdowns during construction
        current_drawn = 0
        for _, row in asset_capex_df.iterrows():
            if row['date'] in schedule['date'].values and current_drawn < debt_amount:
                # Calculate debt portion of this month's CAPEX
                monthly_debt_capex = row['capex'] * actual_gearing
                drawdown_amount = min(monthly_debt_capex, debt_amount - current_drawn)
                
                schedule.loc[schedule['date'] == row['date'], 'drawdowns'] = drawdown_amount
                current_drawn += drawdown_amount
    
    # Generate payment dates
    payment_dates = []
    current_payment_date = debt_service_start_date
    asset_end_date = cod + relativedelta(years=asset.get('assetLife', 25))
    
    while current_payment_date <= asset_end_date:
        payment_dates.append(current_payment_date)
        if repayment_frequency == 'monthly':
            current_payment_date += relativedelta(months=1)
        else:
            current_payment_date += relativedelta(months=3)
    
    # Get annual debt service from the blended_dscr approach
    # Create a simple debt service schedule based on available cash flow
    tenor_years = int(asset_capex_df.iloc[0]['assetLife'] if 'assetLife' in asset_capex_df.columns else 25)
    tenor_years = min(tenor_years, int(total_payments / (12 if repayment_frequency == 'monthly' else 4)))
    
    # Track balance and populate payments
    balance = 0.0
    quarterly_interest_accumulator = 0.0
    
    for i, current_date in enumerate(schedule['date']):
        schedule.loc[i, 'beginning_balance'] = balance
        balance += schedule.loc[i, 'drawdowns']
        
        if current_date >= debt_service_start_date and balance > 0:
            if repayment_frequency == 'monthly':
                if current_date in payment_dates:
                    monthly_interest = balance * period_rate
                    
                    # Use asset_cash_flow to determine principal payment
                    if hasattr(asset_cash_flow, 'index') and current_date in asset_cash_flow.index:
                        available_cfads = asset_cash_flow.loc[current_date, 'cfads']
                        target_dscr = blended_dscr.get(current_date.year, 1.4)
                        max_debt_service = available_cfads / target_dscr if target_dscr > 0 else 0
                        
                        principal_payment = max(0, max_debt_service - monthly_interest)
                        principal_payment = min(principal_payment, balance)
                    else:
                        # Fallback to simple amortization
                        if total_payments > 0:
                            principal_payment = debt_amount / total_payments
                            principal_payment = min(principal_payment, balance)
                        else:
                            principal_payment = 0
                    
                    schedule.loc[i, 'interest'] = monthly_interest
                    schedule.loc[i, 'principal'] = principal_payment
                    balance -= principal_payment
            
            else:  # quarterly
                # Accumulate interest monthly
                monthly_interest = balance * (annual_interest_rate / 12)
                quarterly_interest_accumulator += monthly_interest
                
                if current_date in payment_dates:
                    quarterly_interest = quarterly_interest_accumulator
                    
                    # Calculate quarterly principal
                    if total_payments > 0:
                        quarterly_principal = (debt_amount / total_payments) * 3  # 3 months worth
                        quarterly_principal = min(quarterly_principal, balance)
                    else:
                        quarterly_principal = 0
                    
                    schedule.loc[i, 'interest'] = quarterly_interest
                    schedule.loc[i, 'principal'] = quarterly_principal
                    balance -= quarterly_principal
                    quarterly_interest_accumulator = 0.0
        
        schedule.loc[i, 'ending_balance'] = balance
    
    return schedule.reset_index(drop=True)

def calculate_debt_schedule(assets, debt_assumptions, capex_schedule, cash_flow_df, start_date, end_date, 
                          repayment_frequency=DEFAULT_DEBT_REPAYMENT_FREQUENCY, 
                          grace_period=DEFAULT_DEBT_GRACE_PERIOD, 
                          debt_sizing_method=DEFAULT_DEBT_SIZING_METHOD, 
                          dscr_calculation_frequency=DSCR_CALCULATION_FREQUENCY):
    """
    Calculate debt schedule for all assets - maintains legacy signature.
    
    Returns:
        tuple: (debt_schedule_df, updated_capex_df)
    """
    print(f"\n🏦 DEBT SIZING STARTING")
    print(f"Assets to process: {len(assets)}")
    print(f"Method: {debt_sizing_method}, Frequency: {repayment_frequency}")
    
    all_debt_schedules = []
    updated_capex_schedules = []
    
    for asset in assets:
        asset_name = asset.get('name', f"Asset_{asset['id']}")
        asset_assumptions = debt_assumptions.get(asset_name, {})
        
        print(f"\n--- Processing {asset_name} ---")
        
        if debt_sizing_method == 'dscr':
            # Size debt based on operational cash flows
            sizing_result = iterate_debt_sizing(
                asset, asset_assumptions, capex_schedule, cash_flow_df,
                start_date, end_date, repayment_frequency, grace_period
            )
            
            if sizing_result[0] is None:  # Handle case where sizing failed
                optimal_debt = 0
                debt_schedule = pd.DataFrame(columns=['asset_id', 'date', 'beginning_balance', 'drawdowns', 'interest', 'principal', 'ending_balance'])
            else:
                optimal_debt, debt_service_start_date, period_rate, total_payments, blended_dscr, debt_structure, date_range, cod, interest_rate = sizing_result
                
                # Generate debt schedule using legacy function
                asset_capex = capex_schedule[capex_schedule['asset_id'] == asset['id']].copy()
                
                # Filter cash flow for this asset
                asset_cash_flow = cash_flow_df[
                    (cash_flow_df['asset_id'] == asset['id']) & 
                    (cash_flow_df['date'] >= cod)
                ].copy()
                
                if not asset_cash_flow.empty:
                    asset_cash_flow = asset_cash_flow.set_index('date')
                
                debt_schedule = generate_debt_schedule(
                    optimal_debt, asset, asset_capex, asset_cash_flow, blended_dscr,
                    debt_service_start_date, period_rate, total_payments, repayment_frequency,
                    debt_structure, date_range, cod, interest_rate
                )
        
        elif debt_sizing_method == 'annuity':
            # Annuity method implementation
            asset_assumptions = debt_assumptions.get(asset_name, {})
            capex = asset_assumptions.get('capex', 0)
            max_gearing = asset_assumptions.get('maxGearing', 0.7)
            interest_rate = asset_assumptions.get('interestRate', 0.055)
            tenor_years = asset_assumptions.get('tenorYears', 18)
            
            # Use configured gearing for annuity
            optimal_debt = capex * max_gearing
            
            if optimal_debt > 0:
                # Calculate legacy parameters for generate_debt_schedule
                cod = pd.to_datetime(asset['assetStartDate'])
                date_range = pd.date_range(start=start_date, end=end_date, freq='MS')
                
                if grace_period == 'full_period':
                    if repayment_frequency == 'quarterly':
                        if cod.month in [1, 2, 3]:
                            debt_service_start_date = datetime(cod.year, 4, 1)
                        elif cod.month in [4, 5, 6]:
                            debt_service_start_date = datetime(cod.year, 7, 1)
                        elif cod.month in [7, 8, 9]:
                            debt_service_start_date = datetime(cod.year, 10, 1)
                        else:
                            debt_service_start_date = datetime(cod.year + 1, 1, 1)
                    else:  # monthly
                        debt_service_start_date = cod + relativedelta(months=1)
                else:
                    debt_service_start_date = cod
                
                if repayment_frequency == 'monthly':
                    period_rate = interest_rate / 12
                    total_payments = tenor_years * 12
                else:  # quarterly
                    period_rate = interest_rate / 4
                    total_payments = tenor_years * 4
                
                # Create simple blended DSCR (default for annuity)
                target_dscr = asset_assumptions.get('targetDSCRContract', 1.4)
                blended_dscr = pd.Series([target_dscr])
                debt_structure = 'annuity'
                
                asset_capex = capex_schedule[capex_schedule['asset_id'] == asset['id']].copy()
                asset_cash_flow = cash_flow_df[
                    (cash_flow_df['asset_id'] == asset['id']) & 
                    (cash_flow_df['date'] >= cod)
                ].copy()
                
                if not asset_cash_flow.empty:
                    asset_cash_flow = asset_cash_flow.set_index('date')
                
                debt_schedule = generate_debt_schedule(
                    optimal_debt, asset, asset_capex, asset_cash_flow, blended_dscr,
                    debt_service_start_date, period_rate, total_payments, repayment_frequency,
                    debt_structure, date_range, cod, interest_rate
                )
            else:
                optimal_debt = 0
                debt_schedule = pd.DataFrame(columns=['asset_id', 'date', 'beginning_balance', 'drawdowns', 'interest', 'principal', 'ending_balance'])
        
        else:
            # Unknown method
            optimal_debt = 0
            debt_schedule = pd.DataFrame(columns=['asset_id', 'date', 'beginning_balance', 'drawdowns', 'interest', 'principal', 'ending_balance'])
        
        # Update CAPEX schedule with actual debt/equity split
        asset_capex = capex_schedule[capex_schedule['asset_id'] == asset['id']].copy()
        total_capex = asset_capex['capex'].sum()
        
        if total_capex > 0:
            if optimal_debt > 0:
                actual_gearing = optimal_debt / total_capex
                asset_capex['debt_capex'] = asset_capex['capex'] * actual_gearing
                asset_capex['equity_capex'] = asset_capex['capex'] * (1 - actual_gearing)
                print(f"✓ {asset_name}: ${optimal_debt:,.0f} debt ({actual_gearing:.1%} gearing)")
            else:
                asset_capex['debt_capex'] = 0
                asset_capex['equity_capex'] = asset_capex['capex']
                print(f"✓ {asset_name}: 100% equity funding")
            
            updated_capex_schedules.append(asset_capex)
            
            if not debt_schedule.empty:
                all_debt_schedules.append(debt_schedule)
    
    # Combine results
    if all_debt_schedules:
        debt_df = pd.concat(all_debt_schedules, ignore_index=True)
    else:
        debt_df = pd.DataFrame(columns=['asset_id', 'date', 'beginning_balance', 'drawdowns', 'interest', 'principal', 'ending_balance'])
    
    if updated_capex_schedules:
        updated_capex_df = pd.concat(updated_capex_schedules, ignore_index=True)
    else:
        # If no updates, ensure 100% equity
        updated_capex_df = capex_schedule.copy()
        updated_capex_df['debt_capex'] = 0
        updated_capex_df['equity_capex'] = updated_capex_df['capex']
    
    print(f"\n🏦 DEBT SIZING COMPLETE")
    print(f"Debt schedules generated: {len(all_debt_schedules)}")
    
    return debt_df, updated_capex_df