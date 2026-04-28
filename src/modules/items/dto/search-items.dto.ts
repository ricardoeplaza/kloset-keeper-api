import { IsOptional, IsString, IsArray, IsUUID, IsNumber, IsObject } from 'class-validator';

export class SearchItemsDto {
    // Basic text search
    @IsOptional() @IsString()
    query?: string;

    // Exact filters
    @IsOptional() @IsString()
    brand?: string;

    @IsOptional() @IsString()
    category?: string;

    @IsOptional() @IsUUID()
    locationId?: string;

    // JSONB Filter (Color)
    @IsOptional() @IsString()
    colorGroup?: string;

    // Array filter (Materials)
    @IsOptional() @IsArray()
    materials?: string[];

    // Vector Search (Optional: The consumer could send a pre-calculated embedding)
    @IsOptional() @IsArray()
    embedding?: number[];

    // Pagination
    @IsOptional() @IsNumber()
    limit?: number = 20;

    @IsOptional() @IsNumber()
    offset?: number = 0;
}