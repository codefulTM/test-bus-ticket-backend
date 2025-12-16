import { Controller, Get, OnModuleInit, Param } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Seat } from '../entities/seat.entity';

@ApiTags('Database')
@Controller('database')
export class DatabaseController implements OnModuleInit {
  constructor(
    private readonly databaseService: DatabaseService,
    private dataSource: DataSource
  ) {}

  onModuleInit() {
    console.log('🔗 Database monitoring endpoints initialized');
  }

  @Get('seats/bus/:busId')
  @ApiOperation({ summary: 'Debug: Get all seats for a bus' })
  async getSeatsForBus(@Param('busId') busId: string) {
    try {
      const seats = await this.dataSource
        .getRepository(Seat)
        .find({ 
          where: { busId },
          take: 50, // Limit to first 50 seats
          relations: ['seatStatuses'] // Include seat status info
        });
      
      return { 
        success: true, 
        busId,
        seatCount: seats.length,
        seats: seats.map(s => ({
          id: s.id,
          seatCode: s.seatCode,
          seatType: s.seatType,
          isActive: s.isActive,
          busId: s.busId,
          // Include seat status info if available
          statusCount: s.seatStatuses?.length || 0
        }))
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        busId 
      };
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check database connection pool health' })
  @ApiResponse({ status: 200, description: 'Database health information' })
  async getHealth() {
    const health = await this.databaseService.checkHealth();
    
    return {
      success: true,
      data: health,
      message: health.status === 'healthy' ? 'Database is healthy' : 
                health.status === 'warning' ? 'Database pool under stress' : 
                'Database pool critical',
    };
  }

  @Get('pool/stats')
  @ApiOperation({ summary: 'Get detailed connection pool statistics' })
  @ApiResponse({ status: 200, description: 'Connection pool statistics' })
  getPoolStats() {
    const stats = this.databaseService.getPoolStats();
    
    return {
      success: true,
      data: stats,
      message: 'Connection pool statistics retrieved successfully',
    };
  }

  @Get('pool/config')
  @ApiOperation({ summary: 'Get connection pool configuration' })
  @ApiResponse({ status: 200, description: 'Connection pool configuration' })
  getPoolConfig() {
    const config = this.databaseService.getPoolConfig();
    
    return {
      success: true,
      data: config,
      message: 'Connection pool configuration retrieved successfully',
    };
  }

  @Get('performance')
  @ApiOperation({ summary: 'Test database query performance' })
  @ApiResponse({ status: 200, description: 'Database performance metrics' })
  async testPerformance() {
    const performance = await this.databaseService.testQueryPerformance();
    
    return {
      success: true,
      data: {
        ...performance,
        status: performance.queryTime < 10 ? 'excellent' : 
                performance.queryTime < 50 ? 'good' : 
                performance.queryTime < 100 ? 'fair' : 'poor',
      },
      message: 'Database performance test completed',
    };
  }
}
