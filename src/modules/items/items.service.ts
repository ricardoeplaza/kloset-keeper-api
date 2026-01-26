import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';

import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from 'src/db/drizzle.module';

import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ImageStorageService } from './image-storage.service';
import * as schema from './schemas/items.schema';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    private readonly imageStorageService: ImageStorageService
  ) { }

  /**
   * Creates a new item and its associated image record
   */
  async create(createItemDto: CreateItemDto, file: Express.Multer.File) {
    // 1. Process and save the physical image first
    const itemImage = await this.imageStorageService.saveFile(file);

    try {
      // 2. Attempt to persist the item in Postgres
      const [newItem] = await this.db
        .insert(schema.items)
        .values({
          ...createItemDto,
          id: uuidv7(),
          image: itemImage.id
        })
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
    return await this.db.select().from(schema.items);
  }

  async findOne(id: string) {
    const item = await this.db.query.items.findFirst({
      where: eq(schema.items.id, id),
    });

    if (!item) throw new NotFoundException(`Item with id ${id} not found`);
    return item;
  }

  /**
   * Updates item metadata and optionally replaces the associated image
   */
  async update(id: string, updateItemDto: UpdateItemDto, file?: Express.Multer.File) {
    // 1. Handle image replacement if a new file is provided
    if (file) {
      const item = await this.db.query.items.findFirst({
        where: eq(schema.items.id, id),
      });

      if (!item) throw new NotFoundException(`Item with id ${id} not found`);

      // If the item has an associated image record, update it
      if (item.image) {
        await this.imageStorageService.updateFile(item.image, file);
      }
    }

    // 2. Update item textual data
    const [updatedItem] = await this.db
      .update(schema.items)
      .set({
        ...updateItemDto,
        updatedAt: new Date()
      })
      .where(eq(schema.items.id, id))
      .returning();

    if (!updatedItem) throw new NotFoundException(`Item with id ${id} not found`);

    return updatedItem;
  }

  /**
   * Removes an item by deleting its image. 
   * Database CASCADE should handle the item deletion.
   */
  async remove(id: string) {
    // 1. Retrieve the item to get the image reference
    const item = await this.db.query.items.findFirst({
      where: eq(schema.items.id, id),
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    // 2. Delegate removal to ImageStorageService. 
    // If your schema has ON DELETE CASCADE on the image reference, the item is removed automatically.
    const removeResult = await this.imageStorageService.removeFile(item.image);

    if (removeResult) {
      return { deleted: true };
    }

    throw new InternalServerErrorException(`Could not remove item ${id}`);
  }
}