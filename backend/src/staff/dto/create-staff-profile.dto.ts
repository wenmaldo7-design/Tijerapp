import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStaffProfileDto {
  @ApiProperty({ example: 2, description: 'ID del usuario con rol STAFF' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

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
