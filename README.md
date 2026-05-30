# SIPHON-X Agency Platform

Plataforma de generación de leads con inteligencia artificial para agencias de optimización web. Descubre sitios web con problemas, genera reportes profesionales automatizados y ejecuta campañas de outreach en frío.

## 🎯 Modelo de Negocio

**Agencia de Optimización Web**: SIPHON-X descubre negocios con sitios web deficientes, cuantifica sus pérdidas de revenue, y les envía propuestas de mejora personalizadas.

### Flujo de Valor

1. **Descubrimiento** → Scout encuentra sitios web con problemas técnicos
2. **Auditoría** → Auditor analiza con Lighthouse + señales comerciales
3. **Inteligencia** → Closer genera pain points con estimación de pérdida de revenue ($X/mes)
4. **Reportes** → Genera PDFs profesionales con WeasyPrint
5. **Outreach** → Envía emails personalizados con PDF adjunto vía Resend
6. **Follow-up** → Secuencias automáticas (Day 0, 3, 7) con Redis

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  Dashboard │ Leads │ LeadDetail │ Reports │ Monitor       │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────────┐
│                      API (FastAPI)                           │
│  /leads │ /reports │ /outreach │ /follow-ups │ /monitor     │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│Scout │  │Auditor │  │Closer  │  │Sniper  │  │SearXNG │
│(Go)  │  │(Python)│  │(Python)│  │(Python)│  │(Search)│
└──┬───┘  └───┬────┘  └───┬────┘  └───┬────┘  └────────┘
   │          │           │           │
   └──────────┴───────────┴───────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────┐         ┌────────┐
│Postgres│         │ Redis  │
│  (DB)  │         │(Queue) │
└────────┘         └────────┘
```

## 📦 Servicios

| Servicio | Tecnología | Puerto | Descripción |
|----------|-----------|--------|-------------|
| **frontend** | React 18 + Vite + TypeScript | 3000 | SPA con design system completo |
| **api** | FastAPI + SQLAlchemy | 8000 | Hub central REST + WebSocket |
| **scout** | Go 1.23 | - | Discovery con SearXNG + Google Maps |
| **auditor** | Python + Playwright | - | Auditoría Lighthouse + screenshots |
| **closer** | Python + DeepSeek | - | Inteligencia de ventas con LLM |
| **sniper** | Python | - | Monitoreo de uptime |
| **searxng** | SearXNG | 8080 | Meta-buscador self-hosted |
| **postgres** | PostgreSQL 16 | 5432 | Base de datos principal |
| **redis** | Redis 7 | 6379 | Colas de mensajes + caché |

## 🚀 Deploy Rápido

### Requisitos

- Docker Desktop 24+
- Docker Compose v2+
- 8GB RAM mínimo
- 20GB espacio en disco

### Pasos

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd busca-moro

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys

# 3. Deploy automático
./deploy.sh
```

### Acceso

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Nginx Admin**: http://localhost:81

## 🎨 Frontend

### Stack Tecnológico
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Component primitives
- **TanStack Query** - Server state management
- **React Router v6** - Routing
- **Recharts** - Charts (lazy loaded)
- **Zustand** - UI state management

### Estructura de Carpetas
```
frontend/src/
├── components/
│   ├── ui/              # shadcn/ui primitives (Button, Input, Card, etc.)
│   ├── charts/          # AreaChart, MetricCard, Sparkline, TrendIndicator
│   ├── tables/          # DataTable con sorting/filtering/pagination
│   ├── domain/          # StatusLED, Chip, LeadCard, TabGroup
│   └── layout/          # Sidebar, Header, PageContainer
├── pages/               # 8 páginas (Dashboard, Leads, LeadDetail, etc.)
├── lib/                 # Utils, API client
├── stores/              # Zustand stores (UI state)
└── styles/              # Tailwind + design tokens (Kinetic Ledger)
```

