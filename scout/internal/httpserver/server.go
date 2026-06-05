// Package httpserver expone análisis manual de URLs para la API.
package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/orion/scout/internal/config"
	"github.com/orion/scout/internal/pipeline"
	"github.com/orion/scout/internal/proxy"
)

type analyzeRequest struct {
	URL      string `json:"url"`
	Location string `json:"location"`
	Industry string `json:"industry"`
}

type analyzeResponse struct {
	Published       bool     `json:"published"`
	SkippedReason   string   `json:"skipped_reason,omitempty"`
	URL             string   `json:"url"`
	Segment         string   `json:"segment,omitempty"`
	TotalScore      int      `json:"total_score,omitempty"`
	ProblemScore    int      `json:"problem_score,omitempty"`
	CommercialScore int      `json:"commercial_score,omitempty"`
	Eligible        bool     `json:"eligible"`
	Reasons         []string `json:"reasons,omitempty"`
	Error           string   `json:"error,omitempty"`
}

// Start lanza el servidor HTTP de análisis en una goroutine.
func Start(ctx context.Context, logger *slog.Logger, cfg *config.Config, rotator *proxy.Rotator) {
	if cfg.AnalyzeHTTPPort <= 0 {
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("POST /analyze", func(w http.ResponseWriter, r *http.Request) {
		var req analyzeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, analyzeResponse{Error: "invalid json"})
			return
		}
		reqCtx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
		defer cancel()

		outcome, err := pipeline.Publish(reqCtx, logger, cfg, rotator, pipeline.PublishOptions{
			RawURL:          req.URL,
			Location:        req.Location,
			Industry:        req.Industry,
			DiscoverySource: "manual",
			DiscoveryQuery:  "manual_url",
		})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, analyzeResponse{Error: err.Error(), URL: req.URL})
			return
		}
		resp := analyzeResponse{
			Published:       outcome.Published,
			SkippedReason:   outcome.SkippedReason,
			URL:             outcome.URL,
			Segment:         outcome.Segment,
			TotalScore:      outcome.TotalScore,
			ProblemScore:    outcome.ProblemScore,
			CommercialScore: outcome.CommercialScore,
			Eligible:        outcome.Eligible,
			Reasons:         outcome.Reasons,
		}
		status := http.StatusOK
		if !outcome.Published && outcome.SkippedReason != "" {
			status = http.StatusUnprocessableEntity
		}
		writeJSON(w, status, resp)
	})

	addr := ":" + strconv.Itoa(cfg.AnalyzeHTTPPort)
	srv := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	go func() {
		logger.Info("analyze_http_listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("analyze_http_failed", "err", err)
		}
	}()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
