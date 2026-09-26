import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'mock_client_id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'mock_secret',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, displayName, photos } = profile;
    const email = emails?.[0]?.value;

    if (!email) {
      return done(new UnauthorizedException('Email not provided by Google account'), false);
    }

    // Enforce @msu.edu.ph domain constraint (can be relaxed in local dev if configured)
    const isDev = process.env.NODE_ENV === 'development';
    if (!email.endsWith('@msu.edu.ph') && !isDev) {
      return done(
        new UnauthorizedException('Access restricted to verified @msu.edu.ph accounts'),
        false,
      );
    }

    const user = {
      email,
      fullName: displayName,
      avatarUrl: photos?.[0]?.value,
    };

    done(null, user);
  }
}
