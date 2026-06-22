import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateStaffAccountPayload,
  StaffProfile,
  UpdateStaffProfilePayload,
  WorkingHours,
  TimeOff,
} from '../models/staff.model';

export interface CreateWorkingHoursDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface CreateTimeOffDto {
  startDate: string;
  endDate: string;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly apiUrl = `${environment.apiUrl}/staff`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<StaffProfile[]> {
    return this.http.get<StaffProfile[]>(this.apiUrl);
  }

  /** Incluye peluqueros inactivos (solo ADMIN). */
  getAllAdmin(): Observable<StaffProfile[]> {
    return this.http.get<StaffProfile[]>(`${this.apiUrl}/admin/all`);
  }

  getMe(): Observable<StaffProfile> {
    return this.http.get<StaffProfile>(`${this.apiUrl}/me`);
  }

  /** Alta de peluquero: crea el usuario STAFF y su perfil (solo ADMIN). */
  createWithAccount(dto: CreateStaffAccountPayload): Observable<StaffProfile> {
    return this.http.post<StaffProfile>(`${this.apiUrl}/with-account`, dto);
  }

  updateProfile(id: number, dto: UpdateStaffProfilePayload): Observable<StaffProfile> {
    return this.http.patch<StaffProfile>(`${this.apiUrl}/${id}`, dto);
  }

  setStatus(id: number, isActive: boolean): Observable<StaffProfile> {
    return this.http.patch<StaffProfile>(`${this.apiUrl}/${id}/status`, { isActive });
  }

  // --- Working Hours ---

  addWorkingHours(staffProfileId: number, dto: CreateWorkingHoursDto): Observable<WorkingHours> {
    return this.http.post<WorkingHours>(`${this.apiUrl}/${staffProfileId}/working-hours`, dto);
  }

  updateWorkingHours(staffProfileId: number, whId: number, dto: Partial<CreateWorkingHoursDto>): Observable<WorkingHours> {
    return this.http.patch<WorkingHours>(`${this.apiUrl}/${staffProfileId}/working-hours/${whId}`, dto);
  }

  deleteWorkingHours(staffProfileId: number, whId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${staffProfileId}/working-hours/${whId}`);
  }

  // --- Time Off ---

  getTimeOffs(staffProfileId: number): Observable<TimeOff[]> {
    return this.http.get<TimeOff[]>(`${this.apiUrl}/${staffProfileId}/time-off`);
  }

  addTimeOff(staffProfileId: number, dto: CreateTimeOffDto): Observable<TimeOff> {
    return this.http.post<TimeOff>(`${this.apiUrl}/${staffProfileId}/time-off`, dto);
  }

  deleteTimeOff(staffProfileId: number, toId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${staffProfileId}/time-off/${toId}`);
  }
}
