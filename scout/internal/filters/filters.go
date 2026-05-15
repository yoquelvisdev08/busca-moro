// Package filters aplica las reglas de elegibilidad de un sitio como lead.
package filters

import (
	"strconv"
	"strings"
	"time"

	"github.com/siphonx/scout/internal/fingerprint"
)

// Verdict resume si un sitio califica como prospecto.
type Verdict struct {
	Eligible bool
	Reasons  []string
	Score    int
}

// Rules contiene los umbrales configurables.
type Rules struct {
	LoadTimeThreshold time.Duration
	// Versiones consideradas obsoletas (umbrales mínimos aceptables).
	MinWordPress string // "5.0"
	MinPHP       string // "7.4"
}

// DefaultRules retorna los valores estándar pedidos por el spec.
func DefaultRules(loadThreshold time.Duration) Rules {
	return Rules{
		LoadTimeThreshold: loadThreshold,
		MinWordPress:      "5.0",
		MinPHP:            "7.4",
	}
}

// Evaluate aplica las reglas y construye un Verdict con un score acumulado.
func Evaluate(r *fingerprint.Result, rules Rules) Verdict {
	v := Verdict{Score: 0}

	if !r.HasSSL || !r.ValidCertificate {
		v.Eligible = true
		v.Reasons = append(v.Reasons, "ssl_missing_or_invalid")
		v.Score += 30
	}

	if r.LoadTimeMs > rules.LoadTimeThreshold.Milliseconds() {
		v.Eligible = true
		v.Reasons = append(v.Reasons, "slow_load_time_"+strconv.FormatInt(r.LoadTimeMs, 10)+"ms")
		v.Score += 25
	}

	if r.WordPress && r.WordPressVersion != "" && versionLessThan(r.WordPressVersion, rules.MinWordPress) {
		v.Eligible = true
		v.Reasons = append(v.Reasons, "wordpress_outdated_"+r.WordPressVersion)
		v.Score += 25
	}

	if r.PHPVersion != "" && versionLessThan(r.PHPVersion, rules.MinPHP) {
		v.Eligible = true
		v.Reasons = append(v.Reasons, "php_outdated_"+r.PHPVersion)
		v.Score += 20
	}

	if r.StatusCode >= 500 {
		v.Eligible = true
		v.Reasons = append(v.Reasons, "server_5xx")
		v.Score += 15
	}

	return v
}

func versionLessThan(actual, threshold string) bool {
	a := splitVersion(actual)
	b := splitVersion(threshold)
	for i := 0; i < len(a) && i < len(b); i++ {
		if a[i] < b[i] {
			return true
		}
		if a[i] > b[i] {
			return false
		}
	}
	return len(a) < len(b)
}

func splitVersion(v string) []int {
	parts := strings.Split(v, ".")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return out
		}
		out = append(out, n)
	}
	return out
}
