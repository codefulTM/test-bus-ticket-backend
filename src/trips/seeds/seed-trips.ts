import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { Route } from '../../entities/route.entity';
import { Bus } from '../../entities/bus.entity';

const TRIPS = [
  { 
    routeKey: { 
      origin: 'Ho Chi Minh', 
      destination: 'Nha Trang' 
    }, busPlate: '51B-12345', 
    departureTime: '2025-12-05T22:00:00.000Z', 
    arrivalTime: '2025-12-06T06:00:00.000Z', 
    duration_minutes: 480, 
    basePrice: 350000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Ho Chi Minh', 
      destination: 'Da Lat' 
    }, busPlate: '51B-54321', 
    departureTime: '2025-12-06T06:30:00.000Z', 
    arrivalTime: '2025-12-06T12:30:00.000Z', 
    duration_minutes: 360, 
    basePrice: 220000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Ho Chi Minh', 
      destination: 'Nha Trang' 
    }, 
    busPlate: '79C-98765', 
    departureTime: '2025-12-05T08:00:00.000Z', 
    arrivalTime: '2025-12-05T16:00:00.000Z', 
    duration_minutes: 480, 
    basePrice: 420000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Ha Noi', 
      destination: 'Hai Phong' 
    }, 
      busPlate: '29B-11111', 
      departureTime: '2025-12-07T09:00:00.000Z', 
      arrivalTime: '2025-12-07T11:30:00.000Z', 
      duration_minutes: 150, 
      basePrice: 90000, 
      status: 'active' 
    },
  { 
    routeKey: { 
      origin: 'Da Nang', 
      destination: 'Hue' 
    }, 
    busPlate: '43B-22222', 
    departureTime: '2025-12-08T14:00:00.000Z', 
    arrivalTime: '2025-12-08T16:00:00.000Z', 
    duration_minutes: 120, 
    basePrice: 120000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Ho Chi Minh', 
      destination: 'Vung Tau' 
    }, 
    busPlate: '79C-98765', 
    departureTime: '2025-12-09T07:30:00.000Z', 
    arrivalTime: '2025-12-09T10:00:00.000Z', 
    duration_minutes: 150, 
    basePrice: 150000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Nha Trang', 
      destination: 'Qui Nhon' 
    }, 
    busPlate: '51B-12345', 
    departureTime: '2025-12-10T20:00:00.000Z', 
    arrivalTime: '2025-12-11T00:00:00.000Z', 
    duration_minutes: 240, 
    basePrice: 200000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Ho Chi Minh', 
      destination: 'Cu Chi' 
    }, 
    busPlate: '51D-55555', 
    departureTime: '2025-12-11T13:00:00.000Z', 
    arrivalTime: '2025-12-11T14:30:00.000Z', 
    duration_minutes: 90, 
    basePrice: 60000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Da Nang', 
      destination: 'Quang Ngai' 
    }, 
    busPlate: '43C-66666', 
    departureTime: '2025-12-12T18:00:00.000Z', 
    arrivalTime: '2025-12-12T21:00:00.000Z', 
    duration_minutes: 180, 
    basePrice: 140000, 
    status: 'active' 
  },
  { 
    routeKey: { 
      origin: 'Ha Noi', 
      destination: 'Ninh Binh' 
    }, 
    busPlate: '29C-77777', 
    departureTime: '2025-12-13T08:00:00.000Z', 
    arrivalTime: '2025-12-13T10:00:00.000Z', 
    duration_minutes: 120, 
    basePrice: 80000, 
    status: 'active' 
  },
];

export async function seedTrips(dataSource?: DataSource) {
  let app;
  let localDs = dataSource;
  if (!localDs) {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    localDs = app.get<DataSource>(DataSource);
    if (!localDs.isInitialized) await localDs.initialize();
  }

  const routeRepo = localDs.getRepository(Route);
  const busRepo = localDs.getRepository(Bus);
  const tripRepo = localDs.getRepository(Trip);

  await localDs.transaction(async transactionalEntityManager => {
    for (const seed of TRIPS) {
      // find route
      const route = await transactionalEntityManager.findOne(Route, {
        where: { 
          origin: seed.routeKey.origin, 
          destination: seed.routeKey.destination 
        }
      });
      if (!route) {
        console.warn(`Route not found for trip seed: ${seed.routeKey.origin} -> ${seed.routeKey.destination}`);
        continue;
      }

      const bus = await transactionalEntityManager.findOne(Bus, { 
        where: { plateNumber: seed.busPlate } 
      });
      if (!bus) {
        console.warn(`Bus not found for trip seed: ${seed.busPlate}`);
        continue;
      }
      
      const dep = new Date(seed.departureTime);
      const existing = await transactionalEntityManager.findOne(Trip, {
        where: {
          route: { id: route.id },
          bus: { id: bus.id },
          departureTime: dep,
        } as any,
        relations: ['route', 'bus'],
      });
      if (!existing) {
        const created = transactionalEntityManager.create(Trip, {
          route: route,
          bus: bus,
          departureTime: new Date(seed.departureTime),
          arrivalTime: new Date(seed.arrivalTime),
          basePrice: seed.basePrice,
          status: TripStatus[seed.status ?? 'scheduled'],
        });
        await transactionalEntityManager.save(created);
        console.log(`Trip created: ${route.origin}->${route.destination} at ${seed.departureTime}`);
      } else {
        let changed = false;
        if (existing.departureTime?.toISOString() !== new Date(seed.departureTime).toISOString()) { 
          existing.departureTime = new Date(seed.departureTime); 
          changed = true; 
        }
        if (existing.arrivalTime?.toISOString() !== new Date(seed.arrivalTime).toISOString()) { 
          existing.arrivalTime = new Date(seed.arrivalTime); 
          changed = true; 
        }
        if (existing.basePrice !== seed.basePrice) { 
          existing.basePrice = seed.basePrice; 
          changed = true; 
        }
        if (existing.status !== TripStatus[seed.status]) { 
          existing.status = TripStatus[seed.status]; 
          changed = true; 
        }
        if (changed) {
          existing.route = route;
          existing.bus = bus;
          await transactionalEntityManager.save(existing);
          console.log(`Trip updated: ${route.origin}->${route.destination} at ${seed.departureTime}`);
        } else {
          console.log(`Trip exists: ${route.origin}->${route.destination} at ${seed.departureTime}`);
        }
      }
    }
  });

  if (app) await app.close();
}



// run directly with ts-node
if (require.main === module) {
  seedTrips()
    .then(() => {
      console.log('Operator seed complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('Operator seed failed:', err);
      process.exit(1);
    });
}

