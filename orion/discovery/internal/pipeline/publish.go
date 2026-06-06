// Package pipeline centraliza fingerprint, filtros y publicación de leads.
package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/orion/scout/internal/config"
	"github.com/orion/scout/internal/enrichment"
	"github.com/orion/scout/internal/filters"
	"github.com/orion/scout/internal/fingerprint"
	"github.com/orion/scout/internal/geo"
	"github.com/orion/scout/internal/proxy"
)

// Outcome resume el resultado de analizar una URL.
type Outcome struct {
	Published        bool
	SkippedReason    string
	URL              string
	Segment          string
	TotalScore       int
	ProblemScore     int
	CommercialScore  int
	Eligible         bool
	Reasons          []string
}

// PublishOptions opciones de contexto para el análisis.
type PublishOptions struct {
	RawURL          string
	Location        string
	Industry        string
	DiscoverySource string
	DiscoveryQuery  string
}

// Publish analiza la URL y, si califica, la publica en la API.
func Publish(
	ctx context.Context,
	logger *slog.Logger,
	cfg *config.Config,
	rotator *proxy.Rotator,
	opts PublishOptions,
) (Outcome, error) {
	out := Outcome{URL: opts.RawURL}
	raw := strings.TrimSpace(opts.RawURL)
	if raw == "" {
		out.SkippedReason = "empty_url"
		return out, nil
	}
	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		raw = "https://" + raw
		out.URL = raw
	}

	if isBlockedDomain(raw) {
		out.SkippedReason = "blocked_domain"
		return out, nil
	}

	rules := filters.DefaultRules(
		cfg.LoadTimeThreshold,
		cfg.MinProblemScore,
		cfg.MinCommercialScore,
	)
	client := rotator.NewHTTPClient(cfg.HTTPTimeout)
	apiClient := &http.Client{Timeout: 30 * time.Second}

	res, err := fingerprint.Inspect(ctx, client, raw)
	if err != nil {
		return out, fmt.Errorf("fingerprint: %w", err)
	}

	host := hostFromURL(res.FinalURL, raw)
	if opts.Location != "" && !geo.MatchesLocation(host, res.HTMLBody, opts.Location) {
		out.SkippedReason = "geo_mismatch"
		logger.Info("candidate_skipped_geo", "url", raw, "location", opts.Location, "host", host)
		return out, nil
	}

	signals := enrichment.DetectSignals(res.HTMLBody, res.FinalURL)
	verdict := filters.Evaluate(res, signals, rules)
	out.Eligible = verdict.Eligible
	out.Reasons = verdict.Reasons
	out.Segment = verdict.Segment
	out.TotalScore = verdict.TotalScore
	out.ProblemScore = verdict.ProblemScore
	out.CommercialScore = verdict.CommercialScore

	if !verdict.Eligible {
		out.SkippedReason = "not_eligible"
		return out, nil
	}

	source := opts.DiscoverySource
	if source == "" {
		source = "manual"
	}
	body := map[string]any{
		"url":                    normalizeURL(res.FinalURL, raw),
		"score":                  verdict.TotalScore,
		"problem_score":          verdict.ProblemScore,
		"commercial_score":       verdict.CommercialScore,
		"segment":                verdict.Segment,
		"revenue_signal":         signals.RevenueSignal,
		"has_pricing_page":       signals.HasPricingPage,
		"has_testimonials":       signals.HasTestimonials,
		"content_freshness_days": signals.LastBlogDays,
		"tech_stack":             res.TechStack,
		"has_ssl":                res.HasSSL,
		"load_time_ms":           res.LoadTimeMs,
		"discovery_source":       source,
		"discovery_query":        opts.DiscoveryQuery,
		"commercial_signals":     verdict.CommercialSignals,
	}
	if signals.ContactEmail != "" {
		body["email"] = signals.ContactEmail
	}
	if opts.Industry != "" {
		body["industry"] = opts.Industry
	}

	if err := postLead(ctx, apiClient, cfg.APIBaseURL, body); err != nil {
		return out, fmt.Errorf("api publish: %w", err)
	}
	out.Published = true
	return out, nil
}

// HostKey devuelve el host normalizado para deduplicar candidatos en una pasada.
func HostKey(rawURL string) string {
	return hostFromURL("", rawURL)
}

func hostFromURL(finalURL, fallback string) string {
	u := finalURL
	if u == "" {
		u = fallback
	}
	parsed, err := url.Parse(u)
	if err != nil || parsed.Host == "" {
		return strings.ToLower(u)
	}
	return strings.ToLower(parsed.Host)
}

func normalizeURL(finalURL, fallback string) string {
	if finalURL != "" {
		return finalURL
	}
	if strings.HasPrefix(fallback, "http") {
		return fallback
	}
	return "http://" + fallback
}

func postLead(ctx context.Context, client *http.Client, apiBase string, payload map[string]any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBase+"/v1/leads", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		buf, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("api status %d: %s", resp.StatusCode, string(buf))
	}
	return nil
}

var blockedDomains = []string{
	"xnxx.com", "pornhub.com", "youtube.com", "youtu.be",
	"wikipedia.org", "wikimedia.org", "reddit.com",
	"google.com", "support.google", "microsoft.com",
	"apple.com", "amazon.com", "ebay.com", "imdb.com",
	"facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
	"zhihu.com", "nytimes.com", "bbc.com", "cnn.com",
	"bing.com", "yahoo.com", "baidu.com", "xinhuanet.com",
	"match.com", "datingadvice.com", "datingnews.com", "doulike.com",
	"mingle2.com", "localhookup.com", "browsesingles.com",
	"hostinet.com", "raiolanetworks.com", "axarnet.es", "kinsta.com",
	"ahrefs.com", "prestashop.com", "wix.com", "squarespace.com",
	"findglocal.com", "yellowpages", "yelp.com", "tripadvisor",
	"paginasamarillas", "guiaempresas", "hotfrog", "cylex",
	"easeus.com", "softonic.com", "download.com",
	"wordpress.org", "github.com", "stackoverflow.com",
	"medium.com", "blogspot.com", "tumblr.com",
	"walmart.com", "forbes.com", "washingtonpost.com",
	"elpais.com", "elmundo.es", "investing.com",
	"nasdaq.com", "bloomberg.com", "reuters.com",
	"aol.com", "grubhub.com", "doordash.com",
	"ubereats.com", "cinnabon.com", "mcdonalds.com",
	"starbucks.com", "nike.com", "adidas.com",
	"zara.com", "h&m.com", "target.com",
	"bestbuy.com", "homedepot.com", "lowes.com",
	"costco.com", "ikea.com", "britannica.com",
	"webmd.com", "healthline.com", "mayoclinic.org",
	"clevelandclinic.org",
}

// isBlockedDomain replica la lista de dominios no prospectables.
func isBlockedDomain(rawURL string) bool {
	host := hostFromURL("", rawURL)
	for _, bd := range blockedDomains {
		if host == bd || strings.HasSuffix(host, "."+bd) {
			return true
		}
	}
	return false
}
