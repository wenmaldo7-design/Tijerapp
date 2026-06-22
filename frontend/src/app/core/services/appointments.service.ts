import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Appointment,
  AdminAppointmentsQuery,
  AdminAppointmentsResult,
  AvailableSlot,
  CreateAppointmentDto,
} from '../models/appointment.model';

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly apiUrl = `${environment.apiUrl}/appointments`;

  constructor(private http: HttpClient) {}

  getSlots(staffProfileId: number, serviceId: number, date: string): Observable<AvailableSlot[]> {
    return this.http.get<AvailableSlot[]>(`${this.apiUrl}/slots`, {
      params: { staffProfileId, serviceId, date },
    });
  }

  create(dto: CreateAppointmentDto): Observable<Appointment> {
    return this.http.post<Appointment>(this.apiUrl, dto);
  }

  getMine(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.apiUrl}/my`);
  }

  cancel(id: number): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.apiUrl}/${id}/cancel`, {});
  }

  confirm(id: number): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.apiUrl}/${id}/confirm`, {});
  }

  complete(id: number): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.apiUrl}/${id}/complete`, {});
  }

  getAgenda(date?: string): Observable<Appointment[]> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.http.get<Appointment[]>(`${this.apiUrl}/agenda`, { params });
  }

  getAdminAppointments(q: AdminAppointmentsQuery): Observable<AdminAppointmentsResult> {
    const params: Record<string, string> = {};
    if (q.from) params['from'] = q.from;
    if (q.to) params['to'] = q.to;
    if (q.status) params['status'] = q.status;
    if (q.staffProfileId) params['staffProfileId'] = String(q.staffProfileId);
    if (q.serviceId) params['serviceId'] = String(q.serviceId);
    if (q.page) params['page'] = String(q.page);
    if (q.limit) params['limit'] = String(q.limit);
    return this.http.get<AdminAppointmentsResult>(`${this.apiUrl}/admin`, { params });
  }
}
