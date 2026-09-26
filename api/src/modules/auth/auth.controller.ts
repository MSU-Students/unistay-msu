import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { DevLoginDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
