import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateServicePayload, Service, UpdateServicePayload } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly apiUrl = `${environment.apiUrl}/services`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Service[]> {
    return this.http.get<Service[]>(this.apiUrl);
  }

  /** Incluye servicios inactivos (solo ADMIN). */
  getAllAdmin(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.apiUrl}/admin/all`);
  }

  create(dto: CreateServicePayload): Observable<Service> {
    return this.http.post<Service>(this.apiUrl, dto);
  }

  update(id: number, dto: UpdateServicePayload): Observable<Service> {
    return this.http.patch<Service>(`${this.apiUrl}/${id}`, dto);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  reactivate(id: number): Observable<Service> {
    return this.update(id, { isActive: true });
  }
}
