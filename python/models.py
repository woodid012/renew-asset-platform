# models.py
from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from enum import Enum

class AssetType(str, Enum):
    """Valid asset types"""
    SOLAR = "solar"
    WIND = "wind"
    STORAGE = "storage"

class ContractType(str, Enum):
    """Valid contract types"""
    BUNDLED = "bundled"
    GREEN = "green"
    ENERGY = "Energy"
    FIXED = "fixed"
    CFD = "cfd"
    TOLLING = "tolling"

class ScenarioType(str, Enum):
    """Valid scenario types"""
    BASE = "base"
    WORST = "worst"
    VOLUME = "volume"
    PRICE = "price"

class IntervalType(str, Enum):
    """Valid time interval types"""
    ANNUAL = "annual"
    QUARTERLY = "quarterly"
    MONTHLY = "monthly"

class RevenueFilter(str, Enum):
    """Valid revenue filter types"""
    ALL = "all"
    ENERGY = "energy"
    GREEN = "green"

class Contract(BaseModel):
    """Contract model"""
    id: Optional[str] = None
    counterparty: Optional[str] = None
    type: ContractType
    start_date: str = Field(..., description="Contract start date (YYYY-MM-DD or DD/MM/YYYY)")
    end_date: str = Field(..., description="Contract end date (YYYY-MM-DD or DD/MM/YYYY)")
    buyers_percentage: float = Field(..., ge=0, le=100, description="Percentage of asset output under contract")
    strike_price: Optional[float] = Field(None, ge=0, description="Strike price for single-product contracts")
    green_price: Optional[float] = Field(None, ge=0, description="Green price for bundled contracts")
    energy_price: Optional[float] = Field(None, ge=0, description="Energy price for bundled contracts")
    indexation: Optional[float] = Field(0, description="Annual indexation percentage")
    has_floor: Optional[bool] = Field(False, description="Whether contract has a floor price")
    floor_value: Optional[float] = Field(None, ge=0, description="Floor price value")
    
    @validator('start_date', 'end_date')
    def validate_dates(cls, v):
        """Validate date formats"""
        if not v:
            raise ValueError("Date cannot be empty")
        
        # Try different date formats
        date_formats = ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y']
        for fmt in date_formats:
            try:
                datetime.strptime(v, fmt)
                return v
            except ValueError:
                continue
        
        raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD or DD/MM/YYYY")
    
    @validator('buyers_percentage')
    def validate_percentage(cls, v):
        """Validate percentage is within bounds"""
        if not 0 <= v <= 100:
            raise ValueError("Buyers percentage must be between 0 and 100")
        return v

class Asset(BaseModel):
    """Asset model"""
    name: str = Field(..., description="Asset name")
    type: AssetType = Field(..., description="Asset type")
    capacity: float = Field(..., gt=0, description="Asset capacity in MW")
    state: str = Field(..., description="Australian state (QLD, NSW, VIC, SA, WA, TAS)")
    asset_start_date: str = Field(..., description="Asset operational start date")
    
    # Optional fields
    volume: Optional[float] = Field(None, gt=0, description="Storage volume in MWh (required for storage)")
    volume_loss_adjustment: Optional[float] = Field(95, ge=0, le=100, description="Volume loss adjustment percentage")
    annual_degradation: Optional[float] = Field(0.5, ge=0, le=10, description="Annual degradation percentage")
    
    # Quarterly capacity factors
    qtr_capacity_factor_q1: Optional[float] = Field(None, ge=0, le=100, description="Q1 capacity factor percentage")
    qtr_capacity_factor_q2: Optional[float] = Field(None, ge=0, le=100, description="Q2 capacity factor percentage")
    qtr_capacity_factor_q3: Optional[float] = Field(None, ge=0, le=100, description="Q3 capacity factor percentage")
    qtr_capacity_factor_q4: Optional[float] = Field(None, ge=0, le=100, description="Q4 capacity factor percentage")
    
    # Contracts
    contracts: Optional[List[Contract]] = Field([], description="List of contracts for this asset")
    
    @validator('state')
    def validate_state(cls, v):
        """Validate Australian state codes"""
        valid_states = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS']
        if v.upper() not in valid_states:
            raise ValueError(f"Invalid state: {v}. Must be one of {valid_states}")
        return v.upper()
    
    @validator('volume')
    def validate_storage_volume(cls, v, values):
        """Validate that storage assets have volume specified"""
        if values.get('type') == AssetType.STORAGE and not v:
            raise ValueError("Storage assets must have volume specified")
        return v

class PortfolioData(BaseModel):
    """Portfolio data model"""
    portfolio_id: str = Field(..., description="Portfolio identifier")
    user_id: str = Field(..., description="User identifier")
    portfolio_name: Optional[str] = Field("Portfolio", description="Portfolio display name")
    assets: Dict[str, Dict[str, Any]] = Field(..., description="Dictionary of assets")
    constants: Optional[Dict[str, Any]] = Field({}, description="Portfolio constants and settings")
    
    @validator('assets')
    def validate_assets_not_empty(cls, v):
        """Validate that portfolio has at least one asset"""
        if not v:
            raise ValueError("Portfolio must contain at least one asset")
        return v

