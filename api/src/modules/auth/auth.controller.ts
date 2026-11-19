import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { DevLoginDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Student self-registration to create an account' })
  @ApiResponse({ status: 201, description: 'Student account created and authenticated' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email or Student ID already exists' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Student/Resident login with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully with JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('dev-login')
  @ApiOperation({ summary: 'Instant login for local development and testing' })
  async devLogin(@Body() dto: DevLoginDto) {
    return this.authService.devLogin(dto);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate institutional Google OAuth login' })
  async googleAuth() {
    // Initiates the Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const authResult = await this.authService.validateOAuthLogin(req.user);
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    // Redirect to frontend with token
    return res.redirect(
      `${clientOrigin}/auth/callback?token=${authResult.accessToken}&user=${encodeURIComponent(
        JSON.stringify(authResult.user),
      )}`,
    );
  }
}
