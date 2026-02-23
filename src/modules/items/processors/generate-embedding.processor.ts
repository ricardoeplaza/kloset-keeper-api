import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';

import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

interface EmbeddingJob {
  itemId: string;
  name: string;
  notes: string;
  mainFilePath: string;
}

@Processor('generate-embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService) {
    super();
  }

  async process(job: Job<EmbeddingJob>): Promise<any> {
    const { itemId, name, notes, mainFilePath } = job.data;

    this.logger.log(`Starting Feature Extraction (Embedding) for Item: ${itemId}`);

    try {
      // 1. Prepare Metadata
      const childrenValues = await job.getChildrenValues();
      const colorsPalette = Object.values(childrenValues).find(val => Array.isArray(val)) as any[] || [];
      const colors = colorsPalette.map(c => c.group).filter(Boolean).join(', ');

      const descriptionParts = [name, colors, notes].filter(
        (part) => part && typeof part === 'string' && part.toLowerCase() !== 'null' && part.trim() !== ''
      );
      const cleanDescription = descriptionParts.length > 0 ? descriptionParts.join(' ').trim() : null;

      // 2. Prepare Form Data for AI Service
      const form = new FormData();
      form.append('file', createReadStream(mainFilePath));

      if (cleanDescription) {
        form.append('description', cleanDescription);
        this.logger.debug(`[AI Context] Description: "${cleanDescription}"`);
      }

      // 3. Request to AI Service (FastAPI)
      const { data } = await axios.post(`${this.configService.get<string>('IA_WORKER_BASE_URL')}/embeddings/image`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 10000,
      });

      // 4. Extract vector from response
      const { embedding, model, refined_by_text } = data;

      await this._db
        .update(schema.items)
        .set({
          embedding: embedding,
          embeddingModel: model,
          embeddingstatus: 'ready',
          isMultimodal: refined_by_text,
          updatedAt: new Date()
        })
        .where(eq(schema.items.id, itemId));


      this.logger.log(`[Success] Embedding generated for Item: ${itemId} (Text refined: ${data.refined_by_text})`);

      return { status: 'done', itemId, embedding, model, refined_by_text };

    } catch (error) {
      this.handleError(error, itemId);
      throw error;
    }
  }

  /**
   * Centralized error handling for the embedding worker
   */
  private async handleError(error: any, itemId: string): Promise<void> {

    await this._db
      .update(schema.items)
      .set({ embeddingstatus: 'failed', })
      .where(eq(schema.items.id, itemId));

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