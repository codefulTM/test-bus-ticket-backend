# Booking Expiration System

## Tổng quan
Hệ thống tự động hết hạn booking để đảm bảo ghế được release khi khách hàng không thanh toán trong thời gian quy định.

## Thành phần chính

### 1. Background Job (Cron Job)
- **Tần suất**: Mỗi 5 phút
- **Class**: `BookingSchedulerService`
- **Method**: `handleExpiredBookingsCleanup()`
- **Package**: `@nestjs/schedule`

### 2. Expiration Logic
- **Thời gian hết hạn**: 15 phút sau khi booking
- **Trạng thái**: PENDING → EXPIRED
- **Seat release**: Tự động cập nhật SeatStatus từ BOOKED → AVAILABLE

### 3. Audit Logging
- **Entity**: `AuditLog`
- **Thông tin ghi log**:
  - Action: AUTO_EXPIRED_BOOKING
  - Details: Booking ID và thông tin expired
  - Metadata: Previous status, new status, timestamp
  - Actor: undefined (automated process)

### 4. Error Handling
- **Retry mechanism**: Không, log lỗi và tiếp tục với booking khác
- **Error logging**: Chi tiết lỗi được ghi vào log và return về admin
- **Transaction safety**: Sử dụng database transaction để đảm bảo consistency

## API Endpoints

### Manual Cleanup (Admin)
```http
POST /bookings/admin/cleanup-expired
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed. Processed 5 expired bookings.",
  "data": {
    "processed": 5,
    "errors": []
  }
}
```

## Configuration

### Cron Schedule
```typescript
// Mỗi 5 phút
@Cron(CronExpression.EVERY_5_MINUTES)

// Mỗi 30 phút cho periodic cleanup
@Cron('0 */30 * * * *')
```

### Expiration Time
```typescript
// 15 phút
const fifteenMinutesAgo = new Date();
fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
```

## Workflow

1. **Scheduler chạy mỗi 5 phút**
2. **Tìm PENDING bookings > 15 phút**
3. **Với mỗi expired booking:**
   - Cập nhật booking status → EXPIRED
   - Release seats (BOOKED → AVAILABLE)
   - Tạo audit log
   - Log success/error
4. **Return tổng kết:**
   - Số booking đã process
   - Danh sách lỗi (nếu có)

## Database Changes

### Booking State Transition
```
PENDING (>15 min) → EXPIRED
```

### Seat State Transition
```
BOOKED → AVAILABLE
```

### Audit Trail
```sql
INSERT INTO audit_logs (
  action,
  details,
  metadata,
  created_at
) VALUES (
  'AUTO_EXPIRED_BOOKING',
  'Booking {id} automatically expired due to timeout',
  '{"bookingId": "...", "previousStatus": "PENDING", "newStatus": "EXPIRED"}',
  NOW()
);
```

## Monitoring & Logs

### Application Logs
```
[BookingSchedulerService] Running scheduled booking expiration cleanup...
[BookingSchedulerService] Found 3 expired bookings
[BookingService] Auto-expired booking abc-123-def
[BookingSchedulerService] Successfully processed 3 expired bookings
```

### Error Logs
```
[BookingService] Failed to expire booking abc-123-def: Database connection error
[BookingSchedulerService] Encountered 1 errors during cleanup
```

## Performance Considerations

1. **Index**: Ensure index on `booking.status` và `booking.bookedAt`
2. **Batch size**: Process từng booking một để tránh timeout
3. **Error isolation**: Một booking lỗi không ảnh hưởng booking khác
4. **Transaction scope**: Mỗi booking được process trong transaction riêng

## Testing

### Manual Trigger
```bash
curl -X POST http://localhost:3000/bookings/admin/cleanup-expired \
  -H "Authorization: Bearer <admin-token>"
```

### Check Logs
```bash
# Application logs
tail -f logs/application.log | grep "BookingScheduler"

# Audit logs
SELECT * FROM audit_logs 
WHERE action = 'AUTO_EXPIRED_BOOKING' 
ORDER BY created_at DESC;
```

## Deployment Notes

1. **Package requirement**: `npm install @nestjs/schedule`
2. **Module import**: `ScheduleModule.forRoot()` in `BookingModule`
3. **Environment**: Cron jobs chỉ chạy khi application running
4. **Scaling**: Nếu multiple instances, cần coordination mechanism

## Future Enhancements

1. **Redis TTL**: Sử dụng Redis TTL thay vì cron job
2. **Notification**: Email/SMS thông báo trước khi expire
3. **Grace period**: Cho phép extend thời gian trong trường hợp đặc biệt
4. **Archive**: Move expired bookings sang archive table sau 30 ngày