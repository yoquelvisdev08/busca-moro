// Package logging entrega un logger JSON estructurado.
package logging

import (
	"log/slog"
	"os"
)

// New crea un logger JSON con campos comunes.
func New(service string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	return slog.New(handler).With("service", service)
}
