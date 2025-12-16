import { Controller, Get, OnModuleInit } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('Health')
@Controller('health')
export class HealthController implements OnModuleInit {
  constructor(private readonly databaseService: DatabaseService) {}

  onModuleInit() {
    console.log('🏥 Health check endpoints initialized');
  }

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async getHealth() {
    const dbHealth = await this.databaseService.checkHealth();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'bus-ticket-api',
      version: '1.0.0',
      database: {
        connected: dbHealth.database,
        pool: {
          utilization: dbHealth.pool.utilizationRate,
          status: dbHealth.pool.status,
        },
      },
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - checks if service is ready to handle traffic' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready' })
  async getReadiness() {
    const dbHealth = await this.databaseService.checkHealth();
    
    const isReady = dbHealth.database && dbHealth.status !== 'critical';
    
    return {
      status: isReady ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealth.database ? 'pass' : 'fail',
          pool: {
            status: dbHealth.pool.status,
            utilization: dbHealth.pool.utilizationRate,
          },
        },
      },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - checks if service is alive' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async getLiveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'bus-ticket-api',
    };
  }
}
