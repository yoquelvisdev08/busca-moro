// Command scout es el worker de descubrimiento de Orion.
//
// Flujo:
//  1. Carga seeds y Dorks desde el sistema de archivos.
//  2. Resuelve los Dorks a URLs candidatas vía DorkScraper / MapsScraper.
//  3. Para cada candidata: realiza fingerprint (SSL, tiempo, tech).
//  4. Aplica filtros (sitios deficientes) y publica el lead en la API.
//  5. La API a su vez encola en la cola `orion:queue:audit` para el Auditor.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/orion/scout/internal/config"
	"github.com/orion/scout/internal/discovery"
	"github.com/orion/scout/internal/httpserver"
	"github.com/orion/scout/internal/logging"
	"github.com/orion/scout/internal/pipeline"
	"github.com/orion/scout/internal/proxy"
	"github.com/orion/scout/internal/queue"
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

	httpserver.Start(ctx, logger, cfg, rotator)

	pass := 0
	for {
		pass++
		if shouldRunPass(ctx, logger, cfg, q) {
			if err := singlePass(ctx, logger.With("pass", pass), cfg, rotator, q, pass); err != nil {
				if errors.Is(err, context.Canceled) {
					logger.Info("scout stopped by signal")
					return nil
				}
				logger.Error("pass failed", "err", err)
			}
		} else {
			logger.Info("pass_skipped", "reason", "auto_scout_disabled")
		}

		if cfg.LoopInterval <= 0 {
			logger.Info("scout exiting (loop disabled)")
			return nil
		}

		logger.Info("sleeping until next pass", "interval", getLoopInterval(q, cfg).String())
		// Check for start signal every 5 seconds during sleep
		started := time.Now()
		signaled := false
		sleepFor := getLoopInterval(q, cfg)
		for time.Since(started) < sleepFor {
			if checkStartSignal(q, cfg) {
				logger.Info("start signal detected, running immediately")
				signaled = true
				break
			}
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(5 * time.Second):
			}
		}
		if signaled {
			continue
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
	q *queue.Client,
	passNumber int,
) error {
	seeds, err := discovery.LoadSeeds(cfg.TargetsFile)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Warn("seeds_load_failed", "err", err)
	}
	dorks, err := discovery.LoadDorks(cfg.DorksFile)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Warn("dorks_load_failed", "err", err)
	}

	redisBatch := loadRedisBatch(q, cfg.QueueDiscovery)
	if len(redisBatch.queries) > 0 {
		logger.Info("redis_dorks_loaded", "count", len(redisBatch.queries), "location", redisBatch.location)
		dorks = append(dorks, redisBatch.queries...)
	}

	logger.Info("pass_start", "seeds", len(seeds), "dorks", len(dorks), "target_location", redisBatch.location)

	mode := "automatic"
	if len(redisBatch.queries) > 0 {
		mode = "discovery"
	}
	publishPassStatus(q, passStatus{
		Active:     true,
		Pass:       passNumber,
		Mode:       mode,
		DorksCount: len(dorks),
		SeedsCount: len(seeds),
		Location:   redisBatch.location,
		Industry:   redisBatch.industry,
		StartedAt:  time.Now().UTC().Format(time.RFC3339),
	})
	defer func() {
		publishPassStatus(q, passStatus{
			Active:     false,
			Pass:       passNumber,
			Mode:       mode,
			DorksCount: len(dorks),
			SeedsCount: len(seeds),
			Location:   redisBatch.location,
			Industry:   redisBatch.industry,
			FinishedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}()

	candidates := make(chan discovery.Candidate, cfg.Concurrency*4)
	var seenHosts sync.Map
	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		defer close(candidates)
		return populateCandidates(gctx, logger, cfg, rotator, seeds, dorks, redisBatch.location, redisBatch.industry, candidates)
	})

	var wg sync.WaitGroup
	for i := 0; i < cfg.Concurrency; i++ {
		wg.Add(1)
		workerID := i
		g.Go(func() error {
			defer wg.Done()
			return worker(gctx, workerID, logger, cfg, rotator, &seenHosts, candidates)
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
	targetLocation string,
	targetIndustry string,
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

	searx := discovery.NewSearXNG(cfg.SearXNGURL, rotator.NewHTTPClient(cfg.HTTPTimeout))
	mapsScraper := &discovery.MapsScraper{Client: rotator.NewHTTPClient(cfg.HTTPTimeout)}

	for _, q := range dorks {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		searxResults, err := searx.Search(ctx, q, 35)
		if err != nil {
			logger.Warn("searxng_search_failed", "query", q, "err", err)
		}
		for _, r := range searxResults {
			r.Location = targetLocation
			r.Industry = targetIndustry
			select {
			case <-ctx.Done():
				return ctx.Err()
			case out <- r:
			}
		}

		mapsResults, err := mapsScraper.SearchBusinesses(ctx, q, 30)
		if err != nil {
			logger.Warn("maps_search_failed", "query", q, "err", err)
		}
		for _, r := range mapsResults {
			r.Location = targetLocation
			r.Industry = targetIndustry
			select {
			case <-ctx.Done():
				return ctx.Err()
			case out <- r:
			}
		}

		if len(searxResults) == 0 && len(mapsResults) == 0 {
			logger.Warn("both_discovery_sources_empty", "query", q)
		}

		time.Sleep(1 * time.Second) // rate-limit suave entre Dorks
	}
	return nil
}

func worker(
	ctx context.Context,
	workerID int,
	logger *slog.Logger,
	cfg *config.Config,
	rotator *proxy.Rotator,
	seenHosts *sync.Map,
	in <-chan discovery.Candidate,
) error {
	for cand := range in {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		log := logger.With("worker", workerID, "url", cand.URL, "source", string(cand.Source))

		hostKey := pipeline.HostKey(cand.URL)
		if _, loaded := seenHosts.LoadOrStore(hostKey, true); loaded {
			log.Debug("candidate_skipped_duplicate_host")
			continue
		}

		outcome, err := pipeline.Publish(ctx, log, cfg, rotator, pipeline.PublishOptions{
			RawURL:          cand.URL,
			Location:        cand.Location,
			Industry:        cand.Industry,
			DiscoverySource: string(cand.Source),
			DiscoveryQuery:  cand.Query,
		})
		if err != nil {
			log.Warn("publish_failed", "err", err)
			continue
		}
		log.Info("fingerprinted",
			"eligible", outcome.Eligible,
			"reasons", strings.Join(outcome.Reasons, ","),
			"problem_score", outcome.ProblemScore,
			"commercial_score", outcome.CommercialScore,
			"total_score", outcome.TotalScore,
			"segment", outcome.Segment,
			"skipped", outcome.SkippedReason,
		)
		if outcome.Published {
			log.Info("lead_published", "segment", outcome.Segment, "total_score", outcome.TotalScore)
		}
	}
	return nil
}

// checkStartSignal verifica si hay un signal de arranque inmediato en Redis.
func checkStartSignal(q *queue.Client, cfg *config.Config) bool {
	val, err := q.Get("orion:signal:start")
	if err != nil {
		return false
	}
	if val == "1" {
		q.Delete("orion:signal:start")
		return true
	}
	return false
}

const automationConfigKey = "orion:config:automation"

func hasStartSignal(q *queue.Client) bool {
	val, err := q.Get("orion:signal:start")
	return err == nil && val == "1"
}

func isAutoScoutEnabled(q *queue.Client) bool {
	raw, err := q.Get(automationConfigKey)
	if err != nil || raw == "" {
		return true
	}
	var cfg struct {
		AutoScoutEnabled *bool `json:"auto_scout_enabled"`
	}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return true
	}
	if cfg.AutoScoutEnabled == nil {
		return true
	}
	return *cfg.AutoScoutEnabled
}

func getLoopInterval(q *queue.Client, cfg *config.Config) time.Duration {
	if cfg.LoopInterval <= 0 {
		return cfg.LoopInterval
	}
	raw, err := q.Get(automationConfigKey)
	if err != nil || raw == "" {
		return cfg.LoopInterval
	}
	var ac struct {
		ScoutLoopMinutes *int `json:"scout_loop_minutes"`
	}
	if err := json.Unmarshal([]byte(raw), &ac); err != nil {
		return cfg.LoopInterval
	}
	if ac.ScoutLoopMinutes == nil || *ac.ScoutLoopMinutes <= 0 {
		return cfg.LoopInterval
	}
	return time.Duration(*ac.ScoutLoopMinutes) * time.Minute
}

func shouldRunPass(ctx context.Context, logger *slog.Logger, cfg *config.Config, q *queue.Client) bool {
	if hasStartSignal(q) {
		return true
	}
	n, err := q.Length(ctx, cfg.QueueDiscovery)
	if err == nil && n > 0 {
		return true
	}
	enabled := isAutoScoutEnabled(q)
	if !enabled {
		logger.Debug("auto_scout_disabled")
	}
	return enabled
}

type redisDiscoveryBatch struct {
	queries  []string
	location string
	industry string
}

const maxBatchSize = 1000

// loadRedisBatch lee dorks IA y el contexto de mercado (país/industria).
func loadRedisBatch(q *queue.Client, queueKey string) redisDiscoveryBatch {
	var batch redisDiscoveryBatch
	if raw, err := q.Get("orion:discovery:context"); err == nil && raw != "" {
		var ctx struct {
			Location string `json:"location"`
			Industry string `json:"industry"`
		}
		if err := json.Unmarshal([]byte(raw), &ctx); err == nil {
			batch.location = ctx.Location
			batch.industry = ctx.Industry
		}
	}
	count := 0
	for {
		if count >= maxBatchSize {
			break
		}
		msg, err := q.LPop(queueKey)
		if err != nil {
			break
		}
		var dorkMsg struct {
			Query    string `json:"query"`
			Location string `json:"location"`
			Industry string `json:"industry"`
		}
		if err := json.Unmarshal([]byte(msg), &dorkMsg); err == nil && dorkMsg.Query != "" {
			batch.queries = append(batch.queries, dorkMsg.Query)
			if batch.location == "" && dorkMsg.Location != "" {
				batch.location = dorkMsg.Location
			}
			if batch.industry == "" && dorkMsg.Industry != "" {
				batch.industry = dorkMsg.Industry
			}
		}
		count++
	}
	return batch
}

const scoutPassRedisKey = "orion:scout:pass"

type passStatus struct {
	Active     bool   `json:"active"`
	Pass       int    `json:"pass"`
	Mode       string `json:"mode"`
	DorksCount int    `json:"dorks_count"`
	SeedsCount int    `json:"seeds_count"`
	Location   string `json:"location"`
	Industry   string `json:"industry"`
	StartedAt  string `json:"started_at,omitempty"`
	FinishedAt string `json:"finished_at,omitempty"`
}

func publishPassStatus(q *queue.Client, st passStatus) {
	body, err := json.Marshal(st)
	if err != nil {
		return
	}
	ttl := 45 * time.Minute
	if !st.Active {
		ttl = 2 * time.Hour
	}
	_ = q.Set(scoutPassRedisKey, string(body), ttl)
}
