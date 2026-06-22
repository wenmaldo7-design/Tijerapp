import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ServicesService } from '../../core/services/services.service';
import { StaffService } from '../../core/services/staff.service';
import { AppointmentsService } from '../../core/services/appointments.service';
import { ChatService } from '../../core/services/chat.service';
import { Service, CreateServicePayload } from '../../core/models/service.model';
import { StaffProfile, CreateStaffAccountPayload } from '../../core/models/staff.model';
import {
  Appointment,
  AppointmentStatus,
  AdminAppointmentsResult,
} from '../../core/models/appointment.model';

type Tab = 'servicios' | 'peluqueros' | 'turnos';

@Component({
  selector: 'app-admin-panel',
  imports: [FormsModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss',
})
export class AdminPanel implements OnInit {
  private svcSvc = inject(ServicesService);
  private staffSvc = inject(StaffService);
  private apptSvc = inject(AppointmentsService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  activeTab = signal<Tab>('servicios');

  // --- Servicios ---
  services = signal<Service[]>([]);
  servicesLoading = signal(false);
  servicesError = signal<string | null>(null);

  showServiceForm = signal(false);
  editingServiceId = signal<number | null>(null);
  serviceSaving = signal(false);
  serviceFormError = signal<string | null>(null);
  togglingServiceId = signal<number | null>(null);

  svcName = '';
  svcDescription = '';
  svcDuration: number | null = null;
  svcPrice: number | null = null;

  // --- Peluqueros ---
  staffList = signal<StaffProfile[]>([]);
  staffLoading = signal(false);
  staffError = signal<string | null>(null);

  showStaffForm = signal(false);
  editingStaffId = signal<number | null>(null);
  staffSaving = signal(false);
  staffFormError = signal<string | null>(null);
  togglingStaffId = signal<number | null>(null);

  stfName = '';
  stfEmail = '';
  stfPassword = '';
  stfPhone = '';
  stfSpecialties = '';
  stfBio = '';

  // --- Turnos ---
  apptResult = signal<AdminAppointmentsResult | null>(null);
  apptLoading = signal(false);
  apptError = signal<string | null>(null);

  // Filters
  apptFrom = '';
  apptTo = '';
  apptStatus: AppointmentStatus | '' = '';
  apptPage = 1;
  readonly apptLimit = 20;

  readonly statusOptions: Array<{ value: AppointmentStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'CONFIRMED', label: 'Confirmado' },
    { value: 'COMPLETED', label: 'Completado' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];

  ngOnInit(): void {
    this.loadServices();
    this.loadStaff();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'turnos' && !this.apptResult()) {
      this.loadAppointments();
    }
  }

  tabClass(tab: Tab): string {
    return `admin-panel__tab${this.activeTab() === tab ? ' admin-panel__tab--active' : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Servicios
  // ---------------------------------------------------------------------------

  loadServices(): void {
    this.servicesLoading.set(true);
    this.servicesError.set(null);
    this.svcSvc.getAllAdmin().subscribe({
      next: (list) => {
        this.services.set(this.sortServices(list));
        this.servicesLoading.set(false);
      },
      error: () => {
        this.servicesError.set('No se pudieron cargar los servicios.');
        this.servicesLoading.set(false);
      },
    });
  }

  private sortServices(list: Service[]): Service[] {
    return [...list].sort((a, b) =>
      a.isActive !== b.isActive ? (a.isActive ? -1 : 1) : a.name.localeCompare(b.name),
    );
  }

  openCreateServiceForm(): void {
    this.editingServiceId.set(null);
    this.svcName = '';
    this.svcDescription = '';
    this.svcDuration = null;
    this.svcPrice = null;
    this.serviceFormError.set(null);
    this.showServiceForm.set(true);
  }

  openEditServiceForm(svc: Service): void {
    this.editingServiceId.set(svc.id);
    this.svcName = svc.name;
    this.svcDescription = svc.description ?? '';
    this.svcDuration = svc.durationMinutes;
    this.svcPrice = Number(svc.price);
    this.serviceFormError.set(null);
    this.showServiceForm.set(true);
  }

  cancelServiceForm(): void {
    this.showServiceForm.set(false);
    this.editingServiceId.set(null);
    this.serviceFormError.set(null);
  }

  get serviceFormValid(): boolean {
    return (
      this.svcName.trim().length >= 2 &&
      !!this.svcDuration &&
      this.svcDuration >= 5 &&
      this.svcPrice !== null &&
      this.svcPrice >= 0
    );
  }

  saveService(): void {
    if (!this.serviceFormValid) return;

    const dto: CreateServicePayload = {
      name: this.svcName.trim(),
      description: this.svcDescription.trim() || undefined,
      durationMinutes: Number(this.svcDuration),
      price: Number(this.svcPrice),
    };

    this.serviceSaving.set(true);
    this.serviceFormError.set(null);

    const editId = this.editingServiceId();
    const req = editId ? this.svcSvc.update(editId, dto) : this.svcSvc.create(dto);

    req.subscribe({
      next: () => {
        this.serviceSaving.set(false);
        this.showServiceForm.set(false);
        this.editingServiceId.set(null);
        this.loadServices();
      },
      error: (err) => {
        this.serviceSaving.set(false);
        this.serviceFormError.set(err?.error?.message ?? 'Error al guardar el servicio.');
      },
    });
  }

  toggleServiceActive(svc: Service): void {
    const action = svc.isActive ? 'desactivar' : 'reactivar';
    if (!confirm(`¿Seguro que querés ${action} "${svc.name}"?`)) return;

    this.togglingServiceId.set(svc.id);
    this.servicesError.set(null);
    const req: Observable<unknown> = svc.isActive
      ? this.svcSvc.deactivate(svc.id)
      : this.svcSvc.reactivate(svc.id);
    req.subscribe({
      next: () => {
        this.togglingServiceId.set(null);
        this.loadServices();
      },
      error: () => {
        this.togglingServiceId.set(null);
        this.servicesError.set(`No se pudo ${action} el servicio.`);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Peluqueros
  // ---------------------------------------------------------------------------

  loadStaff(): void {
    this.staffLoading.set(true);
    this.staffError.set(null);
    this.staffSvc.getAllAdmin().subscribe({
      next: (list) => {
        this.staffList.set(this.sortStaff(list));
        this.staffLoading.set(false);
      },
      error: () => {
        this.staffError.set('No se pudieron cargar los peluqueros.');
        this.staffLoading.set(false);
      },
    });
  }

  private sortStaff(list: StaffProfile[]): StaffProfile[] {
    return [...list].sort((a, b) =>
      a.user.isActive !== b.user.isActive
        ? a.user.isActive ? -1 : 1
        : a.user.name.localeCompare(b.user.name),
    );
  }

  openCreateStaffForm(): void {
    this.editingStaffId.set(null);
    this.stfName = '';
    this.stfEmail = '';
    this.stfPassword = '';
    this.stfPhone = '';
    this.stfSpecialties = '';
    this.stfBio = '';
    this.staffFormError.set(null);
    this.showStaffForm.set(true);
  }

  openEditStaffForm(profile: StaffProfile): void {
    this.editingStaffId.set(profile.id);
    this.stfName = profile.user.name;
    this.stfEmail = profile.user.email;
    this.stfPassword = '';
    this.stfPhone = profile.user.phone ?? '';
    this.stfSpecialties = (profile.specialties ?? []).join(', ');
    this.stfBio = profile.bio ?? '';
    this.staffFormError.set(null);
    this.showStaffForm.set(true);
  }

  cancelStaffForm(): void {
    this.showStaffForm.set(false);
    this.editingStaffId.set(null);
    this.staffFormError.set(null);
  }

  get staffFormValid(): boolean {
    if (this.editingStaffId() !== null) return true;
    return (
      this.stfName.trim().length >= 2 &&
      /^\S+@\S+\.\S+$/.test(this.stfEmail.trim()) &&
      this.stfPassword.length >= 6
    );
  }

  private parsedSpecialties(): string[] | undefined {
    const list = this.stfSpecialties
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length ? list : undefined;
  }

  saveStaff(): void {
    if (!this.staffFormValid) return;

    this.staffSaving.set(true);
    this.staffFormError.set(null);

    const editId = this.editingStaffId();
    const req = editId
      ? this.staffSvc.updateProfile(editId, {
          specialties: this.parsedSpecialties(),
          bio: this.stfBio.trim() || undefined,
        })
      : this.staffSvc.createWithAccount({
          name: this.stfName.trim(),
          email: this.stfEmail.trim(),
          password: this.stfPassword,
          phone: this.stfPhone.trim() || undefined,
          specialties: this.parsedSpecialties(),
          bio: this.stfBio.trim() || undefined,
        } as CreateStaffAccountPayload);

    req.subscribe({
      next: () => {
        this.staffSaving.set(false);
        this.showStaffForm.set(false);
        this.editingStaffId.set(null);
        this.loadStaff();
      },
      error: (err) => {
        this.staffSaving.set(false);
        this.staffFormError.set(
          err?.status === 409
            ? 'Ya existe un usuario registrado con ese email.'
            : err?.error?.message ?? 'Error al guardar el peluquero.',
        );
      },
    });
  }

  toggleStaffActive(profile: StaffProfile): void {
    const action = profile.user.isActive ? 'desactivar' : 'reactivar';
    if (!confirm(`¿Seguro que querés ${action} a "${profile.user.name}"?`)) return;

    this.togglingStaffId.set(profile.id);
    this.staffError.set(null);
    this.staffSvc.setStatus(profile.id, !profile.user.isActive).subscribe({
      next: () => {
        this.togglingStaffId.set(null);
        this.loadStaff();
      },
      error: () => {
        this.togglingStaffId.set(null);
        this.staffError.set(`No se pudo ${action} la cuenta.`);
      },
    });
  }

  startChatWithStaff(profile: StaffProfile): void {
    this.chatService.openConversation(profile.user.id).subscribe({
      next: (conv) => this.router.navigate(['/chat'], { queryParams: { conversationId: conv.id } }),
      error: () => alert('No se pudo abrir el chat con el peluquero.'),
    });
  }

  // ---------------------------------------------------------------------------
  // Turnos (admin)
  // ---------------------------------------------------------------------------

  loadAppointments(): void {
    this.apptLoading.set(true);
    this.apptError.set(null);
    this.apptSvc
      .getAdminAppointments({
        from: this.apptFrom || undefined,
        to: this.apptTo || undefined,
        status: (this.apptStatus as AppointmentStatus) || undefined,
        page: this.apptPage,
        limit: this.apptLimit,
      })
      .subscribe({
        next: (res) => {
          this.apptResult.set(res);
          this.apptLoading.set(false);
        },
        error: () => {
          this.apptError.set('No se pudieron cargar los turnos.');
          this.apptLoading.set(false);
        },
      });
  }

  apptSearch(): void {
    this.apptPage = 1;
    this.loadAppointments();
  }

  apptGoToPage(page: number): void {
    this.apptPage = page;
    this.loadAppointments();
  }

  apptPageNumbers(): number[] {
    const total = this.apptResult()?.totalPages ?? 1;
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  apptBadgeClass(status: AppointmentStatus): string {
    const map: Record<AppointmentStatus, string> = {
      PENDING: 'badge badge--pending',
      CONFIRMED: 'badge badge--confirmed',
      COMPLETED: 'badge badge--completed',
      CANCELLED: 'badge badge--cancelled',
    };
    return map[status] ?? 'badge';
  }

  apptStatusLabel(status: AppointmentStatus): string {
    const map: Record<AppointmentStatus, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmado',
      COMPLETED: 'Completado',
      CANCELLED: 'Cancelado',
    };
    return map[status] ?? status;
  }

  apptFormatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  summaryOf(status: AppointmentStatus): number {
    return this.apptResult()?.summary[status] ?? 0;
  }

  apptList(): Appointment[] {
    return this.apptResult()?.data ?? [];
  }
}
