use async_trait::async_trait;
use hmac::{Hmac, Mac};
use reqwest::{header, Method, StatusCode};
use sha1::{Digest, Sha1};

use crate::{
    error::ApiError,
    storage::{build_storage_key, encode_key_path, encode_url_component, sanitized_key, Storage},
};

type HmacSha1 = Hmac<Sha1>;

#[derive(Clone)]
pub struct TencentCosStorage {
    secret_id: String,
    secret_key: String,
    bucket: String,
    region: String,
    client: reqwest::Client,
}

impl TencentCosStorage {
    pub fn new(secret_id: String, secret_key: String, bucket: String, region: String) -> Self {
        Self {
            secret_id,
            secret_key,
            bucket,
            region,
            client: reqwest::Client::new(),
        }
    }

    fn host(&self) -> String {
        format!("{}.cos.{}.myqcloud.com", self.bucket, self.region)
    }

    fn object_url(&self, key: &str) -> Result<String, ApiError> {
        Ok(format!("https://{}/{}", self.host(), encode_key_path(key)?))
    }

    fn authorization(
        &self,
        method: &str,
        key: &str,
        headers: &[(&str, String)],
        expires_in_seconds: i64,
    ) -> Result<String, ApiError> {
        let now = chrono::Utc::now().timestamp();
        let sign_time = format!("{now};{}", now + expires_in_seconds);
        let path = format!("/{}", encode_key_path(key)?);
        let mut headers = headers
            .iter()
            .map(|(key, value)| (key.to_ascii_lowercase(), value.trim().to_string()))
            .collect::<Vec<_>>();
        headers.sort_by(|left, right| left.0.cmp(&right.0));

        let header_list = headers
            .iter()
            .map(|(key, _)| key.as_str())
            .collect::<Vec<_>>()
            .join(";");
        let header_string = headers
            .iter()
            .map(|(key, value)| {
                format!(
                    "{}={}",
                    encode_url_component(key),
                    encode_url_component(value)
                )
            })
            .collect::<Vec<_>>()
            .join("&");
        let http_string = format!(
            "{}\n{}\n\n{}\n",
            method.to_ascii_lowercase(),
            path,
            header_string
        );
        let http_string_sha1 = sha1_hex(http_string.as_bytes());
        let string_to_sign = format!("sha1\n{sign_time}\n{http_string_sha1}\n");
        let sign_key = hmac_sha1_hex(self.secret_key.as_bytes(), sign_time.as_bytes())?;
        let signature = hmac_sha1_hex(sign_key.as_bytes(), string_to_sign.as_bytes())?;

        Ok(format!(
            "q-sign-algorithm=sha1&q-ak={}&q-sign-time={}&q-key-time={}&q-header-list={}&q-url-param-list=&q-signature={}",
            self.secret_id, sign_time, sign_time, header_list, signature
        ))
    }
}

#[async_trait]
impl Storage for TencentCosStorage {
    async fn put(
        &self,
        bytes: Vec<u8>,
        file_name: &str,
        content_type: Option<&str>,
    ) -> Result<String, ApiError> {
        let key = build_storage_key(file_name)?;
        let host = self.host();
        let content_type = content_type.unwrap_or("application/octet-stream");
        let content_length = bytes.len().to_string();
        let authorization = self.authorization(
            "put",
            &key,
            &[
                ("content-length", content_length.clone()),
                ("content-type", content_type.to_string()),
                ("host", host.clone()),
            ],
            7200,
        )?;

        let response = self
            .client
            .put(self.object_url(&key)?)
            .header(header::HOST, host)
            .header(header::CONTENT_LENGTH, content_length)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::AUTHORIZATION, authorization)
            .body(bytes)
            .send()
            .await
            .map_err(storage_error)?;

        if response.status().is_success() {
            Ok(key)
        } else {
            Err(ApiError::Storage(format!(
                "COS upload failed with status {}",
                response.status()
            )))
        }
    }

    async fn public_url(&self, key: &str) -> Result<String, ApiError> {
        self.public_url_with_expiry(key, 86400).await
    }

    async fn public_url_with_expiry(
        &self,
        key: &str,
        expire_time_seconds: i64,
    ) -> Result<String, ApiError> {
        let key = sanitized_key(key)?;
        let host = self.host();
        let authorization =
            self.authorization("get", &key, &[("host", host)], expire_time_seconds)?;

        Ok(format!("{}?{}", self.object_url(&key)?, authorization))
    }

    async fn exists(&self, key: &str) -> Result<bool, ApiError> {
        let key = sanitized_key(key)?;
        let host = self.host();
        let authorization = self.authorization("head", &key, &[("host", host.clone())], 7200)?;
        let response = self
            .client
            .request(Method::HEAD, self.object_url(&key)?)
            .header(header::HOST, host)
            .header(header::AUTHORIZATION, authorization)
            .send()
            .await
            .map_err(storage_error)?;

        match response.status() {
            StatusCode::OK => Ok(true),
            StatusCode::NOT_FOUND => Ok(false),
            status => Err(ApiError::Storage(format!(
                "COS head object failed with status {status}"
            ))),
        }
    }

    async fn delete(&self, key: &str) -> Result<bool, ApiError> {
        let key = sanitized_key(key)?;
        let host = self.host();
        let authorization = self.authorization("delete", &key, &[("host", host.clone())], 7200)?;
        let response = self
            .client
            .delete(self.object_url(&key)?)
            .header(header::HOST, host)
            .header(header::AUTHORIZATION, authorization)
            .send()
            .await
            .map_err(storage_error)?;

        match response.status() {
            StatusCode::NO_CONTENT | StatusCode::OK => Ok(true),
            StatusCode::NOT_FOUND => Ok(false),
            status => Err(ApiError::Storage(format!(
                "COS delete object failed with status {status}"
            ))),
        }
    }
}

fn sha1_hex(bytes: &[u8]) -> String {
    let mut sha1 = Sha1::new();
    sha1.update(bytes);
    hex::encode(sha1.finalize())
}

fn hmac_sha1_hex(key: &[u8], message: &[u8]) -> Result<String, ApiError> {
    let mut mac =
        HmacSha1::new_from_slice(key).map_err(|error| ApiError::Storage(error.to_string()))?;
    mac.update(message);
    Ok(hex::encode(mac.finalize().into_bytes()))
}

fn storage_error(err: reqwest::Error) -> ApiError {
    ApiError::Storage(err.to_string())
}
