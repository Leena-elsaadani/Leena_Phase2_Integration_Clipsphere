FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -o /user-service ./cmd/main.go

FROM alpine:3.21
WORKDIR /app
COPY --from=builder /user-service /usr/local/bin/user-service
EXPOSE 3003
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["/usr/local/bin/user-service"]