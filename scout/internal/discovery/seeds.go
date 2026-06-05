// Package discovery genera URLs candidatas a partir de seeds y Dorks.
package discovery

import (
	"bufio"
	"os"
	"strings"
)

// Source identifica el origen del descubrimiento.
type Source string

const (
	SourceSeed       Source = "seed"
	SourceDorkGoogle Source = "dork_google"
	SourceDorkBing   Source = "dork_bing"
	SourceGoogleMaps Source = "google_maps"
	SourceSearXNG    Source = "searxng"
)

// Candidate es una URL a inspeccionar por el Scout.
type Candidate struct {
	URL      string
	Source   Source
	Query    string
	Location string
	Industry string
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


