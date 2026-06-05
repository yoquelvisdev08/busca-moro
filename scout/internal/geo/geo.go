// Package geo filtra candidatos según país/región objetivo del discovery.
package geo

import (
	"strings"
)

// stripAccents removes common diacritical marks for accent-insensitive matching.
func stripAccents(s string) string {
	r := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u",
		"Á", "A", "É", "E", "Í", "I", "Ó", "O", "Ú", "U",
		"ñ", "n", "Ñ", "N", "ü", "u", "Ü", "U",
	)
	return r.Replace(s)
}

type rule struct {
	tlds     []string
	keywords []string
}

var locationRules = map[string]rule{
	"república dominicana": {
		tlds:     []string{".do"},
		keywords: []string{"dominicana", "santo domingo", "santiago", "punta cana", "la vega", "san cristóbal"},
	},
	"dominican republic": {
		tlds:     []string{".do"},
		keywords: []string{"dominicana", "santo domingo"},
	},
	"españa": {
		tlds:     []string{".es"},
		keywords: []string{"madrid", "barcelona", "valencia", "sevilla", "españa", "espana"},
	},
	"spain": {
		tlds:     []string{".es"},
		keywords: []string{"madrid", "barcelona", "spain", "españa"},
	},
	"méxico": {
		tlds:     []string{".mx"},
		keywords: []string{"mexico", "méxico", "cdmx", "guadalajara", "monterrey"},
	},
	"mexico": {
		tlds:     []string{".mx"},
		keywords: []string{"mexico", "cdmx", "guadalajara"},
	},
	"colombia": {
		tlds:     []string{".co"},
		keywords: []string{"bogota", "bogotá", "medellin", "medellín", "colombia"},
	},
	"argentina": {
		tlds:     []string{".ar"},
		keywords: []string{"argentina", "buenos aires", "cordoba"},
	},
	"chile": {
		tlds:     []string{".cl"},
		keywords: []string{"chile", "santiago"},
	},
	"perú": {
		tlds:     []string{".pe"},
		keywords: []string{"peru", "perú", "lima"},
	},
	"peru": {
		tlds:     []string{".pe"},
		keywords: []string{"peru", "lima"},
	},
	"ecuador": {
		tlds:     []string{".ec"},
		keywords: []string{"ecuador", "quito", "guayaquil"},
	},
	"puerto rico": {
		tlds:     []string{".pr"},
		keywords: []string{"puerto rico", "san juan"},
	},
}

// MatchesLocation indica si la URL (y opcionalmente HTML) encaja con el mercado objetivo.
// Si location está vacío, no filtra.
func MatchesLocation(host, htmlSample, location string) bool {
	location = strings.TrimSpace(strings.ToLower(location))
	if location == "" {
		return true
	}

	host = strings.ToLower(host)
	html := strings.ToLower(htmlSample)

	// Try exact match first, then accent-stripped match
	r, ok := locationRules[location]
	if !ok {
		// Try matching with accents stripped (e.g. "Republica Dominicana" -> "república dominicana")
		stripped := stripAccents(location)
		for key, rule := range locationRules {
			if stripAccents(key) == stripped {
				r = rule
				ok = true
				break
			}
		}
	}
	if !ok {
		compact := strings.ReplaceAll(location, " ", "")
		if strings.Contains(host, compact) {
			return true
		}
		if html != "" && strings.Contains(html, location) {
			return true
		}
		return false
	}

	for _, tld := range r.tlds {
		if strings.HasSuffix(host, tld) {
			return true
		}
	}
	for _, kw := range r.keywords {
		if strings.Contains(host, kw) {
			return true
		}
		if html != "" && strings.Contains(html, kw) {
			return true
		}
	}
	return false
}
