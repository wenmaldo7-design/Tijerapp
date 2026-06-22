import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Appointment, AppointmentStatus } from '../../core/models/appointment.model';
import { AppointmentsService } from '../../core/services/appointments.service';
import { ChatService } from '../../core/services/chat.service';

@Component({
  selector: 'app-my-appointments',
  imports: [RouterLink],
  templateUrl: './my-appointments.html',
  styleUrl: './my-appointments.scss',
})
export class MyAppointments implements OnInit {
  private apptSvc = inject(AppointmentsService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  appointments = signal<Appointment[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  cancellingId = signal<number | null>(null);
  cancelError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.apptSvc.getMine().subscribe({
      next: (list) => {
        this.appointments.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los turnos. Intentá de nuevo.');
        this.loading.set(false);
      },
    });
  }

  canCancel(appt: Appointment): boolean {
    return appt.status === 'PENDING' || appt.status === 'CONFIRMED';
  }

  cancelAppointment(appt: Appointment): void {
    if (!confirm(`¿Cancelar el turno del ${this.formatDateTime(appt.startTime)}?`)) return;

    this.cancellingId.set(appt.id);
    this.cancelError.set(null);

    this.apptSvc.cancel(appt.id).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.load();
      },
      error: () => {
        this.cancellingId.set(null);
        this.cancelError.set('No se pudo cancelar el turno. Intentá de nuevo.');
      },
    });
  }

  // --- Computed helpers ---

  upcoming = computed(() =>
    this.appointments().filter(
      (a) => a.status === 'PENDING' || a.status === 'CONFIRMED',
    ),
  );

  past = computed(() =>
    this.appointments().filter(
      (a) => a.status === 'CANCELLED' || a.status === 'COMPLETED',
    ),
  );

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

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  // The backend serializes DATETIME columns to ISO UTC ("...Z"). Use Date object
  // so the browser converts to local time; string-slicing would show UTC hour.
  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  staffName(appt: Appointment): string {
    return appt.staff?.user?.name || `Peluquero #${appt.staffProfileId}`;
  }

  startChat(appt: Appointment): void {
    const staffUserId = appt.staff?.user?.id;
    if (!staffUserId) return;
    this.chatService.openConversation(staffUserId).subscribe({
      next: (conv) => this.router.navigate(['/chat'], { queryParams: { conversationId: conv.id } }),
      error: () => alert('No se pudo abrir el chat. Intentá de nuevo.'),
    });
  }
}
