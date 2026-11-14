import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/**
 * Module responsible for S3 / MinIO media storage and uploads.
 */
@Module({
    imports: [ConfigModule],
    controllers: [StorageController],
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageModule { }
