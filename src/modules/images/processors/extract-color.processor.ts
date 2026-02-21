import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { readFile } from 'fs/promises';
import { ImagesColorsService } from '../images-colors.service';

import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

/**
 * Data structure for the color extraction job.
 */
export interface ExtractColorsJobData {
    itemId: string;
    mainFilePath: string;
}

/**
 * BullMQ Processor responsible for background color extraction tasks.
 */
@Processor('extract-colors')
@Injectable()
export class ImagesColorsProcessor extends WorkerHost {
    private readonly logger = new Logger(ImagesColorsProcessor.name);

    constructor(
        @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
        private readonly colorExtractionService: ImagesColorsService
    ) {
        super();
    }

    /**
     * Orchestrates the image color extraction process.
     * @param job - The BullMQ job containing file path and item identification.
     */
    async process(job: Job<ExtractColorsJobData>) {
        const { itemId, mainFilePath } = job.data;

        this.logger.log(`🎨 Processing colors for Item ID: ${itemId} (Job: ${job.id})`);

        try {
            // 1. Read file from disk.
            const imageBuffer = await readFile(mainFilePath);

            // 2. Execute business logic (K-Means & Semantic Mapping).
            const colorsPalette = await this.colorExtractionService.extractColors(imageBuffer);

            // 3. Log results (Database update is typically handled by the calling service via job completion).
            this.logger.debug(`Color analysis for ${itemId}: ${JSON.stringify(colorsPalette)}`);
            this.logger.log(`✅ Color processing completed for Item ID: ${itemId}`);

            await this._db
                .update(schema.items)
                .set({
                    color_palette: colorsPalette,
                    updatedAt: new Date()
                })
                .where(eq(schema.items.id, itemId));

            return colorsPalette;

        } catch (error) {
            this.logger.error(`Failed to process colors for Item ${itemId}`, error.stack);
            // Re-throwing ensures BullMQ's retry mechanism is triggered.
            throw error;
        }
    }
}