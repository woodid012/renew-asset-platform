import numpy_financial as npf

def calculate_equity_irr(equity_cash_flows):
    """
    Calculates the Equity Internal Rate of Return (IRR).

    Args:
        equity_cash_flows (list or np.array): A list or numpy array of cash flows
                                             where the first value is the initial investment (negative)
                                             and subsequent values are positive cash inflows.

    Returns:
        float: The Equity IRR as a decimal (e.g., 0.10 for 10%).
               Returns NaN if IRR cannot be calculated (e.g., no cash flows).
    """
    if not equity_cash_flows or len(equity_cash_flows) < 2:
        return float('nan') # Not enough cash flows to calculate IRR

    try:
        # npf.irr expects cash flows to be in chronological order
        # and the initial investment as a negative value.
        irr = npf.irr(equity_cash_flows)
        return irr
    except Exception as e:
        print(f"Error calculating IRR: {e}")
        return float('nan')
