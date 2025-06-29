# main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union
import logging
import traceback
from datetime import datetime
import os

from revenue_calculator import RevenueCalculator
from database import DatabaseManager
from models import (
    PortfolioData, 
    CalculationConfig, 
    OutputConfig, 
    CalculationRequest,
    CalculationResponse,
    ErrorResponse
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Revenue Calculator API",
    description="Python backend for renewable energy portfolio revenue calculations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://your-frontend-domain.com",  # Production frontend
        "*"  # Allow all origins in development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize services
db_manager = DatabaseManager()
revenue_calculator = RevenueCalculator()

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        await db_manager.connect()
        logger.info("✅ Database connection established")
        logger.info("🚀 Revenue Calculator API started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to start services: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        await db_manager.disconnect()
        logger.info("🔌 Database connection closed")
        logger.info("🛑 Revenue Calculator API stopped")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if os.getenv("DEBUG", "false").lower() == "true" else "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Revenue Calculator API",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "calculate_revenue": "/api/calculate-revenue",
            "get_portfolio": "/api/portfolio/{portfolio_id}",
            "health": "/health",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        db_status = await db_manager.check_connection()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "database": "connected" if db_status else "disconnected",
                "calculator": "ready"
            },
            "environment": {
                "python_version": os.sys.version,
                "debug_mode": os.getenv("DEBUG", "false").lower() == "true"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@app.post("/api/calculate-revenue", response_model=CalculationResponse)
async def calculate_revenue(request: CalculationRequest):
    """
    Main revenue calculation endpoint
    
    This endpoint receives portfolio data and calculation configuration,
    runs the revenue calculations, and returns results in the format
    expected by the frontend.
    """
    try:
        logger.info(f"Starting revenue calculation for portfolio: {request.portfolio_data.portfolio_id}")
        logger.info(f"Configuration: {request.calculation_config.model_dump()}")
        
        # Validate request
        if not request.portfolio_data.assets:
            raise HTTPException(
                status_code=400,
                detail="No assets found in portfolio data"
            )
        
        # Validate assets have required fields
        invalid_assets = []
        for asset_name, asset_data in request.portfolio_data.assets.items():
            if not asset_data.get('name'):
                invalid_assets.append(f"{asset_name}: missing name")
            if not asset_data.get('type'):
                invalid_assets.append(f"{asset_name}: missing type")
            if not asset_data.get('capacity'):
                invalid_assets.append(f"{asset_name}: missing capacity")
        
        if invalid_assets:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid asset data: {'; '.join(invalid_assets)}"
            )
        
        # Run calculation
        result = await revenue_calculator.calculate_portfolio_revenue(
            portfolio_data=request.portfolio_data,
            config=request.calculation_config,
            output_config=request.output_config
        )
        
        logger.info(f"✅ Calculation completed for portfolio: {request.portfolio_data.portfolio_id}")
        logger.info(f"Generated {len(result.time_series)} time periods")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Calculation failed: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Calculation failed: {str(e)}"
        )

@app.get("/api/portfolio/{portfolio_id}")
async def get_portfolio(portfolio_id: str, user_id: Optional[str] = None):
    """
    Get portfolio data from database
    
    This endpoint fetches portfolio data from MongoDB,
    useful for validation and data retrieval.
    """
    try:
        logger.info(f"Fetching portfolio: {portfolio_id}, user: {user_id}")
        
        portfolio_data = await db_manager.get_portfolio(portfolio_id, user_id)
        
        if not portfolio_data:
            raise HTTPException(
                status_code=404,
                detail=f"Portfolio {portfolio_id} not found"
            )
        
        logger.info(f"✅ Portfolio retrieved: {portfolio_id}")
        
        return {
            "success": True,
            "portfolio_data": portfolio_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get portfolio: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve portfolio: {str(e)}"
        )

@app.post("/api/validate-portfolio")
async def validate_portfolio(portfolio_data: PortfolioData):
    """
    Validate portfolio data structure and content
    
    This endpoint validates portfolio data without running calculations,
    useful for frontend validation feedback.
    """
    try:
        logger.info(f"Validating portfolio: {portfolio_data.portfolio_id}")
        
        validation_result = revenue_calculator.validate_portfolio_data(portfolio_data)
        
        logger.info(f"✅ Portfolio validation completed: {portfolio_data.portfolio_id}")
        
        return {
            "success": True,
            "validation": validation_result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Portfolio validation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}"
        )

@app.get("/api/price-data/{region}/{asset_type}")
async def get_price_data(
    region: str, 
    asset_type: str, 
    year: Optional[int] = None,
    month: Optional[int] = None
):
    """
    Get merchant price data for specific region and asset type
    
    This endpoint provides price data that can be used for validation
    or frontend display purposes.
    """
    try:
        logger.info(f"Fetching price data: {region}, {asset_type}, {year}, {month}")
        
        price_data = revenue_calculator.get_merchant_prices(
            region=region,
            asset_type=asset_type,
            year=year,
            month=month
        )
        
        return {
            "success": True,
            "price_data": price_data,
            "region": region,
            "asset_type": asset_type,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get price data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve price data: {str(e)}"
        )

@app.post("/api/export-results")
async def export_results(request: CalculationRequest, format: str = "csv"):
    """
    Export calculation results in various formats
    
    Supports CSV, JSON, and Excel exports of calculation results.
    """
    try:
        logger.info(f"Exporting results in {format} format")
        
        # Run calculation
        result = await revenue_calculator.calculate_portfolio_revenue(
            portfolio_data=request.portfolio_data,
            config=request.calculation_config,
            output_config=request.output_config
        )
        
        # Export in requested format
        exported_data = revenue_calculator.export_results(result, format)
        
        return {
            "success": True,
            "format": format,
            "data": exported_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Export failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    
    # Configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    logger.info(f"Starting server on {host}:{port} (debug={debug})")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info" if not debug else "debug"
    )