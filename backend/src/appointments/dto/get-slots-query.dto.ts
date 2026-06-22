import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSlotsQueryDto {
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

  // Fecha en hora local de Canarias — formato YYYY-MM-DD
  @ApiProperty({ example: '2026-07-15', description: 'Fecha a consultar (YYYY-MM-DD, hora local Canarias)' })
  @IsDateString()
  date: string;
}
