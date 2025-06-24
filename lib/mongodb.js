// lib/mongodb.js - Optimized MongoDB connection with connection pooling and caching
import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI

// Optimized connection options
const options = {
  // Connection Pool Settings
  maxPoolSize: 10,          // Maximum number of connections in the pool
  minPoolSize: 2,           // Minimum number of connections in the pool
  maxIdleTimeMS: 30000,     // Close connections after 30 seconds of inactivity
  
  // Connection Timeouts
  serverSelectionTimeoutMS: 5000,  // How long to try to connect
  socketTimeoutMS: 45000,          // How long a send or receive on a socket can take
  connectTimeoutMS: 10000,         // How long to wait for initial connection
  
  // Monitoring and Retry
  heartbeatFrequencyMS: 10000,     // How often to check connection health
  retryWrites: true,               // Automatically retry writes on network errors
  retryReads: true,                // Automatically retry reads on network errors
  
  // Compression
  compressors: ['snappy', 'zlib'], // Compress network traffic
  
  // Write Concern
  w: 'majority',                   // Wait for majority of replica set to acknowledge
  
  // Read Preference
  readPreference: 'secondaryPreferred', // Prefer secondary reads to reduce load on primary
  
  // Application metadata
  appName: 'RenewableAssets-Platform',
}

let client
let clientPromise
let isConnected = false

// Connection health monitoring
const connectionHealth = {
  lastCheck: null,
  isHealthy: false,
  consecutiveFailures: 0,
  maxFailures: 3
}

// Health check function
async function checkConnectionHealth(client) {
  try {
    // Simple ping to check if connection is alive
    await client.db('admin').admin().ping()
    connectionHealth.isHealthy = true
    connectionHealth.consecutiveFailures = 0
    connectionHealth.lastCheck = Date.now()
    return true
  } catch (error) {
    connectionHealth.isHealthy = false
    connectionHealth.consecutiveFailures++
    connectionHealth.lastCheck = Date.now()
    console.error('MongoDB health check failed:', error.message)
    return false
  }
}

// Optimized client creation with error handling
async function createClient() {
  try {
    console.log('Creating new MongoDB client connection...')
    const newClient = new MongoClient(uri, options)
    
    // Connect with timeout
    const connectPromise = newClient.connect()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    )
    
    await Promise.race([connectPromise, timeoutPromise])
    
    // Verify connection
    await newClient.db('admin').admin().ping()
    
    console.log('MongoDB client connected successfully')
    isConnected = true
    
    // Set up connection event listeners
    newClient.on('error', (error) => {
      console.error('MongoDB connection error:', error)
      isConnected = false
    })
    
    newClient.on('close', () => {
      console.log('MongoDB connection closed')
      isConnected = false
    })
    
    newClient.on('reconnect', () => {
      console.log('MongoDB reconnected')
      isConnected = true
    })
    
    return newClient
  } catch (error) {
    console.error('Failed to create MongoDB client:', error)
    throw error
  }
}

// Enhanced connection logic
if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve connections across HMR
  if (!global._mongoClientPromise) {
    console.log('Development: Creating new MongoDB connection')
    client = new MongoClient(uri, options)
    global._mongoClientPromise = createClient()
  } else {
    console.log('Development: Reusing existing MongoDB connection')
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production mode, create fresh connections
  console.log('Production: Creating MongoDB connection')
  clientPromise = createClient()
}

// Enhanced client promise with health monitoring
const getClient = async () => {
  try {
    const client = await clientPromise
    
    // Check if we need to verify connection health
    const now = Date.now()
    const healthCheckInterval = 30000 // 30 seconds
    
    if (!connectionHealth.lastCheck || (now - connectionHealth.lastCheck) > healthCheckInterval) {
      const isHealthy = await checkConnectionHealth(client)
      
      if (!isHealthy && connectionHealth.consecutiveFailures >= connectionHealth.maxFailures) {
        console.log('Connection unhealthy, creating new client...')
        // Force recreation of client
        if (process.env.NODE_ENV === 'development') {
          delete global._mongoClientPromise
          global._mongoClientPromise = createClient()
          return await global._mongoClientPromise
        } else {
          return await createClient()
        }
      }
    }
    
    return client
  } catch (error) {
    console.error('Error getting MongoDB client:', error)
    throw error
  }
}

// Connection statistics for monitoring
export const getConnectionStats = () => ({
  isConnected,
  health: connectionHealth,
  options: {
    maxPoolSize: options.maxPoolSize,
    minPoolSize: options.minPoolSize,
    serverSelectionTimeout: options.serverSelectionTimeoutMS,
  }
})

// Graceful shutdown helper
export const closeConnection = async () => {
  try {
    if (client) {
      console.log('Closing MongoDB connection...')
      await client.close()
      isConnected = false
      console.log('MongoDB connection closed')
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error)
  }
}

// Export enhanced client promise
export default getClient()