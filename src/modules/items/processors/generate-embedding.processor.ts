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
import { ItemProcessingGateway, ItemProcessedEvent } from '../gateways/item-processing.gateway';

interface EmbeddingJob {
  itemId: string;
  name: string;
  notes: string;
  category: string;
  mainFilePath: string;
}

interface ColorPaletteItem {
  group: string;
  hex: string;
  percentage: number;
}

@Processor('generate-embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
    private readonly itemGateway: ItemProcessingGateway,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJob>): Promise<{ status: string; itemId: string; category?: string }> {
    const { itemId, name, notes, category, mainFilePath } = job.data;

    this.logger.log(`Starting Feature Extraction (Embedding) for Item: ${itemId}`);

    const itemRecord = await this._db.query.items.findFirst({
      where: eq(schema.items.id, itemId),
      columns: { ownerId: true },
    });
    const ownerId = itemRecord?.ownerId;

    try {
      const childrenValues = await job.getChildrenValues();
      const colorsPalette = Object.values(childrenValues).find((val): val is ColorPaletteItem[] => Array.isArray(val)) || [];
      const colors = colorsPalette.map(c => c.group).filter(Boolean).join(', ');

      const descriptionParts = [category, colors, notes].filter(
        (part): part is string => typeof part === 'string' && part.toLowerCase() !== 'null' && part.trim() !== ''
      );
      const cleanDescription = descriptionParts.length > 0 ? descriptionParts.join(' ').trim() : null;

      const form = new FormData();
      form.append('file', createReadStream(mainFilePath));

      if (cleanDescription) {
        form.append('description', cleanDescription);
        this.logger.debug(`[AI Context] Refinement Text: "${cleanDescription}"`);
      }

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

      const finalName = name ? name : this.getTemplateName(categoryMatch, colorsPalette);
      const finalCategory = category ? category : categoryMatch;

      await this._db
        .update(schema.items)
        .set({
          name: finalName,
          category: finalCategory,
          embedding: embedding,
          embeddingModel: model,
          embeddingstatus: 'ready',
          updatedAt: new Date()
        })
        .where(eq(schema.items.id, itemId));

      this.logger.log(`[Success] Processed Item: ${itemId}`);

      if (ownerId) {
        const eventData: ItemProcessedEvent = {
          itemId,
          status: 'ready',
          name: finalName,
          category: finalCategory,
          color_palette: colorsPalette,
          embeddingModel: model,
        };
        this.itemGateway.emitToUser(ownerId, 'item:processed', eventData);
      }

      return { status: 'done', itemId, category: finalCategory };

    } catch (error: unknown) {
      await this.handleError(error, itemId);
      
      if (ownerId) {
        this.itemGateway.emitToUser(ownerId, 'item:processed', {
          itemId,
          status: 'failed',
        });
      }

      throw error;
    }
  }

  private getTemplateName(category: string, colorsPalette: ColorPaletteItem[]) {
    const firstColor = colorsPalette[0]?.group?.toLowerCase() || 'unknown';
    return `auto:${category}:${firstColor}`;
  }

  private async handleError(error: unknown, itemId: string): Promise<void> {
    await this._db
      .update(schema.items)
      .set({ embeddingstatus: 'failed' })
      .where(eq(schema.items.id, itemId));

    if (error instanceof Error) {
      const axiosError = error as any;
      if (axiosError.response) {
        const detail = axiosError.response.data?.toString() || 'Unknown error';
        this.logger.error(`AI Embedding Service Error [${itemId}] - Status: ${axiosError.response.status} - Detail: ${detail}`);
      } else if (axiosError.request) {
        this.logger.error(`Network Error [${itemId}] - AI service unreachable at ${this.configService.get<string>('IA_WORKER_BASE_URL')}`);
      } else {
        this.logger.error(`Worker Internal Error [${itemId}] - ${error.message}`);
      }
    } else {
      this.logger.error(`Worker Internal Error [${itemId}] - Unknown error`);
    }
  }
}
