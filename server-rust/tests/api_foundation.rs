use std::{
    env,
    sync::{Mutex, MutexGuard, OnceLock},
};

fn env_lock() -> MutexGuard<'static, ()> {
    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    ENV_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn set_required_env() {
    env::set_var(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost:5432/recocar_test",
    );
    env::set_var("SERVER_PORT", "34532");
}

#[test]
fn config_reads_required_database_url() {
    let _guard = env_lock();
    set_required_env();
    env::set_var("PUBLIC_BASE_URL", "https://car.shcxyz.site");
    env::set_var("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(
        config.database_url,
        "postgres://postgres:postgres@localhost:5432/recocar_test"
    );
    assert_eq!(config.server_port, 34532);
    assert_eq!(
        config.public_base_url.as_deref(),
        Some("https://car.shcxyz.site")
    );
    assert_eq!(
        config.local_upload_dir.to_string_lossy(),
        "/tmp/recorouter-uploads"
    );
}

#[test]
fn config_defaults_local_upload_dir_to_relative_uploads() {
    let _guard = env_lock();
    set_required_env();
    env::remove_var("LOCAL_UPLOAD_DIR");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(config.local_upload_dir.to_string_lossy(), "uploads");
}

#[test]
fn config_trims_public_base_url_trailing_slash() {
    let _guard = env_lock();
    set_required_env();
    env::set_var("PUBLIC_BASE_URL", "https://car.shcxyz.site/");
    env::set_var("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(
        config.public_base_url.as_deref(),
        Some("https://car.shcxyz.site")
    );
}
