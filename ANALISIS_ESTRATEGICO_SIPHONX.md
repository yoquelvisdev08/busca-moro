# SIPHON-X :: Analisis Estrategico y Tecnico
## Como Capturar Leads de Calidad Dispuestos a Pagar + Diagnostico del Frontend

---

## PARTE 1: ANALISIS DE NEGOCIO — Leads de Calidad y Monetizacion

### 1.1. El Problema Fundamental del Sistema Actual

El SIPHON-X en su estado actual captura leads basados en **deficiencias tecnicas** del sitio web. Esto es correcto desde el punto de vista tecnico, pero **insuficiente** desde el punto de vista comercial. Detectar un sitio lento o con SSL caducado no garantiza que el dueno de ese sitio:

- Tenga presupuesto para contratar un redisenio.
- Entienda el valor de invertir en su presencia digital.
- Sea una empresa con decision de compra (B2B), no un hobbyista o un blog personal sin monetizacion.
- Este en una ubicacion geografica accesible para tu agencia.

**En resumen: el sistema encuentra sitios "rotos", no clientes "compradores".**

### 1.2. Los 5 Pilares para que un Lead sea "de Calidad" y Dispuesto a Pagar

Para un sistema de prospeccion de agencias de desarrollo web, un lead de calidad debe cumplir al menos 3 de estos 5 criterios:

| # | Pilar | Por que importa | Como detectarlo |
|---|-------|---------------|---------------|
| 1 | **Tiene ingresos reales** | Un sitio de un negocio que genera dinero tiene presupuesto para mejorar. | Deteccion de e-commerce (cart, checkout, pasarelas de pago), presencia de ads (Google Ads, Meta Pixel), formularios de reserva, precios publicados. |
| 2 | **Tiene trafico real** | Un sitio con visitas tiene incentivo para mejorar la conversion. | Integracion con APIs de trafico estimado (SimilarWeb, SEMrush) o detectar analiticas (Google Analytics 4, Meta Pixel, Hotjar). |
| 3 | **Compite digitalmente** | Si tiene competidores activos online, siente presion por mejorar. | Deteccion de SEO activo (blog con contenido reciente, backlinks, schema.org), presencia en redes sociales con engagement, Google Business Profile. |
| 4 | **Ha invertido previamente** | Si ya pago por un sitio, entiende el valor y puede pagar de nuevo. | Deteccion de CMS premium (Shopify Plus, Webflow, Squarespace), plugins de pago, tema premium, hosting pago (no gratuito). |
| 5 | **Tiene capacidad de decision** | El contacto extraido debe ser del dueno, gerente o director comercial, no de un empleado de bajo nivel. | Enriquecimiento de datos via API (Hunter.io, Apollo, Clearbit) a partir del email de contacto. |

### 1.3. Debilidades Actuales del Scout y Auditor (y su Impacto Comercial)

#### A) El Fingerprint es Demasiado Basico

El `fingerprint.go` actual detecta:
- SSL, certificado, load time, Server header, X-Powered-By, WordPress version, PHP version, titulo.

**Lo que NO detecta y deberia:**

| Falta | Impacto Comercial |
|-------|-------------------|
| E-commerce (WooCommerce, Shopify, Magento, PrestaShop) | No sabes si el sitio vende online o es un brochure. |
| Plataformas de pago (Stripe, MercadoPago, PayPal) | Indicador directo de transacciones reales. |
| Marketing stack (Google Analytics, Meta Pixel, HubSpot, Mailchimp) | Indica inversion en marketing digital = consciente del valor del trafico. |
| CRM/Booking (Calendly, Typeform, Zendesk) | Indica operacion de ventas/soporte activa. |
| Hosting/CDN (Cloudflare, AWS, Vercel) | Indica nivel tecnico y presupuesto. |
| Presencia de ads / monetizacion | Indica modelo de negocio activo. |
| Contenido reciente / frecuencia de actualizacion | Indica si el negocio esta vivo o abandonado. |
| Ubicacion fisica del negocio | Para ofertas locales o visitas presenciales. |

#### B) Los Filtros Califican por "Problemas", no por "Potencial de Pago"

