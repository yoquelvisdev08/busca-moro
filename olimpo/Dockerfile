# Olimpo — nginx unificado: hub + Orion + Poseidon en :3000

FROM node:20-alpine AS orion-build
WORKDIR /app
COPY orion/frontend/package.json orion/frontend/package-lock.json* ./
RUN npm install
COPY orion/frontend/ .
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM node:20-alpine AS poseidon-build
WORKDIR /app
COPY poseidon/frontend/package.json ./
RUN npm install
COPY poseidon/frontend/ .
ENV VITE_API_BASE_URL=/api
ENV VITE_ORION_APP_URL=
RUN npm run build

FROM nginx:1.27-alpine
COPY olimpo/hub/index.html /usr/share/nginx/html/index.html
COPY --from=orion-build /app/dist /usr/share/nginx/html/orion
COPY --from=poseidon-build /app/dist /usr/share/nginx/html/poseidon
COPY olimpo/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
