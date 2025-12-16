import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { Route } from '../../entities/route.entity';
import { Operator } from '../../entities/operator.entity';
import { RoutePoint, PointType } from '../../entities/route-point.entity';

const ROUTES = [
  {
    origin: 'Ho Chi Minh',
    destination: 'Nha Trang',
    distanceKm: 435,
    estimatedMinutes: 420,
    operatorName: 'Saigon Express'
  },
  {
    origin: 'Ho Chi Minh',
    destination: 'Da Lat',
    distanceKm: 315,
    estimatedMinutes: 360,
    operatorName: 'Central Express'
  },
  {
    origin: 'Ho Chi Minh',
    destination: 'Vung Tau',
    distanceKm: 120,
    estimatedMinutes: 150,
    operatorName: 'Saigon Express'
  },
  {
    origin: 'Ho Chi Minh',
    destination: 'Cu Chi',
    distanceKm: 70,
    estimatedMinutes: 90,
    operatorName: 'Saigon Express'
  },
  {
    origin: 'Nha Trang',
    destination: 'Qui Nhon',
    distanceKm: 210,
    estimatedMinutes: 240,
    operatorName: 'Saigon Express'
  },
  {
    origin: 'Ha Noi',
    destination: 'Hai Phong',
    distanceKm: 120,
    estimatedMinutes: 150,
    operatorName: 'Red River Transport'
  },
  {
    origin: 'Ha Noi',
    destination: 'Ninh Binh',
    distanceKm: 95,
    estimatedMinutes: 120,
    operatorName: 'Red River Transport'
  },
  {
    origin: 'Da Nang',
    destination: 'Hue',
    distanceKm: 100,
    estimatedMinutes: 120,
    operatorName: 'Central Express'
  },
  {
    origin: 'Da Nang',
    destination: 'Quang Ngai',
    distanceKm: 130,
    estimatedMinutes: 180,
    operatorName: 'Central Express'
  },
  {
    origin: 'Nha Trang',
    destination: 'Ho Chi Minh',
    distanceKm: 435,
    estimatedMinutes: 420,
    operatorName: 'Red River Transport'
  },
];

export async function seedRoutes(dataSource?: DataSource) {
  let app;
  let localDs = dataSource;
  if (!localDs) {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    localDs = app.get<DataSource>(DataSource);
    if (!localDs.isInitialized) await localDs.initialize();
  }

  await localDs.transaction(async transactionalEntityManager => {
    for (const seed of ROUTES) {
      const operator = await transactionalEntityManager.findOne(Operator, {
        where: { name: seed.operatorName }
      });
      if (!operator) {
        throw new Error(`Operator not found for route seed: ${seed.operatorName} — run seed-operators first`);
      }

      const existing = await transactionalEntityManager.findOne(Route, {
        where: {
          origin: seed.origin,
          destination: seed.destination,
          distanceKm: seed.distanceKm,
          operator: operator,
        }
      });
      if (!existing) {
        const name = `${seed.origin} - ${seed.destination}`;
        const description = `Route from ${seed.origin} to ${seed.destination}, approximately ${seed.distanceKm} km, around ${Math.round(seed.estimatedMinutes / 60)} hours of travel.`;

        const created = transactionalEntityManager.create(Route, {
          operatorId: operator.id,
          operator,
          origin: seed.origin,
          destination: seed.destination,
          distanceKm: seed.distanceKm,
          estimatedMinutes: seed.estimatedMinutes,
          name,
          description,
          isActive: true,
          amenities: [],
        });

        const route = await transactionalEntityManager.save(created);

        // create two RoutePoint entries: origin (order 1) and destination (order 2)
        const originPoint = transactionalEntityManager.create(RoutePoint, {
          name: `${seed.origin} pickup/dropoff point`,
          latitude: 0, // placeholder coordinates
          longitude: 0,
          type: PointType.BOTH,
          order: 1,
          distanceFromStart: 0,
          estimatedTimeFromStart: 0,
          routeId: route.id,
          route,
        });

        const destinationPoint = transactionalEntityManager.create(RoutePoint, {
          name: `${seed.destination} pickup/dropoff point`,
          latitude: 0, // placeholder coordinates
          longitude: 0,
          type: PointType.BOTH,
          order: 2,
          distanceFromStart: seed.distanceKm ? Math.round(seed.distanceKm * 1000) : undefined,
          estimatedTimeFromStart: seed.estimatedMinutes ?? undefined,
          routeId: route.id,
          route,
        });

        await transactionalEntityManager.save([originPoint, destinationPoint]);

        console.log(`Route created: ${seed.origin} -> ${seed.destination} (op=${seed.operatorName})`);
      } else {
        let changed = false;
        if (existing.estimatedMinutes !== seed.estimatedMinutes) {
          existing.estimatedMinutes = seed.estimatedMinutes;
          changed = true;
        }
        const expectedName = `${seed.origin} - ${seed.destination}`;
        if (existing.name !== expectedName) {
          existing.name = expectedName;
          changed = true;
        }
        if (!existing.description) {
          existing.description = `Route from ${seed.origin} to ${seed.destination}, approximately ${seed.distanceKm} km, around ${Math.round(seed.estimatedMinutes / 60)} hours of travel.`;
          changed = true;
        }
        if (existing.isActive !== true) {
          existing.isActive = true;
          changed = true;
        }
        if (!Array.isArray(existing.amenities)) {
          existing.amenities = [];
          changed = true;
        }
        if (changed) {
          existing.operator = operator; // ensure operator reference
          await transactionalEntityManager.save(existing);
          console.log(`Route updated: ${seed.origin} -> ${seed.destination}`);
        } else {
          console.log(`Route exists: ${seed.origin} -> ${seed.destination}`);
        }
      }
    }
  });

  if (app) await app.close();
}

// run directly with ts-node
if (require.main === module) {
  seedRoutes()
    .then(() => {
      console.log('Operator seed complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('Operator seed failed:', err);
      process.exit(1);
    });
}

