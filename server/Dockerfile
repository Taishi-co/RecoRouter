FROM rust:1-bookworm AS builder

WORKDIR /app
RUN mkdir -p /usr/local/cargo \
  && printf '[source.crates-io]\nreplace-with = "rsproxy-sparse"\n[source.rsproxy-sparse]\nregistry = "sparse+https://rsproxy.cn/index/"\n' > /usr/local/cargo/config.toml
COPY Cargo.toml Cargo.lock ./
RUN cargo fetch --locked
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release --bins --locked

FROM debian:bookworm-slim AS runner

WORKDIR /app
RUN mkdir -p /etc/ssl/certs
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

COPY --from=builder /app/target/release/recorouter-api /usr/local/bin/recorouter-api
COPY --from=builder /app/target/release/vehicle-api /usr/local/bin/vehicle-api
COPY --from=builder /app/target/release/mall-api /usr/local/bin/mall-api
COPY --from=builder /app/target/release/platform-api /usr/local/bin/platform-api
COPY --from=builder /app/target/release/recorouter-migrator /usr/local/bin/recorouter-migrator
COPY --from=builder /app/migrations ./migrations

ENV SERVER_PORT=34532
ENV LOCAL_UPLOAD_DIR=/app/uploads
EXPOSE 34532

CMD ["recorouter-api"]
