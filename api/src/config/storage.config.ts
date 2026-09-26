import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'unistay_admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'unistay_minio_secret_2026',
  bucketName: process.env.MINIO_BUCKET_NAME || 'unistay-media',
}));
