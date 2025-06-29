# revenue_calculator.py
import logging
import uuid
import time
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
import numpy as np
from dataclasses import dataclass

from models import (
    PortfolioData, CalculationConfig, OutputConfig, TimePeriod, 
    ValidationResult, SummaryMetrics, CalculationMetadata, CalculationResponse,
    AssetType, ContractType, ScenarioType, IntervalType, RevenueFilter
)

logger = logging.getLogger(__name__)

@dataclass
class AssetRevenue:
    """Data class for asset revenue breakdown"""
    total: float = 0.0
    contracted_green: float = 0.0
    contracted_energy: float = 0.0
    merchant_green: float = 0.0
    merchant_energy: float = 0.0
    volume_mwh: float = 0.0

class RevenueCalculator:
    """
    Main revenue calculation engine
    
    This class handles all portfolio revenue calculations using the same logic
    as the original TypeScript implementation but optimized for Python.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.calculation_cache = {}
        
        # Default merchant prices (fallback values)
        self.default_prices = {
            'solar': {'green': 35, 'energy': 65},
            'wind': {'green': 35, 'energy': 65},
            'storage': {
                0.5: 160, 1: 180, 2: 200, 4: 220,
                'energy': 80
            }
        }
        
        # Default capacity factors by region and technology
        self.default_capacity_factors = {
            'solar': {
                'QLD': 0.29, 'NSW': 0.28, 'VIC': 0.25, 
                'SA': 0.27, 'WA': 0.26, 'TAS': 0.23
            },
            'wind': {
                'QLD': 0.32, 'NSW': 0.35, 'VIC': 0.38,
                'SA': 0.40, 'WA': 0.37, 'TAS': 0.42
            }
        }
        
        logger.info("RevenueCalculator initialized")

    async def calculate_portfolio_revenue(
        self, 
        portfolio_data: PortfolioData, 
        config: CalculationConfig,
        output_config: OutputConfig
    ) -> CalculationResponse:
        """
        Main portfolio revenue calculation method
        
        Args:
            portfolio_data: Portfolio assets and configuration
            config: Calculation configuration
            output_config: Output formatting configuration
            
        Returns:
            CalculationResponse with time series and summary data
        """
        start_time = time.time()
        calculation_id = str(uuid.uuid4())
        
        logger.info(f"Starting calculation {calculation_id}")
        
        try:
            # Validate portfolio data
            validation = self.validate_portfolio_data(portfolio_data)
            if not validation.is_valid:
                raise ValueError(f"Portfolio validation failed: {'; '.join(validation.errors)}")
            
            # Generate time intervals
            time_intervals = self._generate_time_intervals(config)
            logger.info(f"Generated {len(time_intervals)} time intervals")
            
            # Calculate revenue for each time period
            time_series = []
            for interval in time_intervals:
                period_data = await self._calculate_period_revenue(
                    portfolio_data, config, interval
                )
                time_series.append(period_data)
            
            # Generate summary metrics
            summary = self._calculate_summary_metrics(time_series, portfolio_data)
            
            # Create metadata
            execution_time = time.time() - start_time
            metadata = CalculationMetadata(
                calculation_id=calculation_id,
                timestamp=datetime.utcnow().isoformat(),
                version="1.0.0",
                execution_time_seconds=round(execution_time, 3),
                python_version=sys.version
            )
            
            logger.info(f"✅ Calculation {calculation_id} completed in {execution_time:.3f}s")
            
            return CalculationResponse(
                success=True,
                time_series=time_series,
                summary=summary,
                validation=validation,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"❌ Calculation {calculation_id} failed: {e}")
            raise

    def validate_portfolio_data(self, portfolio_data: PortfolioData) -> ValidationResult:
        """
        Validate portfolio data structure and content
        
        Args:
            portfolio_data: Portfolio data to validate
            
        Returns:
            ValidationResult with errors and warnings
        """
        errors = []
        warnings = []
        asset_count = 0
        contract_count = 0
        
        try:
            # Check basic portfolio structure
            if not portfolio_data.assets:
                errors.append("Portfolio contains no assets")
                return ValidationResult(
                    is_valid=False,
                    errors=errors,
                    warnings=warnings,
                    asset_count=0,
                    contract_count=0
                )
            
            # Validate each asset
            for asset_key, asset_data in portfolio_data.assets.items():
                asset_count += 1
                
                # Check required fields
                if not asset_data.get('name'):
                    errors.append(f"Asset {asset_key}: missing name")
                if not asset_data.get('type'):
                    errors.append(f"Asset {asset_key}: missing type")
                if not asset_data.get('capacity'):
                    errors.append(f"Asset {asset_key}: missing capacity")
                if not asset_data.get('assetStartDate'):
                    errors.append(f"Asset {asset_key}: missing assetStartDate")
                
                # Type-specific validation
                asset_type = asset_data.get('type')
                if asset_type == 'storage':
                    if not asset_data.get('volume'):
                        warnings.append(f"Storage asset {asset_key}: missing volume")
                
                # Validate contracts
                contracts = asset_data.get('contracts', [])
                contract_count += len(contracts)
                
                for i, contract in enumerate(contracts):
                    if not contract.get('startDate'):
                        warnings.append(f"Asset {asset_key}, contract {i+1}: missing start date")
                    if not contract.get('endDate'):
                        warnings.append(f"Asset {asset_key}, contract {i+1}: missing end date")
                    if not any([
                        contract.get('strikePrice'),
                        contract.get('greenPrice'),
                        contract.get('EnergyPrice')
                    ]):
                        warnings.append(f"Asset {asset_key}, contract {i+1}: no pricing specified")
                
                # Check capacity factors for renewables
                if asset_type in ['solar', 'wind']:
                    quarterly_factors = [
                        asset_data.get('qtrCapacityFactor_q1'),
                        asset_data.get('qtrCapacityFactor_q2'),
                        asset_data.get('qtrCapacityFactor_q3'),
                        asset_data.get('qtrCapacityFactor_q4')
                    ]
                    if not any(factor for factor in quarterly_factors if factor is not None):
                        warnings.append(f"Asset {asset_key}: no quarterly capacity factors specified")
            
            is_valid = len(errors) == 0
            
            logger.info(f"Portfolio validation: {asset_count} assets, {contract_count} contracts, "
                       f"{len(errors)} errors, {len(warnings)} warnings")
            
            return ValidationResult(
                is_valid=is_valid,
                errors=errors,
                warnings=warnings,
                asset_count=asset_count,
                contract_count=contract_count
            )
            
        except Exception as e:
            logger.error(f"Validation error: {e}")
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation failed: {str(e)}"],
                warnings=warnings,
                asset_count=asset_count,
                contract_count=contract_count
            )

    def _generate_time_intervals(self, config: CalculationConfig) -> List[str]:
        """
        Generate time intervals based on configuration
        
        Args:
            config: Calculation configuration
            
        Returns:
            List of time interval strings
        """
        intervals = []
        start_year = config.start_year
        
        if config.interval_type == IntervalType.ANNUAL:
            for i in range(config.analysis_years):
                intervals.append(str(start_year + i))
                
        elif config.interval_type == IntervalType.QUARTERLY:
            total_quarters = config.analysis_years * 4
            for i in range(total_quarters):
                year = start_year + (i // 4)
                quarter = (i % 4) + 1
                intervals.append(f"{year}-Q{quarter}")
                
        elif config.interval_type == IntervalType.MONTHLY:
            total_months = config.analysis_years * 12
            for i in range(total_months):
                year = start_year + (i // 12)
                month = (i % 12) + 1
                intervals.append(f"{year}-{month:02d}")
        
        return intervals

    async def _calculate_period_revenue(
        self, 
        portfolio_data: PortfolioData, 
        config: CalculationConfig, 
        time_interval: str
    ) -> TimePeriod:
        """
        Calculate revenue for a specific time period
        
        Args:
            portfolio_data: Portfolio data
            config: Calculation configuration  
            time_interval: Time interval string
            
        Returns:
            TimePeriod with revenue calculations
        """
        # Parse time interval
        period_info = self._parse_time_interval(time_interval)
        
        # Initialize portfolio aggregates
        portfolio_revenue = {
            'total': 0.0,
            'contracted_green': 0.0,
            'contracted_energy': 0.0,
            'merchant_green': 0.0,
            'merchant_energy': 0.0
        }
        
        asset_revenues = {}
        
        # Calculate revenue for each asset
        for asset_key, asset_data in portfolio_data.assets.items():
            # Apply region filter
            if (config.region_filter != "ALL" and 
                asset_data.get('state', '').upper() != config.region_filter.upper()):
                continue
            
            asset_revenue = await self._calculate_asset_revenue(
                asset_data, config, period_info
            )
            
            # Apply revenue filter
            filtered_revenue = self._apply_revenue_filter(asset_revenue, config.revenue_filter)
            asset_revenues[asset_data.get('name', asset_key)] = filtered_revenue
            
            # Aggregate to portfolio level
            portfolio_revenue['total'] += filtered_revenue['total']
            portfolio_revenue['contracted_green'] += filtered_revenue['contracted_green']
            portfolio_revenue['contracted_energy'] += filtered_revenue['contracted_energy']
            portfolio_revenue['merchant_green'] += filtered_revenue['merchant_green']
            portfolio_revenue['merchant_energy'] += filtered_revenue['merchant_energy']
        
        return TimePeriod(
            time_period=time_interval,
            year=period_info['year'],
            quarter=period_info.get('quarter'),
            month=period_info.get('month'),
            portfolio_revenue=portfolio_revenue,
            asset_revenues=asset_revenues
        )

    async def _calculate_asset_revenue(
        self, 
        asset_data: Dict[str, Any], 
        config: CalculationConfig, 
        period_info: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Calculate revenue for a specific asset and time period
        
        Args:
            asset_data: Asset configuration data
            config: Calculation configuration
            period_info: Parsed time period information
            
        Returns:
            Dictionary with revenue breakdown
        """
        asset_type = asset_data.get('type')
        
        if asset_type == 'storage':
            return await self._calculate_storage_revenue(asset_data, config, period_info)
        else:
            return await self._calculate_renewable_revenue(asset_data, config, period_info)

    async def _calculate_renewable_revenue(
        self, 
        asset_data: Dict[str, Any], 
        config: CalculationConfig, 
        period_info: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Calculate revenue for renewable assets (solar, wind)
        """
        # Get basic asset parameters
        capacity = float(asset_data.get('capacity', 0))
        asset_type = asset_data.get('type')
        state = asset_data.get('state', 'QLD')
        
        # Check if asset has started operating
        asset_start_year = self._parse_asset_start_year(asset_data.get('assetStartDate', ''))
        if period_info['year'] < asset_start_year:
            return {
                'total': 0.0,
                'contracted_green': 0.0,
                'contracted_energy': 0.0,
                'merchant_green': 0.0,
                'merchant_energy': 0.0
            }
        
        # Calculate capacity factor
        capacity_factor = self._get_capacity_factor(asset_data, period_info)
        
        # Calculate degradation
        years_since_start = period_info['year'] - asset_start_year
        degradation_rate = float(asset_data.get('annualDegradation', 0.5)) / 100
        degradation_factor = (1 - degradation_rate) ** years_since_start
        
        # Calculate generation
        hours_in_year = 8760
        period_adjustment = period_info['period_adjustment']
        volume_loss_adjustment = float(asset_data.get('volumeLossAdjustment', 95)) / 100
        
        base_generation = (capacity * hours_in_year * capacity_factor * 
                          period_adjustment * degradation_factor * volume_loss_adjustment)
        
        # Process contracts
        contracts = asset_data.get('contracts', [])
        active_contracts = self._filter_active_contracts(contracts, period_info)
        
        contract_breakdown = self._process_renewable_contracts(
            active_contracts, period_info['year'], base_generation
        )
        
        # Calculate merchant revenue
        merchant_green_volume = base_generation * (100 - contract_breakdown['green_percentage']) / 100
        merchant_energy_volume = base_generation * (100 - contract_breakdown['energy_percentage']) / 100
        
        # Get merchant prices with escalation
        merchant_green_price = self._get_merchant_price(
            asset_type, 'green', state, period_info, config
        )
        merchant_energy_price = self._get_merchant_price(
            asset_type, 'energy', state, period_info, config
        )
        
        merchant_green_revenue = (merchant_green_volume * merchant_green_price) / 1_000_000
        merchant_energy_revenue = (merchant_energy_volume * merchant_energy_price) / 1_000_000
        
        # Apply scenario stress
        revenues = {
            'contracted_green': contract_breakdown['contracted_green_revenue'],
            'contracted_energy': contract_breakdown['contracted_energy_revenue'],
            'merchant_green': merchant_green_revenue,
            'merchant_energy': merchant_energy_revenue
        }
        
        stressed_revenues = self._apply_scenario_stress(revenues, config)
        
        return {
            'total': sum(stressed_revenues.values()),
            **stressed_revenues
        }

    async def _calculate_storage_revenue(
        self, 
        asset_data: Dict[str, Any], 
        config: CalculationConfig, 
        period_info: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Calculate revenue for storage assets
        """
        capacity = float(asset_data.get('capacity', 0))
        volume = float(asset_data.get('volume', 0))
        state = asset_data.get('state', 'QLD')
        
        # Check if asset has started operating
        asset_start_year = self._parse_asset_start_year(asset_data.get('assetStartDate', ''))
        if period_info['year'] < asset_start_year:
            return {
                'total': 0.0,
                'contracted_green': 0.0,
                'contracted_energy': 0.0,
                'merchant_green': 0.0,
                'merchant_energy': 0.0
            }
        
        # Calculate degradation
        years_since_start = period_info['year'] - asset_start_year
        degradation_rate = float(asset_data.get('annualDegradation', 0.5)) / 100
        degradation_factor = (1 - degradation_rate) ** years_since_start
        
        # Calculate throughput
        days_in_year = 365
        period_adjustment = period_info['period_adjustment']
        volume_loss_adjustment = float(asset_data.get('volumeLossAdjustment', 95)) / 100
        
        annual_throughput = volume * days_in_year * degradation_factor * volume_loss_adjustment
        period_throughput = annual_throughput * period_adjustment
        
        # Process contracts
        contracts = asset_data.get('contracts', [])
        active_contracts = self._filter_active_contracts(contracts, period_info)
        
        contract_breakdown = self._process_storage_contracts(
            active_contracts, period_info['year'], capacity, period_throughput, period_adjustment
        )
        
        # Calculate merchant revenue
        merchant_percentage = max(0, 100 - contract_breakdown['contracted_percentage'])
        merchant_throughput = period_throughput * merchant_percentage / 100
        
        # Get storage spread price
        duration = volume / capacity if capacity > 0 else 2.0
        merchant_spread = self._get_storage_spread(state, duration, period_info, config)
        
        merchant_revenue = (merchant_throughput * merchant_spread) / 1_000_000
        
        # Apply scenario stress
        revenues = {
            'contracted_green': 0.0,
            'contracted_energy': contract_breakdown['contracted_revenue'],
            'merchant_green': 0.0,
            'merchant_energy': merchant_revenue
        }
        
        stressed_revenues = self._apply_scenario_stress(revenues, config)
        
        return {
            'total': sum(stressed_revenues.values()),
            **stressed_revenues
        }

    def _get_capacity_factor(self, asset_data: Dict[str, Any], period_info: Dict[str, Any]) -> float:
        """Get capacity factor for renewable asset"""
        asset_type = asset_data.get('type')
        state = asset_data.get('state', 'QLD')
        
        # Try to get quarterly capacity factor if period is quarterly
        if period_info.get('quarter'):
            quarter_key = f"qtrCapacityFactor_q{period_info['quarter']}"
            quarter_factor = asset_data.get(quarter_key)
            if quarter_factor is not None and quarter_factor != '':
                return float(quarter_factor) / 100
        
        # Try to get monthly capacity factor (use quarter for month)
        if period_info.get('month'):
            quarter = (period_info['month'] - 1) // 3 + 1
            quarter_key = f"qtrCapacityFactor_q{quarter}"
            quarter_factor = asset_data.get(quarter_key)
            if quarter_factor is not None and quarter_factor != '':
                return float(quarter_factor) / 100
        
        # Calculate average from available quarterly factors
        quarterly_factors = []
        for q in range(1, 5):
            factor = asset_data.get(f"qtrCapacityFactor_q{q}")
            if factor is not None and factor != '':
                quarterly_factors.append(float(factor) / 100)
        
        if quarterly_factors:
            return sum(quarterly_factors) / len(quarterly_factors)
        
        # Fall back to default capacity factors
        return self.default_capacity_factors.get(asset_type, {}).get(state, 0.25)

    def _get_merchant_price(
        self, 
        asset_type: str, 
        price_type: str, 
        state: str, 
        period_info: Dict[str, Any], 
        config: CalculationConfig
    ) -> float:
        """Get merchant price with escalation"""
        # Get base price
        base_price = self.default_prices.get(asset_type, {}).get(price_type, 50)
        
        # Apply escalation if enabled
        if config.escalation_settings.enabled:
            years_diff = period_info['year'] - config.escalation_settings.reference_year
            escalation_factor = (1 + config.escalation_settings.rate / 100) ** years_diff
            return base_price * escalation_factor
        
        return base_price

    def _get_storage_spread(
        self, 
        state: str, 
        duration: float, 
        period_info: Dict[str, Any], 
        config: CalculationConfig
    ) -> float:
        """Get storage price spread with interpolation"""
        # Standard duration points for interpolation
        standard_durations = [0.5, 1, 2, 4]
        storage_prices = self.default_prices['storage']
        
        # Find interpolation bounds
        if duration <= standard_durations[0]:
            base_spread = storage_prices[standard_durations[0]]
        elif duration >= standard_durations[-1]:
            base_spread = storage_prices[standard_durations[-1]]
        else:
            # Linear interpolation
            for i in range(len(standard_durations) - 1):
                if standard_durations[i] <= duration <= standard_durations[i + 1]:
                    lower_duration = standard_durations[i]
                    upper_duration = standard_durations[i + 1]
                    lower_price = storage_prices[lower_duration]
                    upper_price = storage_prices[upper_duration]
                    
                    ratio = (duration - lower_duration) / (upper_duration - lower_duration)
                    base_spread = lower_price + ratio * (upper_price - lower_price)
                    break
            else:
                base_spread = storage_prices[2]  # Default to 2-hour
        
        # Apply escalation if enabled
        if config.escalation_settings.enabled:
            years_diff = period_info['year'] - config.escalation_settings.reference_year
            escalation_factor = (1 + config.escalation_settings.rate / 100) ** years_diff
            return base_spread * escalation_factor
        
        return base_spread

    def _parse_time_interval(self, time_interval: str) -> Dict[str, Any]:
        """Parse time interval string into components"""
        if '-Q' in time_interval:
            # Quarterly format: "2025-Q3"
            year_str, quarter_str = time_interval.split('-Q')
            return {
                'year': int(year_str),
                'quarter': int(quarter_str),
                'period_adjustment': 0.25
            }
        elif '-' in time_interval and len(time_interval.split('-')) == 2:
            # Monthly format: "2025-03"
            year_str, month_str = time_interval.split('-')
            month = int(month_str)
            return {
                'year': int(year_str),
                'month': month,
                'quarter': (month - 1) // 3 + 1,
                'period_adjustment': 1/12
            }
        else:
            # Annual format: "2025"
            return {
                'year': int(time_interval),
                'period_adjustment': 1.0
            }

    def _parse_asset_start_year(self, start_date: str) -> int:
        """Parse asset start date to extract year"""
        if not start_date:
            return 2025
        
        # Try different date formats
        try:
            if '/' in start_date:
                # DD/MM/YYYY format
                parts = start_date.split('/')
                return int(parts[2])
            elif '-' in start_date:
                # YYYY-MM-DD format
                return int(start_date.split('-')[0])
            else:
                # Assume it's just a year
                return int(start_date)
        except (ValueError, IndexError):
            logger.warning(f"Could not parse start date: {start_date}")
            return 2025

    def _filter_active_contracts(self, contracts: List[Dict], period_info: Dict[str, Any]) -> List[Dict]:
        """Filter contracts that are active in the given time period"""
        active_contracts = []
        
        for contract in contracts:
            start_year = self._parse_asset_start_year(contract.get('startDate', ''))
            end_year = self._parse_asset_start_year(contract.get('endDate', ''))
            
            if start_year <= period_info['year'] <= end_year:
                active_contracts.append(contract)
        
        return active_contracts

    def _process_renewable_contracts(
        self, 
        active_contracts: List[Dict], 
        year: int, 
        generation: float
    ) -> Dict[str, Any]:
        """Process renewable asset contracts"""
        green_percentage = 0
        energy_percentage = 0
        contracted_green_revenue = 0
        contracted_energy_revenue = 0
        
        for contract in active_contracts:
            buyers_percentage = float(contract.get('buyersPercentage', 0))
            start_year = self._parse_asset_start_year(contract.get('startDate', ''))
            years_elapsed = year - start_year
            indexation = float(contract.get('indexation', 0)) / 100
            indexation_factor = (1 + indexation) ** years_elapsed
            
            contract_type = contract.get('type', '')
            
            if contract_type == 'bundled':
                green_price = float(contract.get('greenPrice', 0)) * indexation_factor
                energy_price = float(contract.get('EnergyPrice', 0)) * indexation_factor
                
                # Apply floor if exists
                if contract.get('hasFloor') and contract.get('floorValue'):
                    floor_value = float(contract.get('floorValue', 0))
                    total_price = green_price + energy_price
                    if total_price < floor_value:
                        if total_price > 0:
                            green_price = (green_price / total_price) * floor_value
                            energy_price = (energy_price / total_price) * floor_value
                        else:
                            green_price = floor_value / 2
                            energy_price = floor_value / 2
                
                contract_volume = generation * buyers_percentage / 100
                contracted_green_revenue += (contract_volume * green_price) / 1_000_000
                contracted_energy_revenue += (contract_volume * energy_price) / 1_000_000
                green_percentage += buyers_percentage
                energy_percentage += buyers_percentage
                
            elif contract_type == 'green':
                price = float(contract.get('strikePrice', 0)) * indexation_factor
                
                if contract.get('hasFloor') and contract.get('floorValue'):
                    price = max(price, float(contract.get('floorValue', 0)))
                
                contract_volume = generation * buyers_percentage / 100
                contracted_green_revenue += (contract_volume * price) / 1_000_000
                green_percentage += buyers_percentage
                
            elif contract_type == 'Energy':
                price = float(contract.get('strikePrice', 0)) * indexation_factor
                
                if contract.get('hasFloor') and contract.get('floorValue'):
                    price = max(price, float(contract.get('floorValue', 0)))
                
                contract_volume = generation * buyers_percentage / 100
                contracted_energy_revenue += (contract_volume * price) / 1_000_000
                energy_percentage += buyers_percentage
        
        return {
            'green_percentage': min(green_percentage, 100),
            'energy_percentage': min(energy_percentage, 100),
            'contracted_green_revenue': contracted_green_revenue,
            'contracted_energy_revenue': contracted_energy_revenue
        }

    def _process_storage_contracts(
        self, 
        active_contracts: List[Dict], 
        year: int, 
        capacity: float, 
        throughput: float,
        period_adjustment: float
    ) -> Dict[str, Any]:
        """Process storage asset contracts"""
        contracted_percentage = 0
        contracted_revenue = 0
        
        for contract in active_contracts:
            buyers_percentage = float(contract.get('buyersPercentage', 0))
            start_year = self._parse_asset_start_year(contract.get('startDate', ''))
            years_elapsed = year - start_year
            indexation = float(contract.get('indexation', 0)) / 100
            indexation_factor = (1 + indexation) ** years_elapsed
            
            contract_type = contract.get('type', '')
            
            if contract_type == 'cfd':
                spread = float(contract.get('strikePrice', 0)) * indexation_factor
                revenue = throughput * spread * (buyers_percentage / 100)
                contracted_revenue += revenue / 1_000_000
                
            elif contract_type == 'tolling':
                hourly_rate = float(contract.get('strikePrice', 0)) * indexation_factor
                revenue = capacity * 8760 * period_adjustment * hourly_rate * (buyers_percentage / 100)
                contracted_revenue += revenue / 1_000_000
                
            elif contract_type == 'fixed':
                annual_revenue = float(contract.get('strikePrice', 0)) * indexation_factor
                revenue = annual_revenue * period_adjustment
                contracted_revenue += revenue
            
            contracted_percentage += buyers_percentage
        
        return {
            'contracted_percentage': min(contracted_percentage, 100),
            'contracted_revenue': contracted_revenue
        }

    def _apply_scenario_stress(self, revenues: Dict[str, float], config: CalculationConfig) -> Dict[str, float]:
        """Apply scenario stress testing to revenues"""
        if config.scenario == ScenarioType.BASE:
            return revenues
        
        # Default stress parameters (can be made configurable)
        volume_stress = 0.20  # 20% volume reduction
        price_stress = 0.20   # 20% price reduction
        
        stressed_revenues = revenues.copy()
        
        if config.scenario == ScenarioType.WORST:
            # Apply both volume and price stress
            stressed_revenues['contracted_green'] *= (1 - volume_stress)
            stressed_revenues['contracted_energy'] *= (1 - volume_stress)
            stressed_revenues['merchant_green'] *= (1 - volume_stress) * (1 - price_stress)
            stressed_revenues['merchant_energy'] *= (1 - volume_stress) * (1 - price_stress)
            
        elif config.scenario == ScenarioType.VOLUME:
            # Apply only volume stress
            for key in stressed_revenues:
                stressed_revenues[key] *= (1 - volume_stress)
                
        elif config.scenario == ScenarioType.PRICE:
            # Apply only price stress to merchant revenues
            stressed_revenues['merchant_green'] *= (1 - price_stress)
            stressed_revenues['merchant_energy'] *= (1 - price_stress)
        
        return stressed_revenues

    def _apply_revenue_filter(self, revenue: Dict[str, float], filter_type: RevenueFilter) -> Dict[str, float]:
        """Apply revenue filter to results"""
        if filter_type == RevenueFilter.ENERGY:
            return {
                'total': revenue['contracted_energy'] + revenue['merchant_energy'],
                'contracted_green': 0.0,
                'contracted_energy': revenue['contracted_energy'],
                'merchant_green': 0.0,
                'merchant_energy': revenue['merchant_energy']
            }
        elif filter_type == RevenueFilter.GREEN:
            return {
                'total': revenue['contracted_green'] + revenue['merchant_green'],
                'contracted_green': revenue['contracted_green'],
                'contracted_energy': 0.0,
                'merchant_green': revenue['merchant_green'],
                'merchant_energy': 0.0
            }
        else:
            return revenue

    def _calculate_summary_metrics(
        self, 
        time_series: List[TimePeriod], 
        portfolio_data: PortfolioData
    ) -> SummaryMetrics:
        """Calculate portfolio summary metrics"""
        if not time_series:
            return SummaryMetrics(
                total_capacity_mw=0.0,
                total_revenue_m=0.0,
                average_annual_revenue_m=0.0,
                contracted_percentage=0.0,
                merchant_percentage=0.0,
                asset_count=0,
                period_count=0
            )
        
        # Calculate totals
        total_revenue = sum(period.portfolio_revenue['total'] for period in time_series)
        total_contracted = sum(
            period.portfolio_revenue['contracted_green'] + period.portfolio_revenue['contracted_energy']
            for period in time_series
        )
        total_merchant = sum(
            period.portfolio_revenue['merchant_green'] + period.portfolio_revenue['merchant_energy']
            for period in time_series
        )
        
        # Calculate capacity
        total_capacity = sum(
            float(asset.get('capacity', 0)) 
            for asset in portfolio_data.assets.values()
        )
        
        # Calculate percentages
        contracted_percentage = (total_contracted / total_revenue * 100) if total_revenue > 0 else 0
        merchant_percentage = (total_merchant / total_revenue * 100) if total_revenue > 0 else 0
        
        return SummaryMetrics(
            total_capacity_mw=total_capacity,
            total_revenue_m=total_revenue,
            average_annual_revenue_m=total_revenue / len(time_series),
            contracted_percentage=contracted_percentage,
            merchant_percentage=merchant_percentage,
            asset_count=len(portfolio_data.assets),
            period_count=len(time_series)
        )

    def get_merchant_prices(
        self, 
        region: str, 
        asset_type: str, 
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get merchant price data for API endpoint"""
        prices = {}
        
        if asset_type == 'storage':
            for duration in [0.5, 1, 2, 4]:
                prices[f"{duration}h"] = self.default_prices['storage'].get(duration, 160)
        else:
            prices['green'] = self.default_prices.get(asset_type, {}).get('green', 35)
            prices['energy'] = self.default_prices.get(asset_type, {}).get('energy', 65)
        
        return {
            'region': region,
            'asset_type': asset_type,
            'year': year,
            'month': month,
            'prices': prices,
            'source': 'default_calculator'
        }

    def export_results(self, result: CalculationResponse, format: str) -> Any:
        """Export calculation results in specified format"""
        if format.lower() == 'csv':
            # Convert to DataFrame and return CSV string
            data = []
            for period in result.time_series:
                row = {
                    'time_period': period.time_period,
                    'year': period.year,
                    'quarter': period.quarter,
                    'month': period.month,
                    **period.portfolio_revenue
                }
                # Add asset-level data
                for asset_name, asset_revenue in period.asset_revenues.items():
                    for revenue_type, value in asset_revenue.items():
                        row[f"{asset_name}_{revenue_type}"] = value
                data.append(row)
            
            df = pd.DataFrame(data)
            return df.to_csv(index=False)
            
        elif format.lower() == 'json':
            return result.model_dump_json(indent=2)
            
        else:
            raise ValueError(f"Unsupported export format: {format}")

    def __str__(self):
        return f"RevenueCalculator(version=1.0.0)"