El `filters.go` actual da score positivo por:
- SSL faltante (+30)
- Load time lento (+25)
- WordPress viejo (+25)
- PHP viejo (+20)
- Error 5xx (+15)

**Problema:** Un sitio de un blog personal con WordPress 4.9 y sin SSL tendria un score de 55 y seria considerado "lead de alta calidad". Pero un blog personal **no tiene presupuesto** para contratar una agencia.

**Propuesta: Sistema de Scoring Dual**

```
SCORE_TOTAL = SCORE_PROBLEMA * PESO_PROBLEMA + SCORE_POTENCIAL * PESO_POTENCIAL
```

| Problema | Score | Potencial | Score |
|----------|-------|-----------|-------|
| Sin SSL | 30 | Tiene e-commerce | 50 |
| Load > 3s | 25 | Tiene pasarela de pago | 40 |
| WP < 5.0 | 25 | Usa CRM/reservas | 30 |
| PHP < 7.4 | 20 | Tiene pixel de analytics | 20 |
| Error 5xx | 15 | Blog activo (< 3 meses) | 15 |
| Mobile no friendly | 20 | Redes sociales activas | 15 |
| No indexable (robots.txt bloquea) | 15 | Hosting pago/CDN | 10 |
| Sin favicon | 5 | Presencia en directorios (Google Maps, Yelp) | 10 |

**Umbral minimo para considerar lead:** SCORE_PROBLEMA >= 20 AND SCORE_POTENCIAL >= 20

Esto descarta automaticamente sitios "rotos pero irrelevantes" (blogs abandonados, sitios personales) y prioriza sitios "rotos pero con negocio detras".

#### C) El Auditor NO Analiza el Contenido ni la Frecuencia de Actualizacion

El `auditor_core.py` toma screenshot, mide Lighthouse, extrae contactos. **Pero no analiza:**

- Fecha del ultimo post del blog (indica si el negocio esta activo).
- Calidad del contenido (thin content, duplicado, sin SEO).
- Estructura de navegacion (confusa, rota, deep linking malo).
- Presencia de CTA (Call to Action): botones de "Contactar", "Comprar", "Reservar".
- Calidad del copy (generico, desactualizado, errores ortograficos masivos).
- Fotos de stock vs fotos reales del negocio.

**Impacto:** No puedes argumentar el valor de tu propuesta con datos de contenido. Un argumento de venta fuerte seria: "Tu ultimo blog post tiene 18 meses, Google penaliza sitios sin contenido fresco, y tus competidores X, Y, Z publican semanalmente." Eso **vende**. "Tu sitio tarda 4 segundos en cargar" suena tecnico y no conecta con el dolor del negocio.

### 1.4. Propuesta: Arquitectura de Enriquecimiento de Leads

Para transformar SIPHON-X en una maquina de capturar clientes con presupuesto, se propone una **nueva capa de enriquecimiento** que se ejecute ANTES de que un lead sea considerado "de alta calidad".

```
Scout encuentra URL
    |
    v
FASE 1: Fingerprint Basico (ya existe)
    |
    v
FASE 2: Enriquecimiento Comercial (NUEVO)
    - Detecta e-commerce, pagos, analytics, CRM
    - Scrapea precios si es e-commerce
    - Detecta frecuencia de blog posts
    - Extrae ubicacion fisica del negocio
    - Detecta competidores directos (via keywords o similar)
    |
    v
FASE 3: Scoring Dual (Problema + Potencial)
    |
    v
FASE 4: Si score total > umbral → Encola para Auditoria
    |
    v
Auditor (Playwright + Lighthouse + Analisis de Contenido)
    |
    v
Closer (LLM genera pitch personalizado con datos de enriquecimiento)
```

#### Modulo de Enriquecimiento Comercial: Detecciones Necesarias

```go
// En scout/internal/enrichment/commercial.go

package enrichment

type CommercialSignals struct {
    HasEcommerce       bool     // WooCommerce, Shopify, Magento, PrestaShop
    HasPaymentGateway  bool     // Stripe, MercadoPago, PayPal, Square
    HasAnalytics       bool     // GA4, GTM, Meta Pixel, Hotjar
    HasCRM             bool     // HubSpot, Salesforce, Calendly, Typeform
    HasBooking         bool     // Reservas online
    HasAds             bool     // Google Ads conversion tracking, FB pixel
    ContentFreshness   int      // Dias desde ultimo post/pagina actualizada
    PriceRange         *string  // "low", "mid", "high" (detectado de productos)
    PhysicalLocation   *string  // Direccion extraida de contacto o schema.org
    CompetitorMention  []string // Competidores mencionados en el sitio
    SocialActivity     bool     // Redes sociales linkeadas con posts recientes
    IsPremiumHosting   bool     // Cloudflare Pro, AWS, VPS dedicado
}
```

