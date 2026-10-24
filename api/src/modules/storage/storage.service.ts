import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as path from 'path';
import * as crypto from 'crypto';

export interface StorageUploadedFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private bucketName: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.config.get<string>('storage.endPoint', 'localhost');
    this.port = this.config.get<number>('storage.port', 9000);
    this.useSSL = this.config.get<boolean>('storage.useSSL', false);
    this.bucketName = this.config.get<string>('storage.bucketName', 'unistay-media');

    this.minioClient = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: this.config.get<string>('storage.accessKey', 'unistay_admin'),
      secretKey: this.config.get<string>('storage.secretKey', 'unistay_minio_secret_2026'),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucketName}`);

        // Set Public Read Policy so frontend clients can actually view the uploaded images
        const publicReadPolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(publicReadPolicy));
        this.logger.log(`Public read policy applied to bucket: ${this.bucketName}`);
      }
    } catch (err: any) {
      this.logger.warn(`MinIO bucket initialization deferred: ${err?.message || err}`);
    }
  }

  async uploadFile(file: StorageUploadedFile, folder = 'maintenance'): Promise<string> {
    const fileExt = path.extname(file.originalname) || '.jpg';
    const randomHash = crypto.randomBytes(8).toString('hex');
    const objectName = `${folder}/${Date.now()}-${randomHash}${fileExt}`;

    try {
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype || 'image/jpeg',
        },
      );

      const protocol = this.useSSL ? 'https' : 'http';
      // Fallback fallback rule cleanup for local dev networks mapping
      const host = this.endpoint === 'minio' ? 'localhost' : this.endpoint;
      const fileUrl = `${protocol}://${host}:${this.port}/${this.bucketName}/${objectName}`;

      this.logger.log(`Uploaded file to MinIO: ${fileUrl}`);
      return fileUrl;
    } catch (err: any) {
      this.logger.error(`MinIO upload failed: ${err?.message || err}. Falling back to Data URL.`);
      const base64 = file.buffer.toString('base64');
      return `data:${file.mimetype || 'image/jpeg'};base64,${base64}`;
    }
  }
}
