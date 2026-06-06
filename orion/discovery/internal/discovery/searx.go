// Package discovery genera URLs candidatas a partir de seeds y motores de búsqueda.
package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// SearXNG integra una instancia self-hosted de SearXNG.
// https://docs.searxng.org/dev/search_api.html
type SearXNG struct {
	Client  *http.Client
	BaseURL string
}

// NewSearXNG crea un cliente SearXNG.
func NewSearXNG(baseURL string, client *http.Client) *SearXNG {
	return &SearXNG{
		Client:  client,
		BaseURL: strings.TrimRight(baseURL, "/"),
	}
}

// searxResponse estructura la respuesta JSON de SearXNG (format=search_api).
type searxResponse struct {
	Results []searxResult `json:"results"`
}

type searxResult struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}

// Search usa SearXNG para obtener URLs candidatas.
func (s *SearXNG) Search(ctx context.Context, query string, limit int) ([]Candidate, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.BaseURL+"/search", nil)
	if err != nil {
		return nil, err
	}

	q := req.URL.Query()
	q.Set("q", query)
	q.Set("format", "json")
	q.Set("categories", "general")
	q.Set("engines", "google,bing,duckduckgo")
	q.Set("pageno", "1")
	req.URL.RawQuery = q.Encode()

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("searxng status %d", resp.StatusCode)
	}

	var body searxResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	out := []Candidate{}
	for _, r := range body.Results {
		if len(out) >= limit {
			break
		}
		u, err := url.Parse(r.URL)
		if err != nil || u.Host == "" {
			continue
		}
		host := strings.ToLower(u.Host)
		if _, dup := seen[host]; dup {
			continue
		}
		seen[host] = struct{}{}
		out = append(out, Candidate{
			URL:    u.Scheme + "://" + u.Host,
			Source: SourceSearXNG,
			Query:  query,
		})
	}
	return out, nil
}