#### Modulo de Analisis de Contenido (Nuevo en Auditor)

```python
# En auditor/auditor/content_analyzer.py

@dataclass
class ContentAnalysis:
    last_blog_post_days: Optional[int]
    total_blog_posts: Optional[int]
    has_cta_above_fold: bool
    has_testimonials: bool
    has_pricing_page: bool
    has_portfolio: bool
    has_team_photos: bool
    stock_photo_ratio: float  # % de imagenes que parecen stock
    spelling_errors_count: int
    seo_title_optimized: bool
    meta_description_present: bool
    heading_structure_valid: bool
    has_schema_org: bool
```

### 1.5. Estrategia de Segmentacion de Leads por Valor Comercial

No todos los leads deben recibir el mismo tratamiento. Propongo **4 segmentos**:

| Segmento | Criterios | Estrategia de Outreach | Precio Esperado |
|----------|-----------|------------------------|-----------------|
| **A — Enterprise** | E-commerce + trafico alto + problemas severos + decision maker contactable | Llamada telefonica + propuesta formal PDF + demo personalizada | $5,000 - $50,000+ |
| **B — Profesional** | CMS premium + inversion previa + problemas moderados + redes activas | Email personalizado con video Loom + calendly de 30 min | $1,000 - $5,000 |
| **C — Startup/SMB** | Negocio local activo + problemas basicos + contacto email | Email semi-personalizado (plantilla con datos de enriquecimiento) + seguimiento WhatsApp | $300 - $1,500 |
| **D — No prioritario** | Problemas tecnicos pero sin senales comerciales | Email automatizado de valor (reporte gratuito de auditoria) + nurturo de 3 toques | $0 - $500 (o descartar) |

**El Closer debe generar un email DIFERENTE para cada segmento.**

- **Segmento A:** Habla de ROI, conversion rate, revenue perdida, benchmark con competidores.
- **Segmento B:** Habla de profesionalismo, confianza del cliente, diferenciacion.
- **Segmento C:** Habla de ahorro de tiempo, facilidad, soporte local.
- **Segmento D:** Ofrece un reporte gratuito de valor sin pedir nada a cambio (lead magnet).

### 1.6. Integraciones Comerciales Necesarias

Para enriquecer leads, se necesitan integraciones con APIs de terceros:

| Servicio | Uso | Costo aprox | Prioridad |
|----------|-----|-------------|-----------|
| **Hunter.io / Apollo.io** | Enriquecimiento de emails: encontrar decision makers, titulos, LinkedIn | $50-200/mes | ALTA |
| **SimilarWeb / SEMrush** | Trafico estimado del sitio, keywords, competidores | $100-300/mes | MEDIA |
| **Clearbit / ZoomInfo** | Enriquecimiento de empresa: tamano, industria, revenue | $200-500/mes | MEDIA |
| **Google Places API** | Verificar ubicacion fisica del negocio, horarios, reviews | ~$5/1000 requests | BAJA |
| **BuiltWith / Wappalyzer API** | Stack tecnologico completo (mas alla de headers) | $50-100/mes | ALTA |

**Alternativa gratuita:** Scrapear Google Business Profile, LinkedIn Company, y hacer heuristicas propias. Mas lento, pero sin costo.

### 1.7. El "Pain Point" que Realmente Vende

El sistema actual genera "pain points" basados en metricas tecnicas (Lighthouse score, load time). **Pero los clientes no pagan por metricas tecnicas; pagan por dinero perdido.**

#### Ejemplo: Email Actual vs Email Propuesto

**Email ACTUAL (basado en Lighthouse):**
> "Su sitio tiene un score de Lighthouse de 42/100. El LCP es de 4.2s y el CLS es 0.15. Recomendamos optimizar el renderizado critico y reducir el layout shift."

