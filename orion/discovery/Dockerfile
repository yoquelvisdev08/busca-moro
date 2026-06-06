FROM golang:1.23-alpine AS build

WORKDIR /src

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/scout ./cmd/scout

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && update-ca-certificates

WORKDIR /app
COPY --from=build /out/scout /app/scout
COPY config /app/config

ENV PATH=/app:$PATH

ENTRYPOINT ["/app/scout"]
