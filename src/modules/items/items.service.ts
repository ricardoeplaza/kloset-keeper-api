import { Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

import { RequestContext } from 'src/infra/context/request-context';
import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { FlowProducer, Queue } from 'bullmq';
import { ItemJobsFactory } from './jobs/item-jobs.factory';
import { ImagesStorageService } from '../images/images-storage.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemsRepository } from './repositories/items.repository';

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    @InjectFlowProducer('item-processing-flow') private readonly itemProcessingFlowProducer: FlowProducer,
    @InjectQueue('generate-embedding') private readonly embeddingQueue: Queue,
    private readonly imageStorageService: ImagesStorageService,
    private readonly itemsRepository: ItemsRepository,
  ) {  }

  async create(createItemDto: CreateItemDto, file: Express.Multer.File) {
    const userId = RequestContext.getRequiredUserId();

    const itemImage = await this.imageStorageService.saveFile(file);

    try {
      const insertData = {
        ...createItemDto,
        id: uuidv7(),
        imageId: itemImage.id,
        ownerId: userId,
      };

      const [newItem] = await this._db.transaction(async (tx) => {
        return await tx
          .insert(schema.items)
          .values(insertData)
          .returning();
      });

      await this.itemProcessingFlowProducer.add({
        ...ItemJobsFactory.generateEmbedding(newItem.id, newItem.name, newItem.notes, newItem.category, itemImage.storagePath),
        children: [
          {
            ...ItemJobsFactory.extractColors(newItem.id, itemImage.storagePath, itemImage.thumbPath),
            children: [
              {
                ...ItemJobsFactory.removeBackground(itemImage.id, itemImage.storagePath, itemImage.thumbPath),
              }
            ]
          }
        ]
      });

      return newItem;

    } catch (error: unknown) {
      await this.imageStorageService.removeFile(itemImage.id);

      this.logger.error('Item Registration Error:', error);
      throw new InternalServerErrorException('Failed to register item, operation rolled back.');
    }
  }

  async createBulk(files: Express.Multer.File[]) {
    const userId = RequestContext.getRequiredUserId();
    const batchId = uuidv7();

    const results = {
      batchId,
      total: files.length,
      successful: 0,
      failed: 0,
      itemIds: [] as string[],
    };

    for (const file of files) {
      let itemImage;
      try {
        itemImage = await this.imageStorageService.saveFile(file);

        const insertData = {
          id: uuidv7(),
          imageId: itemImage.id,
          ownerId: userId,
        };

        const [newItem] = await this._db.transaction(async (tx) => {
          return await tx
            .insert(schema.items)
            .values(insertData)
            .returning();
        });

        await this.itemProcessingFlowProducer.add({
          ...ItemJobsFactory.generateEmbedding(newItem.id, newItem.name, newItem.notes, newItem.category, itemImage.storagePath),
          children: [
            {
              ...ItemJobsFactory.extractColors(newItem.id, itemImage.storagePath, itemImage.thumbPath),
              children: [
                {
                  ...ItemJobsFactory.removeBackground(itemImage.id, itemImage.storagePath, itemImage.thumbPath),
                }
              ]
            }
          ]
        });

        results.successful++;
        results.itemIds.push(newItem.id);

      } catch (error: unknown) {
        if (itemImage) {
          await this.imageStorageService.removeFile(itemImage.id);
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[Bulk Error] Failed to process file ${file.originalname}: ${message}`);
        results.failed++;
      }
    }

    return results;
  }

  async findAll() {
    const userId = RequestContext.getRequiredUserId();
    if (!userId) throw new UnauthorizedException();

    return this.itemsRepository.findAllByOwner(userId);
  }

  async findOne(id: string) {
    const userId = RequestContext.getRequiredUserId();

    const result = await this.itemsRepository.findByIdWithOwner(id, userId);

    if (!result) throw new NotFoundException(`Item with id ${id} not found`);
    return result;
  }

  async update(itemId: string, updateItemDto: UpdateItemDto, file?: Express.Multer.File) {
    const userId = RequestContext.getRequiredUserId();

    const currentItem = await this.itemsRepository.findByIdWithOwner(itemId, userId);

    if (!currentItem) throw new NotFoundException(`Item with id ${itemId} not found`);

    const aiRelevantFields = ['name', 'notes', 'category'] as const;
    const hasAiRelevantChanges = aiRelevantFields.some(
      field => updateItemDto[field] !== undefined && updateItemDto[field] !== currentItem[field]
    );
    const shouldTriggerAi = file || hasAiRelevantChanges;

    const updatePayload: Partial<typeof schema.items.$inferInsert> = {
      ...updateItemDto,
      updatedAt: new Date(),
    };

    if (shouldTriggerAi) {
      updatePayload.embeddingstatus = 'pending';
    }

    const [updatedItem] = await this.itemsRepository.update(itemId, updatePayload);

    if (shouldTriggerAi) {
      if (file) {
        const newImageData = await this.imageStorageService.updateFile(updatedItem.imageId, file);
        const jobIdSuffix = Date.now().toString();

        await this.itemProcessingFlowProducer.add({
          ...ItemJobsFactory.generateEmbedding(updatedItem.id, updatedItem.name, updatedItem.notes, updatedItem.category, newImageData.storagePath, jobIdSuffix),
          children: [
            {
              ...ItemJobsFactory.extractColors(updatedItem.id, newImageData.storagePath, newImageData.thumbPath, jobIdSuffix),
              children: [
                {
                  ...ItemJobsFactory.removeBackground(newImageData.id, newImageData.storagePath, newImageData.thumbPath, jobIdSuffix),
                }
              ]
            }
          ]
        });
      } else {
        const currentImage = await this._db.query.images.findFirst({
          where: eq(schema.images.id, updatedItem.imageId),
        });

        if (currentImage) {
          const jobDef = ItemJobsFactory.generateEmbedding(
            itemId,
            updatedItem.name,
            updatedItem.notes,
            updatedItem.category,
            currentImage.storagePath,
            Date.now().toString()
          );

          await this.embeddingQueue.add(jobDef.name, jobDef.data, jobDef.opts);
        }
      }
    }

    return updatedItem;
  }

  async remove(itemId: string) {
    const userId = RequestContext.getRequiredUserId();
    const item = await this.itemsRepository.findByIdWithOwner(itemId, userId);

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    const removeResult = await this.imageStorageService.removeFile(item.imageId);

    if (removeResult) {
      return { deleted: true };
    }

    throw new InternalServerErrorException(`Could not remove item ${itemId}`);
  }
}
