import { PartialType } from '@nestjs/swagger';
import { CreateWorkingHoursDto } from './create-working-hours.dto';

export class UpdateWorkingHoursDto extends PartialType(CreateWorkingHoursDto) {}
