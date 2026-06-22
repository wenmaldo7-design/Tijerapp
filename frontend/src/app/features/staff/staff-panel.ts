import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StaffService, CreateWorkingHoursDto, CreateTimeOffDto } from '../../core/services/staff.service';
import { AppointmentsService } from '../../core/services/appointments.service';
import { StaffProfile, WorkingHours, TimeOff } from '../../core/models/staff.model';
import { Appointment, AppointmentStatus } from '../../core/models/appointment.model';

type Tab = 'agenda' | 'horarios' | 'diaslibres';

@Component({
  selector: 'app-staff-panel',
  imports: [FormsModule],
  templateUrl: './staff-panel.html',
  styleUrl: './staff-panel.scss',
})
export class StaffPanel implements OnInit {
  private staffSvc = inject(StaffService);
  private apptSvc = inject(AppointmentsService);

  // --- Profile ---
  loading = signal(true);
  error = signal<string | null>(null);
  profile = signal<StaffProfile | null>(null);

  // --- Tabs ---
  activeTab = signal<Tab>('agenda');

  // --- Agenda ---
  appointments = signal<Appointment[]>([]);
  agendaLoading = signal(false);
  agendaError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  actionId = signal<number | null>(null);
  agendaDateFilter = '';

  // --- Working Hours ---
  workingHours = signal<WorkingHours[]>([]);
  whError = signal<string | null>(null);
  showWhForm = signal(false);
  editingWhId = signal<number | null>(null);
  deletingWhId = signal<number | null>(null);
  whSaving = signal(false);
  whDayOfWeek = 1;
  whStartTime = '09:00';
  whEndTime = '18:00';

  sortedWorkingHours = computed(() =>
    [...this.workingHours()].sort((a, b) =>
      a.dayOfWeek !== b.dayOfWeek
        ? a.dayOfWeek - b.dayOfWeek
        : a.startTime.localeCompare(b.startTime),
    ),
  );

