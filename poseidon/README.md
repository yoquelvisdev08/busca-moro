# Poseidon — leads calientes (intención de compra)

Módulo separado de Orion. Detecta personas que piden ayuda activamente (Reddit, foros) para **contacto manual**, no cold email automático.

## Estructura

```
poseidon/
├── poseidon_api/     # Dominio API — modelos, schemas, service, routes
├── worker/           # Worker Python + config + tests
├── frontend/         # UI propia (puerto 3001)
└── Dockerfile        # Worker
```

## Integración

- **Worker** → `POST /v1/poseidon/signals` en Orion API
- **UI** → app independiente en **http://localhost:3001** (no dentro de Orion)
- **Redis** → `orion:signal:poseidon_scan` para escaneo manual

## Comandos

```bash
docker compose build poseidon poseidon-frontend api
docker compose up -d poseidon poseidon-frontend api
```

Abrir **http://localhost:3001** (Poseidon). Orion sigue en **http://localhost:3000**.

## Variables útiles

| Variable | Descripción |
|----------|-------------|
| `POSEIDON_USE_ARCTIC_SHIFT` | Fuente principal (Reddit reciente) |
| `POSEIDON_USE_LLM` | Clasificación DeepSeek (requiere créditos) |
| `POSEIDON_MIN_INTENT_NO_LLM` | Umbral keywords si LLM no disponible |
