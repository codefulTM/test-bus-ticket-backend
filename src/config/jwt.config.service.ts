import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtOptionsFactory } from '@nestjs/jwt';

@Injectable()
export class JwtConfigService implements JwtOptionsFactory {
  constructor(private configService: ConfigService) {}

  get accessTokenSecret(): string {
    return this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'your-secret-key',
    );
  }

  get refreshTokenSecret(): string {
    return this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'your-refresh-secret',
    );
  }

  get accessTokenExpiration(): string {
    return '1h'; // 1 hour
  }

  get refreshTokenExpiration(): string {
    return '7d'; // 7 days
  }

  createJwtOptions(): JwtModuleOptions {
    return {
      secret: this.accessTokenSecret,
      signOptions: {
        expiresIn: this.accessTokenExpiration as any, // Type assertion to handle string expiration
      },
    };
  }

  getExpirationInSeconds(expiration: string): number {
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
        return value; // default to seconds
    }
  }
}
