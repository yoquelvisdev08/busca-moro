# Poseidon — leads calientes (intención de compra)

Módulo separado de Orion. Detecta personas que piden ayuda activamente (Reddit, foros) para **contacto manual**, no cold email automático.

## Estructura

```
poseidon/
├── poseidon_api/     # Dominio API — modelos, schemas, service, routes
├── worker/           # Worker Python + config + tests
├── frontend/         # UI en /poseidon/ vía Olimpo
└── Dockerfile        # Worker
```

## Integración

- **Worker** → `POST /v1/poseidon/signals` en Orion API
- **UI** → **http://localhost:3000/poseidon/** (dentro de Olimpo)
- **Solo español** → subreddits LATAM/España + filtro de idioma (`POSEIDON_REQUIRE_SPANISH=true`)
- **Redis** → `orion:signal:poseidon_scan` para escaneo manual

## Comandos

```bash
docker compose build olimpo-frontend poseidon api
docker compose up -d olimpo-frontend api poseidon
```

Portal: **http://localhost:3000** · Poseidon: **/poseidon/** · Orion: **/orion/**

## Variables útiles

| Variable | Descripción |
|----------|-------------|
| `POSEIDON_USE_ARCTIC_SHIFT` | Fuente principal (Reddit reciente) |
| `POSEIDON_USE_LLM` | Clasificación DeepSeek (requiere créditos) |
| `POSEIDON_REQUIRE_SPANISH` | Solo guardar posts en español (default: true) |
