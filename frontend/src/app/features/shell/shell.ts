import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  auth = inject(AuthService);
  chatService = inject(ChatService);
  private router = inject(Router);

  roleBadgeClass = computed(() => {
    const r = this.auth.currentRole();
    if (!r) return 'badge';
    return `badge badge--${r.toLowerCase()}`;
  });

  unreadTotal = this.chatService.unreadTotal;

  logout(): void {
    this.auth.logout();
    this.chatService.disconnect();
    this.router.navigate(['/auth/login']);
  }
}