**Email PROPUESTO (basado en dinero perdido):**
> "Vi que su tienda online carga en 5.2 segundos. Segun Google, por cada segundo de demora, el 20% de los visitantes abandona antes de comprar. Si su sitio recibe ~1,000 visitas/mes y su ticket promedio es $80, eso significa que podria estar perdiendo aproximadamente $3,200 al mes en ventas que nunca se concretan. Esto le costaria un redisenio de $2,500 que se pagaria solo en 3 semanas. ¿Tiene 15 minutos esta semana para ver como lo resolvemos?"

**La diferencia:** El segundo email habla en **dolares**, no en **segundos**. El Closer debe tener prompts que conviertan metricas tecnicas en **perdida economica estimada**.

### 1.8. Propuesta de Cambios en la Base de Datos

Para soportar el enriquecimiento comercial, se necesitan nuevas columnas en `leads`:

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS 
    revenue_signal TEXT,           -- 'ecommerce', 'subscription', 'services', 'ads', 'none'
    traffic_estimate TEXT,         -- 'high', 'medium', 'low', 'unknown'
    decision_maker_name TEXT,
    decision_maker_title TEXT,
    decision_maker_linkedin TEXT,
    company_size TEXT,             -- 'enterprise', 'mid', 'small', 'solo'
    content_freshness_days INTEGER,
    has_pricing_page BOOLEAN DEFAULT FALSE,
    has_testimonials BOOLEAN DEFAULT FALSE,
    competitor_sites TEXT[],
    commercial_score INTEGER DEFAULT 0,
    segment CHAR(1) CHECK (segment IN ('A','B','C','D'));
```

Y una nueva tabla para historial de enriquecimiento:

```sql
CREATE TABLE IF NOT EXISTS lead_enrichment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    source TEXT NOT NULL,          -- 'builtwith', 'hunter', 'manual', 'heuristic'
    field TEXT NOT NULL,
    value TEXT,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.9. KPIs para Medir la Calidad de Leads

Sin medir, no se mejora. Se propone un dashboard de KPIs:

| KPI | Formula | Meta |
|-----|---------|------|
| Lead-to-Call Rate | Leads que respondieron a un email o aceptaron llamada / Total leads enriquecidos | > 5% |
| Call-to-Proposal Rate | Propuestas enviadas / Llamadas realizadas | > 30% |
| Proposal-to-Win Rate | Contratos firmados / Propuestas enviadas | > 20% |
| Average Deal Size | Revenue total / Contratos firmados | > $2,000 |
| Lead Quality Score | (Deal size * Win rate) / Costo de adquisicion del lead | > 10x |
| Time-to-First-Contact | Tiempo promedio desde descubrimiento hasta primer contacto | < 24h |

---

## PARTE 2: ANALISIS DEL FRONTEND — Diagnostico y Propuestas

### 2.1. Estado Actual del Frontend

El frontend es una aplicacion **Vite + React + TypeScript** con estetica "Void-Tech" (terminal/hacker). Es funcional pero **minimalista al extremo**. Solo tiene 3 paginas y un componente de layout.

**Estructura actual:**
```
frontend/src/
├── App.tsx              # Router con 3 rutas
├── main.tsx             # Entry point
├── components/
│   └── Layout.tsx       # Shell con sidebar, topbar, nav
├── pages/
│   ├── DashboardPage.tsx   # Stats de colas + tabla de leads recientes
│   ├── LeadsPage.tsx       # Lista de leads con filtros por status
│   └── SniperPage.tsx      # (no revisado, probablemente targets de uptime)
└── lib/
    └── api.ts           # Cliente HTTP + tipos
```

**Stack confirmado:**
- React 18 + TypeScript
- React Router DOM
- Fetch API nativa (sin Axios, sin React Query)
- Sin libreria de componentes UI (todo CSS custom, estilo terminal)
- Sin estado global (Zustand, Redux, Context) — cada pagina maneja su propio `useState`
- Sin testing (no se detectaron archivos de test)

### 2.2. Problemas Criticos del Frontend

#### A) Es un "Dashboard de Sistema", NO un "CRM de Ventas"

