import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1640000000001 implements MigrationInterface {
  name = 'AddPerformanceIndexes1640000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Buses table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_buses_operator_id" ON "buses" ("operator_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_buses_plate_number" ON "buses" ("plate_number");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_buses_model" ON "buses" ("model");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_buses_operator_model" ON "buses" ("operator_id", "model");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_buses_operator_capacity" ON "buses" ("operator_id", "seat_capacity");
    `);

    // Seat layouts table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_seat_layouts_bus_id" ON "seat_layouts" ("bus_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_seat_layouts_type" ON "seat_layouts" ("layout_type");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_seat_layouts_bus_type" ON "seat_layouts" ("bus_id", "layout_type");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_seat_layouts_created_at" ON "seat_layouts" ("created_at");
    `);

    // Operators table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_operators_name" ON "operators" ("name");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_operators_email" ON "operators" ("contact_email");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_operators_status" ON "operators" ("status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_operators_name_status" ON "operators" ("name", "status");
    `);

    // Trips table indexes (most critical for booking performance)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_route_id" ON "trips" ("route_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_bus_id" ON "trips" ("bus_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_departure_time" ON "trips" ("departure_time");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_arrival_time" ON "trips" ("arrival_time");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_status" ON "trips" ("status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_route_departure" ON "trips" ("route_id", "departure_time");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_bus_departure" ON "trips" ("bus_id", "departure_time");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_trips_status_departure" ON "trips" ("status", "departure_time");
    `);

    // Bookings table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_user_id" ON "bookings" ("user_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_trip_id" ON "bookings" ("trip_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_status" ON "bookings" ("status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_booked_at" ON "bookings" ("booked_at");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_user_trip" ON "bookings" ("user_id", "trip_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_trip_status" ON "bookings" ("trip_id", "status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bookings_user_status" ON "bookings" ("user_id", "status");
    `);

    // Users table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_google_id" ON "users" ("google_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_name" ON "users" ("name");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users" ("phone");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_role_created" ON "users" ("role", "created_at");
    `);

    // Update statistics for query optimizer
    await queryRunner.query(`ANALYZE "buses";`);
    await queryRunner.query(`ANALYZE "seat_layouts";`);
    await queryRunner.query(`ANALYZE "operators";`);
    await queryRunner.query(`ANALYZE "trips";`);
    await queryRunner.query(`ANALYZE "bookings";`);
    await queryRunner.query(`ANALYZE "users";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_role_created";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_role";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_phone";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_name";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_google_id";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_user_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_trip_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_user_trip";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_booked_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_trip_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_bookings_user_id";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_status_departure";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_bus_departure";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_route_departure";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_arrival_time";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_departure_time";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_bus_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trips_route_id";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_operators_name_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_operators_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_operators_email";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_operators_name";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_seat_layouts_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_seat_layouts_bus_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_seat_layouts_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_seat_layouts_bus_id";`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_buses_operator_capacity";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_buses_operator_model";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_buses_model";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_buses_plate_number";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_buses_operator_id";`);
  }
}
