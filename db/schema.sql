-- ============================================================================
-- SIPHON-X :: Esquema de base de datos (PostgreSQL >= 14)
-- ----------------------------------------------------------------------------
-- Convenciones:
--   * Identificadores en snake_case.
--   * Timestamps en UTC con TIMESTAMPTZ.
--   * Soft-delete via columna deleted_at (NULL = activo).
--   * Datos semi-estructurados (tech stack, raw Lighthouse) en JSONB.
--   * Catálogos enum para status y severidad.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM (
            'new',
            'queued',
            'auditing',
            'audited',
            'enriched',
            'contacted',
            'replied',
            'won',
            'rejected',
            'error'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_status') THEN
        CREATE TYPE audit_status AS ENUM (
            'pending',
            'running',
            'completed',
            'failed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM (
            'info',
            'warning',
            'critical'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_channel') THEN
        CREATE TYPE outreach_channel AS ENUM (
            'email',
            'whatsapp',
            'linkedin',
            'phone'
        );
    END IF;
END$$;

-- ----------------------------------------------------------------------------
-- Helper: trigger genérico para mantener updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siphon_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLA: leads
-- ----------------------------------------------------------------------------
-- Núcleo del CRM. Cada fila representa un sitio web detectado como prospecto
-- por The Scout. El campo `status` rastrea el ciclo de vida completo.
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    url                 TEXT            NOT NULL,
    normalized_domain   CITEXT          NOT NULL,
    company_name        TEXT,
    industry            TEXT,
    country_code        VARCHAR(2),
    city                TEXT,
    email               CITEXT,
    secondary_emails    CITEXT[]        NOT NULL DEFAULT '{}',
    phone               TEXT,
    secondary_phones    TEXT[]          NOT NULL DEFAULT '{}',
    social_links        JSONB           NOT NULL DEFAULT '{}'::jsonb,
    tech_stack          JSONB           NOT NULL DEFAULT '{}'::jsonb,
    lighthouse_score    INTEGER         CHECK (lighthouse_score BETWEEN 0 AND 100),
    mobile_friendly     BOOLEAN,
    has_ssl             BOOLEAN,
    load_time_ms        INTEGER         CHECK (load_time_ms >= 0),
    discovery_source    TEXT,
    discovery_query     TEXT,
    status              lead_status     NOT NULL DEFAULT 'new',
    score               INTEGER         NOT NULL DEFAULT 0,
    notes               TEXT,
    last_error          TEXT,
    discovered_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    audited_at          TIMESTAMPTZ,
    contacted_at        TIMESTAMPTZ,
    revenue_signal      TEXT            DEFAULT 'none',
    traffic_estimate    TEXT            DEFAULT 'unknown',
    decision_maker_name TEXT,
    decision_maker_title TEXT,
    company_size        TEXT            DEFAULT 'unknown',
    content_freshness_days INTEGER,
    has_pricing_page    BOOLEAN         DEFAULT FALSE,
    has_testimonials    BOOLEAN         DEFAULT FALSE,
    competitor_sites    TEXT[]          NOT NULL DEFAULT '{}',
    commercial_score    INTEGER         DEFAULT 0,
    segment             CHAR(1)         DEFAULT 'D',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT leads_url_unique UNIQUE (normalized_domain)
);

CREATE INDEX IF NOT EXISTS idx_leads_status              ON leads (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_score_desc          ON leads (score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_lighthouse_asc      ON leads (lighthouse_score ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_leads_country             ON leads (country_code);
CREATE INDEX IF NOT EXISTS idx_leads_email               ON leads (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tech_stack_gin      ON leads USING gin (tech_stack jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION siphon_touch_updated_at();

-- ============================================================================
-- TABLA: lead_enrichment
-- ----------------------------------------------------------------------------
-- Datos de enriquecimiento comercial y señales detectadas por el Scout.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_enrichment (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID            NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    source              TEXT            NOT NULL,
    field               TEXT            NOT NULL,
    value               TEXT,
    confidence          INTEGER         CHECK (confidence BETWEEN 0 AND 100),
    enriched_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_lead ON lead_enrichment (lead_id);

-- ============================================================================
-- TABLA: audits
-- ----------------------------------------------------------------------------
-- Resultado completo de una pasada del Auditor sobre un lead. Permite múltiples
-- auditorías por lead (historial de cambios en el tiempo).
-- ============================================================================
CREATE TABLE IF NOT EXISTS audits (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID            NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status              audit_status    NOT NULL DEFAULT 'pending',
    lighthouse_score    INTEGER         CHECK (lighthouse_score BETWEEN 0 AND 100),
    performance_score   INTEGER         CHECK (performance_score BETWEEN 0 AND 100),
    seo_score           INTEGER         CHECK (seo_score BETWEEN 0 AND 100),
    accessibility_score INTEGER         CHECK (accessibility_score BETWEEN 0 AND 100),
    best_practices_score INTEGER        CHECK (best_practices_score BETWEEN 0 AND 100),
    mobile_friendly     BOOLEAN,
    has_ssl             BOOLEAN,
    load_time_ms        INTEGER         CHECK (load_time_ms >= 0),
    first_contentful_paint_ms INTEGER,
    largest_contentful_paint_ms INTEGER,
    cumulative_layout_shift  NUMERIC(6,3),
    total_blocking_time_ms INTEGER,
    detected_tech       JSONB           NOT NULL DEFAULT '{}'::jsonb,
    extracted_contacts  JSONB           NOT NULL DEFAULT '{}'::jsonb,
    raw_json_data       JSONB           NOT NULL DEFAULT '{}'::jsonb,
    screenshot_path     TEXT,
    user_agent          TEXT,
    proxy_used          TEXT,
    error_message       TEXT,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_lead              ON audits (lead_id);
CREATE INDEX IF NOT EXISTS idx_audits_status            ON audits (status);
CREATE INDEX IF NOT EXISTS idx_audits_lighthouse_asc    ON audits (lighthouse_score ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_audits_raw_gin           ON audits USING gin (raw_json_data jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_audits_updated_at ON audits;
CREATE TRIGGER trg_audits_updated_at
    BEFORE UPDATE ON audits
    FOR EACH ROW EXECUTE FUNCTION siphon_touch_updated_at();

-- ============================================================================
-- TABLA: sales_intelligence
-- ----------------------------------------------------------------------------
-- Output de The Closer: pain points y cold email generados por Ollama, ligados
-- a una auditoría concreta (para versionado/A-B testing de copies).
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_intelligence (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID            NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    audit_id            UUID            REFERENCES audits(id) ON DELETE SET NULL,
    model               TEXT            NOT NULL,
    pain_points         JSONB           NOT NULL DEFAULT '[]'::jsonb,
    cold_email_subject  TEXT,
    cold_email_body     TEXT,
    language            VARCHAR(8)      NOT NULL DEFAULT 'es',
    tone                TEXT,
    prompt_hash         TEXT,
    tokens_input        INTEGER,
    tokens_output       INTEGER,
    generated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_intel_lead         ON sales_intelligence (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_intel_audit        ON sales_intelligence (audit_id);
CREATE INDEX IF NOT EXISTS idx_sales_intel_pain_gin     ON sales_intelligence USING gin (pain_points jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_sales_intel_updated_at ON sales_intelligence;
CREATE TRIGGER trg_sales_intel_updated_at
    BEFORE UPDATE ON sales_intelligence
    FOR EACH ROW EXECUTE FUNCTION siphon_touch_updated_at();

-- ============================================================================
-- TABLA: outreach_messages
-- ----------------------------------------------------------------------------
-- Registro histórico de cada intento de contacto (email enviado, WhatsApp,
-- etc). El Closer crea la inteligencia; este módulo persiste lo realmente
-- enviado y su tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS outreach_messages (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID            NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    sales_intel_id      UUID            REFERENCES sales_intelligence(id) ON DELETE SET NULL,
    channel             outreach_channel NOT NULL,
    recipient           TEXT            NOT NULL,
    subject             TEXT,
    body                TEXT            NOT NULL,
    provider_message_id TEXT,
    delivered           BOOLEAN,
    opened              BOOLEAN,
    clicked             BOOLEAN,
    replied             BOOLEAN,
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_lead            ON outreach_messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_channel         ON outreach_messages (channel);
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at         ON outreach_messages (sent_at DESC);

DROP TRIGGER IF EXISTS trg_outreach_updated_at ON outreach_messages;
CREATE TRIGGER trg_outreach_updated_at
    BEFORE UPDATE ON outreach_messages
    FOR EACH ROW EXECUTE FUNCTION siphon_touch_updated_at();

-- ============================================================================
-- TABLA: sniper_targets
-- ----------------------------------------------------------------------------
-- Listado de sitios que el Uptime Sniper monitorea constantemente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sniper_targets (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    url                 TEXT            NOT NULL UNIQUE,
    label               TEXT,
    industry            TEXT,
    enabled             BOOLEAN         NOT NULL DEFAULT TRUE,
    interval_seconds    INTEGER         NOT NULL DEFAULT 60 CHECK (interval_seconds >= 10),
    failure_threshold   INTEGER         NOT NULL DEFAULT 3 CHECK (failure_threshold >= 1),
    consecutive_failures INTEGER        NOT NULL DEFAULT 0,
    last_status_code    INTEGER,
    last_checked_at     TIMESTAMPTZ,
    last_failure_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sniper_enabled           ON sniper_targets (enabled);
CREATE INDEX IF NOT EXISTS idx_sniper_last_checked      ON sniper_targets (last_checked_at);

DROP TRIGGER IF EXISTS trg_sniper_targets_updated_at ON sniper_targets;
CREATE TRIGGER trg_sniper_targets_updated_at
    BEFORE UPDATE ON sniper_targets
    FOR EACH ROW EXECUTE FUNCTION siphon_touch_updated_at();

-- ============================================================================
-- TABLA: sniper_alerts
-- ----------------------------------------------------------------------------
-- Eventos disparados por el Sniper cuando un target supera el threshold de
-- fallos. Reutilizable para construir webhooks / dashboards.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sniper_alerts (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id           UUID            NOT NULL REFERENCES sniper_targets(id) ON DELETE CASCADE,
    severity            alert_severity  NOT NULL DEFAULT 'warning',
    status_code         INTEGER,
    error_kind          TEXT,
    message             TEXT,
    payload             JSONB           NOT NULL DEFAULT '{}'::jsonb,
    acknowledged        BOOLEAN         NOT NULL DEFAULT FALSE,
    acknowledged_at     TIMESTAMPTZ,
    triggered_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sniper_alerts_target     ON sniper_alerts (target_id);
CREATE INDEX IF NOT EXISTS idx_sniper_alerts_triggered  ON sniper_alerts (triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_sniper_alerts_unack      ON sniper_alerts (acknowledged) WHERE acknowledged = FALSE;

-- ============================================================================
-- TABLA: proxy_pool
-- ----------------------------------------------------------------------------
-- Pool de proxies residenciales / data-center con métricas de salud.
-- ============================================================================
CREATE TABLE IF NOT EXISTS proxy_pool (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme              TEXT            NOT NULL CHECK (scheme IN ('http','https','socks5')),
    host                TEXT            NOT NULL,
    port                INTEGER         NOT NULL CHECK (port BETWEEN 1 AND 65535),
    username            TEXT,
    password            TEXT,
    country_code        VARCHAR(2),
    is_residential      BOOLEAN         NOT NULL DEFAULT TRUE,
    enabled             BOOLEAN         NOT NULL DEFAULT TRUE,
    success_count       BIGINT          NOT NULL DEFAULT 0,
    failure_count       BIGINT          NOT NULL DEFAULT 0,
    last_used_at        TIMESTAMPTZ,
    last_error          TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT proxy_unique UNIQUE (scheme, host, port)
);

CREATE INDEX IF NOT EXISTS idx_proxy_enabled            ON proxy_pool (enabled);

DROP TRIGGER IF EXISTS trg_proxy_updated_at ON proxy_pool;
CREATE TRIGGER trg_proxy_updated_at
    BEFORE UPDATE ON proxy_pool
    FOR EACH ROW EXECUTE FUNCTION siphon_touch_updated_at();

-- ============================================================================
-- VISTAS úti­les para el panel
-- ============================================================================
CREATE OR REPLACE VIEW v_lead_dashboard AS
SELECT
    l.id,
    l.url,
    l.company_name,
    l.industry,
    l.status,
    l.lighthouse_score,
    l.score,
    l.email,
    l.has_ssl,
    l.mobile_friendly,
    l.load_time_ms,
    l.discovered_at,
    l.audited_at,
    l.contacted_at,
    (SELECT COUNT(*) FROM audits a WHERE a.lead_id = l.id)            AS audit_count,
    (SELECT COUNT(*) FROM outreach_messages o WHERE o.lead_id = l.id) AS outreach_count
FROM leads l
WHERE l.deleted_at IS NULL;
