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
}
