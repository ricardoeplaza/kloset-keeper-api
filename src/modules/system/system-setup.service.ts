import { Injectable, Logger } from '@nestjs/common';

import { WEAR_CATEGORIES } from '../../common/constants/categories-map.constants';
import { SystemCategoriesService } from './system-categories.service';
import { SystemRepository } from './repositories/system.repository';

/**
 * Handles the initial system setup and data synchronization on application startup.
 */
@Injectable()
export class SystemSetupService {
  private readonly logger = new Logger(SystemSetupService.name);

  constructor(
    private readonly systemRepository: SystemRepository,
    private readonly categoriesService: SystemCategoriesService,
  ) { }

  /**
   * Iterates through defined category constants and ensures they are persisted
   * in the database with their respective AI-generated embeddings.
   */
  async initializeCategories() {
    const initializedCategories: unknown[] = [];

    for (const category of WEAR_CATEGORIES) {
      const existing = await this.systemRepository.findCategoryByName(category.name);

      if (!existing || !existing.embedding) {
        try {
          this.logger.log(`Generating embedding for category: ${category.name}`);

          const vector = await this.categoriesService.generateTextEmbedding(category.prompt);

          const result = await this.systemRepository.createCategory({
            name: category.name,
            prompt: category.prompt,
            embedding: vector,
          });

          initializedCategories.push(result);

        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to initialize category [${category.name}]:`, message);
        }
      }
    }

    this.logger.log('Category synchronization sequence completed.');
    return initializedCategories;
  }
}
