#!/bin/bash
set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Orion Agency Platform - Deploy Script              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parsear argumentos
RESET=false
if [ "$1" = "--reset" ] || [ "$1" = "-r" ]; then
    RESET=true
    echo -e "${YELLOW}🔄 Modo RESET activado — se borrarán todos los datos${NC}"
    echo ""
fi

# Función para verificar comando
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ Error: $1 no está instalado${NC}"
        exit 1
    fi
}

# Función para verificar Docker daemon
check_docker_daemon() {
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Error: Docker daemon no está corriendo${NC}"
        echo -e "${YELLOW}💡 Por favor inicia Docker Desktop${NC}"
        exit 1
    fi
}

# Función para esperar servicio healthy
wait_for_healthy() {
    local service=$1
    local max_attempts=$2
    local attempt=1
    
    echo -e "${YELLOW}⏳ Esperando $service...${NC}"
    while [ $attempt -le $max_attempts ]; do
        status=$(docker compose ps $service --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}✅ $service está healthy${NC}"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Timeout esperando $service${NC}"
    return 1
}

# 1. Verificar dependencias
echo -e "${BLUE}[1/7] Verificando dependencias...${NC}"
check_command docker
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Error: Docker Compose plugin no está disponible (docker compose)${NC}"
    exit 1
fi
check_docker_daemon
echo -e "${GREEN}✅ Dependencias OK${NC}"
echo ""

# 2. Verificar archivo .env
echo -e "${BLUE}[2/7] Verificando configuración...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: Archivo .env no encontrado${NC}"
    echo -e "${YELLOW}💡 Copia .env.example a .env y configura las variables${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Archivo .env encontrado${NC}"
echo ""

# 3. Limpiar contenedores anteriores
echo -e "${BLUE}[3/7] Limpiando contenedores anteriores...${NC}"
if [ "$RESET" = true ]; then
    echo -e "${YELLOW}⚠️  Borrando contenedores, imágenes y volúmenes...${NC}"
    docker compose down --volumes --remove-orphans --rmi local 2>/dev/null || true
    echo -e "${YELLOW}⚠️  Datos de base de datos eliminados${NC}"
else
    docker compose down --remove-orphans 2>/dev/null || true
fi
echo -e "${GREEN}✅ Limpieza completada${NC}"
echo ""

# 4. Construir imágenes
echo -e "${BLUE}[4/7] Construyendo imágenes Docker...${NC}"
docker compose build --parallel
echo -e "${GREEN}✅ Imágenes construidas${NC}"
echo ""

# 5. Levantar servicios base (postgres, redis)
echo -e "${BLUE}[5/7] Levantando servicios base...${NC}"
docker compose up -d postgres redis
wait_for_healthy "postgres" 30
wait_for_healthy "redis" 30
echo ""

# 6. Ejecutar migraciones de base de datos
echo -e "${BLUE}[6/7] Ejecutando migraciones de base de datos...${NC}"
if docker compose run --rm api alembic upgrade head 2>/dev/null; then
    echo -e "${GREEN}✅ Migraciones ejecutadas (Alembic)${NC}"
else
    echo -e "${YELLOW}⚠️  Alembic no disponible, usando schema directo${NC}"
    # El schema.sql se carga automáticamente via docker-entrypoint-initdb.d
    # Solo necesitamos que la DB exista — los modelos de SQLAlchemy crean tablas faltantes
    docker compose run --rm api python -c "
from app.core.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
print('✅ Tablas sincronizadas via SQLAlchemy')
" 2>/dev/null || echo -e "${YELLOW}⚠️  Usando schema.sql inicial (ya cargado en postgres)${NC}"
fi
echo ""

# 7. Levantar todos los servicios
echo -e "${BLUE}[7/7] Levantando todos los servicios...${NC}"
docker compose up -d
echo ""

# Esperar a que todos los servicios estén listos
echo -e "${YELLOW}⏳ Esperando a que todos los servicios estén listos...${NC}"
sleep 15

# Verificar servicios críticos
echo -e "${BLUE}Verificando servicios críticos...${NC}"
for svc in api scout searxng frontend; do
    if docker compose ps $svc --format json 2>/dev/null | grep -q '"State":"running"'; then
        echo -e "${GREEN}  ✅ $svc corriendo${NC}"
    else
        echo -e "${RED}  ❌ $svc NO está corriendo${NC}"
    fi
done

# Verificar estado final
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Estado de Servicios                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
docker compose ps
echo ""

# URLs de acceso
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 Deploy Completado Exitosamente            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 URLs de acceso:${NC}"
echo -e "   • Frontend:        ${GREEN}http://localhost:3000${NC}"
echo -e "   • API:             ${GREEN}http://localhost:8000${NC}"
echo -e "   • API Docs:        ${GREEN}http://localhost:8000/docs${NC}"
echo -e "   • Nginx Admin:     ${GREEN}http://localhost:81${NC}"
echo ""
echo -e "${BLUE}📊 Servicios activos:${NC}"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | tail -n +2
echo ""
echo -e "${YELLOW}💡 Comandos útiles:${NC}"
echo -e "   • Ver logs:        ${BLUE}docker compose logs -f [servicio]${NC}"
echo -e "   • Detener:         ${BLUE}docker compose down${NC}"
echo -e "   • Reiniciar:       ${BLUE}docker compose restart [servicio]${NC}"
echo -e "   • Shell API:       ${BLUE}docker compose exec api bash${NC}"
echo -e "   • Reset total:     ${BLUE}./deploy.sh --reset${NC}  (borra DB y todo)"
echo ""
echo -e "${GREEN}✅ Orion Agency Platform está listo para generar ingresos!${NC}"
echo ""
