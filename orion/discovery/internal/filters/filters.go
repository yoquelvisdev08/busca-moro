// Package filters aplica las reglas de elegibilidad de un sitio como lead.
package filters

import (
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/orion/scout/internal/enrichment"
	"github.com/orion/scout/internal/fingerprint"
)

// Verdict resume si un sitio califica como prospecto con dual scoring.
type Verdict struct {
	Eligible          bool
	ProblemScore      int
	CommercialScore   int
	TotalScore        int
	Reasons           []string
	CommercialSignals []string
	Segment           string // "A", "B", "C", "D"
}

// Rules contiene los umbrales configurables.
type Rules struct {
	LoadTimeThreshold time.Duration
	MinProblemScore   int
	MinCommercialScore int
	// Versiones consideradas obsoletas (umbrales mínimos aceptables).
	MinWordPress string // "5.0"
	MinPHP       string // "7.4"
}

// DefaultRules retorna los valores estándar pedidos por el spec.
func DefaultRules(loadThreshold time.Duration, minProblem, minCommercial int) Rules {
	if minProblem <= 0 {
		minProblem = 15
	}
	if minCommercial <= 0 {
		minCommercial = 25
	}
	return Rules{
		LoadTimeThreshold:  loadThreshold,
		MinProblemScore:    minProblem,
		MinCommercialScore: minCommercial,
		MinWordPress:       "5.0",
		MinPHP:             "7.4",
	}
}

// Evaluate aplica dual scoring: problem + commercial potential.
func Evaluate(r *fingerprint.Result, signals *enrichment.CommercialSignals, rules Rules) Verdict {
	v := Verdict{}

	// PROBLEM SCORING
	if !r.HasSSL || !r.ValidCertificate {
		v.ProblemScore += 30
		v.Reasons = append(v.Reasons, "ssl_missing_or_invalid")
	}

	if r.LoadTimeMs > rules.LoadTimeThreshold.Milliseconds() {
		v.ProblemScore += 25
		v.Reasons = append(v.Reasons, "slow_load_time_"+strconv.FormatInt(r.LoadTimeMs, 10)+"ms")
	}

	if r.WordPress && r.WordPressVersion != "" && versionLessThan(r.WordPressVersion, rules.MinWordPress) {
		v.ProblemScore += 25
		v.Reasons = append(v.Reasons, "wordpress_outdated_"+r.WordPressVersion)
	}

	if r.PHPVersion != "" && versionLessThan(r.PHPVersion, rules.MinPHP) {
		v.ProblemScore += 20
		v.Reasons = append(v.Reasons, "php_outdated_"+r.PHPVersion)
	}

	if r.StatusCode >= 500 {
		v.ProblemScore += 15
		v.Reasons = append(v.Reasons, "server_5xx")
	}

	// COMMERCIAL SCORING
	if signals != nil {
		if signals.HasEcommerce {
			v.CommercialScore += 50
			v.CommercialSignals = append(v.CommercialSignals, "has_ecommerce")
		}
		if signals.HasPaymentGateway {
			v.CommercialScore += 40
			v.CommercialSignals = append(v.CommercialSignals, "has_payment")
		}
		if signals.HasCRM || signals.HasBooking {
			v.CommercialScore += 30
			v.CommercialSignals = append(v.CommercialSignals, "has_crm_booking")
		}
		if signals.HasAnalytics {
			v.CommercialScore += 20
			v.CommercialSignals = append(v.CommercialSignals, "has_analytics")
		}
		if signals.HasBlog && signals.LastBlogDays > 0 && signals.LastBlogDays < 90 {
			v.CommercialScore += 15
			v.CommercialSignals = append(v.CommercialSignals, "active_blog")
		}
		if signals.SocialActivity {
			v.CommercialScore += 15
			v.CommercialSignals = append(v.CommercialSignals, "social_active")
		}
		if signals.IsPremiumHosting {
			v.CommercialScore += 10
			v.CommercialSignals = append(v.CommercialSignals, "premium_hosting")
		}
		if signals.HasPricingPage {
			v.CommercialScore += 10
			v.CommercialSignals = append(v.CommercialSignals, "has_pricing")
		}
		if signals.HasTestimonials {
			v.CommercialScore += 10
			v.CommercialSignals = append(v.CommercialSignals, "has_testimonials")
		}
		if signals.HasCTA {
			v.CommercialScore += 10
			v.CommercialSignals = append(v.CommercialSignals, "has_cta")
		}
		if signals.HasPortfolio {
			v.CommercialScore += 5
			v.CommercialSignals = append(v.CommercialSignals, "has_portfolio")
		}
		// Alta intención: negocio que captura leads activamente
		if signals.HasBooking && (signals.HasCTA || signals.HasCRM) {
			v.CommercialScore += 15
			v.CommercialSignals = append(v.CommercialSignals, "high_intent_leads")
		}
		if signals.RevenueSignal == "services" || signals.RevenueSignal == "subscription" {
			v.CommercialScore += 10
			v.CommercialSignals = append(v.CommercialSignals, "services_revenue")
		}
		if signals.IsSmallBusiness {
			v.CommercialScore += 20
			v.CommercialSignals = append(v.CommercialSignals, "is_small_business")
		}
	}

	// Large site / corporate penalty
	htmlLower := strings.ToLower(r.HTMLBody)
	corporateKeywords := []string{"careers", "investor relations", "press room", "stock", "annual report"}
	for _, kw := range corporateKeywords {
		if strings.Contains(htmlLower, kw) {
			v.CommercialScore -= 30
			v.CommercialSignals = append(v.CommercialSignals, "corporate_site_penalty")
			break
		}
	}
	host := hostFromURL(r.FinalURL)
	if host != "" {
		parts := strings.Split(host, ".")
		// Exclude www and penalize hosts with subdomains beyond the domain+TLD
		if len(parts) > 3 || (len(parts) == 3 && parts[0] != "www") {
			v.CommercialScore -= 20
			v.CommercialSignals = append(v.CommercialSignals, "subdomain_penalty")
		}
	}

	// TOTAL SCORE
	v.TotalScore = v.ProblemScore + v.CommercialScore

	minP := rules.MinProblemScore
	minC := rules.MinCommercialScore

	// Elegibilidad: problema técnico + negocio con señal comercial
	v.Eligible = v.ProblemScore >= minP && v.CommercialScore >= minC
	// PYME con alta señal comercial: buen prospecto aunque no tenga problemas técnicos
	if !v.Eligible && v.CommercialScore >= minC*2 {
		v.Eligible = true
	}

	// SEGMENT ASSIGNMENT (alineado con umbrales mínimos)
	if v.CommercialScore >= 80 && v.ProblemScore >= minP+15 {
		v.Segment = "A"
	} else if v.CommercialScore >= minC+25 && v.ProblemScore >= minP+10 {
		v.Segment = "B"
	} else if v.CommercialScore >= minC && v.ProblemScore >= minP {
		v.Segment = "C"
	} else if v.CommercialScore >= minC*2 {
		v.Segment = "C" // Alto commercial, sin problemas técnicos = buen prospecto
	} else {
		v.Segment = "D"
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
	// Strip non-numeric suffixes (e.g., "7.4-fpm" -> "7.4")
	if idx := strings.IndexAny(v, "-+_"); idx >= 0 {
		v = v[:idx]
	}
	parts := strings.Split(v, ".")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			break
		}
		out = append(out, n)
	}
	return out
}

func hostFromURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return strings.ToLower(raw)
	}
	return strings.ToLower(u.Host)
}
