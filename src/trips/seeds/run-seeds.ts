import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { seedOperators } from './seed-operators';
import { seedBuses } from './seed-buses';
import { seedRoutes } from './seed-routes';
import { seedTrips } from './seed-trips';
import { seedSeats } from './seed-seats';

async function runAll() {
  // create and reuse a single DataSource to avoid multiple app contexts
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get<DataSource>(DataSource);
  if (!ds.isInitialized) await ds.initialize();

  try {
    await seedOperators(ds);
    await seedBuses(ds);
    await seedSeats(ds); // Add seat seeding after buses are created
    await seedRoutes(ds);
    await seedTrips(ds);
    console.log('All seeds finished successfully.');
  } catch (err) {
    console.error('Seeding pipeline failed:', err);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runAll().catch(err => { console.error(err); process.exit(1); });