El frontend actual muestra:
- Profundidad de colas Redis (descubrimiento, auditoria, outreach)
- Lista de leads con status tecnico (new, queued, auditing, audited...)
- Botones para forzar audit o closer manualmente

**Lo que NO muestra y un vendedor necesita:**
- Vista detallada de un lead con toda la inteligencia de ventas (pain points, email generado, screenshot).
- Pipeline visual de ventas (kanban: Nuevo → Contactado → Propuesta Enviada → Negociacion → Cerrado).
- Historial de interacciones con el lead (emails enviados, llamadas, notas).
- Score de calidad del lead (no solo el score tecnico).
- Comparativa con competidores.
- Ganancias estimadas vs costo del redisenio.
- Filtros geograficos, por industria, por tamano de empresa.

**Impacto:** El frontend no sirve para que un vendedor trabaje los leads. Es una herramienta de monitoreo de infraestructura, no de ventas.

#### B) Falta de Paginas Esenciales

| Pagina que falta | Por que es critica | Prioridad |
|------------------|-------------------|-----------|
| **Lead Detail Page** (`/leads/:id`) | Mostrar screenshot, Lighthouse scores, contactos extraidos, pain points, email generado, historial de outreach. | CRITICA |
| **Pipeline / Kanban** | Visualizar el funnel de ventas, arrastrar leads entre etapas. | CRITICA |
| **Sales Intelligence Viewer** | Leer y editar los pain points y cold emails generados por el Closer. | ALTA |
| **Analytics / Reports** | Conversion rates, revenue estimado, leads por fuente, rendimiento por segmento. | ALTA |
| **Settings / Config** | Configurar thresholds del Scout, reglas de scoring, templates de email, integraciones API. | MEDIA |
| **Outreach Manager** | Ver emails enviados, tasa de apertura, respuestas, programar seguimientos. | ALTA |

#### C) La UX es "Cool" pero Ineficiente para Ventas

La estetica "terminal/hacker" con badges de colores, glyphs, y texto monospace es visualmente atractiva pero **reduce la legibilidad y la velocidad de trabajo**.

**Ejemplos concretos:**
- La tabla de leads no tiene paginacion real (limit=100 max, sin navegacion de paginas).
- No hay busqueda rapida por dominio, empresa, o email.
- Los filtros son un `<select>` basico con status en texto plano.
- No hay ordenamiento por columnas (click en header para ordenar por score, lighthouse, load time).
- No hay seleccion multiple de leads (acciones en bulk: "contactar todos", "descartar").
- No hay notificaciones de nuevos leads descubiertos.
- Los modulos Scout, Auditor, Closer en el sidebar estan deshabilitados (`href="#"` + `preventDefault`) — son placeholders.

#### D) Manejo de Estado y Data Fetching Primitivo

Cada pagina hace su propio `useEffect` + `fetch`:
```typescript
// En DashboardPage.tsx y LeadsPage.tsx — codigo repetido
useEffect(() => {
  async function load() { /* fetch */ }
  load();
  const interval = setInterval(load, 8000);
  return () => clearInterval(interval);
}, []);
```

**Problemas:**
- Sin cache: cada cambio de pagina vuelve a cargar todo.
- Sin optimistic updates: si marco un lead como "contactado", la UI no refleja el cambio hasta el proximo fetch.
- Sin manejo de errores robusto: solo muestra `err.message` en un div.
- Sin loading states diferenciados: un solo `loading` booleano.
- Sin retry automatico ni backoff.

#### E) Tipado Incompleto en API

El `api.ts` define:
```typescript
export interface Lead {
  // ... campos basicos
  tech_stack: Record<string, unknown>;
  social_links: Record<string, unknown>;
}
```

`unknown` es correcto para seguridad, pero en el frontend se necesita **tipado fuerte** para poder mostrar datos especificos (ej: "Facebook: 3 links, Instagram: 1 link"). Falta:
- Tipos para `Audit`, `SalesIntelligence`, `OutreachMessage`.
- Tipos para los datos de enriquecimiento comercial.

### 2.3. Propuesta de Redisenio del Frontend

#### A) Nueva Arquitectura de Paginas

