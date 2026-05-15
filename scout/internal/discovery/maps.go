package discovery

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// MapsScraper extrae negocios visibles desde Google Maps usando una
// estrategia ligera (hojea SERP de "site:google.com/maps <query>" para
// recolectar enlaces hacia perfiles públicos).
//
// NOTA: Google Maps endpoints reales requieren JavaScript; este scraper
// produce candidatas que el Auditor luego visita con Playwright para extraer
// los detalles. Aquí solo nos importa producir URLs/hosts de negocios.
type MapsScraper struct {
	Client *http.Client
}

var websiteRE = regexp.MustCompile(`https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s"']*)?`)

// SearchBusinesses busca negocios para un query (ej: "dentistas en Madrid").
func (m *MapsScraper) SearchBusinesses(ctx context.Context, query string, limit int) ([]Candidate, error) {
	endpoint := "https://www.bing.com/search?q=" + url.QueryEscape("site:google.com/maps "+query) + "&count=" + fmt.Sprintf("%d", limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := m.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("maps proxy status %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	out := []Candidate{}
	doc.Find("li.b_algo p, li.b_algo .b_caption").Each(func(_ int, sel *goquery.Selection) {
		text := sel.Text()
		for _, href := range websiteRE.FindAllString(text, -1) {
			u, err := url.Parse(href)
			if err != nil {
				continue
			}
			host := strings.ToLower(u.Host)
			if host == "" || strings.Contains(host, "google.") || strings.Contains(host, "bing.") {
				continue
			}
			if _, dup := seen[host]; dup {
				continue
			}
			seen[host] = struct{}{}
			out = append(out, Candidate{
				URL:    u.Scheme + "://" + u.Host,
				Source: SourceGoogleMaps,
				Query:  query,
			})
		}
	})
	return out, nil
}
