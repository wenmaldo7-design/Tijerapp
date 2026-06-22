import { Component, input, output, signal, computed, effect } from '@angular/core';

interface CalendarCell {
  key: string;
  iso: string;
  day: number;
  isToday: boolean;
  isPast: boolean;
  isEmpty: boolean;
  isSunday: boolean;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class CalendarComponent {
  minDate = input<string>(new Date().toISOString().split('T')[0]);
  selectedDate = input<string>('');
  dateSelected = output<string>();

  private readonly todayStr = new Date().toISOString().split('T')[0];
  calendarYear = signal(new Date().getFullYear());
  calendarMonth = signal(new Date().getMonth());

  constructor() {
    effect(() => {
      const sel = this.selectedDate();
      if (sel) {
        const d = new Date(sel + 'T00:00:00');
        this.calendarYear.set(d.getFullYear());
        this.calendarMonth.set(d.getMonth());
      }
    });
  }

  calendarTitle = computed(() => {
    const d = new Date(this.calendarYear(), this.calendarMonth(), 1);
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  });

  canGoPrev = computed(() => {
    const today = new Date();
    return !(
      this.calendarYear() === today.getFullYear() &&
      this.calendarMonth() === today.getMonth()
    );
  });

  calendarDays = computed((): CalendarCell[] => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const min = this.minDate();

    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7; // Mon = 0, Sun = 6

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: CalendarCell[] = [];

    for (let i = 0; i < startDow; i++) {
      cells.push({ key: `e${i}`, iso: '', day: 0, isToday: false, isPast: false, isEmpty: true, isSunday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(year, month, d).getDay(); // 0 = domingo
      cells.push({
        key: iso,
        iso,
        day: d,
        isToday: iso === this.todayStr,
        isPast: iso < min,
        isEmpty: false,
        isSunday: dow === 0,
      });
    }

    return cells;
  });

  prevMonth(): void {
    if (this.calendarMonth() === 0) {
      this.calendarMonth.set(11);
      this.calendarYear.update(y => y - 1);
    } else {
      this.calendarMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.calendarMonth() === 11) {
      this.calendarMonth.set(0);
      this.calendarYear.update(y => y + 1);
    } else {
      this.calendarMonth.update(m => m + 1);
    }
  }

  selectDay(iso: string): void {
    this.dateSelected.emit(iso);
  }
}
