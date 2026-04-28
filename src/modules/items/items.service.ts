import { Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { and, eq } from 'drizzle-orm';
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

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    @InjectFlowProducer('item-processing-flow') private readonly itemProcessingFlowProducer: FlowProducer,
    @InjectQueue('generate-embedding') private readonly embeddingQueue: Queue,
    private readonly imageStorageService: ImagesStorageService,
  ) {  }

  /**
   * Creates a new item and its associated image record
   */
  async create(createItemDto: CreateItemDto, file: Express.Multer.File) {
    const userId = RequestContext.getRequiredUserId();

    // 1. Save the physical image first
    const itemImage = await this.imageStorageService.saveFile(file);

    try {
      // 2. Prepare data for insertion (Explicit mapping)
      const insertData = {
        ...createItemDto,
        id: uuidv7(),
        imageId: itemImage.id,
        ownerId: userId,
      };

      // 3. Attempt to persist the item in Postgres
      const [newItem] = await this._db
        .insert(schema.items)
        .values(insertData)
        .returning();

      // 4. Trigger embedding generation (Remove BG -> Extact Colors -> Embedding)
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

    } catch (error) {
      // Error recovery: Delete the orphaned image if DB insertion fails
      await this.imageStorageService.removeFile(itemImage.id);

      console.error('Item Registration Error:', error);
      throw new InternalServerErrorException('Failed to register item, operation rolled back.');
    }
  }

  /**
   * Handles bulk upload of clothing items.
   * Creates database records and triggers the asynchronous AI processing pipeline.
   */
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
        // 1. Persist Image to Local Storage first
        itemImage = await this.imageStorageService.saveFile(file);

        // 2. Database Record Creation (Placeholder state)
        const insertData = {
          id: uuidv7(),
          imageId: itemImage.id,
          ownerId: userId,
        };

        // 3. Attempt to persist the item in Postgres
        const [newItem] = await this._db
          .insert(schema.items)
          .values(insertData)
          .returning();

        // 4. Dispatch to BullMQ Flow
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

      } catch (error) {
        if (itemImage) {
          await this.imageStorageService.removeFile(itemImage.id);
        }

        console.error(`[Bulk Error] Failed to process file ${file.originalname}: ${error.message}`);
        results.failed++;
      }
    }

    return results;
  }

  async findAll() {
    const userId = RequestContext.getRequiredUserId();
    if (!userId) throw new UnauthorizedException();

    return await this._db
      .select()
      .from(schema.items)
      .leftJoin(schema.images, eq(schema.items.imageId, schema.images.id))
      .where(eq(schema.items.ownerId, userId));
  }

  async findOne(id: string) {
    const userId = RequestContext.getRequiredUserId();

    const result = await this._db
      .select()
      .from(schema.items)
      .leftJoin(schema.images, eq(schema.items.imageId, schema.images.id))
      .where(
        and(
          eq(schema.items.id, id),
          eq(schema.items.ownerId, userId),
        ),
      );

    if (!result.length) throw new NotFoundException(`Item with id ${id} not found`);
    return result[0];
  }

  /**
   * Updates item metadata and optionally replaces the associated image
   */
  async update(itemId: string, updateItemDto: UpdateItemDto, file?: Express.Multer.File) {
    const userId = RequestContext.getRequiredUserId();

    // 1. Update textual data and retrieve the new state in a single query
    const [updatedItem] = await this._db
      .update(schema.items)
      .set({
        ...updateItemDto,
        embeddingstatus: 'pending',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.items.id, itemId),
          eq(schema.items.ownerId, userId)
        )
      )
      .returning();

    if (!updatedItem) throw new NotFoundException(`Item with id ${itemId} not found`);

    // 2. DECISION BRIDGE: Determine the processing heavy-lift based on the input
    if (file) {
      // HEAVY SCENARIO: New image provided. Trigger full pipeline (Remove BG -> Extact Colors -> Embedding)
      const newImageData = await this.imageStorageService.updateFile(updatedItem.imageId, file);

      await this.itemProcessingFlowProducer.add({
        ...ItemJobsFactory.generateEmbedding(updatedItem.id, updatedItem.name, updatedItem.notes, updatedItem.category, newImageData.storagePath),
        children: [
          {
            ...ItemJobsFactory.extractColors(updatedItem.id, newImageData.storagePath, newImageData.thumbPath),
            children: [
              {
                ...ItemJobsFactory.removeBackground(newImageData.id, newImageData.storagePath, newImageData.thumbPath),
              }
            ]
          }
        ]
      });
    } else {
      // LIGHT SCENARIO: Only text or metadata changed. Re-run embedding using the existing clean image
      const currentImage = await this._db.query.images.findFirst({
        where: eq(schema.images.id, updatedItem.imageId),
      });

      if (currentImage) {
        const jobDef = ItemJobsFactory.generateEmbedding(itemId, updatedItem.name, updatedItem.notes, currentImage.storagePath);

        // We add it directly to the queue as there are no children dependencies
        await this.embeddingQueue.add(jobDef.name, jobDef.data, jobDef.opts);
      }
    }

    return updatedItem;
  }

  /**
   * Removes an item by deleting its image. 
   * Database CASCADE should handle the item deletion.
   */
  async remove(itemId: string) {
    const userId = RequestContext.getRequiredUserId();
    // 1. Retrieve the item to get the image reference
    const item = await this._db.query.items.findFirst({
      where: and(
        eq(schema.items.id, itemId),
        eq(schema.items.ownerId, userId)
      )
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    // 2. Delegate removal to ImageStorageService. 
    // If your schema has ON DELETE CASCADE on the image reference, the item is removed automatically.
    const removeResult = await this.imageStorageService.removeFile(item.imageId);

    if (removeResult) {
      return { deleted: true };
    }

    throw new InternalServerErrorException(`Could not remove item ${itemId}`);
  }

}