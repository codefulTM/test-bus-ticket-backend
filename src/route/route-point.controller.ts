import { Route } from '../entities/route.entity';
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Put, 
  Delete, 
  ParseUUIDPipe,
  Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RoutePoint } from '../entities/route-point.entity';
import { RouteService } from './route.service';
import { CreateRoutePointDto } from './dto/create-route-point.dto';
import { UpdateRoutePointDto } from './dto/update-route-point.dto';

@ApiTags('route-points')
@Controller('routes/:routeId/points')
export class RoutePointController {
  constructor(private readonly routeService: RouteService) {}

  @Get()
  @ApiOperation({ summary: 'Get all points for a route' })
  @ApiParam({ name: 'routeId', description: 'ID of the route' })
  @ApiResponse({ status: 200, description: 'Returns all points for the specified route', type: [RoutePoint] })
  async getPoints(
    @Param('routeId', ParseUUIDPipe) routeId: string
  ): Promise<RoutePoint[]> {
    return this.routeService.findPoints(routeId);
  }

  @Get(':pointId')
  @ApiOperation({ summary: 'Get a specific point from a route' })
  @ApiParam({ name: 'routeId', description: 'ID of the route' })
  @ApiParam({ name: 'pointId', description: 'ID of the point' })
  @ApiResponse({ status: 200, description: 'Returns the specified point', type: RoutePoint })
  @ApiResponse({ status: 404, description: 'Point not found' })
  async getPoint(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Param('pointId', ParseUUIDPipe) pointId: string
  ): Promise<RoutePoint> {
    return this.routeService.findPoint(routeId, pointId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new point to a route' })
  @ApiParam({ name: 'routeId', description: 'ID of the route' })
  @ApiResponse({ status: 201, description: 'The point has been successfully added', type: RoutePoint })
  async addPoint(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() createPointDto: CreateRoutePointDto
  ): Promise<RoutePoint> {
    return this.routeService.addPoint(routeId, createPointDto);
  }

  @Put(':pointId')
  @ApiOperation({ summary: 'Update a point in a route' })
  @ApiParam({ name: 'routeId', description: 'ID of the route' })
  @ApiParam({ name: 'pointId', description: 'ID of the point to update' })
  @ApiResponse({ status: 200, description: 'The point has been successfully updated', type: RoutePoint })
  @ApiResponse({ status: 404, description: 'Point not found' })
  async updatePoint(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Param('pointId', ParseUUIDPipe) pointId: string,
    @Body() updatePointDto: UpdateRoutePointDto
  ): Promise<RoutePoint> {
    return this.routeService.updatePoint(routeId, pointId, updatePointDto);
  }

  @Delete(':pointId')
  @ApiOperation({ summary: 'Delete a point from a route' })
  @ApiParam({ name: 'routeId', description: 'ID of the route' })
  @ApiParam({ name: 'pointId', description: 'ID of the point to delete' })
  @ApiResponse({ status: 200, description: 'The point has been successfully deleted' })
  @ApiResponse({ status: 404, description: 'Point not found' })
  async removePoint(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Param('pointId', ParseUUIDPipe) pointId: string
  ): Promise<void> {
    return this.routeService.removePoint(routeId, pointId);
  }

  @Get('search/nearby')
  @ApiOperation({ summary: 'Find routes with points near a location' })
  @ApiQuery({ name: 'lat', type: Number, required: true, description: 'Latitude of the location' })
  @ApiQuery({ name: 'lng', type: Number, required: true, description: 'Longitude of the location' })
  @ApiQuery({ name: 'radius', type: Number, required: false, description: 'Search radius in kilometers (default: 5km)' })
  @ApiResponse({ status: 200, description: 'Returns routes with points near the specified location', type: [Route] })
  async findRoutesNearLocation(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number = 5
  ): Promise<Route[]> {
    return this.routeService.findRoutesByLocation(parseFloat(lat.toString()), parseFloat(lng.toString()), radius);
  }
}
