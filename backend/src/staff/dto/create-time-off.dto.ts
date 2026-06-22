import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTimeOffDto {
  @ApiProperty({ example: '2026-12-24', description: 'Fecha inicio (YYYY-MM-DD, hora local Canarias)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-12-26', description: 'Fecha fin (YYYY-MM-DD, hora local Canarias)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 'Vacaciones de Navidad' })
  @IsOptional()
  @IsString()
  reason?: string;
}
