import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Auth (sin guard — accesibles sin sesión)
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  // Shell autenticado
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'book',
        loadComponent: () =>
          import('./features/appointments/book').then((m) => m.Book),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./features/appointments/my-appointments').then(
            (m) => m.MyAppointments,
          ),
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/chat').then((m) => m.Chat),
      },
      {
        path: 'staff',
        canActivate: [roleGuard],
        data: { roles: ['STAFF', 'ADMIN'] },
        loadComponent: () =>
          import('./features/staff/staff-panel').then((m) => m.StaffPanel),
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./features/admin/admin-panel').then((m) => m.AdminPanel),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
