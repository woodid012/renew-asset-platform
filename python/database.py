# database.py
import os
import logging
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import asyncio

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    MongoDB connection and operations manager
    
    This class handles all database operations for the revenue calculator,
    including portfolio data retrieval and caching.
    """
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.connection_string = self._get_connection_string()
        self.database_name = os.getenv('MONGODB_DB', 'energy_contracts')
        self.connected = False
        
        logger.info("DatabaseManager initialized")

    def _get_connection_string(self) -> str:
        """Get MongoDB connection string from environment variables"""
        # Try different environment variable names
        connection_string = (
            os.getenv('MONGODB_URI') or 
            os.getenv('MONGO_URI') or 
            os.getenv('DATABASE_URL')
        )
        
        if not connection_string:
            # Default connection string for local development
            connection_string = 'mongodb://localhost:27017'
            logger.warning("No MongoDB connection string found in environment. Using default: mongodb://localhost:27017")
        
        return connection_string

    async def connect(self) -> bool:
        """
        Establish connection to MongoDB
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            logger.info(f"Connecting to MongoDB at: {self.connection_string}")
            
            # Create client with optimized settings
            self.client = AsyncIOMotorClient(
                self.connection_string,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
                connectTimeoutMS=10000,         # 10 second connection timeout
                socketTimeoutMS=45000,          # 45 second socket timeout
                maxPoolSize=10,                 # Maximum connections in pool
                minPoolSize=1,                  # Minimum connections in pool
                maxIdleTimeMS=30000,           # Close connections after 30s idle
                retryWrites=True,              # Retry writes on network errors
                retryReads=True,               # Retry reads on network errors
                appname="RevenueCalculator-Python"
            )
            
            # Get database reference
            self.db = self.client[self.database_name]
            
            # Test connection
            await self.client.admin.command('ping')
            self.connected = True
            
            logger.info(f"✅ Successfully connected to MongoDB database: {self.database_name}")
            return True
            
        except ConnectionFailure as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            self.connected = False
            return False
            
        except ServerSelectionTimeoutError as e:
            logger.error(f"❌ MongoDB server selection timeout: {e}")
            self.connected = False
            return False
            
        except Exception as e:
            logger.error(f"❌ Unexpected database connection error: {e}")
            self.connected = False
            return False

    async def disconnect(self) -> None:
        """Close database connection"""
        try:
            if self.client:
                self.client.close()
                self.connected = False
                logger.info("🔌 MongoDB connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing MongoDB connection: {e}")

    async def check_connection(self) -> bool:
        """
        Check if database connection is alive
        
        Returns:
            bool: True if connected and responsive, False otherwise
        """
        try:
            if not self.client or not self.connected:
                return False
            
            # Simple ping to check connection
            await self.client.admin.command('ping')
            return True
            
        except Exception as e:
            logger.warning(f"Database connection check failed: {e}")
            self.connected = False
            return False

    async def get_portfolio(self, portfolio_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get portfolio data from database
        
        Args:
            portfolio_id: Portfolio identifier
            user_id: Optional user identifier for filtering
            
        Returns:
            Portfolio data dictionary or None if not found
        """
        try:
            if not self.connected:
                logger.warning("Database not connected. Attempting to reconnect...")
                await self.connect()
            
            # Build query
            query = {"portfolioId": portfolio_id}
            if user_id:
                query["userId"] = user_id
            
            logger.info(f"Fetching portfolio with query: {query}")
            
            # Query portfolios collection
            collection = self.db.portfolios
            portfolio = await collection.find_one(query)
            
            if portfolio:
                # Convert ObjectId to string and clean up
                portfolio['_id'] = str(portfolio['_id'])
                logger.info(f"✅ Portfolio found: {portfolio_id}")
                return portfolio
            else:
                logger.warning(f"❌ Portfolio not found: {portfolio_id}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error fetching portfolio {portfolio_id}: {e}")
            return None

    async def get_portfolios_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all portfolios for a specific user
        
        Args:
            user_id: User identifier
            
        Returns:
            List of portfolio data dictionaries
        """
        try:
            if not self.connected:
                await self.connect()
            
            logger.info(f"Fetching portfolios for user: {user_id}")
            
            collection = self.db.portfolios
            cursor = collection.find({"userId": user_id})
            portfolios = await cursor.to_list(length=None)
            
            # Convert ObjectIds to strings
            for portfolio in portfolios:
                portfolio['_id'] = str(portfolio['_id'])
            
            logger.info(f"✅ Found {len(portfolios)} portfolios for user {user_id}")
            return portfolios
            
        except Exception as e:
            logger.error(f"❌ Error fetching portfolios for user {user_id}: {e}")
            return []

    async def save_portfolio(self, portfolio_data: Dict[str, Any]) -> bool:
        """
        Save or update portfolio data
        
        Args:
            portfolio_data: Portfolio data to save
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.connected:
                await self.connect()
            
            portfolio_id = portfolio_data.get('portfolioId')
            user_id = portfolio_data.get('userId')
            
            if not portfolio_id or not user_id:
                logger.error("Portfolio ID and User ID are required for saving")
                return False
            
            logger.info(f"Saving portfolio: {portfolio_id} for user: {user_id}")
            
            # Add timestamp
            portfolio_data['lastUpdated'] = datetime.utcnow()
            
            collection = self.db.portfolios
            
            # Upsert (update or insert)
            result = await collection.replace_one(
                {"portfolioId": portfolio_id, "userId": user_id},
                portfolio_data,
                upsert=True
            )
            
            if result.acknowledged:
                logger.info(f"✅ Portfolio saved successfully: {portfolio_id}")
                return True
            else:
                logger.error(f"❌ Failed to save portfolio: {portfolio_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error saving portfolio: {e}")
            return False

    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user data from database
        
        Args:
            user_id: User identifier
            
        Returns:
            User data dictionary or None if not found
        """
        try:
            if not self.connected:
                await self.connect()
            
            logger.info(f"Fetching user: {user_id}")
            
            collection = self.db.users
            user = await collection.find_one({"_id": user_id})
            
            if user:
                user['_id'] = str(user['_id'])
                logger.info(f"✅ User found: {user_id}")
                return user
            else:
                logger.warning(f"❌ User not found: {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error fetching user {user_id}: {e}")
            return None

    async def get_price_data(
        self, 
        region: str, 
        asset_type: str, 
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get merchant price data from database
        
        Args:
            region: Australian state code
            asset_type: Asset type (solar, wind, storage)
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of price data records
        """
        try:
            if not self.connected:
                await self.connect()
            
            logger.info(f"Fetching price data: {region}, {asset_type}")
            
            # Build query
            query = {
                "region": region.upper(),
                "asset_type": asset_type.lower()
            }
            
            if start_date and end_date:
                query["date"] = {
                    "$gte": start_date,
                    "$lte": end_date
                }
            
            # Query price_data collection (if it exists)
            collection = self.db.price_data
            cursor = collection.find(query).sort("date", 1)
            price_data = await cursor.to_list(length=1000)  # Limit to 1000 records
            
            # Convert ObjectIds to strings
            for record in price_data:
                record['_id'] = str(record['_id'])
            
            logger.info(f"✅ Found {len(price_data)} price records")
            return price_data
            
        except Exception as e:
            logger.error(f"❌ Error fetching price data: {e}")
            return []

    async def save_calculation_result(
        self, 
        calculation_id: str, 
        result_data: Dict[str, Any]
    ) -> bool:
        """
        Save calculation results for caching/auditing
        
        Args:
            calculation_id: Unique calculation identifier
            result_data: Calculation results to save
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.connected:
                await self.connect()
            
            logger.info(f"Saving calculation result: {calculation_id}")
            
            # Prepare document
            document = {
                "calculation_id": calculation_id,
                "timestamp": datetime.utcnow(),
                "result_data": result_data
            }
            
            collection = self.db.calculation_results
            result = await collection.insert_one(document)
            
            if result.acknowledged:
                logger.info(f"✅ Calculation result saved: {calculation_id}")
                return True
            else:
                logger.error(f"❌ Failed to save calculation result: {calculation_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error saving calculation result: {e}")
            return False

    async def get_calculation_result(self, calculation_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached calculation results
        
        Args:
            calculation_id: Calculation identifier
            
        Returns:
            Calculation results or None if not found
        """
        try:
            if not self.connected:
                await self.connect()
            
            collection = self.db.calculation_results
            result = await collection.find_one({"calculation_id": calculation_id})
            
            if result:
                result['_id'] = str(result['_id'])
                logger.info(f"✅ Found cached calculation: {calculation_id}")
                return result
            else:
                logger.info(f"❌ No cached calculation found: {calculation_id}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error fetching calculation result: {e}")
            return None

    async def cleanup_old_calculations(self, days_old: int = 30) -> int:
        """
        Clean up old calculation results
        
        Args:
            days_old: Remove calculations older than this many days
            
        Returns:
            Number of records deleted
        """
        try:
            if not self.connected:
                await self.connect()
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            collection = self.db.calculation_results
            result = await collection.delete_many({
                "timestamp": {"$lt": cutoff_date}
            })
            
            deleted_count = result.deleted_count
            logger.info(f"🗑️ Cleaned up {deleted_count} old calculation results")
            return deleted_count
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up calculations: {e}")
            return 0

    async def get_database_stats(self) -> Dict[str, Any]:
        """
        Get database statistics for monitoring
        
        Returns:
            Dictionary with database statistics
        """
        try:
            if not self.connected:
                await self.connect()
            
            stats = {
                "connected": self.connected,
                "database_name": self.database_name,
                "collections": {}
            }
            
            # Get collection statistics
            collection_names = ["portfolios", "users", "price_data", "calculation_results"]
            
            for collection_name in collection_names:
                try:
                    collection = self.db[collection_name]
                    count = await collection.count_documents({})
                    stats["collections"][collection_name] = {
                        "document_count": count
                    }
                except Exception as e:
                    stats["collections"][collection_name] = {
                        "document_count": 0,
                        "error": str(e)
                    }
            
            # Get database stats
            db_stats = await self.db.command("dbStats")
            stats["database_stats"] = {
                "data_size": db_stats.get("dataSize", 0),
                "storage_size": db_stats.get("storageSize", 0),
                "index_size": db_stats.get("indexSize", 0),
                "collections_count": db_stats.get("collections", 0)
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error getting database stats: {e}")
            return {
                "connected": False,
                "error": str(e)
            }

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test database connection and return detailed status
        
        Returns:
            Dictionary with connection test results
        """
        test_result = {
            "timestamp": datetime.utcnow().isoformat(),
            "connection_string": self.connection_string.replace(
                self.connection_string.split('@')[0].split('//')[1], 
                "***:***"
            ) if '@' in self.connection_string else self.connection_string,
            "database_name": self.database_name,
            "tests": {}
        }
        
        try:
            # Test 1: Basic connection
            if not self.connected:
                connect_success = await self.connect()
                test_result["tests"]["connection"] = {
                    "status": "pass" if connect_success else "fail",
                    "message": "Connection established" if connect_success else "Connection failed"
                }
            else:
                test_result["tests"]["connection"] = {
                    "status": "pass",
                    "message": "Already connected"
                }
            
            # Test 2: Ping database
            try:
                await self.client.admin.command('ping')
                test_result["tests"]["ping"] = {
                    "status": "pass",
                    "message": "Database responds to ping"
                }
            except Exception as e:
                test_result["tests"]["ping"] = {
                    "status": "fail",
                    "message": f"Ping failed: {str(e)}"
                }
            
            # Test 3: List collections
            try:
                collections = await self.db.list_collection_names()
                test_result["tests"]["collections"] = {
                    "status": "pass",
                    "message": f"Found {len(collections)} collections",
                    "collections": collections
                }
            except Exception as e:
                test_result["tests"]["collections"] = {
                    "status": "fail",
                    "message": f"Failed to list collections: {str(e)}"
                }
            
            # Test 4: Read access
            try:
                collection = self.db.portfolios
                count = await collection.count_documents({})
                test_result["tests"]["read_access"] = {
                    "status": "pass",
                    "message": f"Read access confirmed. Found {count} portfolios"
                }
            except Exception as e:
                test_result["tests"]["read_access"] = {
                    "status": "fail",
                    "message": f"Read access failed: {str(e)}"
                }
            
            # Overall status
            all_tests_passed = all(
                test.get("status") == "pass" 
                for test in test_result["tests"].values()
            )
            test_result["overall_status"] = "healthy" if all_tests_passed else "unhealthy"
            
        except Exception as e:
            test_result["overall_status"] = "error"
            test_result["error"] = str(e)
        
        return test_result

    def __str__(self):
        return f"DatabaseManager(connected={self.connected}, db={self.database_name})"
            