import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

import { WEAR_CATEGORIES } from '../../common/constants/categories-map.constants';
import { SystemCategoriesService } from './system-categories.service';

/**
 * Handles the initial system setup and data synchronization on application startup.
 */
@Injectable()
export class SystemSetupService {
  private readonly logger = new Logger(SystemSetupService.name);

  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    private readonly categoriesService: SystemCategoriesService,
  ) { }

  /**
   * Iterates through defined category constants and ensures they are persisted 
   * in the database with their respective AI-generated embeddings.
   */
  async initializeCategories() {
    for (const category of WEAR_CATEGORIES) {
      // 1. Check if the category already exists in the database
      const existing = await this._db.query.categories.findFirst({
        where: eq(schema.categories.name, category.name),
      });

      // 2. If it's a new category or missing its embedding, process it
      if (!existing || !existing.embedding) {
        try {
          this.logger.log(`Generating embedding for category: ${category.name}`);

          // Fetch the vector from the local AI Worker
          const vector = await this.categoriesService.generateTextEmbedding(category.prompt);

          // 3. Upsert the category record to maintain consistency
          const categories = await this._db.insert(schema.categories)
            .values({
              name: category.name,
              prompt: category.prompt,
              embedding: vector,
            });

          return categories;

        } catch (error) {
          this.logger.error(`Failed to initialize category [${category.name}]:`, error.message);
        }
      }
    }
    this.logger.log('Category synchronization sequence completed.');
  }

}