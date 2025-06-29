import pandas as pd
import numpy as np
from datetime import datetime

def get_merchant_price(profile, price_type, region, date, monthly_prices, yearly_spreads, constants):
    # Ensure date is a datetime object
    if isinstance(date, str):
        date = datetime.strptime(date, '%Y-%m-%d')

    # For yearly spreads (storage duration based)
    if isinstance(price_type, (float, int)):
        # Find the closest duration in yearly_spreads
        duration = float(price_type)
        relevant_spreads = yearly_spreads[(yearly_spreads['REGION'] == region) & (yearly_spreads['YEAR'] == date.year)]

        if relevant_spreads.empty:
            # Fallback to default if no data for the year/state
            return 50 # Default fallback

        # Sort by duration to find interpolation points
        relevant_spreads = relevant_spreads.sort_values(by='DURATION')

        lower_duration_row = relevant_spreads[relevant_spreads['DURATION'] <= duration].iloc[-1:]
        upper_duration_row = relevant_spreads[relevant_spreads['DURATION'] >= duration].iloc[:1]

        if not lower_duration_row.empty and not upper_duration_row.empty:
            lower_duration = lower_duration_row['DURATION'].iloc[0]
            upper_duration = upper_duration_row['DURATION'].iloc[0]
            lower_price = lower_duration_row['SPREAD'].iloc[0]
            upper_price = upper_duration_row['SPREAD'].iloc[0]

            if lower_duration == upper_duration:
                return lower_price
            else:
                # Linear interpolation
                interpolated_price = lower_price + (upper_price - lower_price) * \
                                     (duration - lower_duration) / (upper_duration - lower_duration)
                return interpolated_price
        elif not lower_duration_row.empty:
            return lower_duration_row['SPREAD'].iloc[0]
        elif not upper_duration_row.empty:
            return upper_duration_row['SPREAD'].iloc[0]
        else:
            return 50 # Default fallback

    # For monthly prices (Energy/green)
    else:
        # Filter for the exact month and year
        # Convert monthly_prices['time'] to datetime objects for proper comparison
        monthly_prices['_time_dt'] = pd.to_datetime(monthly_prices['time'], format='%d/%m/%Y')
        
        # Filter for the exact month and year
        filtered_prices = monthly_prices[
            (monthly_prices['profile'] == profile) &
            (monthly_prices['type'] == price_type) &
            (monthly_prices['REGION'] == region) &
            (monthly_prices['_time_dt'].dt.year == date.year) &
            (monthly_prices['_time_dt'].dt.month == date.month)
        ]

        if not filtered_prices.empty:
            return filtered_prices['price'].iloc[0]
        else:
            # Fallback logic: search backwards for valid prices
            year_to_try = date.year
            month_to_try = date.month
            for _ in range(12 * 5): # Try up to 5 years back
                month_to_try -= 1
                if month_to_try == 0:
                    month_to_try = 12
                    year_to_try -= 1
                
                fallback_prices = monthly_prices[
                    (monthly_prices['profile'] == profile) &
                    (monthly_prices['type'] == price_type) &
                    (monthly_prices['REGION'] == region) &
                    (monthly_prices['_time_dt'].dt.year == year_to_try) &
                    (monthly_prices['_time_dt'].dt.month == month_to_try)
                ]
                if not fallback_prices.empty:
                    return fallback_prices['price'].iloc[0]
            return 50 # Default fallback if no historical data found
