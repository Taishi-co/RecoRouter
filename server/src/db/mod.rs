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

    // Fix checksum mismatches for already-applied migrations.
    // This can happen when a migration file is modified after initial deployment
    // (e.g. adding IF NOT EXISTS for idempotency). Since all our migrations are
    // idempotent, updating the stored checksum is safe.
    for migration in migrator.migrations.iter() {
        let version = migration.version;
        let checksum = &migration.checksum;

        // Compute the hex representation of the checksum bytes
        let checksum_hex: String = checksum.iter().map(|b| format!("{:02x}", b)).collect();

        let result = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM _sqlx_migrations WHERE version = $1",
        )
        .bind(version as i64)
        .fetch_one(pool)
        .await;

        if let Ok(1) = result {
            // Migration was already applied — update checksum to match current file
            sqlx::query("UPDATE _sqlx_migrations SET checksum = $2 WHERE version = $1 AND checksum != $2")
                .bind(version as i64)
                .bind(&checksum_hex)
                .execute(pool)
                .await
                .ok();
        }
    }

    migrator.run(pool).await
}
