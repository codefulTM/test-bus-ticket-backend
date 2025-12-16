/**
 * Database Service
 * 
 * This service manages the database connection pool and provides utilities for
 * monitoring and managing database connections. It implements OnModuleInit and OnModuleDestroy
 * to properly initialize and clean up database connections when the application starts and stops.
 */

// Core NestJS and TypeORM imports
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * DatabaseService handles all database connection pooling and monitoring
 * 
 * This service is responsible for:
 * - Managing the lifecycle of database connections
 * - Monitoring connection pool health and statistics
 * - Providing utilities for database health checks
 * - Implementing connection pooling best practices
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  // Logger instance for this service
  private readonly logger = new Logger(DatabaseService.name);
  
  // Tracks if the database connection is currently active
  private isConnected = false;

  /**
   * Initializes a new instance of the DatabaseService
   * @param dataSource - Injected TypeORM DataSource for database operations
   * @param configService - Service to access configuration values
   */
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Lifecycle hook: Called when the module is initialized
   * Sets up the database connection pool and performs initial health checks
   */
  async onModuleInit() {
    this.logger.log('🔗 Initializing database connection pool...');
    try {
      // Test the database connection
      await this.testConnection();
      this.isConnected = true;

      // Optional: Warm up the connection pool by creating minimum connections
      // This is useful to avoid cold-start latency on first requests
      // Uncomment if you want to pre-create connections at startup
      // await this.warmUpPool();

      // Log initial pool statistics
      await this.logPoolStats();
    } catch (error) {
      // Log detailed error if connection fails
      this.logger.error('❌ Failed to initialize database connection:', error);
      this.isConnected = false;
    }
  }

  /**
   * Lifecycle hook: Called when the module is destroyed
   * Cleans up database connections to prevent resource leaks
   */
  async onModuleDestroy() {
    this.logger.log('🔗 Closing database connection pool...');
    try {
      // Properly close all connections in the pool
      await this.dataSource.destroy();
      this.isConnected = false;
      this.logger.log('✅ Database connection pool closed successfully');
    } catch (error) {
      this.logger.error('❌ Error closing database connection pool:', error);
    }
  }

  /**
   * Tests the database connection by executing a simple query
   * @returns Promise<boolean> True if connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      // Execute a simple query to verify the connection
      await this.dataSource.query('SELECT 1');
      this.logger.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      // Log detailed error information
      this.logger.error('❌ Database connection test failed:', {
        error: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Warms up the connection pool by creating the minimum number of connections
   * This helps avoid cold-start latency on first requests by pre-establishing connections
   * 
   * @private
   * @returns Promise<void>
   */
  private async warmUpPool(): Promise<void> {
    // Get the minimum number of connections from config or use default (5)
    const minConnections = this.configService.get<number>('DB_POOL_MIN', 5);
    this.logger.log(`🔥 Warming up pool with ${minConnections} connections...`);

    try {
      // Create an array of promises, each representing a database query
      // This will force the pool to create the minimum number of connections
      const promises = Array(minConnections).fill(null).map(() =>
        this.dataSource.query('SELECT 1')
      );

      // Execute all queries in parallel to warm up the pool
      await Promise.all(promises);
      this.logger.log(`✅ Pool warmed up with ${minConnections} connections`);
    } catch (error) {
      // Log warning if warm-up fails, but don't crash the application
      this.logger.warn('⚠️ Pool warm-up failed:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Retrieves current statistics about the database connection pool
   * 
   * This method provides insights into the connection pool's current state including:
   * - Total, active, and idle connections
   - Waiting clients
   - Pool utilization
   - Configuration limits
   
   * @returns {Promise<Object>} Pool statistics including connection counts and status
   */
  async getPoolStats() {
    try {
      // First, check if we're connected to the database
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          totalConnections: 0,
          idleConnections: 0,
          waitingClients: 0,
          activeConnections: 0,
          maxConnections: this.configService.get<number>('DB_POOL_MAX', 20),
          minConnections: this.configService.get<number>('DB_POOL_MIN', 5),
          utilizationRate: 0,
          lastError: 'Database not connected',
          timestamp: new Date().toISOString(),
          driverType: 'PostgreSQL',
          poolType: 'PostgreSQL Native Pool'
        };
      }

      // Get actual PostgreSQL connection statistics
      const connectionStats = await this.getPostgresConnectionStats();
      
      // Get pool configuration values with defaults
      const maxConnections = this.configService.get<number>('DB_POOL_MAX', 20);
      const minConnections = this.configService.get<number>('DB_POOL_MIN', 5);
      
      // Calculate pool utilization percentage (active connections / max connections)
      const activeConnections = connectionStats.activeConnections || 0;
      const utilizationRate = maxConnections > 0 
        ? Math.min(100, Math.round((activeConnections / maxConnections) * 100))
        : 0;

      // Compile comprehensive pool statistics
      const stats = {
        status: 'connected',
        totalConnections: connectionStats.totalConnections || 0,
        idleConnections: connectionStats.idleConnections || 0,
        waitingClients: connectionStats.waitingClients || 0,
        activeConnections: activeConnections,
        maxConnections: maxConnections,
        minConnections: minConnections,
        utilizationRate: utilizationRate,
        lastCheck: new Date().toISOString(),
        driverType: 'PostgreSQL',
        poolType: 'PostgreSQL Native Pool',
        lastError: undefined,
        // Include additional diagnostic information
        idleInTransaction: connectionStats.idleInTransaction || 0,
        // Add timestamp in a more readable format
        timestamp: new Date().toISOString(),
        // Add memory usage information if available
        memoryUsage: process.memoryUsage()
      };

      // Log detailed pool statistics in development environment
      // if (process.env.NODE_ENV === 'development') {
      //   this.logger.debug('📊 Database pool stats', {
      //     // Include all basic stats
      //     ...stats,
      //     // Add raw PostgreSQL statistics
      //     postgresStats: connectionStats,
      //     // Include environment information
      //     environment: process.env.NODE_ENV,
      //     // Add timestamp for correlation with other logs
      //     loggedAt: new Date().toISOString()
      //   });
      // }

      return stats;
    } catch (error) {
      this.logger.error('❌ Error getting pool stats:', {
        error: error.message,
        stack: error.stack,
        driverType: 'PostgreSQL'
      });

      return {
        status: 'error',
        totalConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
        activeConnections: 0,
        maxConnections: this.configService.get<number>('DB_POOL_MAX', 20),
        minConnections: this.configService.get<number>('DB_POOL_MIN', 5),
        utilizationRate: 0,
        lastError: error.message,
        timestamp: new Date().toISOString(),
        driverType: 'PostgreSQL'
      };
    }
  }

  /**
   * Retrieves detailed connection statistics directly from PostgreSQL
   * 
   * This method queries the PostgreSQL system catalog to get real-time
   * information about the current database connections and their states.
   * 
   * @private
   * @returns {Promise<Object>} Connection statistics including counts by state
   */
  private async getPostgresConnectionStats() {
    try {
      // Query to get detailed connection information from pg_stat_activity
      const activityQuery = `
        SELECT 
          -- Total number of connections to this database
          COUNT(*) as total_connections,
          
          -- Connections currently executing queries
          COUNT(*) FILTER (WHERE state = 'active') as active_connections,
          
          -- Connections available for new queries
          COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
          
          -- Connections in an open transaction but not currently executing
          COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          
          -- Connections waiting for a lock or other resource
          COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_clients,
          
          -- Additional useful metrics
          COUNT(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_in_aborted_tx,
          COUNT(*) FILTER (WHERE state = 'fastpath function call') as fastpath_function_calls,
          COUNT(*) FILTER (WHERE state = 'disabled') as disabled_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()  -- Only count connections to current database
      `;

      // Execute the query and get the first row of results
      const result = await this.dataSource.query(activityQuery);
      const stats = result[0] || {};

      // Return a clean object with parsed values
      return {
        // Total connections to this database
        totalConnections: parseInt(stats.total_connections) || 0,
        
        // Active connections (executing queries)
        activeConnections: parseInt(stats.active_connections) || 0,
        
        // Idle connections (available for new queries)
        idleConnections: parseInt(stats.idle_connections) || 0,
        
        // Connections in a transaction but not currently active
        idleInTransaction: parseInt(stats.idle_in_transaction) || 0,
        
        // Connections waiting for locks/resources
        waitingClients: parseInt(stats.waiting_clients) || 0,
        
        // Additional metrics
        idleInAbortedTx: parseInt(stats.idle_in_aborted_tx) || 0,
        fastpathFunctionCalls: parseInt(stats.fastpath_function_calls) || 0,
        disabledConnections: parseInt(stats.disabled_connections) || 0,
        
        // Timestamp of when these stats were collected
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Log a warning if we can't get PostgreSQL stats
      this.logger.warn('⚠️ Could not get PostgreSQL stats, using fallback:', {
        error: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      // Fallback: Try to estimate from TypeORM driver internals
      // Note: This is implementation-specific and might break with TypeORM updates
      try {
        const driver = this.dataSource.driver as any;
        const master = driver?.master;
        
        if (master && master._clients) {
          const totalConnections = master._clients.length;
          const activeConnections = master._clients.filter((c: any) => c._active).length;
          
          return {
            totalConnections,
            activeConnections,
            idleConnections: totalConnections - activeConnections,
            idleInTransaction: 0,
            waitingClients: 0,
            source: 'typeorm-fallback',
            timestamp: new Date().toISOString()
          };
        }
      } catch (fallbackError) {
        this.logger.error('⚠️ Fallback stats failed:', {
          error: fallbackError.message,
          originalError: error.message
        });
      }
      
      // Final fallback - return zeros if all else fails
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        idleInTransaction: 0,
        waitingClients: 0,
        source: 'zero-fallback',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Logs detailed statistics about the current state of the connection pool
   * 
   * This method retrieves pool statistics and logs them with appropriate log levels
   * based on the current state of the pool (normal, warning, or error conditions).
   * 
   * @private
   * @returns {Promise<void>}
   */
  private async logPoolStats() {
    // Get current pool statistics
    const stats = await this.getPoolStats();
    
    // Destructure relevant statistics
    const {
      status,
      totalConnections = 0,
      idleConnections = 0,
      waitingClients = 0,
      maxConnections = 0,
      utilizationRate = 0,
    } = stats;

    // Calculate active connections (total - idle)
    const activeConnections = Math.max(0, totalConnections - idleConnections);
    
    // Prepare log data object with relevant metrics
    const logData: any = {
      status,
      // Connection metrics
      connections: {
        total: totalConnections,
        idle: idleConnections,
        active: activeConnections,
        waiting: waitingClients,
        max: maxConnections,
        // Calculate available connections
        available: Math.max(0, maxConnections - activeConnections - idleConnections)
      },
      // Utilization metrics
      utilization: {
        percentage: utilizationRate,
        formatted: `${utilizationRate}%`,
        // Add human-readable status
        status: utilizationRate < 70 ? 'healthy' : 
                utilizationRate < 90 ? 'moderate' : 'critical'
      },
      // Timestamp information
      timestamp: {
        lastCheck: (stats as any).lastCheck || new Date().toISOString(),
        current: new Date().toISOString()
      },
      // Include environment context
      environment: process.env.NODE_ENV || 'development',
      // Include process memory usage
      memoryUsage: process.memoryUsage()
    };

    // Add error information if present
    if ((stats as any).lastError) {
      logData.error = (stats as any).lastError;
    }

    // Log with appropriate log level based on pool status
    if (status === 'error' || status === 'disconnected') {
      // Critical error - database connection is down
      this.logger.error('❌ Database connection issue', logData);
    } else if (utilizationRate > 90 || waitingClients > 0) {
      // Warning - pool is under heavy load
      this.logger.warn('⚠️ Database pool under stress', logData);
    } else {
      // Normal operation - log informational message
      const isInitialState = totalConnections === 0 && activeConnections === 0;
      const message = isInitialState
        ? '📊 Database pool status (connections will be created on demand)'
        : '📊 Database pool status';
      this.logger.log(message, logData);
    }

    // Additional detailed warnings for pool health
    if (waitingClients > 0) {
      const waitMsg = `⚠️ ${waitingClients} client${waitingClients > 1 ? 's' : ''} waiting for database connections`;
      const waitDetails = {
        waitingClients,
        maxConnections,
        activeConnections,
        idleConnections,
        utilizationRate: `${utilizationRate}%`,
        suggestion: waitingClients > 5 ? 'Consider increasing DB_POOL_MAX' : ''
      };
      this.logger.warn(waitMsg, waitDetails);
    }

    // Warn about high utilization
    if (utilizationRate > 80) {
      const utilMsg = `⚠️ Database pool utilization at ${utilizationRate}%`;
      const utilDetails = {
        utilizationRate,
        maxConnections,
        activeConnections,
        idleConnections,
        suggestion: utilizationRate > 90 
          ? 'Warning: Approaching maximum pool size. Consider increasing DB_POOL_MAX.'
          : 'Pool usage is high but within acceptable limits.'
      };
      this.logger.warn(utilMsg, utilDetails);
    }

    // Critical error if utilization is extremely high
    if (utilizationRate > 95) {
      const criticalMsg = `🚨 Database pool critical: ${utilizationRate}% utilization`;
      const criticalDetails = {
        utilizationRate,
        maxConnections,
        activeConnections,
        idleConnections,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        actionRequired: 'Immediate attention needed. Consider:' +
          '\n- Increasing DB_POOL_MAX' +
          '\n- Optimizing slow queries' +
          '\n- Scaling database resources' +
          '\n- Implementing read replicas if read-heavy'
      };
      this.logger.error(criticalMsg, criticalDetails);
    }
  }

  /**
   * Performs a comprehensive health check of the database connection and pool
   * 
   * This method checks:
   * 1. If the database is reachable
   * 2. Current pool utilization
   * 3. Number of waiting clients
   * 4. Overall pool health
   * 
   * @returns {Promise<Object>} Health check results with status and details
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';  // Overall health status
    database: boolean;                           // Is the database reachable?
    pool: any;                                   // Detailed pool statistics
    timestamp: string;                           // When the check was performed
    details?: string;                            // Additional details or error message
    metrics?: {                                  // Raw metrics
      utilizationRate: number;
      waitingClients: number;
      activeConnections: number;
      maxConnections: number;
    };
  }> {
    const stats = await this.getPoolStats();
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let details = '';

    // Check connection status first
    if (stats.status === 'disconnected' || stats.status === 'error') {
      return {
        status: 'critical',
        database: false,
        pool: stats,
        timestamp: new Date().toISOString(),
        details: (stats as any).lastError || 'Database connection is not available'
      };
    }

    // Check pool health metrics
    const { utilizationRate, waitingClients = 0, maxConnections } = stats;

    if (utilizationRate >= 95 || waitingClients > 5) {
      status = 'critical';
      details = `High database load: ${utilizationRate}% utilization, ${waitingClients} clients waiting`;
    } else if (utilizationRate > 80 || waitingClients > 0) {
      status = 'warning';
      details = `Moderate database load: ${utilizationRate}% utilization, ${waitingClients} clients waiting`;
    }

    // Test database connection
    let database = false;
    try {
      await this.dataSource.query('SELECT 1');
      database = true;
    } catch (error) {
      this.logger.error('❌ Database health check failed:', error);
      status = 'critical';
      details = `Database query failed: ${error.message}`;
    }

    // Log health status
    const healthStatus = { status, database, utilizationRate, waitingClients, maxConnections };
    if (status === 'critical') {
      this.logger.error('🚨 Database health check critical', healthStatus);
    } else if (status === 'warning') {
      this.logger.warn('⚠️ Database health check warning', healthStatus);
    } else {
      this.logger.log('✅ Database health check passed', healthStatus);
    }

    return {
      status,
      database,
      pool: {
        ...stats,
        status: status,
        lastCheck: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      ...(details && { details })
    };
  }

  /**
   * Retrieves the current connection pool configuration
   * 
   * @returns {Object} Current pool configuration with the following properties:
   * - max: Maximum number of connections in the pool
   * - min: Minimum number of connections to maintain
   * - idleTimeoutMillis: How long a connection can be idle before being closed
   * - connectionTimeoutMillis: Connection timeout in milliseconds
   * - reapIntervalMillis: How often to check for idle connections
   * - maxUses: Maximum number of times a connection can be used before being recycled
   */
  getPoolConfig() {
    return {
      // Maximum number of clients the pool should contain
      max: this.configService.get<number>('DB_POOL_MAX', 20),
      
      // Minimum number of clients to keep in the pool
      min: this.configService.get<number>('DB_POOL_MIN', 5),
      
      // Number of milliseconds a client must sit idle in the pool and not be checked out
      // before it is disconnected from the backend and discarded
      idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT', 30000),
      
      // Number of milliseconds to wait before timing out when connecting a new client
      connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 2000),
      
      // How often to run the reaper to check for idle connections (in milliseconds)
      reapIntervalMillis: this.configService.get<number>('DB_REAP_INTERVAL', 1000),
      
      // Maximum number of times a client can be used before it is removed from the pool
      maxUses: this.configService.get<number>('DB_MAX_USES', 7500),
      
      // Additional metadata
      _configSource: 'environment',
      _lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Tests the performance of a simple database query
   * 
   * This method measures:
   * 1. Total query execution time (including connection acquisition)
   * 2. Time taken to acquire a connection from the pool
   * 
   * @returns {Promise<Object>} Performance metrics in milliseconds:
   * - queryTime: Total time including connection acquisition and query execution
   * - connectionTime: Time taken to get a connection from the pool
   * - executionTime: Time taken to execute the query (queryTime - connectionTime)
   */
  async testQueryPerformance(): Promise<{
    queryTime: number;      // Total time (ms) including connection and query
    connectionTime: number; // Time (ms) to get a connection
    executionTime: number;  // Time (ms) to execute the query
    timestamp: string;      // When the test was performed
  }> {
    // Record start time for total query duration
    const start = Date.now();
    
    // Record time just before getting a connection
    const beforeConnection = Date.now();
    
    try {
      // Execute a simple query to measure performance
      await this.dataSource.query('SELECT 1');
      
      // Calculate timing metrics
      const queryTime = Date.now() - start;
      const connectionTime = beforeConnection - start;
      const executionTime = queryTime - connectionTime;
      
      // Log performance metrics (debug level to avoid cluttering logs)
      this.logger.debug('📊 Database query performance test', {
        queryTime,
        connectionTime,
        executionTime,
        status: 'success',
        timestamp: new Date().toISOString()
      });
      
      return { 
        queryTime, 
        connectionTime, 
        executionTime,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      // Log error details if the query fails
      const errorTime = Date.now() - start;
      this.logger.error('❌ Database query performance test failed', {
        error: error.message,
        duration: errorTime,
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }
}
