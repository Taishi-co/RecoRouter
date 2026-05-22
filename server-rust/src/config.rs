use std::{env, path::PathBuf};

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub database_url: String,
    pub server_port: u16,
    pub public_base_url: Option<String>,
    pub local_upload_dir: PathBuf,
    pub cos_secret_id: Option<String>,
    pub cos_secret_key: Option<String>,
    pub cos_bucket: Option<String>,
    pub cos_region: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigError {
    #[error("missing required environment variable {0}")]
    Missing(&'static str),
    #[error("invalid SERVER_PORT: {0}")]
    InvalidServerPort(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        dotenvy::dotenv().ok();

        let database_url = read_trimmed("DATABASE_URL").ok_or(ConfigError::Missing("DATABASE_URL"))?;
        let server_port = read_trimmed("SERVER_PORT")
            .unwrap_or_else(|| "34532".to_string())
            .parse::<u16>()
            .map_err(|err| ConfigError::InvalidServerPort(err.to_string()))?;
        let local_upload_dir = read_trimmed("LOCAL_UPLOAD_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/tmp/recorouter-uploads"));

        Ok(Self {
            database_url,
            server_port,
            public_base_url: read_trimmed("PUBLIC_BASE_URL"),
            local_upload_dir,
            cos_secret_id: read_trimmed("COS_SECRET_ID"),
            cos_secret_key: read_trimmed("COS_SECRET_KEY"),
            cos_bucket: read_trimmed("COS_BUCKET"),
            cos_region: read_trimmed("COS_REGION"),
        })
    }

    pub fn has_tencent_cos(&self) -> bool {
        self.cos_secret_id.is_some()
            && self.cos_secret_key.is_some()
            && self.cos_bucket.is_some()
            && self.cos_region.is_some()
    }
}

pub fn read_trimmed(key: &'static str) -> Option<String> {
    env::var(key).ok().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}
