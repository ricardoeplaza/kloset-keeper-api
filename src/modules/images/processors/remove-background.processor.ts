import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createReadStream } from 'node:fs';
import { ConfigService } from '@nestjs/config';

import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';

import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

interface ImageProcessJob {
  imageId: string;
  mainFilePath: string;
  thumbFilePath: string;
  thumbWidth: number;
}

@Processor('remove-background')
export class ImageProcessor extends WorkerHost {
  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService) { super(); }

  private readonly logger = new Logger(ImageProcessor.name);

  async process(job: Job<ImageProcessJob>): Promise<{ status: string; imageId: string }> {
    const { imageId, mainFilePath, thumbFilePath } = job.data;

    this.logger.log(`Starting IA Background Removal for Image: ${imageId}`);

    try {
      const form = new FormData();
      form.append('file', createReadStream(mainFilePath));

      const response = await axios.post(`${this.configService.get<string>('IA_WORKER_BASE_URL')}/remove-background`, form, {
        headers: {
          ...form.getHeaders(),
        },
        responseType: 'arraybuffer',
        maxBodyLength: Infinity,
      });

      const noBgBuffer = Buffer.from(response.data);

      await Promise.all([
        sharp(noBgBuffer)
          .webp({ quality: 80 })
          .toFile(mainFilePath),

        sharp(noBgBuffer)
          .resize(this.configService.get<number>('THUMB_WIDTH'))
          .webp({ quality: 65 })
          .toFile(thumbFilePath),
      ]);

      await this.db
        .update(schema.images)
        .set({ status: 'ready' })
        .where(eq(schema.images.id, imageId));

      this.logger.log(`Image ${imageId} processed and saved successfully`);

      return { status: 'done', imageId };

    } catch (error: unknown) {
      await this.handleError(error, imageId);
      throw error;
    }
  }

  private async handleError(error: unknown, imageId: string): Promise<void> {
    await this.db
      .update(schema.images)
      .set({ status: 'failed' })
      .where(eq(schema.images.id, imageId));

    if (error instanceof Error) {
      const axiosError = error as any;
      if (axiosError.response) {
        const detail = axiosError.response.data?.toString() || 'Unknown error';
        this.logger.error(`AI Service Error [${imageId}] - Status: ${axiosError.response.status} - Detail: ${detail}`);
      } else if (axiosError.request) {
        this.logger.error(`Network Error [${imageId}] - AI service unreachable at ${this.configService.get<string>('IA_WORKER_BASE_URL')}`);
      } else {
        this.logger.error(`Worker Internal Error [${imageId}] - ${error.message}`);
      }
    } else {
      this.logger.error(`Worker Internal Error [${imageId}] - Unknown error`);
    }
  }
}