```
/                          → Dashboard (KPIs de negocio, no solo colas)
/leads                     → Lista de leads (tabla avanzada con filtros, sorting, bulk)
/leads/:id                 → Lead Detail (vista completa del lead)
/leads/:id/audit           → Audit History (historial de auditorias, comparativa)
/leads/:id/outreach        → Outreach Manager (emails, llamadas, notas)
/pipeline                  → Kanban Pipeline (visual funnel de ventas)
/intelligence              → Sales Intelligence Viewer (pain points, emails generados)
/analytics                 → Reports & Analytics (conversiones, revenue, fuentes)
/settings                  → Configuration (scoring, thresholds, templates, APIs)
```

#### B) Stack Recomendado para Escalar

Manteniendo Vite + React + TS, se recomienda agregar:

| Libreria | Para que | Costo |
|----------|----------|-------|
| **TanStack Query (React Query)** | Data fetching con cache, stale-while-revalidate, mutations, optimistic updates | Gratis |
| **Zustand** | Estado global ligero (filtros activos, lead seleccionado, configuracion) | Gratis |
| **TanStack Table** | Tablas avanzadas con sorting, filtering, pagination, selection | Gratis |
| **React Hook Form + Zod** | Formularios tipados y validados (configuracion, notas, templates) | Gratis |
| **Recharts / Tremor** | Graficos para analytics (line, bar, funnel) | Gratis |
| **React DnD / @dnd-kit** | Drag & drop para el kanban pipeline | Gratis |

**Decision:** No agregar un UI kit pesado (MUI, Chakra) para mantener la estetica Void-Tech custom. Pero SI implementar un **design system interno** con componentes reutilizables.

#### C) Componentes Reutilizables Necesarios

```
frontend/src/components/
├── ui/                    # Design system atomico
│   ├── Button.tsx
│   ├── Badge.tsx          # Status badges con colores semanticos
│   ├── Card.tsx
│   ├── Table.tsx          # Wrapper sobre TanStack Table
│   ├── Modal.tsx
│   ├── Tabs.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Textarea.tsx
│   └── Skeleton.tsx       # Loading placeholders
├── layout/
│   ├── Layout.tsx         # Shell existente, mejorado
│   ├── Sidebar.tsx        # Extraer del Layout monolitico
│   ├── Topbar.tsx
│   └── Breadcrumbs.tsx
├── features/
│   ├── LeadCard.tsx       # Resumen de lead para listas
│   ├── LeadDetail/
│   │   ├── Header.tsx     # URL, dominio, score, acciones
│   │   ├── Screenshot.tsx # Visor de screenshot con zoom
│   │   ├── Metrics.tsx    # Lighthouse scores, load time, SSL, mobile
│   │   ├── Contacts.tsx   # Emails, telefonos, redes sociales
│   │   ├── TechStack.tsx  # Stack tecnico detectado
│   │   ├── PainPoints.tsx # Pain points del LLM + editable
│   │   └── OutreachTimeline.tsx  # Historial de contactos
│   ├── Pipeline/
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   └── KanbanCard.tsx
│   └── Analytics/
│       ├── ConversionFunnel.tsx
│       ├── RevenueChart.tsx
│       └── LeadSourceChart.tsx
└── hooks/
    ├── useLead.ts          # TanStack Query hook para un lead
    ├── useLeads.ts         # TanStack Query hook para lista
    ├── useMutation.ts      # Wrapper para mutaciones con toast
    └── useDebounce.ts      # Para busqueda en tiempo real
```

#### D) Redisenio del Dashboard (de "Monitoreo de Sistema" a "Command Center de Ventas")

**Dashboard Actual:** Muestra 5 cards de profundidad de colas Redis + tabla de leads recientes + terminal box con status.

**Dashboard Propuesto:**

```
+----------------------------------------------------------+
|  KPIs de Negocio (hoy / esta semana / este mes)          |
|  [Nuevos Leads] [Contactados] [Propuestas] [Cerrados]    |
|  [$ Revenue Pipeline] [$ Revenue Cerrado] [% Conversion]   |
+----------------------------------------------------------+
|  Grafico: Funnel de Conversion (visuales)                |
|  [Descubiertos] → [Auditoria OK] → [Enriquecidos]        |
|       → [Contactados] → [Reunión] → [Propuesta] → [Win]  |
+----------------------------------------------------------+
|  Leads de Alta Prioridad (score > 80, segmento A/B)      |
|  Tabla con: Dominio | Score | Potencial | Accion Rapida    |
+----------------------------------------------------------+
|  Alertas y Oportunidades Inmediatas                      |
|  - 3 leads nuevos con e-commerce detectado               |
|  - 1 lead con SSL vencido hoy (urgencia real)            |
|  - 2 leads con competidor activo recientemente           |
+----------------------------------------------------------+
```

