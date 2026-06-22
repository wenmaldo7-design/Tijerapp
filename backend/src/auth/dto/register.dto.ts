import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'juan@ejemplo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'contraseña123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '+54 11 1234-5678' })
  @IsOptional()
  @IsString()
  phone?: string;
}
