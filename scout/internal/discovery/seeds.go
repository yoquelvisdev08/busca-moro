// Package discovery genera URLs candidatas a partir de seeds y Dorks.
package discovery

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// Source identifica el origen del descubrimiento.
type Source string

const (
	SourceSeed      Source = "seed"
	SourceDorkGoogle Source = "dork_google"
	SourceDorkBing   Source = "dork_bing"
	SourceGoogleMaps Source = "google_maps"
)

// Candidate es una URL a inspeccionar por el Scout.
type Candidate struct {
	URL    string
	Source Source
	Query  string
}

// LoadSeeds lee un archivo con una URL por línea.
func LoadSeeds(path string) ([]Candidate, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	out := []Candidate{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, Candidate{URL: line, Source: SourceSeed})
	}
	return out, sc.Err()
}

// LoadDorks lee Google/Bing Dorks (uno por línea).
func LoadDorks(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var out []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, line)
	}
	return out, sc.Err()
}

// DorkScraper resuelve Dorks usando un motor de búsqueda público.
//
// IMPORTANTE: scraping de Google/Bing está sujeto a sus términos de servicio.
// En producción se recomienda usar SerpAPI / ScrapingBee / Brave Search API.
// Esta implementación está pensada para uso responsable con proxies y rate
// limiting, y se mantiene aislada para poder reemplazarse fácilmente.
type DorkScraper struct {
	Client *http.Client
}

// SearchBing devuelve los hosts únicos de los resultados orgánicos.
// Bing es históricamente menos hostil al scraping que Google y útil como
// implementación de referencia.
func (s *DorkScraper) SearchBing(ctx context.Context, query string, limit int) ([]Candidate, error) {
	endpoint := "https://www.bing.com/search?q=" + url.QueryEscape(query) + "&count=" + fmt.Sprintf("%d", limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bing status %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	out := []Candidate{}
	doc.Find("li.b_algo h2 a").Each(func(_ int, sel *goquery.Selection) {
		href, ok := sel.Attr("href")
		if !ok {
			return
		}
		u, err := url.Parse(href)
		if err != nil || u.Host == "" {
			return
		}
		host := strings.ToLower(u.Host)
		if _, dup := seen[host]; dup {
			return
		}
		seen[host] = struct{}{}
		out = append(out, Candidate{
			URL:    u.Scheme + "://" + u.Host,
			Source: SourceDorkBing,
			Query:  query,
		})
	})
	return out, nil
}
