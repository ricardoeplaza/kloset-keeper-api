import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { createReadStream } from 'node:fs';

import axios from 'axios';
import FormData from 'form-data';

interface EmbeddingJob {
  itemId: string;
  name: string;
  notes: string;
  mainFilePath: string;
}

@Processor('item-embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async process(job: Job<EmbeddingJob>): Promise<any> {
    const { itemId, name, notes, mainFilePath } = job.data;

    this.logger.log(`Starting Feature Extraction (Embedding) for Item: ${itemId}`);

    try {
      // 1. Prepare Form Data for AI Service
      const form = new FormData();
      form.append('file', createReadStream(mainFilePath));

      // 2. Logic to compose a clean description.
      const descriptionParts = [name, notes].filter(part => part && part !== 'null' && part.trim() !== '');

      if (descriptionParts.length > 0) {
        const cleanDescription = descriptionParts.join(' ').trim();
        form.append('description', cleanDescription);

        this.logger.debug(`Sending description to AI: "${cleanDescription}"`);
      }

      // 3. Request to AI Service (FastAPI)
      const response = await axios.post(`${this.configService.get<string>('IA_WORKER_BASE_URL')}/generate-embedding`, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
      },
      );

      // 3. Extract vector from response
      const { embedding, model, refined_by_text } = response.data;

      this.logger.log(`Embedding generated and saved for Item: ${itemId}`);

      return { status: 'done', itemId, embedding, model, refined_by_text };

    } catch (error) {
      this.handleError(error, itemId);
      throw error;
    }
  }

  /**
   * Centralized error handling for the embedding worker
   */
  private handleError(error: any, itemId: string): void {
    if (error.response) {
      const detail = error.response.data?.toString() || 'Unknown error';
      this.logger.error(`AI Embedding Service Error [${itemId}] - Status: ${error.response.status} - Detail: ${detail}`);
    } else if (error.request) {
      this.logger.error(`Network Error [${itemId}] - AI service unreachable at ${this.configService.get<string>('IA_WORKER_BASE_URL')}`);
    } else {
      this.logger.error(`Worker Internal Error [${itemId}] - ${error.message}`);
    }
  }
}