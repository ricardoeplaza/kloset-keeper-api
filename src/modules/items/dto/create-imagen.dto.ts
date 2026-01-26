import { IsUUID, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateImageDto {
  @IsString()
  @IsNotEmpty()
  hash: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  thumbPath: string; // El path del thumb "raw" inicial

  @IsString()
  @IsOptional()
  storagePath?: string; // Opcional al inicio, lo llenará el worker

  @IsUUID()
  @IsOptional()
  itemId?: string; // Opcional si quieres vincularlo después
}