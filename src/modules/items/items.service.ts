import { Inject, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';

import { RequestContext } from 'src/infra/context/request-context';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ImageStorageService } from './image-storage.service';
import * as schema from './schemas/items.schema';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DRIZZLE) private _db: NodePgDatabase<typeof schema>,
    private readonly imageStorageService: ImageStorageService
  ) { }

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
    // 1. Handle image replacement if a new file is provided
    if (file) {
      const item = await this._db.query.items.findFirst({
        where: and(
          eq(schema.items.id, itemId),
          eq(schema.items.ownerId, userId)
        )
      });

      if (!item) throw new NotFoundException(`Item with id ${itemId} not found`);

      // If the item has an associated image record, update it
      if (file) {
       await this.imageStorageService.updateFile(item.imageId, file);
      }
    }

    // 2. Update item textual data
    const [updatedItem] = await this._db
      .update(schema.items)
      .set({
        ...updateItemDto,
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