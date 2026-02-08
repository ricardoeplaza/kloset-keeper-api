import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateUserDto {
    @IsString() @IsNotEmpty() name: string;
    @IsString() @IsNotEmpty() email: string;
    @IsString() @IsNotEmpty() password: string;
    @IsBoolean() @IsOptional() isAdmin: boolean;
}
