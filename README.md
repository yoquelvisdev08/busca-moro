# SIPHON-X

> Sistema de prospección automatizada de clientes de desarrollo web.
> Detecta sitios deficientes, los audita, genera inteligencia de ventas con
> un LLM externo (DeepSeek por defecto, OpenAI-compatible) y prepara el
> outreach. Todo orquestado por colas Redis y persistido en PostgreSQL.

## Tabla de contenidos

1. [Arquitectura](#arquitectura)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Stack y por qué](#stack-y-por-qué)
4. [Bus de mensajería Redis](#bus-de-mensajería-redis)
5. [Modelo de datos](#modelo-de-datos)
6. [Puesta en marcha](#puesta-en-marcha)
7. [Flujo end-to-end](#flujo-end-to-end)
8. [Endpoints principales](#endpoints-principales)
9. [Operación y observabilidad](#operación-y-observabilidad)
10. [Anti-detección (stealth)](#anti-detección-stealth)
11. [Notas legales y éticas](#notas-legales-y-éticas)

---

## Arquitectura

```
                          +-----------------------------+
                          |  Frontend Void-Tech (React) |
                          |   served by Nginx           |
                          +--------------+--------------+
                                         |
                                         v
                  +----------------------+----------------------+
                  |               FastAPI (api)                 |
                  |   - REST v1, OpenAPI, ORJSON                |
                  |   - SQLAlchemy async + asyncpg              |
                  |   - Publica/lee en Redis (colas lógicas)    |
                  +---+----------+----------+----------+--------+
                      |          |          |          |
                      v          v          v          v
                +-----+--+ +-----+--+ +-----+--+ +-----+--+
                |Scout Go| |Auditor | |Closer  | |Sniper  |
                |        | |Playwr. | |LLM     | |Uptime  |
                +-----+--+ +-----+--+ +---+----+ +-----+--+
                      |          |        |            |
                      +----+-----+----+---+------------+
                           |          |        |
                           v          v        v
                       +---+---+  +---+----+ +-+--------+
                       | Redis |  |Postgres| | DeepSeek |
                       +-------+  +--------+ |(OpenAI-  |
                                             | compat)  |
                                             +----------+
```

Todos los servicios viven en `siphon-core` (red privada). El frontend y la
API también están en `siphon-edge`, expuestos vía Nginx Proxy Manager (puerto
80/443 al host, panel admin en `:81`).

## Estructura del repositorio

```
busca-moro/
├── docker-compose.yml          # Orquestación de toda la plataforma
├── .env.example                # Variables de entorno (copia a .env)
├── db/
│   └── schema.sql              # Esquema PostgreSQL (init script del contenedor)
├── api/                        # FastAPI orquestadora
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # Bootstrap + routers + lifespan
│       ├── core/               # Settings, DB async, Redis, logging JSON
│       ├── models/             # SQLAlchemy 2.x
│       ├── schemas/            # Pydantic v2 (DTOs)
│       ├── services/           # Casos de uso (capa entre router y modelo)
│       └── api/v1/             # Routers: leads, audits, sniper, sales-intel, monitor
├── scout/                      # Worker Go - descubrimiento
│   ├── cmd/scout/main.go
│   └── internal/{config,discovery,filters,fingerprint,proxy,queue,logging}
├── auditor/                    # Worker Python - Playwright + Lighthouse
│   └── auditor/{auditor_core,worker,stealth,lighthouse,extractors}
├── closer/                     # Worker Python - cliente LLM OpenAI-compatible
│   └── closer/{intelligence,llm_client,prompts,worker,api_client}
├── sniper/                     # Uptime Sniper (Python)
│   └── sniper/{monitor,worker,api_client}
├── frontend/                   # Vite + React + TS, estética Void-Tech
│   └── src/{components,pages,lib,styles}
├── nginx/                      # (reservado para configuraciones extra)
└── storage/screenshots/        # Volumen compartido entre Auditor y API
```

## Stack y por qué

| Capa                | Tecnología                            | Razón                                                                       |
|---------------------|---------------------------------------|------------------------------------------------------------------------------|
| API + orquestación  | **FastAPI 0.115 + SQLAlchemy 2 async**| Tipado fuerte, OpenAPI gratis, productividad senior                          |
| Scraping concurrente| **Go 1.23 + errgroup**                | Goroutines = miles de I/O concurrente sin GIL                                |
| Auditoría web       | **Playwright + Lighthouse CLI**       | Render real, fiable; Lighthouse oficial para Core Web Vitals                 |
| Generación IA       | **DeepSeek (OpenAI-compatible)**      | Latencia <5s en CPU, JSON mode nativo, costo bajo. Swap por OpenAI/Mistral/Groq cambiando `LLM_BASE_URL`. Ollama queda como perfil opcional `llm-local`. |
| Persistencia        | **PostgreSQL 16 + JSONB**             | Relacional + semi-estructurado en la misma tabla                             |
| Cola / pub-sub      | **Redis 7 (lists BRPOP/LPUSH)**       | Simple, atomic, mismo cliente en Go y Python                                 |
| Edge                | **Nginx Proxy Manager**               | TLS, dominios y proxy reverso administrable por UI                           |
| Frontend            | **Vite + React + TS**                 | DX moderno, sin frameworks pesados                                           |

## Bus de mensajería Redis

Hemos elegido **Redis Lists** con `LPUSH` (productor) y `BRPOP` (consumidor)
en vez de Celery. Razones:

- El **Scout** está escrito en Go; usar Celery exigiría un cliente
  inter-lenguaje. Las listas Redis son agnósticas y tienen contratos JSON
  triviales.
- Cada worker tiene su propio bucle de consumo con back-pressure natural
  (BRPOP con timeout corto + reintentos exponenciales).
- Aún se puede añadir Celery encima para tareas programadas si surge la
  necesidad.

### Colas lógicas (configurables por `.env`)

| Cola                       | Productor        | Consumidor       | Payload típico                                          |
|----------------------------|------------------|------------------|---------------------------------------------------------|
| `siphon:queue:discovery`   | Scout            | (opcional)       | `{ "url", "source" }`                                   |
| `siphon:queue:audit`       | API (`POST /v1/leads`, `/v1/leads/{id}/audit`) | Auditor | `{ "lead_id", "url" }`                                  |
| `siphon:queue:outreach`    | API (`POST /v1/audits` o `/v1/leads/{id}/closer`) | Closer | `{ "lead_id", "audit_id" }`                             |
| `siphon:queue:sniper`      | Sniper           | (subs futuros)   | Payload de alerta completo                              |
| `siphon:queue:dlq`         | Todos los workers| Operador humano  | `{ "payload": ..., "reason": ... }`                     |

### Cómo se conectan los módulos paso a paso

1. **Scout (Go)** lee `seeds.txt` y `dorks.txt`, scrapea Bing y derivados,
   ejecuta `fingerprint.Inspect` (HTTPS, TLS, tiempo, generator, Server,
   X-Powered-By, WP/PHP). Si `filters.Evaluate` marca el sitio como
   elegible, hace `POST /v1/leads` a la API.
2. **API** ejecuta `LeadService.upsert` (idempotente por
   `normalized_domain`) y publica `{lead_id, url}` en
   `siphon:queue:audit`. El lead queda en estado `queued`.
3. **Auditor (Python)** consume con `BRPOP`, lanza Chromium stealth,
   captura métricas, screenshot above-the-fold, extrae emails/teléfonos/
   redes y corre `lighthouse` CLI. Publica el resultado por
   `POST /v1/audits`.
4. **API** persiste el `Audit`, sincroniza campos rápidos en el `Lead`
   (denormalización para dashboard) y publica `{lead_id, audit_id}` en
   `siphon:queue:outreach`.
5. **Closer (Python)** consume con `BRPOP`, hace `GET /v1/leads/{id}` +
   `GET /v1/audits/lead/{id}`, llama al proveedor LLM dos veces (pain
   points en JSON, cold email en JSON) vía `/chat/completions`
   OpenAI-compatible, y persiste por `POST /v1/sales-intelligence`.
   El lead transiciona a `enriched`.
6. **Sniper** corre en paralelo: registra seeds, hace polling HTTP con
   `httpx`, cuenta fallos consecutivos y, al superar el threshold, publica
   alerta en `siphon:queue:sniper` y `POST /v1/sniper/alerts`. Opcional
   webhook externo (Slack/Telegram).

## Modelo de datos

Tablas principales (ver `db/schema.sql`):

- `leads` — núcleo del CRM (status enumerado: new → queued → auditing → audited → enriched → contacted → replied → won/rejected/error).
- `audits` — histórico de auditorías por lead, con `raw_json_data` (JSONB) de Lighthouse.
- `sales_intelligence` — pain points (JSONB array) + cold email generado por el LLM.
- `outreach_messages` — mensajes realmente enviados (email/WA/LI/phone) con tracking.
- `sniper_targets` / `sniper_alerts` — Uptime Sniper.
- `proxy_pool` — gestión central de proxies y métricas de salud.

Optimizaciones incluidas: índices GIN sobre JSONB (`tech_stack`,
`raw_json_data`, `pain_points`), trigger `updated_at` global, soft-delete
en leads, vista `v_lead_dashboard` para el frontend.

## Puesta en marcha

### Requisitos

- Docker + Docker Compose v2
- 4 GB de RAM libres (Playwright es el más pesado)
- Una API key compatible OpenAI (DeepSeek, OpenAI, Mistral, Groq, …)

### Pasos

```bash
cp .env.example .env
# Edita .env: contraseñas fuertes, LLM_API_KEY del proveedor y, si quieres,
# cambia LLM_BASE_URL/LLM_MODEL por otro proveedor compatible.

docker compose build
docker compose up -d postgres redis
docker compose up -d api scout auditor closer sniper frontend nginx-proxy-manager
```

> **LLM local opcional (Ollama):** si prefieres self-host en vez de DeepSeek,
> arranca el perfil `llm-local` y apunta el Closer al puerto de Ollama:
>
> ```bash
> docker compose --profile llm-local up -d ollama
> docker compose exec ollama ollama pull phi3:mini
> # En .env:
> #   LLM_BASE_URL=http://ollama:11434/v1
> #   LLM_API_KEY=ollama          # cualquier no-vacío
> #   LLM_MODEL=phi3:mini
> ```

Accesos:

- Frontend Void-Tech: `http://localhost/`
- API (Swagger UI): `http://localhost/api/docs`
- Nginx Proxy Manager admin: `http://localhost:81`

## Flujo end-to-end

```bash
# 1) Inyectar manualmente un lead (también lo hace el Scout solo)
curl -X POST http://localhost/api/v1/leads \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# 2) Ver depth de colas
curl http://localhost/api/v1/monitor/queues

# 3) Listar leads recientes
curl 'http://localhost/api/v1/leads?limit=20'

# 4) Forzar regeneración del Closer
curl -X POST http://localhost/api/v1/leads/<LEAD_ID>/closer

# 5) Registrar target para Sniper
curl -X POST http://localhost/api/v1/sniper/targets \
  -H "Content-Type: application/json" \
  -d '{"url":"https://competidor.example.com","label":"comp-1"}'
```

## Endpoints principales

| Método | Ruta                                  | Descripción                                              |
|--------|---------------------------------------|----------------------------------------------------------|
| GET    | `/health`                             | Liveness                                                 |
| POST   | `/v1/leads`                           | Upsert de lead + encolar para auditoría                  |
| GET    | `/v1/leads`                           | Listado paginado (filtro por status)                     |
| GET    | `/v1/leads/{id}`                      | Detalle                                                  |
| PATCH  | `/v1/leads/{id}`                      | Actualización parcial                                    |
| POST   | `/v1/leads/{id}/audit`                | Re-encolar para auditar                                  |
| POST   | `/v1/leads/{id}/closer`               | Encolar para inteligencia de ventas                      |
| POST   | `/v1/audits`                          | Callback del Auditor (worker)                            |
| GET    | `/v1/audits/{id}`                     | Detalle de auditoría                                     |
| GET    | `/v1/audits/lead/{lead_id}`           | Historial de auditorías de un lead                       |
| POST   | `/v1/sales-intelligence`              | Callback del Closer (worker)                             |
| POST   | `/v1/sniper/targets`                  | Upsert de target                                         |
| GET    | `/v1/sniper/targets`                  | Listado                                                  |
| POST   | `/v1/sniper/alerts`                   | Callback del Sniper                                      |
| GET    | `/v1/monitor/queues`                  | Profundidad de cada cola Redis                           |

## Operación y observabilidad

- **Logs**: todos los servicios Python emiten JSON estructurado vía
  `python-json-logger`. Go emite JSON con `slog`. Listos para Loki/ELK.
- **DLQ**: cualquier mensaje que falle de forma terminal cae en
  `siphon:queue:dlq` con `{ payload, reason }`. Inspecciona con:
  ```bash
  docker compose exec redis redis-cli -a "$REDIS_PASSWORD" LRANGE siphon:queue:dlq 0 -1
  ```
- **Profundidad de colas**: `GET /v1/monitor/queues` o el dashboard.
- **Health checks** definidos en `docker-compose.yml` para Postgres, Redis
  y la API. (Ollama solo si activas el perfil `llm-local`).

## Anti-detección (stealth)

- Scout y Auditor leen `user_agents.txt` y `proxies.txt`; cada request o
  contexto Playwright rota UA y proxy (con auth si corresponde).
- Playwright se inicializa con `playwright-stealth`, parchea
  `navigator.webdriver`, `window.chrome`, plugins y WebGL.
- Headers `Accept-Language` consistentes (`es-ES,es;q=0.9`).
- Viewport por defecto 1366x768; perfil mobile 375x667 para evaluar mobile
  friendly.
- Pool de proxies persistible en `proxy_pool` con métricas de éxito/fallo
  para futuras decisiones inteligentes de selección.

## Notas legales y éticas

Este sistema realiza scraping y auditoría sobre sitios web públicos. Es
responsabilidad del operador:

- Respetar `robots.txt` (`SCOUT_RESPECT_ROBOTS=true` por defecto).
- Cumplir GDPR / LOPDGDD / leyes locales sobre cold email y datos personales
  (incluye base legal de "interés legítimo", opt-out y revelación de
  identidad real del remitente).
- Cumplir los Términos de Servicio de cualquier API o motor de búsqueda
  utilizado. Para producción a escala, sustituir el `DorkScraper` por
  servicios autorizados (SerpAPI, Brave Search API, etc.).
- No usar el sistema para spam masivo, suplantación de identidad ni acceso
  no autorizado a infraestructura ajena.

El código no incluye, deliberadamente, capacidades ofensivas como escaneo
masivo de puertos sin permiso, brute-force, ni explotación de
vulnerabilidades.
