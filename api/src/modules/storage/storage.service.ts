import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('storage.bucketName', 'unistay-media');
  }

  onModuleInit() {
    try {
      this.minioClient = new Minio.Client({
        endPoint: this.configService.get<string>('storage.endPoint', 'localhost'),
        port: this.configService.get<number>('storage.port', 9000),
        useSSL: this.configService.get<boolean>('storage.useSSL', false),
        accessKey: this.configService.get<string>('storage.accessKey', 'unistay_admin'),
        secretKey: this.configService.get<string>('storage.secretKey', 'unistay_minio_secret_2026'),
      });
      this.logger.log(`MinIO Storage Client initialized for bucket: ${this.bucketName}`);
    } catch (err: any) {
      this.logger.warn(`MinIO Storage Client initialization postponed or failed: ${err?.message || err}`);
    }
  }

  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    folder = 'uploads',
  ): Promise<string> {
    const timestamp = Date.now();
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${folder}/${timestamp}-${cleanFileName}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return `/${this.bucketName}/${objectName}`;
  }

  async getPresignedUrl(objectName: string, expirySeconds = 24 * 3600): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucketName, objectName, expirySeconds);
  }
}
