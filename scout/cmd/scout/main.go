// Command scout es el worker de descubrimiento de SIPHON-X.
//
// Flujo:
//  1. Carga seeds y Dorks desde el sistema de archivos.
//  2. Resuelve los Dorks a URLs candidatas vía DorkScraper / MapsScraper.
//  3. Para cada candidata: realiza fingerprint (SSL, tiempo, tech).
//  4. Aplica filtros (sitios deficientes) y publica el lead en la API.
//  5. La API a su vez encola en la cola `siphon:queue:audit` para el Auditor.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/siphonx/scout/internal/config"
	"github.com/siphonx/scout/internal/discovery"
	"github.com/siphonx/scout/internal/filters"
	"github.com/siphonx/scout/internal/fingerprint"
	"github.com/siphonx/scout/internal/logging"
	"github.com/siphonx/scout/internal/proxy"
	"github.com/siphonx/scout/internal/queue"
	"golang.org/x/sync/errgroup"
)

func main() {
	if err := run(); err != nil {
		slog.Error("scout fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}
	logger := logging.New(cfg.ServiceName)
	logger.Info("scout up",
		"concurrency", cfg.Concurrency,
		"queue_audit", cfg.QueueAudit,
		"api", cfg.APIBaseURL,
		"loop_interval", cfg.LoopInterval.String(),
	)

	rotator, err := proxy.NewRotator(cfg.ProxiesFile, cfg.UserAgentsFile)
	if err != nil {
		return fmt.Errorf("proxy rotator: %w", err)
	}

	q, err := queue.New(cfg.RedisURL)
	if err != nil {
		return fmt.Errorf("redis: %w", err)
	}
	defer q.Close()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	pass := 0
	for {
		pass++
		if err := singlePass(ctx, logger.With("pass", pass), cfg, rotator); err != nil {
			if errors.Is(err, context.Canceled) {
				logger.Info("scout stopped by signal")
				return nil
			}
			logger.Error("pass failed", "err", err)
		}

		if cfg.LoopInterval <= 0 {
			logger.Info("scout exiting (loop disabled)")
			return nil
		}

		logger.Info("sleeping until next pass", "interval", cfg.LoopInterval.String())
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(cfg.LoopInterval):
		}
	}
}

// singlePass ejecuta una sola pasada del Scout: carga seeds/Dorks, lanza
// productores y workers, espera a que todos drenen y retorna.
func singlePass(
	ctx context.Context,
	logger *slog.Logger,
	cfg *config.Config,
	rotator *proxy.Rotator,
) error {
	seeds, err := discovery.LoadSeeds(cfg.TargetsFile)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Warn("seeds_load_failed", "err", err)
	}
	dorks, err := discovery.LoadDorks(cfg.DorksFile)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Warn("dorks_load_failed", "err", err)
	}
	logger.Info("pass_start", "seeds", len(seeds), "dorks", len(dorks))

	candidates := make(chan discovery.Candidate, cfg.Concurrency*4)
	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		defer close(candidates)
		return populateCandidates(gctx, logger, cfg, rotator, seeds, dorks, candidates)
	})

	var wg sync.WaitGroup
	for i := 0; i < cfg.Concurrency; i++ {
		wg.Add(1)
		workerID := i
		g.Go(func() error {
			defer wg.Done()
			return worker(gctx, workerID, logger, cfg, rotator, candidates)
		})
	}

	err = g.Wait()
	wg.Wait()
	logger.Info("pass_drained")
	if err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	return nil
}

func populateCandidates(
	ctx context.Context,
	logger *slog.Logger,
	cfg *config.Config,
	rotator *proxy.Rotator,
	seeds []discovery.Candidate,
	dorks []string,
	out chan<- discovery.Candidate,
) error {
	for _, s := range seeds {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case out <- s:
		}
	}

	if len(dorks) == 0 {
		return nil
	}

	dorkScraper := &discovery.DorkScraper{Client: rotator.NewHTTPClient(cfg.HTTPTimeout)}
	mapsScraper := &discovery.MapsScraper{Client: rotator.NewHTTPClient(cfg.HTTPTimeout)}

	for _, q := range dorks {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		bingResults, err := dorkScraper.SearchBing(ctx, q, 25)
		if err != nil {
			logger.Warn("dork_search_failed", "query", q, "err", err)
		}
		for _, r := range bingResults {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case out <- r:
			}
		}

		mapsResults, err := mapsScraper.SearchBusinesses(ctx, q, 25)
		if err != nil {
			logger.Warn("maps_search_failed", "query", q, "err", err)
		}
		for _, r := range mapsResults {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case out <- r:
			}
		}

		time.Sleep(2 * time.Second) // rate-limit suave entre Dorks
	}
	return nil
}

func worker(
	ctx context.Context,
	workerID int,
	logger *slog.Logger,
	cfg *config.Config,
	rotator *proxy.Rotator,
	in <-chan discovery.Candidate,
) error {
	rules := filters.DefaultRules(cfg.LoadTimeThreshold)
	client := rotator.NewHTTPClient(cfg.HTTPTimeout)
	apiClient := &http.Client{Timeout: 15 * time.Second}

	for cand := range in {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		log := logger.With("worker", workerID, "url", cand.URL, "source", string(cand.Source))

		res, err := fingerprint.Inspect(ctx, client, cand.URL)
		if err != nil {
			log.Warn("fingerprint_failed", "err", err)
			continue
		}
		verdict := filters.Evaluate(res, rules)
		log.Info("fingerprinted",
			"status", res.StatusCode,
			"ssl", res.HasSSL,
			"load_ms", res.LoadTimeMs,
			"wp", res.WordPress,
			"eligible", verdict.Eligible,
			"reasons", strings.Join(verdict.Reasons, ","),
			"score", verdict.Score,
		)

		if !verdict.Eligible {
			continue
		}

		body := map[string]any{
			"url":              normalizeURL(res.FinalURL, cand.URL),
			"tech_stack":       res.TechStack,
			"has_ssl":          res.HasSSL,
			"load_time_ms":     res.LoadTimeMs,
			"discovery_source": string(cand.Source),
			"discovery_query":  cand.Query,
		}
		if err := postLead(ctx, apiClient, cfg.APIBaseURL, body); err != nil {
			log.Error("api_publish_failed", "err", err)
			continue
		}
		log.Info("lead_published")
	}
	return nil
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
