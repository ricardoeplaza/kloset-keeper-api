import { IsOptional, IsUUID } from "class-validator";

export class MoveLocationDto {
    @IsUUID()
    @IsOptional()
    destinationParentId: string | null;
}