#### E) Redisenio de la Lead Detail Page

Esta es la pagina mas importante y **actualmente no existe**. Debe ser el "dossier" completo de un prospecto.

```
+----------------------------------------------------------+
|  [Dominio]  [Score: 87]  [Segmento: B]  [Acciones]       |
|  [Screenshot del sitio] [Visitar sitio] [Forzar audit]   |
+----------------------------------------------------------+
|  Tabs: Overview | Metrics | Contacts | Intelligence |    |
|        Outreach | Audit History | Competitors           |
+----------------------------------------------------------+
|  TAB: Overview                                           |
|  - Problemas detectados (SSL, velocidad, movil)         |
|  - Potencial comercial (ecommerce, trafico, pagos)      |
|  - Perdida economica estimada ($/mes)                   |
|  - Argumento de venta principal (generado por LLM)       |
+----------------------------------------------------------+
|  TAB: Metrics                                            |
|  - Lighthouse scores con gauges visuales                 |
|  - Core Web Vitals (FCP, LCP, CLS, TBT)                 |
|  - Load time historico (si hay multiples audits)        |
|  - Comparativa vs promedio de industria                  |
+----------------------------------------------------------+
|  TAB: Contacts                                           |
|  - Emails extraidos (con boton "Enriquecer via Hunter")  |
|  - Telefonos (con boton "Click para llamar")            |
|  - Redes sociales (links directos)                       |
|  - Formulario para agregar contacto manual               |
+----------------------------------------------------------+
|  TAB: Intelligence (Sales Intel)                         |
|  - Pain points generados por LLM (editable)              |
|  - Cold email subject + body (editable, con preview)     |
|  - Variantes A/B de email                                |
|  - Boton "Generar nuevo" (re-llama al Closer)           |
+----------------------------------------------------------+
|  TAB: Outreach                                           |
|  - Timeline de interacciones (email enviado, abierto,    |
|    clickeado, respondido, llamada, nota)                 |
|  - Boton "Enviar email" (usa template del Closer)       |
|  - Boton "Programar seguimiento" (fecha + nota)         |
|  - Boton "Marcar como ganado/perdido"                    |
+----------------------------------------------------------+
```

### 2.4. Mejoras de UX Inmediatas (Quick Wins)

Sin redisenar todo, estas mejoras tienen alto impacto y bajo esfuerzo:

1. **Agregar paginacion real** en `LeadsPage` (offset/limit con navegacion).
2. **Agregar busqueda** por dominio/email/empresa con debounce.
3. **Agregar ordenamiento** por columnas (click en header).
4. **Agregar seleccion multiple** con acciones en bulk ("Marcar como contactado", "Descartar").
5. **Agregar toasts/notificaciones** para feedback de acciones ("Audit encolado", "Email enviado").
6. **Hacer clickeable cada lead** en la tabla para ver detalle (aunque sea un modal basico).
7. **Mostrar el screenshot** del lead en la lista (thumbnail pequeno).
8. **Agregar filtros avanzados**: por score minimo, por segmento, por presencia de ecommerce, por pais.
9. **Agregar indicador de "nuevo"** para leads descubiertos en las ultimas 24h.
10. **Responsive**: Actualmente parece desktop-only. Agregar breakpoints para tablet/mobile.

### 2.5. Refactor de `api.ts` para Escalar

