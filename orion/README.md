# Orion — plataforma B2B de prospección web

Módulo principal del monorepo **busca-moro**. Descubre sitios con problemas, audita, genera inteligencia comercial y ejecuta outreach.

## Estructura

```
orion/
├── api/              # FastAPI — leads, outreach, reports, discovery, monitor
├── frontend/         # React — dashboard, leads, discover (puerto 3000)
├── discovery/        # Worker Scout (Go) — búsqueda de negocios vía SearXNG / Maps
├── audit/            # Worker Auditor (Python) — Lighthouse + screenshots
├── intelligence/     # Worker Closer (Python) — pain points y revenue loss (LLM)
├── monitor/          # Worker Sniper (Python) — alertas de uptime
└── infra/
    ├── db/           # schema.sql inicial PostgreSQL
    └── searxng/      # configuración meta-buscador
```

## Flujo de negocio

1. **discovery** encuentra URLs candidatas
2. **audit** analiza rendimiento y señales técnicas
3. **intelligence** cuantifica pérdida y redacta argumentos
4. **api** orquesta leads, reportes PDF y campañas
5. **frontend** operación diaria del pipeline

## Comandos

Desde la raíz del repo:

```bash
docker compose build api frontend scout auditor closer sniper
docker compose up -d api frontend scout
```

API: `http://localhost:8000` · UI: `http://localhost:3000`
