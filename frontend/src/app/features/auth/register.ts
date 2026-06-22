import { Component, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: [''],
  });

  error = signal<string | null>(null);
  loading = signal(false);

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
  }

  get name() { return this.form.controls.name; }
  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }
  get phone() { return this.form.controls.phone; }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);

    const { name, email, password, phone } = this.form.getRawValue();
    const payload = phone.trim() ? { name, email, password, phone } : { name, email, password };

    this.auth.register(payload).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg[0] : (msg ?? 'Error al registrarse'));
        this.loading.set(false);
      },
    });
  }
}
