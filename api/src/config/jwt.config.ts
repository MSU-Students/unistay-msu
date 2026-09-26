import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'super_secret_jwt_key_unistay_msu_2026_dev_mode',
  expiresIn: process.env.JWT_EXPIRATION || '7d',
}));
