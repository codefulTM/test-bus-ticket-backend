import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PoolMonitorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PoolMonitorMiddleware.name);
  private lastLogTime = 0;
  private readonly logInterval = 30000; // Log every 30 seconds

  constructor(private readonly databaseService: DatabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const poolStats = await this.databaseService.getPoolStats();
    const now = Date.now();

    // Add pool stats to response headers for monitoring
    res.setHeader('X-DB-Pool-Total', String(poolStats.totalConnections));
    res.setHeader('X-DB-Pool-Idle', String(poolStats.idleConnections));
    res.setHeader('X-DB-Pool-Active', String(poolStats.activeConnections || 0));
    res.setHeader('X-DB-Pool-Waiting', String(poolStats.waitingClients || 0));
    res.setHeader('X-DB-Pool-Max', String(poolStats.maxConnections));
    res.setHeader('X-DB-Pool-Utilization', String(poolStats.utilizationRate));

    // Log pool health periodically or when there are issues
    const shouldLog = 
      now - this.lastLogTime > this.logInterval ||
      (poolStats.waitingClients && poolStats.waitingClients > 0) ||
      (poolStats.utilizationRate && poolStats.utilizationRate > 80);

    if (shouldLog) {
      this.lastLogTime = now;
      this.logPoolHealth(poolStats);
    }

    // Alert on critical pool conditions
    if (poolStats.waitingClients && poolStats.waitingClients > 5) {
      this.logger.warn(`🚨 Database pool under stress: ${poolStats.waitingClients} requests waiting`);
    }

    if (poolStats.utilizationRate && poolStats.utilizationRate > 95) {
      this.logger.error(`🚨 Database pool critical: ${poolStats.utilizationRate}% utilization`);
    }

    next();
  }

  private logPoolHealth(stats: any) {
    const utilizationRate = stats.utilizationRate || 0;
    const level = utilizationRate > 95 ? 'error' : 
                  utilizationRate > 80 ? 'warn' : 'log';
    
    const message = `🔗 DB Pool - Total: ${stats.totalConnections}/${stats.maxConnections} (${utilizationRate}%), Idle: ${stats.idleConnections}, Active: ${stats.activeConnections || 0}, Waiting: ${stats.waitingClients || 0}`;
    
    this.logger[level](message);
  }
}