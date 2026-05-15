// Package config carga la configuración del Scout desde el entorno.
package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

// Config agrupa toda la configuración del Scout.
type Config struct {
	ServiceName string `env:"SERVICE_NAME" envDefault:"scout"`

	RedisURL          string `env:"REDIS_URL,required"`
	QueueDiscovery    string `env:"QUEUE_DISCOVERY" envDefault:"siphon:queue:discovery"`
	QueueAudit        string `env:"QUEUE_AUDIT"     envDefault:"siphon:queue:audit"`
	QueueDLQ          string `env:"QUEUE_DLQ"       envDefault:"siphon:queue:dlq"`

	APIBaseURL string `env:"API_BASE_URL" envDefault:"http://api:8000"`

	Concurrency        int           `env:"SCOUT_CONCURRENCY"               envDefault:"16"`
	PortScanTimeout    time.Duration `env:"SCOUT_PORT_SCAN_TIMEOUT_MS"      envDefault:"2500ms"`
	HTTPTimeout        time.Duration `env:"SCOUT_HTTP_TIMEOUT_MS"           envDefault:"15000ms"`
	LoadTimeThreshold  time.Duration `env:"SCOUT_LOAD_TIME_THRESHOLD_MS"    envDefault:"5000ms"`
	DorksFile          string        `env:"SCOUT_DORKS_FILE"                envDefault:"/app/config/dorks.txt"`
	TargetsFile        string        `env:"SCOUT_TARGETS_FILE"              envDefault:"/app/config/seeds.txt"`
	UserAgentsFile     string        `env:"SCOUT_USER_AGENTS_FILE"          envDefault:"/app/config/user_agents.txt"`
	ProxiesFile        string        `env:"SCOUT_PROXIES_FILE"              envDefault:"/app/config/proxies.txt"`
	RespectRobots      bool          `env:"SCOUT_RESPECT_ROBOTS"            envDefault:"true"`

	// LoopInterval define cuánto espera el Scout entre pasadas completas.
	// Si es 0, ejecuta una sola pasada (modo cron). Por defecto 15m.
	LoopInterval time.Duration `env:"SCOUT_LOOP_INTERVAL"             envDefault:"15m"`
}

// Load resuelve la configuración desde variables de entorno.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, fmt.Errorf("parse env: %w", err)
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 8
	}
	return cfg, nil
}
