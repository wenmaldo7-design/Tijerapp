import { Service } from './service.model';
import { StaffProfile } from './staff.model';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface AppointmentClient {
  id: number;
  name: string;
  email: string;
}

export interface Appointment {
  id: number;
  clientId: number;
  staffProfileId: number;
  serviceId: number;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  client?: AppointmentClient;
  staff: StaffProfile;
  service: Service;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}

export interface CreateAppointmentDto {
  staffProfileId: number;
  serviceId: number;
  startTime: string;
  notes?: string;
}

export interface AdminAppointmentsResult {
  data: Appointment[];
  total: number;
  page: number;
  totalPages: number;
  summary: Record<AppointmentStatus, number>;
}

export interface AdminAppointmentsQuery {
  from?: string;
  to?: string;
  status?: AppointmentStatus;
  staffProfileId?: number;
  serviceId?: number;
  page?: number;
  limit?: number;
}
