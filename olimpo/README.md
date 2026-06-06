# Olimpo — portal unificado

Shell web en **http://localhost:3000** que agrupa tus dos agencias:

| Ruta | App |
|------|-----|
| `/` | Olimpo (selector) |
| `/orion/` | Orion — prospección B2B |
| `/poseidon/` | Poseidon — leads calientes en español |
| `/api/` | Proxy a Orion API (:8000) |

## Levantar

```bash
docker compose build olimpo-frontend
docker compose up -d olimpo-frontend api poseidon
```

Los servicios `frontend` y `poseidon-frontend` separados quedaron bajo el profile `legacy-split-ui` (solo desarrollo).
