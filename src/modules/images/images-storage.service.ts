import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { uuidv7 } from 'uuidv7';

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as schema from 'src/db/schema';

import { InferSelectModel } from 'drizzle-orm';
import { createReadStream } from 'fs';
import { RequestContext } from 'src/infra/context/request-context';
import { ImagesRepository } from './repositories/images.repository';

export type Image = InferSelectModel<typeof schema.images>;

@Injectable()
export class ImagesStorageService {
  private readonly logger = new Logger(ImagesStorageService.name);
  private readonly THUMB_PATH: string = 'thumbnails';
  private readonly IMAGES_PATH: string = 'images';

  private readonly baseUploadPath: string;
  private readonly directoryLevels: number;
  private readonly mainWidth: number;
  private readonly thumbWidth: number;

  constructor(
    private readonly imagesRepository: ImagesRepository,
    private configService: ConfigService
  ) {
    this.baseUploadPath = this.configService.get<string>('UPLOAD_LOCATION', './media');
    this.directoryLevels = this.configService.get<number>('UPLOAD_DIRECTORY_LEVELS', 2);
    this.mainWidth = this.configService.get<number>('IMAGE_WIDTH', 1920);
    this.thumbWidth = this.configService.get<number>('THUMB_WIDTH', 300);
  }

  /**
   * Internal logic to handle file validation, hashing, and physical storage
   */
  private async processImage(imageId: string, file: Express.Multer.File) {
    const userId = RequestContext.getRequiredUserId();
    const imageBuffer = file.buffer;

    const type = await fileTypeFromBuffer(imageBuffer);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!type || !allowedMimeTypes.includes(type.mime)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG and WebP are allowed.');
    }

    try {
      const fileHash = this.generateFileHash(imageBuffer);

      const existingImage = await this.imagesRepository.findByHash(fileHash);

      if (existingImage) {
        throw new ConflictException('This image has already been uploaded.');
      }

      const shardPath = this.getShardedPath(fileHash);

      const thumbTargetFolder = path.join(this.baseUploadPath, userId, this.THUMB_PATH, shardPath);
      const uploadTargetFolder = path.join(this.baseUploadPath, userId, this.IMAGES_PATH, shardPath);

      const thumbFilePath = path.join(thumbTargetFolder, `${fileHash}_thumb.webp`);
      const mainFilePath = path.join(uploadTargetFolder, `${fileHash}.webp`);

      await Promise.all([
        fs.mkdir(thumbTargetFolder, { recursive: true }),
        fs.mkdir(uploadTargetFolder, { recursive: true })
      ]);

      await Promise.all([
        sharp(imageBuffer)
          .resize(this.thumbWidth)
          .webp({ quality: 65 })
          .toFile(thumbFilePath),

        sharp(imageBuffer)
          .resize({ width: this.mainWidth, withoutEnlargement: true })
          .webp({ quality: 95, lossless: false })
          .toFile(mainFilePath)
      ]);

      return {
        fileHash,
        thumbFilePath,
        mainFilePath,
      };

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error, 'Image Processing Error');
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
    const userId = RequestContext.getRequiredUserId();
    const uuidImage = uuidv7();
    const { fileHash, thumbFilePath, mainFilePath } = await this.processImage(uuidImage, file);

    const [newImage] = await this.imagesRepository.create({
      id: uuidImage,
      hash: fileHash,
      thumbPath: thumbFilePath,
      storagePath: mainFilePath,
      status: 'pending',
      ownerId: userId
    });

    return newImage;
  }

  /**
   * Orchestrates the replacement of an existing image's content
   */
  async updateFile(imageId: string, file: Express.Multer.File): Promise<Image> {
    const oldImage = await this.imagesRepository.findById(imageId);

    if (!oldImage) {
      throw new NotFoundException(`Image record ${imageId} not found`);
    }

    const { fileHash, thumbFilePath, mainFilePath } = await this.processImage(oldImage.id, file);

    const [updated] = await this.imagesRepository.update(imageId, {
      hash: fileHash,
      thumbPath: thumbFilePath,
      storagePath: mainFilePath,
      status: 'pending',
    });

    try {
      await Promise.all([
        oldImage.thumbPath ? fs.rm(oldImage.thumbPath, { force: true }) : null,
        oldImage.storagePath ? fs.rm(oldImage.storagePath, { force: true }) : null,
      ]);
    } catch (error: unknown) {
      this.logger.error(`Post-update cleanup failed for ${imageId}:`, error);
    }

    return updated;
  }

  /**
   * Removes image record and triggers physical file deletion
   */
  async removeFile(id: string): Promise<boolean> {
    const [deleted] = await this.imagesRepository.delete(id);

    if (!deleted) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    try {
      await Promise.all([
        deleted.thumbPath ? fs.rm(deleted.thumbPath, { force: true }) : Promise.resolve(),
        deleted.storagePath ? fs.rm(deleted.storagePath, { force: true }) : Promise.resolve()
      ]);
    } catch (error: unknown) {
      this.logger.error(`Cleanup failed for image ${id}:`, error);
    }

    return true;
  }

  async getImage(id: string) {
    try {
      const userId = RequestContext.getRequiredUserId();
      const existingImage = await this.imagesRepository.findById(id);

      if (!existingImage || existingImage.ownerId !== userId) {
        throw new NotFoundException('Image not found');
      }

      try {
        await fs.access(existingImage.storagePath);
      } catch {
        throw new NotFoundException('Physical file not found');
      }

      const fileStream = createReadStream(existingImage.storagePath);

      return new StreamableFile(fileStream, {
        type: 'image/webp',
        disposition: 'inline',
        length: await this.getFileSize(existingImage.storagePath),
      });

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error serving image:', error);
      throw new InternalServerErrorException('Error serving image');
    }
  }

  async getImageThumb(id: string) {
    try {
      const userId = RequestContext.getRequiredUserId();
      const existingImage = await this.imagesRepository.findById(id);

      if (!existingImage || existingImage.ownerId !== userId) {
        throw new NotFoundException('Image not found');
      }

      try {
        await fs.access(existingImage.thumbPath);
      } catch {
        throw new NotFoundException('Physical file not found');
      }

      const fileStream = createReadStream(existingImage.thumbPath);

      return new StreamableFile(fileStream, {
        type: 'image/webp',
        disposition: 'inline',
        length: await this.getFileSize(existingImage.thumbPath),
      });

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error serving thumbnail:', error);
      throw new InternalServerErrorException('Error serving thumbnail');
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stat = await fs.stat(filePath);
    return stat.size;
  }
}
