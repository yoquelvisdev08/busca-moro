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
│  Dashboard │ Leads │ LeadDetail │ Campaigns │ Reports       │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────────┐
│                      API (FastAPI)                           │
│  /leads │ /reports │ /outreach │ /follow-ups │ /campaigns   │
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
- 8 páginas rediseñadas (Dashboard, Leads, LeadDetail, Settings, Discover, Monitor, Campaigns, Reports)
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
