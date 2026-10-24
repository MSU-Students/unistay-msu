import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { StorageService, StorageUploadedFile } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Controller for asset uploads (photos, receipts, evidence).
 */
@ApiTags('Storage & Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) { }

  @Post('upload')
  @ApiOperation({ summary: 'Upload an image file (e.g. photo evidence for repair tickets)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/i)) {
          return callback(
            new BadRequestException('Only image files (jpg, jpeg, png, webp, gif) are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: StorageUploadedFile) {
    if (!file) {
      throw new BadRequestException('No file provided for upload.');
    }
    const url = await this.storageService.uploadFile(file, 'maintenance');
    return {
      url,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