  // --- Time Off ---
  timeOffs = signal<TimeOff[]>([]);
  toLoading = signal(false);
  toError = signal<string | null>(null);
  showToForm = signal(false);
  deletingToId = signal<number | null>(null);
  toSaving = signal(false);
  tofStartDate = '';
  tofEndDate = '';
  tofReason = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.staffSvc.getMe().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.workingHours.set(p.workingHours ?? []);
        this.loading.set(false);
        this.loadAgenda();
        this.loadTimeOffs();
      },
      error: () => {
        this.error.set('No se pudo cargar el perfil de staff.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  tabClass(tab: Tab): string {
    return `staff-panel__tab${this.activeTab() === tab ? ' staff-panel__tab--active' : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Agenda
  // ---------------------------------------------------------------------------

  loadAgenda(): void {
    this.agendaLoading.set(true);
    this.agendaError.set(null);
    this.actionError.set(null);
    const date = this.agendaDateFilter || undefined;
    this.apptSvc.getAgenda(date).subscribe({
      next: (list) => {
        this.appointments.set(list);
        this.agendaLoading.set(false);
      },
      error: () => {
        this.agendaError.set('No se pudieron cargar los turnos.');
        this.agendaLoading.set(false);
      },
    });
  }

  confirmAppt(appt: Appointment): void {
    this.actionId.set(appt.id);
    this.actionError.set(null);
    this.apptSvc.confirm(appt.id).subscribe({
      next: () => { this.actionId.set(null); this.loadAgenda(); },
      error: (err) => {
        this.actionId.set(null);
        this.actionError.set(err?.error?.message ?? 'No se pudo confirmar el turno.');
      },
    });
  }

  completeAppt(appt: Appointment): void {
    this.actionId.set(appt.id);
    this.actionError.set(null);
    this.apptSvc.complete(appt.id).subscribe({
      next: () => { this.actionId.set(null); this.loadAgenda(); },
      error: (err) => {
        this.actionId.set(null);
        this.actionError.set(err?.error?.message ?? 'No se pudo completar el turno.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Working Hours
  // ---------------------------------------------------------------------------

  private refreshWorkingHours(): void {
    this.staffSvc.getMe().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.workingHours.set(p.workingHours ?? []);
      },
    });
  }

  openAddWhForm(): void {
    this.editingWhId.set(null);
    this.whDayOfWeek = 1;
    this.whStartTime = '09:00';
    this.whEndTime = '18:00';
    this.whError.set(null);
    this.showWhForm.set(true);
  }

  openEditWhForm(wh: WorkingHours): void {
    this.editingWhId.set(wh.id);
    this.whDayOfWeek = wh.dayOfWeek;
    this.whStartTime = wh.startTime;
    this.whEndTime = wh.endTime;
    this.whError.set(null);
    this.showWhForm.set(true);
  }

  cancelWhForm(): void {
    this.showWhForm.set(false);
    this.editingWhId.set(null);
    this.whError.set(null);
  }

  saveWh(): void {
    const profile = this.profile();
    if (!profile) return;

    const dto: CreateWorkingHoursDto = {
      dayOfWeek: Number(this.whDayOfWeek),
      startTime: this.whStartTime,
      endTime: this.whEndTime,
    };

    this.whSaving.set(true);
    this.whError.set(null);

    const editId = this.editingWhId();
    const req = editId
      ? this.staffSvc.updateWorkingHours(profile.id, editId, dto)
      : this.staffSvc.addWorkingHours(profile.id, dto);

    req.subscribe({
      next: () => {
        this.whSaving.set(false);
        this.showWhForm.set(false);
        this.editingWhId.set(null);
        this.refreshWorkingHours();
      },
      error: (err) => {
        this.whSaving.set(false);
        this.whError.set(err?.error?.message ?? 'Error al guardar el horario.');
      },
    });
  }

  deleteWh(wh: WorkingHours): void {
    const profile = this.profile();
    if (!profile) return;
    if (!confirm(`¿Eliminar el horario del ${this.dayName(wh.dayOfWeek)} ${wh.startTime}–${wh.endTime}?`)) return;

    this.deletingWhId.set(wh.id);
    this.whError.set(null);
    this.staffSvc.deleteWorkingHours(profile.id, wh.id).subscribe({
      next: () => { this.deletingWhId.set(null); this.refreshWorkingHours(); },
      error: () => {
        this.deletingWhId.set(null);
        this.whError.set('No se pudo eliminar el horario.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Time Off
  // ---------------------------------------------------------------------------

  loadTimeOffs(): void {
    const profile = this.profile();
    if (!profile) return;
    this.toLoading.set(true);
    this.staffSvc.getTimeOffs(profile.id).subscribe({
      next: (list) => { this.timeOffs.set(list); this.toLoading.set(false); },
      error: () => {
        this.toError.set('No se pudieron cargar los días libres.');
        this.toLoading.set(false);
      },
    });
  }

  openAddToForm(): void {
    this.tofStartDate = '';
    this.tofEndDate = '';
    this.tofReason = '';
    this.toError.set(null);
    this.showToForm.set(true);
  }

  cancelToForm(): void {
    this.showToForm.set(false);
    this.toError.set(null);
  }

  saveTimeOff(): void {
    const profile = this.profile();
    if (!profile || !this.tofStartDate || !this.tofEndDate) return;

    const dto: CreateTimeOffDto = {
      startDate: this.tofStartDate,
      endDate: this.tofEndDate,
      reason: this.tofReason || undefined,
    };

    this.toSaving.set(true);
    this.toError.set(null);
    this.staffSvc.addTimeOff(profile.id, dto).subscribe({
      next: () => {
        this.toSaving.set(false);
        this.showToForm.set(false);
        this.loadTimeOffs();
      },
      error: (err) => {
        this.toSaving.set(false);
        this.toError.set(err?.error?.message ?? 'Error al agregar el bloqueo.');
      },
    });
  }

  deleteTimeOff(to: TimeOff): void {
    const profile = this.profile();
    if (!profile) return;
    if (!confirm(`¿Eliminar el bloqueo del ${to.startDate} al ${to.endDate}?`)) return;

    this.deletingToId.set(to.id);
    this.toError.set(null);
    this.staffSvc.deleteTimeOff(profile.id, to.id).subscribe({
      next: () => { this.deletingToId.set(null); this.loadTimeOffs(); },
      error: () => {
        this.deletingToId.set(null);
        this.toError.set('No se pudo eliminar el bloqueo.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  dayName(day: number): string {
    return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day] ?? `Día ${day}`;
  }

  dayNames = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
  ];

  badgeClass(status: AppointmentStatus): string {
    const map: Record<AppointmentStatus, string> = {
      PENDING:   'badge badge--pending',
      CONFIRMED: 'badge badge--confirmed',
      CANCELLED: 'badge badge--cancelled',
      COMPLETED: 'badge badge--completed',
    };
    return map[status] ?? 'badge';
  }

  statusLabel(status: AppointmentStatus): string {
    const map: Record<AppointmentStatus, string> = {
      PENDING:   'Pendiente',
      CONFIRMED: 'Confirmado',
      CANCELLED: 'Cancelado',
      COMPLETED: 'Completado',
    };
    return map[status] ?? status;
  }

  clientName(appt: Appointment): string {
    return appt.client?.name ?? `Cliente #${appt.clientId}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
}
