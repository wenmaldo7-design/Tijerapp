# Tijerapp

Sistema de reservas de turnos para peluquería. Construido de cero con **NestJS + Angular + MySQL**, con autenticación por roles, disponibilidad en tiempo real, recordatorios automáticos por email y stack de producción dockerizado.

---

## Features

| | |
|---|---|
| **Auth con roles** | Registro/login con JWT. Tres roles (`CLIENT`, `STAFF`, `ADMIN`) con guards en Angular y decoradores en NestJS. Cada endpoint valida el rol; cada request valida que el usuario siga activo en la DB. |
| **Disponibilidad en tiempo real** | Los slots disponibles se calculan dinámicamente contra los horarios del staff, sus días libres (`TimeOff`) y los turnos ya existentes. No hay slots pre-generados en la DB. |
| **Ciclo de vida del turno** | `PENDING → CONFIRMED → COMPLETED / CANCELLED`. Las transiciones tienen reglas por rol: el cliente puede cancelar el propio turno, el staff confirma y completa, el admin tiene acceso total. |
| **Recordatorios por email** | Cron job (NestJS `@nestjs/schedule`) que corre cada hora y envía un email N horas antes del turno (configurable por env). Usa Nodemailer; funciona con cualquier SMTP. |
| **Tres paneles diferenciados** | Panel cliente (reservar + mis turnos), panel staff (agenda propia del día + gestión de estados), panel admin (ABM de servicios + gestión del equipo con horarios y días libres). |

---

## Decisiones de arquitectura

**Lock pesimista contra dobles reservas**
La creación de turno abre una transacción y adquiere un `SELECT ... FOR UPDATE` sobre la fila del peluquero en `staff_profiles`. Dos requests concurrentes para el mismo staff se serializan: el segundo bloquea hasta que el primero commitea; cuando sigue, la verificación de superposición ya ve el turno nuevo y lanza 409.

**Schema gestionado con migraciones TypeORM**
`synchronize` está apagado en producción. El entrypoint del container corre `typeorm migration:run` antes de arrancar la app: el primer deploy crea el schema, los siguientes solo aplican migraciones nuevas. No hay riesgo de que un reinicio destruya datos.

**DB aislada para E2E**
La suite de Playwright corre contra una instancia MySQL separada (`tijerapp_test`), con fixtures fijos sembrados en el `globalSetup`. Los tests de integración nunca tocan datos de desarrollo, son reproducibles y no tienen interferencia entre sí.

**Revocación inmediata de acceso**
`JwtStrategy.validate()` consulta la DB en cada request para verificar `user.isActive`. Si el admin desactiva una cuenta, el acceso se corta en la siguiente request — no hace falta esperar a que expire el JWT (hasta 7 días).

**Same-origin en producción sin CORS**
Nginx proxea `/api/` al backend y sirve el frontend como estático. El browser solo habla con nginx; nunca hace requests cross-origin. En el stack Docker no hace falta configurar CORS.

---

## Capturas

> *Agregar capturas o GIF de los tres paneles aquí.*
> Sugerencia: `docs/screenshots/panel-cliente.png`, `panel-staff.png`, `panel-admin.png`.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11, TypeORM 1, Passport JWT, Nodemailer |
| Frontend | Angular 21, signals, lazy loading por rol |
| Base de datos | MySQL 8 |
| Testing | Playwright (E2E), Jest (unitario) |
| Infraestructura | Docker multi-stage, nginx, docker-compose |

---

## Desarrollo local

### Requisitos

- Node.js 22+
- Docker + Docker Compose

### Levantar las bases de datos

```bash
docker compose up -d    # mysql dev (puerto 3308) + mysql test (3309)
```

### Backend

```bash
cd backend
cp .env.example .env    # completar con valores locales
npm install
npm run start:dev       # http://localhost:3001  |  Swagger: http://localhost:3001/api
```

### Frontend

```bash
cd frontend
npm install
npm start               # http://localhost:4200
```

### Tests E2E (Playwright)

Playwright levanta el backend de test y el frontend automáticamente. Solo hace falta tener la DB de test corriendo:

```bash
docker compose up -d db_test   # si no está ya levantada

cd frontend
npm run e2e
```

> `reuseExistingServer` está activo localmente: si ya tenés los servers en `:3002`/`:4203`, los reutiliza en lugar de reiniciarlos.

---

## Deploy

### Stack completo en Docker (producción local o VPS)

> **Puertos**: dev usa 3001/4200, test usa 3002/4203. Producción expone solo el puerto 8080 (nginx); backend y DB quedan en red interna.

#### 1. Crear el archivo de variables

```bash
cp .env.production.example .env.production
```

Editar `.env.production` y completar todos los valores. Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 2. Construir y levantar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

La app queda en **http://localhost:8080** (o el `FRONTEND_PORT` que configures).

#### 3. Apagar

```bash
docker compose -f docker-compose.prod.yml down          # conserva los datos
docker compose -f docker-compose.prod.yml down -v       # ⚠️ borra los datos
```

#### 4. Logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Migraciones manuales

```bash
cd backend
npm run migration:run       # aplica pendientes
npm run migration:revert    # revierte la última
npm run migration:generate -- src/migrations/NombreDeLaMigracion   # genera desde entidades
```

---

## Railway (backend) + Vercel (frontend)

### Backend en Railway

1. Conectar el repo, **Root Directory** → `backend/`. Railway detecta el Dockerfile automáticamente.
2. Agregar el plugin MySQL de Railway y copiar las credenciales a las variables del servicio.
3. Variables mínimas:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DB_HOST` | hostname MySQL de Railway |
   | `DB_PORT` | `3306` |
   | `DB_NAME` | nombre de la DB |
   | `DB_USER` | usuario |
   | `DB_PASSWORD` | password |
   | `JWT_SECRET` | secret generado (64 bytes hex) |
   | `CORS_ORIGIN` | URL del frontend en Vercel |
   | `MAIL_*` | credenciales SMTP |

### Frontend en Vercel

1. Conectar el repo, **Root Directory** → `frontend/`.
2. Build command: `npm run build -- --configuration production`. Output: `dist/tijerapp-frontend/browser`.
3. Agregar `vercel.json` en la raíz del frontend:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://tu-backend.railway.app/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
