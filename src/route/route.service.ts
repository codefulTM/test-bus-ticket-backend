import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Route } from '../entities/route.entity';
import { RoutePoint } from '../entities/route-point.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { CreateRoutePointDto } from './dto/create-route-point.dto';
import { UpdateRoutePointDto } from './dto/update-route-point.dto';

@Injectable()
export class RouteService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(RoutePoint)
    private readonly routePointRepository: Repository<RoutePoint>,
  ) {}

  async removePoint(routeId: string, pointId: string): Promise<void> {
    // Check if the route exists
    const route = await this.routeRepository.findOne({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException(`Route with ID ${routeId} not found`);
    }

    // Find and delete the point
    const result = await this.routePointRepository.delete({ 
      id: pointId, 
      routeId 
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Point with ID ${pointId} not found in route ${routeId}`
      );
    }
  }

  async addPoint(routeId: string, createPointDto: CreateRoutePointDto): Promise<RoutePoint> {
    // Check if route exists
    const route = await this.routeRepository.findOne({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException(`Route with ID ${routeId} not found`);
    }

    // Create and save the new route point
    const point = this.routePointRepository.create({
      ...createPointDto,
      routeId
    });
    
    return this.routePointRepository.save(point);
  }

  async create(createRouteDto: CreateRouteDto): Promise<Route> {
    // Create the route first
    const { points, ...routeData } = createRouteDto;
    const route = this.routeRepository.create(routeData);
    const savedRoute = await this.routeRepository.save(route);

    // Then create all route points
    if (points && points.length > 0) {
      const routePoints = points.map(pointDto => ({
        ...pointDto,
        routeId: savedRoute.id,
      }));
      
      const createdPoints = this.routePointRepository.create(routePoints);
      await this.routePointRepository.save(createdPoints);
      savedRoute.points = createdPoints;
    }

    return savedRoute;
  }

  async findPoints(routeId: string): Promise<RoutePoint[]> {
    return this.routePointRepository.find({ 
      where: { routeId },
      order: { order: 'ASC' }
    });
  }

  async findPoint(routeId: string, pointId: string): Promise<RoutePoint> {
    const point = await this.routePointRepository.findOne({
      where: { id: pointId, routeId }
    });

    if (!point) {
      throw new NotFoundException(`Route point with ID ${pointId} not found in route ${routeId}`);
    }

    return point;
  }

  async updatePoint(routeId: string, pointId: string, updatePointDto: UpdateRoutePointDto): Promise<RoutePoint> {
    // First find the point to ensure it exists
    const point = await this.findPoint(routeId, pointId);
    
    // Update the point with new data
    Object.assign(point, updatePointDto);
    
    // Save and return the updated point
    return this.routePointRepository.save(point);
  }

  async findAll(includePoints: boolean = false): Promise<Route[]> {
    const relations = ['operator', 'trips', 'points'];
    
    return await this.routeRepository.find({
      relations,
      order: {
        name: 'ASC',
        points: {
          order: 'ASC'
        }
      },
      where: {
        isActive: true
      }
    });
  }

  async findOne(id: string, includePoints: boolean = true): Promise<Route> {
    const relations = ['operator', 'trips', 'points'];
    if (includePoints) {
      relations.push('points');
    }
    
    const route = await this.routeRepository.findOne({
      where: { id },
      relations,
      order: {
        points: {
          order: 'ASC'
        }
      }
    });
    
    if (!route) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
    return route;
  }

  async update(id: string, updateRouteDto: UpdateRouteDto): Promise<Route> {
    const { points, ...routeData } = updateRouteDto;
    
    // Update route basic info
    const route = await this.findOne(id, false);
    Object.assign(route, routeData);
    await this.routeRepository.save(route);
    
    // If points are provided, update them
    if (points && Array.isArray(points)) {
      // First, delete all existing points for this route
      await this.routePointRepository.delete({ routeId: id });
      
      // Then create new points
      const routePoints = points.map(pointDto => ({
        ...pointDto,
        routeId: id,
      }));
      
      const createdPoints = this.routePointRepository.create(routePoints);
      await this.routePointRepository.save(createdPoints);
      route.points = createdPoints;
    } else {
      // If no points in update, load existing points
      route.points = await this.routePointRepository.find({
        where: { routeId: id },
        order: { order: 'ASC' }
      });
    }
    
    return route;
  }

  async remove(id: string): Promise<void> {
    // First delete all points to avoid foreign key constraint
    await this.routePointRepository.delete({ routeId: id });
    
    // Then delete the route
    const result = await this.routeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async findRoutesByLocation(lat: number, lng: number, radiusKm: number = 5): Promise<Route[]> {
    // Convert km to meters (PostGIS uses meters for distance calculations)
    const radiusMeters = radiusKm * 1000;
    
    // Find all routes that have at least one point within the specified radius
    const query = this.routeRepository
      .createQueryBuilder('route')
      .innerJoinAndSelect('route.points', 'point')
      .where("ST_DWithin(\
        ST_MakePoint(point.longitude, point.latitude)::geography, \
        ST_MakePoint(:lng, :lat)::geography, \
        :radius\
      )", { lng, lat, radius: radiusMeters })
      .orderBy('route.name', 'ASC');

    return query.getMany();
  }
}
