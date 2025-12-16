# Render Deployment Memory Optimization

## Problem

The JavaScript heap out of memory error occurs because Render's free plan has limited memory (512MB total). The NestJS application, especially during data seeding operations, exceeds this limit.

## Solutions Applied

### 1. Node.js Memory Limits

Updated package.json scripts to include explicit memory limits:

- **Production**: `--max-old-space-size=512` (uses full available memory)
- **Seeding scripts**: `--max-old-space-size=256` (conservative limit for data operations)

### 2. Memory Optimization Recommendations

#### For Production Deployment

```bash
# Use the optimized start script
npm run start:prod
```

#### For Database Seeding

```bash
# Run seeds with memory limits
npm run seed:all
```

### 3. Additional Optimizations (if needed)

#### Environment Variables

Add to Render environment variables:

```
NODE_OPTIONS=--max-old-space-size=512
NODE_ENV=production
```

#### Database Connection Pooling

Ensure TypeORM connection pool is configured conservatively:

```typescript
// In app.module.ts
TypeOrmModule.forRoot({
  type: 'postgres',
  // ... other config
  extra: {
    max: 5, // Reduced pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
```

### 4. Render Service Configuration

- **Free Plan**: 512MB RAM limit
- **Upgrade**: Consider Standard plan ($7/month) for 1GB RAM if issues persist
- **Metrics**: Monitor memory usage in Render dashboard

### 5. Long-term Solutions

1. **Disable auto-seeding** in production - seed data locally before deployment
2. **Optimize queries** - add proper database indexes
3. **Implement caching** - reduce database load
4. **Use background jobs** - for heavy operations like seat generation

## Monitoring

Check Render service metrics for:

- Memory usage trends
- CPU utilization
- Database connection count

## Emergency Recovery

If deployment fails:

1. Clear database and reseed with smaller dataset
2. Temporarily reduce application features
3. Upgrade to paid Render plan
