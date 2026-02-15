import { Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';
import * as schema from 'src/db/schema';

import { RequestContext } from 'src/infra/context/request-context';
import { InjectFlowProducer, InjectQueue, OnQueueEvent, QueueEventsHost, QueueEventsListener } from '@nestjs/bullmq';
import { FlowProducer, Queue } from 'bullmq';
import { ItemJobsFactory } from './jobs/item-jobs.factory';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ImageStorageService } from './image-storage.service';

@Injectable()
@QueueEventsListener('item-embedding')
export class ItemsService extends QueueEventsHost {
  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    @InjectFlowProducer('item-processing') private readonly itemProcessingProducer: FlowProducer,
    @InjectQueue('item-embedding') private readonly embeddingQueue: Queue,
    private readonly imageStorageService: ImageStorageService,
  ) { super() }

  /**
   * Creates a new item and its associated image record
   */
  async create(createItemDto: CreateItemDto, file: Express.Multer.File) {
    const userId = RequestContext.getRequiredUserId();

    // 1. Process and save the physical image first
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

      // 4. Trigger embedding generation
      await this.itemProcessingProducer.add({
        ...ItemJobsFactory.generateEmbedding(newItem.id, newItem.name, newItem.notes, itemImage.storagePath),
        children: [
          ItemJobsFactory.removeBackground(itemImage.id, itemImage.storagePath, itemImage.thumbPath),
        ],
      });

      return newItem;

    } catch (error) {
      // Error recovery: Delete the orphaned image if DB insertion fails
      await this.imageStorageService.removeFile(itemImage.id);

      console.error('Item Registration Error:', error);
      throw new InternalServerErrorException('Failed to register item, operation rolled back.');
    }
  }

  async findAll() {
    const userId = RequestContext.getRequiredUserId();
    if (!userId) throw new UnauthorizedException();
    return await this._db.select().from(schema.items).where(eq(schema.items.ownerId, userId));
  }

  async findOne(id: string) {
    const userId = RequestContext.getRequiredUserId();

    const item = await this._db.query.items.findFirst({
      where: and(
        eq(schema.items.id, id),
        eq(schema.items.ownerId, userId)
      )
    });

    if (!item) throw new NotFoundException(`Item with id ${id} not found`);
    return item;
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
      // HEAVY SCENARIO: New image provided. Trigger full pipeline (Remove BG -> Embedding)
      const newImageData = await this.imageStorageService.updateFile(updatedItem.imageId, file);

      await this.itemProcessingProducer.add({
        ...ItemJobsFactory.generateEmbedding(itemId, updatedItem.name, updatedItem.notes, newImageData.storagePath),
        children: [
          ItemJobsFactory.removeBackground(updatedItem.imageId, newImageData.storagePath, newImageData.thumbPath),
        ],
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

  @OnQueueEvent('completed')
  async onEmbeddingCompleted(job) {

    const { itemId, embedding, model, refined_by_text } = job.returnvalue;
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

    console.log(`IA Job ${job.jobId} finished.`);
  }

  @OnQueueEvent('failed')
  async onEmbeddingFailed({ jobId, failedReason }: { jobId: string; failedReason: any }) {
    // 1. Get the full job object using the jobId
    const job = await this.embeddingQueue.getJob(jobId);

    if (job) {
      // 2. Access the original data we sent at the beginning
      const { itemId } = job.data;

      await this._db
        .update(schema.items)
        .set({ embeddingstatus: 'failed', })
        .where(eq(schema.items.id, itemId));
    }
  }
}