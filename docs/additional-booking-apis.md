# Additional Booking API Endpoints

## Overview
Added three new API endpoints to enhance booking management functionality:
- **GET** `/bookings/:id` - Get booking details
- **PUT** `/bookings/:id/update` - Update passenger information
- **PUT** `/bookings/:id/cancel` - Cancel booking

## API Documentation

### 1. GET /bookings/:id - Get Booking Details

**Description:** Retrieve detailed information about a specific booking.

**Authorization:** JWT token required

**Parameters:**
- `id` (path): Booking ID (UUID)

**Authorization:** User can only access their own bookings (admin access can be added later)

**Response:**
```json
{
  "success": true,
  "message": "Booking details retrieved successfully",
  "data": {
    "id": "booking-uuid",
    "userId": "user-uuid",
    "tripId": "trip-uuid",
    "totalAmount": 150000,
    "status": "pending",
    "bookedAt": "2025-12-06T08:00:00Z",
    "cancelledAt": null,
    "passengers": [
      {
        "id": "passenger-uuid",
        "fullName": "Nguyen Van A",
        "documentId": "123456789",
        "seatCode": "A1"
      }
    ],
    "seats": [
      {
        "id": "seat-status-uuid",
        "seatCode": "A1",
        "state": "booked"
      }
    ],
    "expirationTimestamp": "2025-12-06T08:15:00Z"
  }
}
```

### 2. PUT /bookings/:id/update - Update Passenger Information

**Description:** Update passenger information for pending bookings only.

**Authorization:** JWT token required (user must own the booking)

**Parameters:**
- `id` (path): Booking ID (UUID)

**Request Body:**
```json
{
  "passengers": [
    {
      "id": "passenger-uuid",
      "fullName": "Updated Name",
      "documentId": "987654321",
      "seatCode": "A1"
    }
  ]
}
```

**Validation Rules:**
- Can only update PENDING bookings
- All passenger fields are required
- Passenger ID must exist and belong to the booking

**Response:**
```json
{
  "success": true,
  "message": "Passenger information updated successfully",
  "data": {
    // Updated booking details (same structure as GET endpoint)
  }
}
```

### 3. PUT /bookings/:id/cancel - Cancel Booking

**Description:** Cancel a pending booking and release seats.

**Authorization:** JWT token required (user must own the booking)

**Parameters:**
- `id` (path): Booking ID (UUID)

**Business Rules:**
- Can only cancel PENDING bookings
- Automatically releases booked seats (BOOKED → AVAILABLE)
- Creates audit log for tracking
- Sets cancelledAt timestamp

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

## Database Changes

### Booking Entity
Added `cancelledAt` field:
```typescript
@Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
cancelledAt?: Date;
```

### Audit Logging
All operations create audit logs:
- **UPDATE_PASSENGER_INFO**: When passenger details are updated
- **USER_CANCEL_BOOKING**: When user cancels their booking

## Error Handling

### Common Errors
- **404**: Booking not found
- **403**: Access denied (user doesn't own booking)
- **400**: Invalid operation (e.g., updating non-pending booking)

### Example Error Response
```json
{
  "success": false,
  "message": "Can only update passenger info for pending bookings",
  "statusCode": 400
}
```

## Security Considerations

1. **Authorization**: Users can only access their own bookings
2. **State Validation**: Operations only allowed on appropriate booking states
3. **Input Validation**: All input data validated using DTOs
4. **Audit Trail**: All changes logged for compliance

## Testing Examples

### Test Update Passenger Info
```bash
curl -X PUT http://localhost:3000/bookings/booking-uuid/update \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "passengers": [
      {
        "id": "passenger-uuid",
        "fullName": "New Name",
        "documentId": "123456789",
        "seatCode": "A1"
      }
    ]
  }'
```

### Test Cancel Booking
```bash
curl -X PUT http://localhost:3000/bookings/booking-uuid/cancel \
  -H "Authorization: Bearer <jwt-token>"
```

### Test Get Booking Details
```bash
curl -X GET http://localhost:3000/bookings/booking-uuid \
  -H "Authorization: Bearer <jwt-token>"
```

## Integration with Frontend

These endpoints integrate seamlessly with the existing booking flow:

1. **Passenger Info Page**: Use PUT `/update` to modify passenger details
2. **Booking Review Modal**: Use GET `/:id` to display current booking details  
3. **Cancel Flow**: Use PUT `/cancel` for user-initiated cancellations
4. **Booking History**: Use GET `/:id` for detailed booking views

## Future Enhancements

1. **Admin Override**: Allow admin to update any booking
2. **Partial Updates**: Support updating individual passengers
3. **Change Validation**: Prevent seat changes that conflict with availability
4. **Notification Integration**: Send emails/SMS on updates/cancellations