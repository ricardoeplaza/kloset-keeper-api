import { Type } from 'class-transformer';
import { IsArray, IsDate, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ITEM_CATEGORIES } from '../../../common/constants/categories-map.constants';
import type { ItemCategory } from '../../../common/constants/categories-map.constants';

export class CreateItemDto {
  @IsString() @IsOptional() brand?: string;
  @IsString() @IsNotEmpty() name: string;
  @IsIn(ITEM_CATEGORIES) @IsNotEmpty() category: ItemCategory;

  @IsOptional() @Type(() => Date) @IsDate() purchaseDate?: Date;

  @IsArray() @IsString({ each: true }) @IsOptional() color?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() material?: string[];
  @IsString() @IsOptional() size?: string;
  @IsString() @IsOptional() notes?: string;

  @IsUUID() @IsOptional() locationId?: string;
}
