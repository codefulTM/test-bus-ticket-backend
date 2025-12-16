import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { seedSeats } from './seed-seats';

async function runSeatSeeds() {
  console.log('🚌 Starting seat seeding process...');
  
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get<DataSource>(DataSource);
  if (!ds.isInitialized) await ds.initialize();

  try {
    await seedSeats(ds);
    console.log('✅ Seat seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seat seeding failed:', err);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runSeatSeeds().catch(err => { 
  console.error('❌ Seat seeding script failed:', err); 
  process.exit(1); 
});