### Cómo Correr (Desarrollo)
```bash
cd frontend
npm install
npm run dev          # Dev server en http://localhost:5173
npm run build        # Build de producción
npm test             # Tests con Vitest
```

### Cómo Agregar Páginas
1. Crear archivo en `src/pages/MiPagina.tsx`
2. Agregar ruta en `src/App.tsx` con React.lazy:
```tsx
const MiPagina = lazy(() => import('./pages/MiPagina'))
```
3. Agregar link en Sidebar (`src/components/layout/Sidebar.tsx`)

### Cómo Agregar Componentes
1. Crear archivo en `src/components/[categoria]/MiComponente.tsx`
2. Exportar desde `src/components/[categoria]/index.ts`
3. Importar en páginas: `import { MiComponente } from '@/components/[categoria]'`

Ver documentación completa de componentes en [docs/components.md](docs/components.md)

### Design System: "Kinetic Ledger"
- **Modo**: Dark mode only
- **Colores primarios**: Indigo (#6366f1), Purple (#a855f7)
- **Fondos**: Slate oscuro (#0b1326, #1a2539, #243047)
- **Tipografía**: Geist (headlines), Inter (body), JetBrains Mono (code)
- **Spacing**: 4px base unit
- **Border radius**: 4px (sm), 8px (md), 12px (lg)
- **Elevation**: Glow effects en lugar de shadows

Ver todos los tokens en `frontend/src/styles/design-tokens.ts`

### Testing
```bash
npm test                    # Correr todos los tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # Con coverage
```

Stack: Vitest + Testing Library + MSW (API mocking)

### Deployment
El frontend se sirve como static files desde Docker:
```bash
cd frontend
npm run build
docker build -t siphon-frontend .
docker run -p 3000:80 siphon-frontend
```

O deploy a Vercel/Netlify:
```bash
vercel --prod
```

## 📊 Fases Implementadas

### ✅ Fase 1: Revenue Loss Calculations
- Fórmula determinística basada en benchmarks de Akamai/Google
- 5 factores: load time, LCP, mobile, SSL, Lighthouse score
- Inyección en prompts del Closer (Segment A/B con "$X/mes perdido")
- **Commit**: `a48a3da` | **Líneas**: ~200

### ✅ Fase 2: PDF Report Generation
- WeasyPrint + Jinja2 templates
- 7 secciones: cover, executive summary, technical audit, commercial analysis, pain points, recommendations, service proposal
- 6 endpoints REST para gestión de reportes
- **Commit**: `3946e3f` | **Líneas**: ~800

### ✅ Fase 3: Email Attachments + Follow-up Automation
- Attachments en base64 (límite 25MB) vía Resend API
- FollowUpService con Redis sorted sets
- Background poller cada 60s
- Exponential backoff retry (max 3 intentos)
- **Commit**: `69b0bd2` | **Líneas**: ~400

### ✅ Fase 4: Stitch UI Redesign
- Design system con 9 componentes reutilizables
- 7 páginas (Dashboard, Leads, LeadDetail, Settings, Discover, Monitor, Reports)
- 20+ React Query hooks
- Tema oscuro profesional con acentos indigo/purple
- **Commit**: `36b136b` | **Líneas**: ~3,100

## 🔧 Configuración

### Variables de Entorno Clave

```bash
# Base de datos
POSTGRES_DB=siphon
POSTGRES_USER=siphon
POSTGRES_PASSWORD=<tu-password>

# Redis
REDIS_PASSWORD=<tu-password>

# LLM Provider (DeepSeek)
LLM_API_KEY=sk-<tu-api-key>
LLM_MODEL=deepseek-chat

# Email (Resend)
EMAIL_API_KEY=re_<tu-api-key>
EMAIL_FROM=outreach@tu-dominio.com

# SearXNG
SEARXNG_SECRET=<tu-secret>
```

### Migraciones de Base de Datos

```bash
# Ejecutar migraciones
docker compose run --rm api alembic upgrade head

# Crear nueva migración
docker compose run --rm api alembic revision --autogenerate -m "descripcion"

# Revertir última migración
docker compose run --rm api alembic downgrade -1
```

## 🧪 Testing

```bash
# Tests de API
docker compose exec api pytest tests/ -v

# Tests de Frontend
docker compose exec frontend npm test

# Tests de Scout
docker compose exec scout go test ./... -v
```

## 📈 Uso

### 1. Descubrir Leads

```bash
# Iniciar discovery con Scout
curl -X POST http://localhost:8000/api/v1/scout/discover \
  -H "Content-Type: application/json" \
  -d '{"industry": "restaurants", "location": "Miami"}'
```

### 2. Generar Reporte PDF

```bash
# Generar reporte para un lead
curl -X POST http://localhost:8000/api/v1/reports/generate \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "uuid-del-lead"}'
```

### 3. Enviar Email con PDF

```bash
# Enviar outreach con PDF adjunto
curl -X POST http://localhost:8000/api/v1/outreach/send \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "uuid-del-lead",
    "report_id": "uuid-del-reporte",
    "subject": "Tu sitio web está perdiendo $5,000/mes",
    "body": "..."
  }'
```

### 4. Programar Follow-ups

```bash
# Programar secuencia de follow-ups
curl -X POST http://localhost:8000/api/v1/follow-ups/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "uuid-del-lead",
    "sequence": [
      {"delay_days": 0, "subject": "Primer contacto"},
      {"delay_days": 3, "subject": "Seguimiento"},
      {"delay_days": 7, "subject": "Último recordatorio"}
    ]
  }'
```

## 🛠️ Comandos Útiles

```bash
# Ver logs de un servicio
docker compose logs -f api

# Reiniciar un servicio
docker compose restart scout

# Shell en contenedor
docker compose exec api bash

# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes
docker compose down -v

# Reconstruir imágenes
docker compose build --no-cache
```

## 📚 Documentación Adicional

- [API Reference](http://localhost:8000/docs) - Swagger UI interactivo
- [Design System](frontend/src/design-system/) - Componentes reutilizables
- [Database Schema](db/schema.sql) - Estructura de base de datos
- [Deployment Guide](DEPLOYMENT.md) - Guía de deploy en producción

## 🎓 Aprendizajes Clave

### WeasyPrint en Docker
- Requiere dependencias del sistema: `libcairo2`, `libpango-1.0-0`, `libgdk-pixbuf2.0-0`
- No funciona en macOS local, solo en Docker/Linux
- Solución: usar contenedor Docker para generación de PDFs

### Redis Sorted Sets para Scheduling
- Eficiente para colas con prioridad temporal
- `ZADD` con timestamp como score
- `ZRANGEBYSCORE` para obtener items vencidos
- Mejor que Celery para casos simples

### Design System con Tokens
- Consistencia visual en 8 páginas
- Fácil mantenimiento y cambios globales
- Componentes reutilizables reducen duplicación

### Revenue Loss Formula
```
base_revenue = estimated_traffic * conversion_rate * avg_order_value
loss_percentage = (load_time_penalty + lcp_penalty + mobile_penalty + ssl_penalty + lighthouse_penalty)
monthly_loss = base_revenue * loss_percentage
```

## 🤝 Contribución

Este proyecto fue desarrollado con SDD (Spec-Driven Development):

1. **Exploración** → Análisis de requerimientos y arquitectura
2. **Propuesta** → Definición de scope y enfoque
3. **Specs** → Especificaciones detalladas por fase
4. **Design** → Diseño técnico de componentes
5. **Tasks** → Breakdown de tareas implementables
6. **Apply** → Implementación incremental con commits atómicos
7. **Verify** → Validación de cumplimiento de specs

## 📄 Licencia

Propietario - Todos los derechos reservados

## 👤 Autor

Desarrollado por Yoquelvis Jorge Abreu  
Contacto: yoquelvis@yoquelvis.dev

---

**Estado**: ✅ Producción Ready  
**Última actualización**: 2026-05-29  
**Versión**: 1.0.0
