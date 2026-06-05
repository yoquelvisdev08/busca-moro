// Package fingerprint detecta la tecnología y métricas básicas de un sitio web.
package fingerprint

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Result agrupa toda la información detectada.
type Result struct {
	URL              string            `json:"url"`
	FinalURL         string            `json:"final_url"`
	StatusCode       int               `json:"status_code"`
	HasSSL           bool              `json:"has_ssl"`
	ValidCertificate bool              `json:"valid_certificate"`
	LoadTimeMs       int64             `json:"load_time_ms"`
	ServerHeader     string            `json:"server_header"`
	PoweredBy        string            `json:"powered_by"`
	PHPVersion       string            `json:"php_version,omitempty"`
	WordPress        bool              `json:"wordpress"`
	WordPressVersion string            `json:"wordpress_version,omitempty"`
	Generator        string            `json:"generator,omitempty"`
	Title            string            `json:"title,omitempty"`
	TechStack        map[string]string `json:"tech_stack"`
	HTMLBody         string            `json:"-"` // Raw HTML body for enrichment
}

// HTTPDoer abstrae *http.Client para facilitar tests.
type HTTPDoer interface {
	Do(*http.Request) (*http.Response, error)
}

var (
	wpVersionRE  = regexp.MustCompile(`(?i)wordpress\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)`)
	phpVersionRE = regexp.MustCompile(`(?i)PHP/([0-9]+\.[0-9]+(?:\.[0-9]+)?)`)
)

// Inspect realiza una petición HTTP y deriva el fingerprint.
func Inspect(ctx context.Context, client HTTPDoer, rawURL string) (*Result, error) {
	candidate := rawURL
	if !strings.HasPrefix(candidate, "http") {
		candidate = "https://" + candidate
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, candidate, nil)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		// fallback HTTP
		if strings.HasPrefix(candidate, "https://") {
			req2, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+strings.TrimPrefix(candidate, "https://"), nil)
			start = time.Now()
			resp, err = client.Do(req2)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	defer resp.Body.Close()

	loadMs := time.Since(start).Milliseconds()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if len(bodyBytes) == 0 {
		return nil, fmt.Errorf("empty body from %s", rawURL)
	}
	res := &Result{
		URL:        rawURL,
		FinalURL:   resp.Request.URL.String(),
		StatusCode: resp.StatusCode,
		HasSSL:     resp.Request.URL.Scheme == "https",
		LoadTimeMs: loadMs,
		TechStack:  map[string]string{},
		HTMLBody:   string(bodyBytes),
	}

	if resp.TLS != nil {
		res.ValidCertificate = checkValidTLS(resp.TLS)
	}

	res.ServerHeader = resp.Header.Get("Server")
	res.PoweredBy = resp.Header.Get("X-Powered-By")
	if m := phpVersionRE.FindStringSubmatch(res.PoweredBy); len(m) == 2 {
		res.PHPVersion = m[1]
		res.TechStack["php"] = m[1]
	}
	if res.ServerHeader != "" {
		res.TechStack["server"] = res.ServerHeader
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(res.HTMLBody))
	if err == nil {
		res.Title = strings.TrimSpace(doc.Find("title").First().Text())
		if gen, ok := doc.Find("meta[name='generator']").First().Attr("content"); ok {
			res.Generator = gen
			res.TechStack["generator"] = gen
			if m := wpVersionRE.FindStringSubmatch(gen); len(m) == 2 {
				res.WordPress = true
				res.WordPressVersion = m[1]
				res.TechStack["wordpress"] = m[1]
			}
		}
		doc.Find("link[href*='wp-content'],script[src*='wp-content']").Each(func(_ int, _ *goquery.Selection) {
			res.WordPress = true
		})
	}

	return res, nil
}

func checkValidTLS(cs *tls.ConnectionState) bool {
	for _, cert := range cs.PeerCertificates {
		if time.Now().After(cert.NotAfter) {
			return false
		}
	}
	return len(cs.PeerCertificates) > 0
}
