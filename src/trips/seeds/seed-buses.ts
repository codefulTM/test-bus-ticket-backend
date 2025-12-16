import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { Bus } from '../../entities/bus.entity';
import { Operator } from '../../entities/operator.entity';

const BUSES = [
  { 
    plateNumber: '51B-12345', 
    model: 'Mercedes Sprinter 2020', 
    seatCapacity: 30, 
    amenities: JSON.stringify(['wifi','ac','toilet']), 
    busType: 'sleeper', 
    operatorName: 'Saigon Express' 
  },
  {
    plateNumber: '51B-54321', 
    model: 'Thaco 2019', 
    seatCapacity: 40, 
    amenities: JSON.stringify(['ac']), 
    busType: 'standard', 
    operatorName: 'Central Express' 
  },
  { 
    plateNumber: '29B-11111', 
    model: 'Volvo 2017', 
    seatCapacity: 45, 
    amenities: JSON.stringify(['ac','wifi']), 
    busType: 'standard', 
    operatorName: 'Red River Transport' 
  },
  { 
    plateNumber: '43B-22222', 
    model: 'Hyundai Universe 2019', 
    seatCapacity: 38, 
    amenities: JSON.stringify(['ac']), 
    busType: 'standard', 
    operatorName: 'Central Express' 
  },
  { 
    plateNumber: '79C-98765', 
    model: 'Isuzu 2018', 
    seatCapacity: 34, 
    amenities: JSON.stringify(['wifi','ac','recliner']), 
    busType: 'limousine', 
    operatorName: 'Saigon Express' 
  },
];

export async function seedBuses(dataSource?: DataSource) {
  let app;
  let localDs = dataSource;
  if (!localDs) {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    localDs = app.get<DataSource>(DataSource);
    if (!localDs.isInitialized) await localDs.initialize();
  }

  await localDs.transaction(async transactionalEntityManager => {
    for (const seed of BUSES) {
      // find operator
      const operator = await transactionalEntityManager.findOne(Operator, { 
        where: { name: seed.operatorName } 
      });
      if (!operator) {
        throw new Error(`Operator not found for bus seed: ${seed.operatorName} — run seed-operators first`);
      }

      const existing = await transactionalEntityManager.findOne(Bus, { 
        where: { plateNumber: seed.plateNumber } 
      });
      if (!existing) {
        const created = transactionalEntityManager.create(Bus, {
          plateNumber: seed.plateNumber,
          model: seed.model,
          seatCapacity: seed.seatCapacity,
          amenities: JSON.parse(seed.amenities),
          operator: operator,
          busType: seed.busType,
        });
        await transactionalEntityManager.save(created);
        console.log(`Bus created: ${seed.plateNumber}`);
      } else {
        let changed = false;
        if (existing.model !== seed.model) { 
          existing.model = seed.model; 
          changed = true; 
        }
        if (existing.seatCapacity !== seed.seatCapacity) { 
          existing.seatCapacity = seed.seatCapacity; 
          changed = true; 
        }
        if (JSON.stringify(existing.amenities) !== seed.amenities) { 
          existing.amenities = JSON.parse(seed.amenities); 
          changed = true; 
        }
        if (changed) {
          existing.operator = operator; // ensure operator reference
          await transactionalEntityManager.save(existing);
          console.log(`Bus updated: ${seed.plateNumber}`);
        } else {
          console.log(`Bus exists: ${seed.plateNumber}`);
        }
      }
    }
  });

  if (app) await app.close();
}

// run directly with ts-node
if (require.main === module) {
  seedBuses()
    .then(() => {
      console.log('Operator seed complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('Operator seed failed:', err);
      process.exit(1);
    });
}
