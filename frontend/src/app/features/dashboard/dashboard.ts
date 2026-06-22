import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  auth = inject(AuthService);

  today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  userName = computed(() => {
    const user = this.auth.currentUser();
    return user?.name || user?.email.split('@')[0] || 'usuario';
  });

  roleBadgeClass = computed(() => {
    const r = this.auth.currentRole();
    if (!r) return 'badge';
    return `badge badge--${r.toLowerCase()}`;
  });
}
