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

    # Ensure the first cash flow is negative (initial investment)
    # If it's not, and there are positive cash flows later, IRR might still be calculable
    # but it's good practice for the initial investment to be negative.
    # If all cash flows are zero, IRR is undefined.
    if all(cf == 0 for cf in equity_cash_flows):
        return float('nan')

    try:
        # npf.irr expects cash flows to be in chronological order
        irr = npf.irr(equity_cash_flows)
        return irr
    except ValueError as e:
        # This often happens if there's no sign change in cash flows, or other numerical issues
        print(f"ValueError calculating IRR: {e}. Cash flows: {equity_cash_flows[:5]}...{equity_cash_flows[-5:]}")
        return float('nan')
    except Exception as e:
        print(f"An unexpected error occurred calculating IRR: {e}")
        return float('nan')
