// Package proxy implementa rotación round-robin thread-safe de proxies/UA.
package proxy

import (
	"bufio"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// Rotator selecciona proxies y user-agents aleatorios.
type Rotator struct {
	mu        sync.Mutex
	proxies   []*url.URL
	userAgent []string
	rand      *rand.Rand
}

// NewRotator construye un rotador leyendo archivos con un valor por línea.
// Las líneas vacías y aquellas que comienzan con '#' se ignoran.
func NewRotator(proxiesPath, userAgentsPath string) (*Rotator, error) {
	proxies, err := readNonEmptyLines(proxiesPath)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	uas, err := readNonEmptyLines(userAgentsPath)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	if len(uas) == 0 {
		uas = []string{defaultUserAgent}
	}

	parsed := make([]*url.URL, 0, len(proxies))
	for _, p := range proxies {
		u, err := url.Parse(p)
		if err == nil && u.Host != "" {
			parsed = append(parsed, u)
		}
	}

	return &Rotator{
		proxies:   parsed,
		userAgent: uas,
		rand:      rand.New(rand.NewSource(time.Now().UnixNano())),
	}, nil
}

// PickProxy retorna un proxy aleatorio o nil si no hay configurados.
func (r *Rotator) PickProxy() *url.URL {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.proxies) == 0 {
		return nil
	}
	return r.proxies[r.rand.Intn(len(r.proxies))]
}

// PickUserAgent retorna un UA aleatorio.
func (r *Rotator) PickUserAgent() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.userAgent[r.rand.Intn(len(r.userAgent))]
}

// NewHTTPClient construye un cliente con timeout, UA aleatorio y proxy.
func (r *Rotator) NewHTTPClient(timeout time.Duration) *http.Client {
	transport := &http.Transport{
		ResponseHeaderTimeout: timeout,
		IdleConnTimeout:       30 * time.Second,
	}
	if proxyURL := r.PickProxy(); proxyURL != nil {
		transport.Proxy = http.ProxyURL(proxyURL)
	}
	return &http.Client{
		Timeout:   timeout,
		Transport: &uaTransport{base: transport, ua: r.PickUserAgent()},
	}
}

type uaTransport struct {
	base http.RoundTripper
	ua   string
}

func (t *uaTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", t.ua)
	}
	req.Header.Set("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
	return t.base.RoundTrip(req)
}

func readNonEmptyLines(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var out []string
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, line)
	}
	return out, sc.Err()
}

const defaultUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
