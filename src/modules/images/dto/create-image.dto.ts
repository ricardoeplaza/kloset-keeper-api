import { IsString, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export class CreateImageDto {
    @IsString()
    @IsNotEmpty()
    hash: string;

    @IsString()
    @IsNotEmpty()
    thumbPath: string;

    @IsString()
    @IsOptional()
    storagePath?: string;

    @IsUUID()
    itemId: string;
}
