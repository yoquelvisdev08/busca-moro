#!/usr/bin/env bash
# Elimina contenedor scout huérfano y levanta el stack (conflicto de nombre /orion-scout).
set -e
cd "$(dirname "$0")/.."

echo "Deteniendo compose..."
docker compose stop scout 2>/dev/null || true

for id in $(docker ps -aq --filter "name=orion-scout"); do
  echo "Eliminando contenedor scout: $id"
  docker rm -f "$id" 2>/dev/null || true
done

echo "Reconstruyendo y levantando scout..."
docker compose build scout
docker compose up -d scout

echo "Estado:"
docker compose ps scout
echo ""
echo "Logs (lead_published): docker compose logs scout -f | grep lead_published"
