# Sistema de costeo por órdenes de proyecto — Tableros eléctricos

Aplicación web interna para determinar el costo real de cada tablero o proyecto (costeo por órdenes de producción): materiales directos, mano de obra directa, ingeniería y puesta en marcha, CIF asignados y mermas; costo total, costo unitario, margen y alertas.

**Fase 1 (MVP)** implementada. Requisitos completos en [`prompt.md`](prompt.md).

## Tecnología

- Next.js 15 (App Router) + TypeScript + Tailwind CSS — frontend y backend en un solo proyecto (Server Actions y Route Handlers).
- PostgreSQL + Prisma (migraciones). Auth.js (correo y contraseña, bcrypt, sesión JWT de 8 h).
- Motor de cálculo puro en TypeScript con `decimal.js` (`src/lib/costeo`). Nunca se usa punto flotante para dinero.
- PDF en el servidor con `@react-pdf/renderer`.
- Pruebas: Vitest (unitarias e integración) y Playwright (humo de extremo a extremo).

## Instalación local

Requisitos: Node.js 20+ y Docker (o un PostgreSQL 16 propio).

```bash
npm install
cp .env.example .env            # y cambie AUTH_SECRET (openssl rand -base64 32)
docker compose up -d            # PostgreSQL en el puerto 5433
npx prisma migrate deploy       # crea las tablas
npm run db:seed                 # roles, etapas, parámetros, usuarios demo y la orden OP-2026-0001
npm run dev                     # http://localhost:3000
```

Usuarios de demostración (contraseña `Costeo2026*`) — **cámbielos o desactívelos en producción**:

| Correo | Rol |
|---|---|
| admin@empresa.com | Administrador |
| contador@empresa.com | Contador |
| coordinador@empresa.com | Coordinador de proyectos |
| tecnico@empresa.com, ingeniera@empresa.com | Ingeniero / Técnico |
| gerencia@empresa.com | Gerencia (solo lectura) |

Para una base sin datos de demostración: `SEMILLA_DEMO=false npm run db:seed`.

## Pruebas

```bash
npm test                  # motor de cálculo (incluye el caso de aceptación §13)
npm run test:coverage     # cobertura del motor (umbral 90 %)
npm run test:integration  # CU-01, CU-02, CU-03 contra la base costeo_test (se crea sola en el Postgres de docker)
npm run build && npm run test:e2e   # humo con navegador (instale antes: npx playwright install chromium)
```

La prueba de extremo a extremo usa la base configurada en `.env` y crea órdenes «Tablero E2E …»; ejecútela sobre una base de desarrollo.

## Despliegue en Vercel

1. Cree una base PostgreSQL en **Neon** (desde *Storage* en Vercel o en neon.tech). Neon tiene restauración a un punto en el tiempo (respaldo diario automático).
2. Importe el repositorio en Vercel y defina las variables:
   - `DATABASE_URL`: URL **con pooler** de Neon (`...-pooler...?sslmode=require`).
   - `DIRECT_URL`: URL **sin pooler** (para migraciones).
   - `AUTH_SECRET`: secreto aleatorio. `AUTH_TRUST_HOST=true`.
3. En *Settings → Build*, use el comando `npm run vercel-build` (aplica migraciones y compila).
4. Ejecute la semilla una vez desde su equipo apuntando a Neon: `DATABASE_URL=... DIRECT_URL=... SEMILLA_DEMO=false npm run db:seed`, y cree el usuario administrador definitivo.

## Documentación

- [Manual de usuario por rol](docs/manual-usuario.md)
- [Documento técnico: modelo de datos, endpoints y fórmulas](docs/tecnico.md)
- [Supuestos y preguntas abiertas](docs/supuestos.md)
