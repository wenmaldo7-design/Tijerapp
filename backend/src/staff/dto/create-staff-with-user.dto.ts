import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateStaffWithUserDto {
  @ApiProperty({ example: 'María Gómez' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'maria@tijerapp.com' })
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

  @ApiPropertyOptional({ example: ['corte', 'tinte'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ example: 'Especialista en coloración y cortes modernos.' })
  @IsOptional()
  @IsString()
  bio?: string;
}
