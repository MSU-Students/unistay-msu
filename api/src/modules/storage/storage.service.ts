import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const storageConfig = this.configService.get('storage');
    this.bucketName = storageConfig?.bucketName || 'unistay-media';

    this.minioClient = new Minio.Client({
      endPoint: storageConfig?.endPoint || 'localhost',
      port: storageConfig?.port || 9000,
      useSSL: storageConfig?.useSSL || false,
      accessKey: storageConfig?.accessKey || 'unistay_admin',
      secretKey: storageConfig?.secretKey || 'unistay_minio_secret_2026',
    });
  }

  async uploadFile(fileName: string, buffer: Buffer, mimeType: string): Promise<string> {
    try {
      await this.minioClient.putObject(this.bucketName, fileName, buffer, buffer.length, {
        'Content-Type': mimeType,
      });
      return `/${this.bucketName}/${fileName}`;
    } catch (error) {
      this.logger.error(`Error uploading file ${fileName}: ${(error as Error).message}`);
      throw error;
    }
  }

  getClient(): Minio.Client {
    return this.minioClient;
  }
}

