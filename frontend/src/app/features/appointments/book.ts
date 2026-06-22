import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Service } from '../../core/models/service.model';
import { StaffProfile } from '../../core/models/staff.model';
import { AvailableSlot } from '../../core/models/appointment.model';
import { ServicesService } from '../../core/services/services.service';
import { StaffService } from '../../core/services/staff.service';
import { AppointmentsService } from '../../core/services/appointments.service';
import { CalendarComponent } from '../../shared/components/calendar/calendar';

type Step = 'service' | 'staff' | 'date' | 'slots' | 'confirm';

@Component({
  selector: 'app-book',
  imports: [FormsModule, CalendarComponent],
  templateUrl: './book.html',
  styleUrl: './book.scss',
})
export class Book implements OnInit {
  private router = inject(Router);
  private svcSvc = inject(ServicesService);
  private staffSvc = inject(StaffService);
  private apptSvc = inject(AppointmentsService);

  step = signal<Step>('service');

  // Data
  services = signal<Service[]>([]);
  staffList = signal<StaffProfile[]>([]);
  slots = signal<AvailableSlot[]>([]);

  // Selections
  selectedService = signal<Service | null>(null);
  selectedStaff = signal<StaffProfile | null>(null);
  selectedDate = signal<string>('');
  selectedSlot = signal<AvailableSlot | null>(null);
  notes = signal<string>('');

  // UI state
  loadingServices = signal(false);
  loadingStaff = signal(false);
  loadingSlots = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // Min date for date input (today)
  readonly minDate = new Date().toISOString().split('T')[0];

  readonly steps: Step[] = ['service', 'staff', 'date', 'slots', 'confirm'];

  currentStepIndex = computed(() => this.steps.indexOf(this.step()));

  ngOnInit(): void {
    this.loadServices();
  }

  private loadServices(): void {
    this.loadingServices.set(true);
    this.error.set(null);
    this.svcSvc.getAll().subscribe({
      next: (list) => {
        this.services.set(list.filter((s) => s.isActive));
        this.loadingServices.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los servicios. Intentá de nuevo.');
        this.loadingServices.set(false);
      },
    });
  }

  private loadStaff(): void {
    this.loadingStaff.set(true);
    this.error.set(null);
    this.staffSvc.getAll().subscribe({
      next: (list) => {
        this.staffList.set(list);
        this.loadingStaff.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los peluqueros. Intentá de nuevo.');
        this.loadingStaff.set(false);
      },
    });
  }

  private loadSlots(): void {
    const svc = this.selectedService();
    const staff = this.selectedStaff();
    const date = this.selectedDate();
    if (!svc || !staff || !date) return;

    this.loadingSlots.set(true);
    this.error.set(null);
    this.slots.set([]);
    this.selectedSlot.set(null);

    this.apptSvc.getSlots(staff.id, svc.id, date).subscribe({
      next: (list) => {
        this.slots.set(list);
        this.loadingSlots.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los horarios. Intentá de nuevo.');
        this.loadingSlots.set(false);
      },
    });
  }

  // --- Step navigation ---

  selectService(svc: Service): void {
    this.selectedService.set(svc);
    this.selectedStaff.set(null);
    this.selectedDate.set('');
    this.selectedSlot.set(null);
    this.step.set('staff');
    this.loadStaff();
  }

  selectStaff(staff: StaffProfile): void {
    this.selectedStaff.set(staff);
    this.selectedDate.set('');
    this.selectedSlot.set(null);
    this.step.set('date');
  }

  onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.selectedSlot.set(null);
    if (date) {
      this.step.set('slots');
      this.loadSlots();
    }
  }

  selectSlot(slot: AvailableSlot): void {
    this.selectedSlot.set(slot);
    this.step.set('confirm');
  }

  goToStep(target: Step): void {
    const targetIdx = this.steps.indexOf(target);
    if (targetIdx >= this.currentStepIndex()) return;
    this.step.set(target);
    // Reset downstream selections
    if (targetIdx <= 0) { this.selectedService.set(null); }
    if (targetIdx <= 1) { this.selectedStaff.set(null); }
    if (targetIdx <= 2) { this.selectedDate.set(''); }
    if (targetIdx <= 3) { this.selectedSlot.set(null); this.slots.set([]); }
    this.error.set(null);
  }

  confirm(): void {
    const svc = this.selectedService();
    const staff = this.selectedStaff();
    const slot = this.selectedSlot();
    if (!svc || !staff || !slot) return;

    this.submitting.set(true);
    this.error.set(null);

    this.apptSvc
      .create({
        staffProfileId: staff.id,
        serviceId: svc.id,
        startTime: slot.startTime,
        notes: this.notes() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/appointments']);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          if (err.status === 409) {
            this.error.set('Ese horario ya fue reservado. Por favor elegí otro.');
            this.step.set('slots');
            this.loadSlots();
          } else {
            this.error.set(
              err.error?.message ?? 'Ocurrió un error al reservar. Intentá de nuevo.',
            );
          }
        },
      });
  }

  // --- Template helpers ---

  formatTime(iso: string): string {
    return iso.slice(11, 16);
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  staffName(profile: StaffProfile): string {
    return profile.user?.name || `Peluquero #${profile.id}`;
  }
}
