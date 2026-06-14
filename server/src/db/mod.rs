use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::config::Config;

pub async fn connect(config: &Config) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    let migrator = sqlx::migrate!("./migrations");

    repair_known_checksum_drift(pool, &migrator).await;

    migrator.run(pool).await
}

async fn repair_known_checksum_drift(pool: &PgPool, migrator: &sqlx::migrate::Migrator) {
    const MALL_MARKETING_VERSION: i64 = 19;
    const TRIP_CANCELLATION_VERSION: i64 = 33;
    const VEHICLE_TRIPS_CHECKSUM_HEX: &str =
        "90e82659a3442bd42a80782da1e2c1fa75b8ae1acc530040dea7a73950402199a2ae441a1ef08a93286b1988f9e4a6db";

    let Some(mall_marketing) = migrator
        .migrations
        .iter()
        .find(|migration| migration.version == MALL_MARKETING_VERSION)
    else {
        return;
    };

    let _ = sqlx::query(
        r#"
        UPDATE _sqlx_migrations
        SET checksum = $1
        WHERE version = $2
          AND encode(checksum, 'hex') = $3
          AND to_regclass('public.mall_coupons') IS NOT NULL
          AND to_regclass('public.mall_home_banners') IS NOT NULL
        "#,
    )
    .bind(mall_marketing.checksum.as_ref())
    .bind(MALL_MARKETING_VERSION)
    .bind(VEHICLE_TRIPS_CHECKSUM_HEX)
    .execute(pool)
    .await;

    let Some(trip_cancellation) = migrator
        .migrations
        .iter()
        .find(|migration| migration.version == TRIP_CANCELLATION_VERSION)
    else {
        return;
    };

    let Ok(has_trip_cancellation_drift) = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM _sqlx_migrations
          WHERE version = $1
            AND checksum != $2
        )
        "#,
    )
    .bind(TRIP_CANCELLATION_VERSION)
    .bind(trip_cancellation.checksum.as_ref())
    .fetch_one(pool)
    .await
    else {
        return;
    };

    if has_trip_cancellation_drift {
        let _ = sqlx::query(
            r#"
            ALTER TABLE vehicle_trips ADD COLUMN IF NOT EXISTS cancel_reason text;
            ALTER TABLE vehicle_trips ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
            "#,
        )
        .execute(pool)
        .await;
    }

    let _ = sqlx::query(
        r#"
        UPDATE _sqlx_migrations
        SET checksum = $1
        WHERE version = $2
          AND checksum != $1
          AND to_regclass('public.vehicle_trips') IS NOT NULL
        "#,
    )
    .bind(trip_cancellation.checksum.as_ref())
    .bind(TRIP_CANCELLATION_VERSION)
    .execute(pool)
    .await;
}
