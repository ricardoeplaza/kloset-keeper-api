import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';

import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

interface EmbeddingJob {
  itemId: string;
  name: string;
  notes: string;
  category: string;
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

  /**
   * Processes the embedding generation by fusing visual features with semantic metadata.
   * If category is missing, it performs a zero-shot classification 
   * using the pre-computed category vectors in the database.
   */
  async process(job: Job<EmbeddingJob>): Promise<any> {
    const { itemId, name, notes, category, mainFilePath } = job.data;

    this.logger.log(`Starting Feature Extraction (Embedding) for Item: ${itemId}`);

    try {
      // 1. Gather context from child jobs (e.g., color extraction)
      const childrenValues = await job.getChildrenValues();
      const colorsPalette = Object.values(childrenValues).find(val => Array.isArray(val)) as any[] || [];
      const colors = colorsPalette.map(c => c.group).filter(Boolean).join(', ');

      // 2. Build semantic description for multimodal refinement
      const descriptionParts = [category, colors, notes].filter(
        (part) => part && typeof part === 'string' && part.toLowerCase() !== 'null' && part.trim() !== ''
      );
      const cleanDescription = descriptionParts.length > 0 ? descriptionParts.join(' ').trim() : null;

      // 3. Prepare Multipart request for the FastAPI AI Worker
      const form = new FormData();
      form.append('file', createReadStream(mainFilePath));

      if (cleanDescription) {
        form.append('description', cleanDescription);
        this.logger.debug(`[AI Context] Refinement Text: "${cleanDescription}"`);
      }

      // 4. Execute remote inference
      const { data } = await axios.post(
        `${this.configService.get<string>('IA_WORKER_BASE_URL')}/embeddings/image`,
        form,
        {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          timeout: 10000,
        }
      );

      const { embedding, model } = data;
      let categoryMatch = '';

      // 5. Semantic Classification (Bulk Upload Logic)
      // If no category was provided, find the closest one in the vector space
      if (!category) {
        const [bestMatch] = await this._db
          .select({ name: schema.categories.name })
          .from(schema.categories)
          .orderBy(sql`${schema.categories.embedding} <=> ${JSON.stringify(embedding)}`)
          .limit(1);

        if (bestMatch) {
          categoryMatch = bestMatch.name;
          this.logger.debug(`[Auto-Tag] Nearest category found: ${categoryMatch}`);
        }
      }

      // 6. Persistence
      await this._db
        .update(schema.items)
        .set({
          // Fallback name logic: User Provided > AI Predicted + Colors
          name: name ? name : this.getTemplateName(categoryMatch, colorsPalette),
          category: category ? category : categoryMatch,
          embedding: embedding,
          embeddingModel: model,
          embeddingstatus: 'ready',
          updatedAt: new Date()
        })
        .where(eq(schema.items.id, itemId));

      this.logger.log(`[Success] Processed Item: ${itemId}`);

      return { status: 'done', itemId, category: category || categoryMatch };

    } catch (error) {
      this.handleError(error, itemId);
      throw error;
    }
  }

  private getTemplateName(category, colorsPalette) {
    const firstColor = colorsPalette[0].group.toLowerCase() || 'unknown';

    return `auto:${category}:${firstColor}`;
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