import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  UserRole,
} from '../models/user.model';

const TOKEN_KEY = 'tijerapp_token';
const USER_KEY = 'tijerapp_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user = signal<User | null>(this.loadUserFromStorage());

  readonly token = this._token.asReadonly();
  readonly currentUser = this._user.asReadonly();

  readonly isLoggedIn = computed(() => {
    const t = this._token();
    return !!t && !this.isTokenExpired(t);
  });

  readonly currentRole = computed(() => this._user()?.role ?? null);

  constructor(private http: HttpClient) {}

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  hasRole(...roles: UserRole[]): boolean {
    const role = this._user()?.role;
    return role != null && roles.includes(role);
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }

  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const [, payload] = token.split('.');
      // JWT uses URL-safe base64 — normalize before decoding
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(normalized)) as { exp?: number };
      return typeof decoded.exp === 'number' && decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
