// Package queue encapsula el bus Redis usado por todos los workers.
package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client envuelve un cliente Redis con helpers tipados.
type Client struct {
	rdb *redis.Client
}

// New crea un cliente conectado a la URL provista.
func New(redisURL string) (*Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	rdb := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return &Client{rdb: rdb}, nil
}

// Close cierra la conexión.
func (c *Client) Close() error { return c.rdb.Close() }

// Push publica un payload JSON en la cola indicada.
func (c *Client) Push(ctx context.Context, queue string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	if err := c.rdb.RPush(ctx, queue, body).Err(); err != nil {
		return fmt.Errorf("rpush %s: %w", queue, err)
	}
	return nil
}

// Length retorna el tamaño actual de una cola.
func (c *Client) Length(ctx context.Context, queue string) (int64, error) {
	return c.rdb.LLen(ctx, queue).Result()
}

// Get obtiene un valor de Redis por clave.
func (c *Client) Get(key string) (string, error) {
	return c.rdb.Get(context.Background(), key).Result()
}

// Delete elimina una clave de Redis.
func (c *Client) Delete(key string) error {
	return c.rdb.Del(context.Background(), key).Err()
}

// LPop saca y retorna el primer elemento de una lista.
func (c *Client) LPop(queue string) (string, error) {
	return c.rdb.LPop(context.Background(), queue).Result()
}
