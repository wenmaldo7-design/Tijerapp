import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @ApiProperty({ example: 1, description: 'ID del StaffProfile' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  staffProfileId: number;

  @ApiProperty({ example: 1, description: 'ID del servicio' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  serviceId: number;

  // Datetime en hora local de Canarias — formato ISO 8601 sin zona, e.g. "2026-07-15T10:00:00"
  @ApiProperty({ example: '2026-07-15T10:00:00', description: 'Hora de inicio (hora local Canarias)' })
  @IsISO8601()
  startTime: string;

  @ApiPropertyOptional({ example: 'Sin gluten en los productos' })
  @IsOptional()
  @IsString()
  notes?: string;
}
