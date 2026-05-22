FROM rust:1-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim AS runner

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/recorouter-api /usr/local/bin/recorouter-api
COPY --from=builder /app/migrations ./migrations

ENV SERVER_PORT=34532
ENV LOCAL_UPLOAD_DIR=/app/uploads
EXPOSE 34532

CMD ["recorouter-api"]
