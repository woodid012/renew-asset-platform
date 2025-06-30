import json
import os
import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from .price_curves import get_merchant_price
from config import MERCHANT_PRICE_ESCALATION_RATE, MERCHANT_PRICE_ESCALATION_REFERENCE_DATE

def generate_frontend_price_curves_export(monthly_prices, yearly_spreads, start_date, end_date, output_dir='results'):
    """
    Generate comprehensive price curves data for frontend consumption (specifically for price-curves-2).
    
    Args:
        monthly_prices (pd.DataFrame): Monthly price data
        yearly_spreads (pd.DataFrame): Yearly spread data for storage
        start_date (datetime): Model start date
        end_date (datetime): Model end date
        output_dir (str): Output directory (not used for frontend export, but kept for signature consistency)
    
    Returns:
        dict: Price curves data structure
    """
    print("=== GENERATING FRONTEND PRICE CURVES EXPORT (price-curves-2) ===")
    
    # Available options
    profiles = ['solar', 'wind', 'baseload', 'storage']
    regions = ['QLD', 'NSW', 'VIC', 'SA']
    types = ['Energy', 'green']
    storage_durations = [0.5, 1, 2, 4]
    
    # Time intervals
    time_intervals = {
        'monthly': [],
        'quarterly': [],
        'yearly': []
    }
    
    # Generate monthly intervals
    current_date = start_date.replace(day=1)  # Start from first day of month
    while current_date <= end_date:
        time_intervals['monthly'].append({
            'date': current_date.strftime('%Y-%m-%d'),
            'display': current_date.strftime('%m/%Y'),
            'year': current_date.year,
            'month': current_date.month,
            'quarter': (current_date.month - 1) // 3 + 1
        })
        current_date += relativedelta(months=1)
    
    # Generate quarterly intervals
    current_date = start_date.replace(month=((start_date.month - 1) // 3) * 3 + 1, day=1)
    while current_date <= end_date:
        quarter = (current_date.month - 1) // 3 + 1
        time_intervals['quarterly'].append({
            'date': current_date.strftime('%Y-%m-%d'),
            'display': f"{current_date.year}-Q{quarter}",
            'year': current_date.year,
            'quarter': quarter
        })
        current_date += relativedelta(months=3)
    
    # Generate yearly intervals
    for year in range(start_date.year, end_date.year + 1):
        time_intervals['yearly'].append({
            'date': f"{year}-01-01",
            'display': str(year),
            'year': year
        })
    
    # Price data structure
    price_data = {}
    
    print(f"Generating prices for {len(time_intervals['monthly'])} monthly periods...")
    
    # Generate prices for each combination
    for interval_type, intervals in time_intervals.items():
        price_data[interval_type] = {}
        
        for interval in intervals:
            period_date = datetime.strptime(interval['date'], '%Y-%m-%d')
            period_key = interval['display']
            price_data[interval_type][period_key] = {
                'date': interval['date'],
                'year': interval['year'],
                'prices': {}
            }
            
            # Add quarter info for quarterly data
            if 'quarter' in interval:
                price_data[interval_type][period_key]['quarter'] = interval['quarter']
            
            # Generate prices for each region
            for region in regions:
                price_data[interval_type][period_key]['prices'][region] = {}
                
                # Renewable profiles (solar, wind, baseload)
                for profile in ['solar', 'wind', 'baseload']:
                    price_data[interval_type][period_key]['prices'][region][profile] = {}
                    
                    for price_type in types:
                        try:
                            price = get_merchant_price(profile, price_type, region, period_date, 
                                                     monthly_prices, yearly_spreads, {})
                            price_data[interval_type][period_key]['prices'][region][profile][price_type] = round(price, 2)
                        except Exception as e:
                            print(f"Error getting {profile}-{price_type} price for {region} {period_key}: {e}")
                            price_data[interval_type][period_key]['prices'][region][profile][price_type] = 0
                
                # Storage durations
                price_data[interval_type][period_key]['prices'][region]['storage'] = {}
                for duration in storage_durations:
                    try:
                        price = get_merchant_price('storage', duration, region, period_date, 
                                                 monthly_prices, yearly_spreads, {})
                        price_data[interval_type][period_key]['prices'][region]['storage'][f"{duration}h"] = round(price, 2)
                    except Exception as e:
                        print(f"Error getting storage-{duration}h price for {region} {period_key}: {e}")
                        price_data[interval_type][period_key]['prices'][region]['storage'][f"{duration}h"] = 0
    
    # Metadata
    metadata = {
        'generated_at': datetime.now().isoformat(),
        'model_period': {
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d')
        },
        'escalation_settings': {
            'rate': MERCHANT_PRICE_ESCALATION_RATE,
            'reference_date': MERCHANT_PRICE_ESCALATION_REFERENCE_DATE
        },
        'available_options': {
            'profiles': profiles,
            'regions': regions,
            'types': types,
            'storage_durations': storage_durations
        },
        'data_structure': {
            'intervals': list(time_intervals.keys()),
            'total_periods': {
                'monthly': len(time_intervals['monthly']),
                'quarterly': len(time_intervals['quarterly']),
                'yearly': len(time_intervals['yearly'])
            }
        }
    }
    
    # Combine everything
    export_data = {
        'metadata': metadata,
        'time_intervals': time_intervals,
        'price_data': price_data
    }
    
    # Save to JSON file in public/price-cache directory for frontend access
    # The path needs to go up two directories from 'backend' to the project root, then into 'public/price-cache'
    public_cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'price-cache')
    os.makedirs(public_cache_dir, exist_ok=True)
    output_path = os.path.join(public_cache_dir, 'frontend_price_curves_export.json')
    
    with open(output_path, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"Frontend price curves export saved to: {output_path}")
    print(f"Generated {len(time_intervals['monthly'])} monthly, {len(time_intervals['quarterly'])} quarterly, and {len(time_intervals['yearly'])} yearly price points")
    print("=== FRONTEND PRICE CURVES EXPORT COMPLETE ===")
    
    return export_data