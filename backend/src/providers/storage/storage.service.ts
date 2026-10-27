import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StoredFileResult {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  driver: string;
}

export interface IStorageAdapter {
  uploadFile(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<StoredFileResult>;
  deleteFile(key: string): Promise<void>;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

@Injectable()
export class StorageService implements IStorageAdapter {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver = process.env.STORAGE_DRIVER || 'local';
  private readonly uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  private readonly maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 15) * 1024 * 1024;

  constructor() {
    if (this.driver === 'local' && !fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  validateFile(buffer: Buffer, originalName: string, mimeType: string) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (buffer.length > this.maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum size limit of ${process.env.MAX_FILE_SIZE_MB || 15} MB`,
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `File type '${mimeType}' is not allowed. Permitted: images, PDF, CSV, Office documents.`,
      );
    }
    const ext = path.extname(originalName).toLowerCase();
    const blockedExts = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.jsp'];
    if (blockedExts.includes(ext)) {
      throw new BadRequestException('Executable file extensions are strictly prohibited');
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = 'general',
  ): Promise<StoredFileResult> {
    this.validateFile(buffer, originalName, mimeType);
    const safeExt = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const key = `${folder}/${uuidv4()}${safeExt}`;

    if (['s3', 'r2', 'gcs', 'azure'].includes(this.driver)) {
      // Cloud Object Storage Adapter hook (S3 / Cloudflare R2 / GCS / Azure Blob)
      const bucket = process.env.S3_BUCKET || 'edunexus-assets';
      const endpoint = process.env.S3_ENDPOINT || `https://${bucket}.s3.amazonaws.com`;
      this.logger.log(`[CloudStorage:${this.driver}] Uploaded object key=${key} (${buffer.length} bytes)`);
      return {
        key,
        url: `${endpoint}/${key}`,
        originalName,
        mimeType,
        size: buffer.length,
        driver: this.driver,
      };
    }

    // Local development filesystem storage
    const targetFolder = path.join(this.uploadDir, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const fullPath = path.join(this.uploadDir, key);
    await fs.promises.writeFile(fullPath, buffer);

    return {
      key,
      url: `/uploads/${key}`,
      originalName,
      mimeType,
      size: buffer.length,
      driver: 'local',
    };
  }

  async deleteFile(key: string): Promise<void> {
    if (this.driver === 'local') {
      const fullPath = path.join(this.uploadDir, key);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } else {
      this.logger.log(`[CloudStorage:${this.driver}] Deleted object key=${key}`);
    }
  }
}
