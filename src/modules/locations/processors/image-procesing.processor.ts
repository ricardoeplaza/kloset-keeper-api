import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createReadStream } from 'node:fs';
import { ConfigService } from '@nestjs/config';

import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';

interface ImageProcessJob {
  imageId: string;
  mainFilePath: string;
  thumbFilePath: string;
  thumbWidth: number;
}

@Processor('image-processing')
export class ImageProcessor extends WorkerHost {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  private readonly logger = new Logger(ImageProcessor.name);

  async process(job: Job<ImageProcessJob>): Promise<any> {
    const { imageId, mainFilePath, thumbFilePath, thumbWidth } = job.data;

    this.logger.log(`Starting IA Background Removal for Image: ${imageId}`);

    try {
      // 1. Prepare Form Data for AI Service (FastAPI)
      const form = new FormData();
      form.append('file', createReadStream(mainFilePath));

      // 2. Request to local AI Service
      const response = await axios.post(`${this.configService.get<string>('IA_WORKER_BASE_URL')}/remove-background`, form, {
        headers: {
          ...form.getHeaders(),
        },
        responseType: 'arraybuffer',
        maxBodyLength: Infinity,
      });

      const noBgBuffer = Buffer.from(response.data);

      // 3. Parallel processing with Sharp
      // We overwrite existing files with the processed versions (without background)
      await Promise.all([
        // Main Image: High quality/Lossless to preserve clothing details
        sharp(noBgBuffer)
          .webp({ quality: 80 }) // Near-lossless for maximum detail
          .toFile(mainFilePath),

        // Thumbnail: Lower quality for fast gallery loading
        sharp(noBgBuffer)
          .resize(thumbWidth)
          .webp({ quality: 65 })
          .toFile(thumbFilePath),
      ]);

      this.logger.log(`Image ${imageId} processed and saved successfully`);

      return { status: 'done', imageId };

    } catch (error) {
      this.handleError(error, imageId);
      throw error;
    }
  }

  /**
   * Centralized error handling for the worker
   */
  private handleError(error: any, imageId: string): void {
    if (error.response) {
      const detail = error.response.data.toString();
      this.logger.error(`AI Service Error [${imageId}] - Status: ${error.response.status} - Detail: ${detail}`);
    } else if (error.request) {
      this.logger.error(`Network Error [${imageId}] - AI service unreachable at ${this.configService.get<string>('IA_WORKER_BASE_URL')}`);
    } else {
      this.logger.error(`Worker Internal Error [${imageId}] - ${error.message}`);
    }
  }
}