import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { Operator, OperatorStatus } from '../../entities/operator.entity';

const OPERATORS = [
  {
    name: 'Saigon Express',
    contactEmail: 'hello@saigonexpress.vn',
    contactPhone: '0901234567',
    status: 'approved',
    approvedAt: new Date(),
  },
  {
    name: 'Central Express',
    contactEmail: 'contact@central.vn',
    contactPhone: '0902223344',
    status: 'approved',
    approvedAt: new Date(),
  },
  {
    name: 'Red River Transport',
    contactEmail: 'info@redriver.vn',
    contactPhone: '0903334455',
    status: 'approved',
    approvedAt: new Date(),
  },
];

export async function seedOperators(dataSource?: DataSource) {
  let app;
  let localDs = dataSource;
  if (!localDs) {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    localDs = app.get<DataSource>(DataSource);
    if (!localDs.isInitialized) await localDs.initialize();
  }

  await localDs.transaction(async transactionalEntityManager => {
    for (const seed of OPERATORS) {
      const existing = await transactionalEntityManager.findOne(Operator, {
        where: { name: seed.name },
      });

      if (!existing) {
        const created = transactionalEntityManager.create(Operator, {
          name: seed.name,
          contactEmail: seed.contactEmail,
          contactPhone: seed.contactPhone,
          status: OperatorStatus[seed.status],
          approvedAt: new Date(seed.approvedAt),
        });
        await transactionalEntityManager.save(created);
        console.log(`Operator created: ${seed.name}`);
      } else {
        let changed = false;
        if (existing.contactEmail !== seed.contactEmail) {
          existing.contactEmail = seed.contactEmail;
          changed = true;
        }
        if (existing.contactPhone !== seed.contactPhone) {
          existing.contactPhone = seed.contactPhone;
          changed = true;
        }
        if (seed.status && existing.status !== seed.status) {
          existing.status = seed.status as any;
          changed = true;
        }
        if (seed.approvedAt) {
          const seedDate = new Date(seed.approvedAt);
          if (!existing.approvedAt || existing.approvedAt.getTime() !== seedDate.getTime()) {
            existing.approvedAt = seedDate;
            changed = true;
          }
        }

        if (changed) {
          await transactionalEntityManager.save(existing);
          console.log(`Operator updated: ${seed.name}`);
        } else {
          console.log(`Operator exists: ${seed.name}`);
        }
      }
    }
  });

  if (app) await app.close();
}

// run directly with ts-node
if (require.main === module) {
  seedOperators()
    .then(() => {
      console.log('Operator seed complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('Operator seed failed:', err);
      process.exit(1);
    });
}
