import { DataSource } from 'typeorm';
import { Seat, SeatType } from '../../entities/seat.entity';
import { Bus } from '../../entities/bus.entity';

export async function seedSeats(ds: DataSource) {
  console.log('🪑 Seeding seats...');
  
  const seatRepo = ds.getRepository(Seat);
  const busRepo = ds.getRepository(Bus);
  
  // Clear existing seats
  const existingSeats = await seatRepo.find();
  if (existingSeats.length > 0) {
    await seatRepo.remove(existingSeats);
    console.log(`Cleared ${existingSeats.length} existing seats`);
  } else {
    console.log('No existing seats to clear');
  }
  
  // Get all buses
  const buses = await busRepo.find();
  console.log(`Found ${buses.length} buses to create seats for`);
  
  let totalSeatsCreated = 0;
  
  for (const bus of buses) {
    console.log(`Creating seats for bus ${bus.plateNumber} (${bus.model})`);
    
    const seatsToCreate: Partial<Seat>[] = [];
    
    // Standard bus layout based on seat capacity
    const capacity = bus.seatCapacity || 40;
    
    if (capacity <= 20) {
      // Small bus: 1 row business, 4 rows normal (4 seats per row)
      // Row 1: Business class
      for (let col of ['A', 'B', 'C', 'D']) {
        seatsToCreate.push({
          busId: bus.id,
          seatCode: `1${col}`,
          seatType: SeatType.BUSINESS,
          isActive: true
        });
      }
      
      // Rows 2-5: Normal class
      for (let row = 2; row <= 5; row++) {
        for (let col of ['A', 'B', 'C', 'D']) {
          seatsToCreate.push({
            busId: bus.id,
            seatCode: `${row}${col}`,
            seatType: SeatType.NORMAL,
            isActive: true
          });
        }
      }
    } else if (capacity <= 40) {
      // Standard bus: 1 row business, 9 rows normal (4 seats per row)
      // Row 1: Business class
      for (let col of ['A', 'B', 'C', 'D']) {
        seatsToCreate.push({
          busId: bus.id,
          seatCode: `1${col}`,
          seatType: SeatType.BUSINESS,
          isActive: true
        });
      }
      
      // Rows 2-10: Normal class
      for (let row = 2; row <= 10; row++) {
        for (let col of ['A', 'B', 'C', 'D']) {
          seatsToCreate.push({
            busId: bus.id,
            seatCode: `${row}${col}`,
            seatType: SeatType.NORMAL,
            isActive: true
          });
        }
      }
    } else {
      // Large bus: 2 rows business, 10 rows normal, some VIP
      // Rows 1-2: Business class
      for (let row = 1; row <= 2; row++) {
        for (let col of ['A', 'B', 'C', 'D']) {
          seatsToCreate.push({
            busId: bus.id,
            seatCode: `${row}${col}`,
            seatType: SeatType.BUSINESS,
            isActive: true
          });
        }
      }
      
      // Row 3: VIP class (fewer seats, more space)
      for (let col of ['A', 'C']) { // Only window seats for VIP
        seatsToCreate.push({
          busId: bus.id,
          seatCode: `3${col}`,
          seatType: SeatType.VIP,
          isActive: true
        });
      }
      
      // Rows 4-12: Normal class
      for (let row = 4; row <= 12; row++) {
        for (let col of ['A', 'B', 'C', 'D']) {
          seatsToCreate.push({
            busId: bus.id,
            seatCode: `${row}${col}`,
            seatType: SeatType.NORMAL,
            isActive: true
          });
        }
      }
    }
    
    // Trim to actual capacity
    const finalSeats = seatsToCreate.slice(0, capacity);
    
    // Save seats for this bus
    await seatRepo.save(finalSeats);
    
    totalSeatsCreated += finalSeats.length;
    console.log(`  ✅ Created ${finalSeats.length} seats for bus ${bus.plateNumber}`);
    console.log(`     Business: ${finalSeats.filter(s => s.seatType === SeatType.BUSINESS).length}`);
    console.log(`     VIP: ${finalSeats.filter(s => s.seatType === SeatType.VIP).length}`);
    console.log(`     Normal: ${finalSeats.filter(s => s.seatType === SeatType.NORMAL).length}`);
  }
  
  console.log(`🪑 Seats seeding completed! Created ${totalSeatsCreated} seats for ${buses.length} buses`);
  
  // Show some sample seats
  const sampleSeats = await seatRepo.find({ 
    take: 10,
    relations: ['bus'],
    order: { busId: 'ASC', seatCode: 'ASC' }
  });
  
  console.log('\n📋 Sample seats created:');
  console.table(sampleSeats.map(seat => ({
    seatCode: seat.seatCode,
    seatType: seat.seatType,
    busPlate: seat.bus?.plateNumber,
    isActive: seat.isActive
  })));
}