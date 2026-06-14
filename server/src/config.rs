use std::{env, path::PathBuf};

use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiService {
    Legacy,
    Vehicle,
    Mall,
    Platform,
}

impl ApiService {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Legacy => "recorouter-api",
            Self::Vehicle => "vehicle-api",
            Self::Mall => "mall-api",
            Self::Platform => "platform-api",
        }
    }

    fn database_url_key(self) -> &'static str {
        match self {
            Self::Legacy => "DATABASE_URL",
            Self::Vehicle => "VEHICLE_DATABASE_URL",
            Self::Mall => "MALL_DATABASE_URL",
            Self::Platform => "PLATFORM_DATABASE_URL",
        }
    }

    fn port_key(self) -> &'static str {
        match self {
            Self::Legacy => "SERVER_PORT",
            Self::Vehicle => "VEHICLE_API_PORT",
            Self::Mall => "MALL_API_PORT",
            Self::Platform => "PLATFORM_API_PORT",
        }
    }

    fn default_port(self) -> &'static str {
        match self {
            Self::Legacy | Self::Vehicle => "34532",
            Self::Mall => "34533",
            Self::Platform => "34534",
        }
    }

    pub fn default_run_migrations(self) -> bool {
        matches!(self, Self::Legacy)
    }

    fn run_migrations_key(self) -> &'static str {
        match self {
            Self::Legacy => "RUN_MIGRATIONS",
            Self::Vehicle => "VEHICLE_RUN_MIGRATIONS",
            Self::Mall => "MALL_RUN_MIGRATIONS",
            Self::Platform => "PLATFORM_RUN_MIGRATIONS",
        }
    }

    pub fn from_name(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "legacy" | "recorouter" | "recorouter-api" => Some(Self::Legacy),
            "vehicle" | "vehicle-api" => Some(Self::Vehicle),
            "mall" | "mall-api" => Some(Self::Mall),
            "platform" | "platform-api" => Some(Self::Platform),
            _ => None,
        }
    }
}

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
    #[error("invalid boolean environment variable {key}: {value}")]
    InvalidBoolean { key: &'static str, value: String },
    #[error("invalid api service: {0}")]
    InvalidApiService(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_env_for_service(ApiService::Legacy)
    }

    pub fn from_env_for_service(service: ApiService) -> Result<Self, ConfigError> {
        dotenvy::dotenv().ok();

        let database_url = read_trimmed(service.database_url_key())
            .or_else(|| {
                if service == ApiService::Legacy {
                    None
                } else {
                    read_trimmed("DATABASE_URL")
                }
            })
            .ok_or(ConfigError::Missing(service.database_url_key()))?;
        let server_port = read_trimmed(service.port_key())
            .or_else(|| {
                if service == ApiService::Legacy {
                    None
                } else {
                    read_trimmed("SERVER_PORT")
                }
            })
            .unwrap_or_else(|| service.default_port().to_string())
            .parse::<u16>()
            .map_err(|err| ConfigError::InvalidServerPort(err.to_string()))?;
        let local_upload_dir = read_trimmed("LOCAL_UPLOAD_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("uploads"));

        Ok(Self {
            database_url,
            server_port,
            public_base_url: read_trimmed("PUBLIC_BASE_URL")
                .map(|value| value.trim_end_matches('/').to_string())
                .filter(|value| !value.is_empty()),
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

pub fn should_run_migrations(service: ApiService) -> Result<bool, ConfigError> {
    if let Some(value) = read_trimmed(service.run_migrations_key()) {
        return parse_bool_flag(&value).ok_or(ConfigError::InvalidBoolean {
            key: service.run_migrations_key(),
            value,
        });
    }

    if service != ApiService::Legacy {
        if let Some(value) = read_trimmed("RUN_MIGRATIONS") {
            return parse_bool_flag(&value).ok_or(ConfigError::InvalidBoolean {
                key: "RUN_MIGRATIONS",
                value,
            });
        }
    }

    Ok(service.default_run_migrations())
}

pub fn service_from_env_key(
    key: &'static str,
    default: ApiService,
) -> Result<ApiService, ConfigError> {
    match read_trimmed(key) {
        Some(value) => ApiService::from_name(&value).ok_or(ConfigError::InvalidApiService(value)),
        None => Ok(default),
    }
}

pub fn read_trimmed(key: impl AsRef<str>) -> Option<String> {
    env::var(key.as_ref()).ok().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn parse_bool_flag(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "y" | "on" => Some(true),
        "0" | "false" | "no" | "n" | "off" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_bool_flag, ApiService};

    #[test]
    fn legacy_runs_migrations_by_default_but_split_services_do_not() {
        assert!(ApiService::Legacy.default_run_migrations());
        assert!(!ApiService::Vehicle.default_run_migrations());
        assert!(!ApiService::Mall.default_run_migrations());
        assert!(!ApiService::Platform.default_run_migrations());
    }

    #[test]
    fn bool_flag_parser_accepts_common_env_values() {
        assert_eq!(parse_bool_flag("1"), Some(true));
        assert_eq!(parse_bool_flag("true"), Some(true));
        assert_eq!(parse_bool_flag("yes"), Some(true));
        assert_eq!(parse_bool_flag("on"), Some(true));
        assert_eq!(parse_bool_flag("0"), Some(false));
        assert_eq!(parse_bool_flag("false"), Some(false));
        assert_eq!(parse_bool_flag("no"), Some(false));
        assert_eq!(parse_bool_flag("off"), Some(false));
        assert_eq!(parse_bool_flag("maybe"), None);
    }
}
