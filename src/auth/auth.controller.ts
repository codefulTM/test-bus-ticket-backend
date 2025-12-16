import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const response = await this.authService.googleLogin(req.user);

    if (!response) {
      return res.redirect('http://localhost:8000');
    }

    // Determine cookie settings based on environment
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax' | 'strict', // Explicit type casting
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    };

    res.cookie('access_token', response.data.accessToken, cookieOptions);
    res.cookie('refresh_token', response.data.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`http://localhost:8000/`);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getCurrentUser(@Req() req) {
    return {
      success: true,
      data: {
        fullName: req.user.fullName,
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.login(loginDto);

    // Determine cookie settings based on environment
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax' | 'strict', // Explicit type casting
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    };

    // Set HTTP-only cookies for both tokens
    res.cookie('access_token', response.data.accessToken, cookieOptions);
    res.cookie('refresh_token', response.data.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data without tokens
    return {
      success: true,
      data: {
        user: response.data.user,
      },
    };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      refreshTokenDto.refreshToken || req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const response = await this.authService.refreshToken(refreshToken);

    // Determine cookie settings based on environment
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax' | 'strict', // Explicit type casting
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    };

    // Set new HTTP-only cookies
    res.cookie('access_token', response.data.accessToken, cookieOptions);
    res.cookie('refresh_token', response.data.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data without tokens
    return {
      success: true,
      data: {
        user: response.data.user,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}