class EscalationSettings(BaseModel):
    """Escalation settings model"""
    enabled: bool = Field(True, description="Whether escalation is enabled")
    rate: float = Field(2.5, ge=0, le=20, description="Annual escalation rate percentage")
    reference_year: int = Field(2025, ge=2020, le=2030, description="Reference year for escalation")

class CalculationConfig(BaseModel):
    """Calculation configuration model"""
    interval_type: IntervalType = Field(IntervalType.ANNUAL, description="Time interval type")
    start_year: int = Field(2025, ge=2020, le=2050, description="Analysis start year")
    analysis_years: int = Field(30, ge=1, le=50, description="Number of years to analyze")
    scenario: ScenarioType = Field(ScenarioType.BASE, description="Scenario type")
    region_filter: str = Field("ALL", description="Region filter (ALL or specific state)")
    revenue_filter: RevenueFilter = Field(RevenueFilter.ALL, description="Revenue type filter")
    include_stress: bool = Field(False, description="Include stress testing")
    escalation_settings: Optional[EscalationSettings] = Field(
        default_factory=EscalationSettings, 
        description="Price escalation settings"
    )

class OutputConfig(BaseModel):
    """Output configuration model"""
    format: str = Field("json", description="Output format")
    include_breakdown: bool = Field(True, description="Include asset-level breakdown")
    include_summary: bool = Field(True, description="Include portfolio summary")
    include_validation: bool = Field(True, description="Include validation results")

class CalculationRequest(BaseModel):
    """Main calculation request model"""
    portfolio_data: PortfolioData
    calculation_config: CalculationConfig
    output_config: Optional[OutputConfig] = Field(default_factory=OutputConfig)

class TimePeriod(BaseModel):
    """Time period model for results"""
    time_period: str = Field(..., description="Time period identifier")
    year: int = Field(..., description="Year")
    quarter: Optional[int] = Field(None, ge=1, le=4, description="Quarter (1-4)")
    month: Optional[int] = Field(None, ge=1, le=12, description="Month (1-12)")
    
    portfolio_revenue: Dict[str, float] = Field(..., description="Portfolio-level revenue breakdown")
    asset_revenues: Dict[str, Dict[str, float]] = Field(..., description="Asset-level revenue breakdowns")

class ValidationResult(BaseModel):
    """Validation result model"""
    is_valid: bool = Field(..., description="Whether portfolio data is valid")
    errors: List[str] = Field([], description="List of validation errors")
    warnings: List[str] = Field([], description="List of validation warnings")
    asset_count: int = Field(..., description="Number of assets validated")
    contract_count: int = Field(..., description="Total number of contracts")

class SummaryMetrics(BaseModel):
    """Summary metrics model"""
    total_capacity_mw: float = Field(..., description="Total portfolio capacity in MW")
    total_revenue_m: float = Field(..., description="Total revenue in millions")
    average_annual_revenue_m: float = Field(..., description="Average annual revenue in millions")
    contracted_percentage: float = Field(..., description="Percentage of revenue from contracts")
    merchant_percentage: float = Field(..., description="Percentage of revenue from merchant sales")
    asset_count: int = Field(..., description="Number of assets")
    period_count: int = Field(..., description="Number of time periods calculated")

class CalculationMetadata(BaseModel):
    """Calculation metadata model"""
    calculation_id: str = Field(..., description="Unique calculation identifier")
    timestamp: str = Field(..., description="Calculation timestamp")
    version: str = Field("1.0.0", description="Calculator version")
    execution_time_seconds: float = Field(..., description="Calculation execution time")
    python_version: str = Field(..., description="Python version used")

class CalculationResponse(BaseModel):
    """Main calculation response model"""
    success: bool = Field(..., description="Whether calculation succeeded")
    time_series: List[TimePeriod] = Field(..., description="Time series results")
    summary: SummaryMetrics = Field(..., description="Summary metrics")
    validation: ValidationResult = Field(..., description="Validation results")
    metadata: CalculationMetadata = Field(..., description="Calculation metadata")
    
    # Optional fields
    error: Optional[str] = Field(None, description="Error message if calculation failed")
    warnings: Optional[List[str]] = Field([], description="List of warnings")

class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = Field(False, description="Always false for error responses")
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    timestamp: str = Field(..., description="Error timestamp")
    request_id: Optional[str] = Field(None, description="Request identifier for debugging")

# Export configuration for different formats
class ExportConfig(BaseModel):
    """Export configuration model"""
    format: str = Field("csv", description="Export format (csv, json, excel)")
    include_metadata: bool = Field(True, description="Include metadata in export")
    include_summary: bool = Field(True, description="Include summary in export")
    flatten_structure: bool = Field(True, description="Flatten nested structures for CSV")

# Price data models
class PricePoint(BaseModel):
    """Individual price point model"""
    timestamp: str = Field(..., description="Price timestamp")
    price: float = Field(..., description="Price value")
    price_type: str = Field(..., description="Price type (green, energy, spread)")
    region: str = Field(..., description="Region")
    source: str = Field(..., description="Price data source")

class PriceData(BaseModel):
    """Price data collection model"""
    region: str = Field(..., description="Region")
    asset_type: str = Field(..., description="Asset type")
    price_points: List[PricePoint] = Field(..., description="List of price points")
    metadata: Dict[str, Any] = Field({}, description="Price data metadata")