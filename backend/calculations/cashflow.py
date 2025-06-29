
import pandas as pd
from config import TERMINAL_GROWTH_RATE

def aggregate_cashflows(revenue, opex, capex, debt_schedule, end_date, assets_data, asset_cost_assumptions):
    """
    Aggregates all financial components into a final cash flow statement for each asset.

    Args:
        revenue (pd.DataFrame): Time-series of revenue.
        opex (pd.DataFrame): Time-series of opex.
        capex (pd.DataFrame): Time-series of capex.
        debt_schedule (pd.DataFrame): Time-series of debt schedule.
        end_date (datetime): The end date of the analysis period.

    Returns:
        pd.DataFrame: A DataFrame with the consolidated cash flow for each asset.
    """
    # Merge the financial components
    cash_flow = pd.merge(revenue, opex, on=['asset_id', 'date'], how='left')
    cash_flow = pd.merge(cash_flow, capex, on=['asset_id', 'date'], how='left')
    cash_flow = pd.merge(cash_flow, debt_schedule, on=['asset_id', 'date'], how='left')

    # Fill NaNs for assets that might not have all components
    cash_flow.fillna(0, inplace=True)

    # Calculate key cash flow lines
    cash_flow['cfads'] = cash_flow['revenue'] - cash_flow['opex']
    # Calculate debt service for DSCR
    debt_service = cash_flow['interest'] + cash_flow['principal']
    # Handle division by zero for DSCR
    cash_flow['dscr'] = cash_flow.apply(lambda row: row['cfads'] / debt_service[row.name] if debt_service[row.name] != 0 else None, axis=1)
    cash_flow['equity_cash_flow'] = cash_flow['cfads'] - cash_flow['interest'] - cash_flow['principal']

    # Calculate Terminal Value
    # Iterate through each asset to apply its specific terminal value
    for asset_id in cash_flow['asset_id'].unique():
        asset_name = next((asset['name'] for asset in assets_data if asset['id'] == asset_id), None)
        if asset_name and asset_name in asset_cost_assumptions:
            asset_tv = asset_cost_assumptions[asset_name].get('terminalValue', 0.0)
            if asset_tv > 0:
                # Find the last period for this specific asset
                last_period_date_for_asset = cash_flow[cash_flow['asset_id'] == asset_id]['date'].max()
                cash_flow.loc[(cash_flow['asset_id'] == asset_id) & (cash_flow['date'] == last_period_date_for_asset), 'terminal_value'] = asset_tv
                cash_flow.loc[(cash_flow['asset_id'] == asset_id) & (cash_flow['date'] == last_period_date_for_asset), 'equity_cash_flow'] += asset_tv

    return cash_flow
