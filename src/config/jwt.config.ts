export const jwtConstants = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-secret-key',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  accessTokenExpiration: '1h', // 1 hour
  refreshTokenExpiration: '7d', // 7 days
};

export const getExpirationInSeconds = (expiration: string): number => {
  const unit = expiration.slice(-1);
  const value = parseInt(expiration.slice(0, -1), 10);

  switch (unit) {
    case 's':
      return value; // seconds
    case 'm':
      return value * 60; // minutes
    case 'h':
      return value * 60 * 60; // hours
    case 'd':
      return value * 24 * 60 * 60; // days
    default:
      return 3600; // default to 1 hour in seconds
  }
};
