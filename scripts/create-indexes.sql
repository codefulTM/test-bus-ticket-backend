-- Database Performance Indexes for Bus Ticket System
-- Run this script to create all performance indexes

-- ============================================
-- BUSES TABLE INDEXES
-- ============================================

-- Single column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buses_operator_id ON buses(operator_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buses_plate_number ON buses(plate_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buses_model ON buses(model);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buses_operator_model ON buses(operator_id, model);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buses_operator_capacity ON buses(operator_id, seat_capacity);

-- ============================================
-- SEAT LAYOUTS TABLE INDEXES
-- ============================================

-- Single column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seat_layouts_bus_id ON seat_layouts(bus_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seat_layouts_type ON seat_layouts(layout_type);

-- Composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seat_layouts_bus_type ON seat_layouts(bus_id, layout_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seat_layouts_created_at ON seat_layouts(created_at);

-- ============================================
-- OPERATORS TABLE INDEXES
-- ============================================

-- Single column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operators_name ON operators(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operators_email ON operators(contact_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operators_status ON operators(status);

-- Composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operators_name_status ON operators(name, status);

-- ============================================
-- TRIPS TABLE INDEXES (CRITICAL FOR BOOKING PERFORMANCE)
-- ============================================

-- Single column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_route_id ON trips(route_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_bus_id ON trips(bus_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_departure_time ON trips(departure_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_arrival_time ON trips(arrival_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_status ON trips(status);

-- Composite indexes for booking search patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_route_departure ON trips(route_id, departure_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_bus_departure ON trips(bus_id, departure_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_status_departure ON trips(status, departure_time);

-- ============================================
-- BOOKINGS TABLE INDEXES
-- ============================================

-- Single column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_booked_at ON bookings(booked_at);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_trip ON bookings(user_id, trip_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_trip_status ON bookings(trip_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_status ON bookings(user_id, status);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================

-- Single column indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);

-- Composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created ON users(role, created_at);

-- ============================================
-- UPDATE STATISTICS FOR QUERY OPTIMIZER
-- ============================================

ANALYZE buses;
ANALYZE seat_layouts;
ANALYZE operators;
ANALYZE trips;
ANALYZE bookings;
ANALYZE users;

-- ============================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries (requires pg_stat_statements extension)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
