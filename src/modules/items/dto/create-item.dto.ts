import { IsString, IsArray, IsEnum, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';

export enum ItemCategory {
  TOP = 'top',
  BOTTOM = 'bottom',
  FOOTWEAR = 'footwear',
  ACCESSORY = 'accessory',
  OUTERWEAR = 'outerwear'
}

export class CreateItemDto {
  @IsString() @IsOptional() brand?: string;
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(ItemCategory) @IsNotEmpty() category: ItemCategory;
  @IsOptional() purchaseDate?: Date;

  @IsArray() @IsString({ each: true }) @IsOptional() color?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() material?: string[];
  @IsString() @IsOptional() size?: string;
  @IsString() @IsOptional() notes?: string;

  @IsUUID() @IsOptional() locationId?: string;
  @IsString() @IsOptional() imagePath?: string;
}
