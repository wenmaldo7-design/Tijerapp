import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateStaffProfileDto } from './create-staff-profile.dto';

// No se puede cambiar el userId una vez creado el perfil
export class UpdateStaffProfileDto extends PartialType(
  OmitType(CreateStaffProfileDto, ['userId'] as const),
) {}
