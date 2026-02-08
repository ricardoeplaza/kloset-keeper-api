import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateLocationDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    type?: string;

    @IsUUID()
    @IsOptional()
    parentId?: string | null;
}