```typescript
// Propuesta de api.ts mejorado

import { QueryClient } from '@tanstack/react-query';

// Tipos completos
export interface Lead {
  id: string;
  url: string;
  normalized_domain: string;
  company_name: string | null;
  industry: string | null;
  country_code: string | null;
  city: string | null;
  email: string | null;
  secondary_emails: string[];
  phone: string | null;
  secondary_phones: string[];
  social_links: Record<string, string[]>;
  tech_stack: Record<string, string>;
  lighthouse_score: number | null;
  mobile_friendly: boolean | null;
  has_ssl: boolean | null;
  load_time_ms: number | null;
  status: LeadStatus;
  score: number;
  commercial_score: number | null;
  segment: 'A' | 'B' | 'C' | 'D' | null;
  revenue_signal: string | null;
  discovered_at: string;
  audited_at: string | null;
  contacted_at: string | null;
  notes: string | null;
}

export interface Audit {
  id: string;
  lead_id: string;
  lighthouse_score: number | null;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  mobile_friendly: boolean | null;
  has_ssl: boolean | null;
  load_time_ms: number | null;
  fcp_ms: number | null;
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  detected_tech: Record<string, string>;
  extracted_contacts: {
    emails: string[];
    phones: string[];
    socials: Record<string, string[]>;
  };
  screenshot_path: string | null;
  raw_json_data: Record<string, unknown>;
  created_at: string;
}

export interface SalesIntelligence {
  id: string;
  lead_id: string;
  audit_id: string | null;
  model: string;
  pain_points: { title: string; description: string; severity: string }[];
  cold_email_subject: string | null;
  cold_email_body: string | null;
  language: string;
  tone: string | null;
  generated_at: string;
}

// Hooks con TanStack Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

export function useLeads(params: ListLeadsParams) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => api.listLeads(params),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.getLead(id),
    enabled: !!id,
  });
}

export function useTriggerAudit() {
  return useMutation({
    mutationFn: api.triggerAudit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
```

### 2.6. La Estetica "Void-Tech": Mantenerla o Evolucionarla?

**Veredicto: Mantener la estetica, pero hacerla funcional.**

La estetica terminal es un diferenciador de marca. Pero debe evolucionar de "muestra de sistema" a "herramienta de productividad":

- **Mantener:** Paleta de colores oscura, tipografia monospace para datos tecnicos, badges de colores para status.
- **Mejorar:** Usar tipografia sans-serif para textos largos (legibilidad), agregar espaciado generoso entre elementos, usar cards con sombras sutiles para separar secciones, agregar iconos semanticos (no solo glyphs abstractos como `::` o `>_`).
- **Agregar:** Modo "alto contraste" para presentaciones a clientes, modo "compacto" para power users que manejan 100+ leads.

---

## PARTE 3: RESUMEN EJECUTIVO Y ROADMAP

### Prioridades para Hacer SIPHON-X Rentable

| Fase | Que hacer | Impacto | Esfuerzo | Timeline |
|------|-----------|---------|----------|----------|
| **Fase 1: Fundamentos** | Enriquecimiento comercial en Scout (e-commerce, analytics, pago, contenido). Scoring dual. | ALTO | MEDIO | 2-3 semanas |
| **Fase 2: Frontend CRM** | Lead Detail Page, Pipeline Kanban, Outreach Manager. | CRITICO | ALTO | 3-4 semanas |
| **Fase 3: Inteligencia de Ventas** | Closer con prompts de "perdida economica", segmentacion A/B/C/D, templates por segmento. | ALTO | MEDIO | 1-2 semanas |
| **Fase 4: Integraciones** | Hunter.io/Apollo para enriquecimiento de contactos, email sender (SendGrid/Resend) para outreach real. | MEDIO | MEDIO | 2 semanas |
| **Fase 5: Analytics** | Dashboard de KPIs de negocio, conversion rates, revenue pipeline. | MEDIO | BAJO | 1 semana |
| **Fase 6: Escala** | Proxy rotacion inteligente, anti-detection avanzado, multi-tenant para agencias. | MEDIO | ALTO | 4+ semanas |

### La Regla de Oro

> **Un lead de calidad no es un sitio con problemas tecnicos. Es un NEGOCIO con problemas tecnicos que tiene PRESUPUESTO para solucionarlos y un DECISION MAKER que entiende el VALOR de hacerlo.**

El SIPHON-X actual detecta problemas tecnicos. Para ser rentable, debe detectar **negocios con problemas**.

---

*Documento generado para SIPHON-X el 2026-05-16.*
*Incluye analisis de negocio, propuesta de arquitectura de enriquecimiento, diagnostico del frontend, y roadmap de implementacion.*
