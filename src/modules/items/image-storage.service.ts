import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { eq, InferSelectModel } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';

import { fileTypeFromBuffer } from 'file-type'; // Para validación binaria
import sharp from 'sharp';
import { uuidv7 } from 'uuidv7';

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as schema from './schemas/images.schema';

export type Image = InferSelectModel<typeof schema.images>;

@Injectable()
export class ImageStorageService {
  private readonly THUMB_PATH: string = 'thumbnails';
  private readonly IMAGES_PATH: string = 'images';

  private readonly baseUploadPath: string;
  private readonly directoryLevels: number;
  private readonly imageWidth: number;
  private readonly thumbWidth: number;

  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    private configService: ConfigService
  ) {
    this.baseUploadPath = this.configService.get<string>('UPLOAD_LOCATION', './media');
    this.directoryLevels = this.configService.get<number>('UPLOAD_DIRECTORY_LEVELS', 2);
    this.imageWidth = Number(this.configService.get<number>('IMAGE_WIDTH', 1920));
    this.thumbWidth = Number(this.configService.get<number>('THUMB_WIDTH', 300));
  }

  /**
   * Internal logic to handle file validation, hashing, and physical storage
   */
  private async processImage(file: Express.Multer.File) {
    // 1. Binary validation for security purposes
    const type = await fileTypeFromBuffer(file.buffer);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!type || !allowedMimeTypes.includes(type.mime)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG and WebP are allowed.');
    }

    try {
      // 2. Path definition and sharding logic
      const imageBuffer = file.buffer;
      const fileHash = this.generateFileHash(imageBuffer);
      const shardPath = this.getShardedPath(fileHash);

      const thumbTargetFolder = path.join(this.baseUploadPath, this.THUMB_PATH, shardPath);
      const uploadTargetFolder = path.join(this.baseUploadPath, this.IMAGES_PATH, shardPath);

      const thumbFilePath = path.join(thumbTargetFolder, `${fileHash}_thumb.webp`);
      const mainFilePath = path.join(uploadTargetFolder, `${fileHash}.webp`);

      // 3. Ensure directory structure exists (Parallelized)
      await Promise.all([
        fs.mkdir(thumbTargetFolder, { recursive: true }),
        fs.mkdir(uploadTargetFolder, { recursive: true })
      ]);

      // 4. Image processing (Parallelized for performance optimization)
      // Sharp handles multiple threads internally, making this highly efficient
      await Promise.all([
        sharp(imageBuffer)
          .resize(this.thumbWidth)
          .webp({ quality: 65 })
          .toFile(thumbFilePath),

        sharp(imageBuffer)
          .resize({ width: this.imageWidth, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(mainFilePath)
      ]);

      /**
       * 5. TODO: Queue heavy tasks for background worker (AI Inference + Final Optimization)
       * This stage will be implemented in a future phase.
       * * await this.imageQueue.add('process-background-removal', {
       * imageId: newImage.id,
       * buffer: file.buffer,
       * fileHash: fileHash
       * });
       */

      return {
        fileHash,
        thumbFilePath,
        mainFilePath
      };

    } catch (error) {
      console.error('Image Processing Error:', error);
      throw new InternalServerErrorException('Failed to process or store the physical image');
    }
  }

  private generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private getShardedPath(identifier: string): string {
    let shardedPath = '';
    for (let i = 0; i < this.directoryLevels; i++) {
      shardedPath = path.join(shardedPath, identifier.substring(i * 2, (i * 2) + 2));
    }
    return shardedPath;
  }

  /**
   * Orchestrates the creation of a new image record
   */
  async saveFile(file: Express.Multer.File): Promise<Image> {
    // 1. Process and store new physical files
    const { fileHash, thumbFilePath, mainFilePath } = await this.processImage(file);

    // 2. Database persistence
    const [newImage] = await this.db.insert(schema.images).values({
      id: uuidv7(),
      hash: fileHash,
      thumbPath: thumbFilePath,
      storagePath: mainFilePath,
      status: 'processing',
    }).returning();

    return newImage;
  }

  /**
   * Orchestrates the replacement of an existing image's content
   */
  async updateFile(imageId: string, file: Express.Multer.File): Promise<Image> {
    // 1. Verify existence before consuming resources
    const oldImage = await this.db.query.images.findFirst({
      where: eq(schema.images.id, imageId),
    });

    if (!oldImage) {
      throw new NotFoundException(`Image record ${imageId} not found`);
    }

    // 2. Process and store new physical files
    const { fileHash, thumbFilePath, mainFilePath } = await this.processImage(file);

    // 3. Update existing database record
    const [updated] = await this.db
      .update(schema.images)
      .set({
        hash: fileHash,
        thumbPath: thumbFilePath,
        storagePath: mainFilePath,
        status: 'processing',
      })
      .where(eq(schema.images.id, imageId))
      .returning();

    // 4. Physical cleanup of old files (Asynchronous)
    try {
      await Promise.all([
        oldImage.thumbPath ? fs.rm(oldImage.thumbPath, { force: true }) : null,
        oldImage.storagePath ? fs.rm(oldImage.storagePath, { force: true }) : null,
      ]);
    } catch (error) {
      console.error(`Post-update cleanup failed for ${imageId}:`, error);
    }

    return updated;
  }

  /**
   * Removes image record and triggers physical file deletion
   */
  async removeFile(id: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(schema.images)
      .where(eq(schema.images.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    try {
      await Promise.all([
        deleted.thumbPath ? fs.rm(deleted.thumbPath, { force: true }) : Promise.resolve(),
        deleted.storagePath ? fs.rm(deleted.storagePath, { force: true }) : Promise.resolve()
      ]);
    } catch (error) {
      console.error(`Cleanup failed for image ${id}:`, error);
    }

    return true;
  }
}