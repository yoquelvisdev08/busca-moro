#!/usr/bin/env bash
# Reencola jobs closer_failed desde la DLQ hacia orion:queue:outreach.
set -e
cd "$(dirname "$0")/.."

ARGS=("$@")
docker compose cp scripts/requeue-dlq-closer.py api:/tmp/requeue-dlq-closer.py >/dev/null
docker compose exec api sh -c "PYTHONPATH=/app python /tmp/requeue-dlq-closer.py ${ARGS[*]}"
