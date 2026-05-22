use std::{
    collections::HashMap,
    env,
    sync::{Mutex, MutexGuard, OnceLock},
};

const TOUCHED_ENV_KEYS: [&str; 4] = [
    "DATABASE_URL",
    "SERVER_PORT",
    "PUBLIC_BASE_URL",
    "LOCAL_UPLOAD_DIR",
];

struct EnvGuard {
    _lock: MutexGuard<'static, ()>,
    snapshot: HashMap<&'static str, Option<String>>,
}

impl EnvGuard {
    fn new() -> Self {
        let lock = env_lock();
        let snapshot = TOUCHED_ENV_KEYS
            .into_iter()
            .map(|key| (key, env::var(key).ok()))
            .collect();

        Self {
            _lock: lock,
            snapshot,
        }
    }

    fn set(&self, key: &'static str, value: &str) {
        assert!(TOUCHED_ENV_KEYS.contains(&key));
        env::set_var(key, value);
    }

    fn remove(&self, key: &'static str) {
        assert!(TOUCHED_ENV_KEYS.contains(&key));
        env::remove_var(key);
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        for key in TOUCHED_ENV_KEYS {
            match self.snapshot.get(key).and_then(|value| value.as_ref()) {
                Some(value) => env::set_var(key, value),
                None => env::remove_var(key),
            }
        }
    }
}

fn env_lock() -> MutexGuard<'static, ()> {
    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    ENV_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn set_required_env(env: &EnvGuard) {
    env.set(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost:5432/recocar_test",
    );
    env.set("SERVER_PORT", "34532");
}

#[test]
fn config_reads_required_database_url() {
    let env = EnvGuard::new();
    set_required_env(&env);
    env.set("PUBLIC_BASE_URL", "https://car.shcxyz.site");
    env.set("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

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
    let env = EnvGuard::new();
    set_required_env(&env);
    env.remove("LOCAL_UPLOAD_DIR");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(config.local_upload_dir.to_string_lossy(), "uploads");
}

#[test]
fn config_trims_public_base_url_trailing_slash() {
    let env = EnvGuard::new();
    set_required_env(&env);
    env.set("PUBLIC_BASE_URL", "https://car.shcxyz.site/");
    env.set("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(
        config.public_base_url.as_deref(),
        Some("https://car.shcxyz.site")
    );
}
