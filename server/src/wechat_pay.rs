use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

use aes_gcm::{
    aead::{Aead, Payload},
    Aes256Gcm, KeyInit, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::{distributions::Alphanumeric, rngs::OsRng, Rng};
use rsa::{
    pkcs1::DecodeRsaPrivateKey,
    pkcs1v15::SigningKey,
    pkcs8::DecodePrivateKey,
    signature::{RandomizedSigner, SignatureEncoding},
    RsaPrivateKey,
};
use serde::{de::DeserializeOwned, Deserialize};
use sha2::Sha256;

use crate::{
    config::{read_trimmed, ApiService},
    error::{ApiError, ApiResult},
};

pub const DEFAULT_WECHAT_MCH_ID: &str = "1746295681";
pub const WECHAT_CODE2SESSION_URL: &str = "https://api.weixin.qq.com/sns/jscode2session";
pub const WECHAT_ACCESS_TOKEN_URL: &str = "https://api.weixin.qq.com/cgi-bin/token";
pub const WECHAT_GET_PHONE_NUMBER_URL: &str =
    "https://api.weixin.qq.com/wxa/business/getuserphonenumber";
pub const WECHAT_USER_AGENT: &str = "RecoRouter/1.0";

#[derive(Clone)]
pub struct WechatPayMerchantConfig {
    pub app_id: String,
    pub mch_id: String,
    pub mch_serial_no: String,
    pub private_key: RsaPrivateKey,
    pub miniapp_secret: Option<String>,
}

#[derive(Clone)]
pub struct WechatMiniappConfig {
    pub app_id: String,
    pub miniapp_secret: String,
}

#[derive(Debug, Clone)]
pub struct MiniappLoginSession {
    pub openid: String,
    pub unionid: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MiniappPhoneNumber {
    pub phone_number: String,
}

#[derive(Debug, Deserialize)]
pub struct WechatNotifyBody {
    pub resource: WechatNotifyResource,
}

#[derive(Debug, Deserialize)]
pub struct WechatNotifyResource {
    pub algorithm: String,
    pub ciphertext: String,
    pub associated_data: Option<String>,
    pub nonce: String,
}

impl WechatPayMerchantConfig {
    pub fn from_env() -> ApiResult<Self> {
        Self::from_env_for_service(ApiService::Legacy)
    }

    pub fn from_env_for_service(service: ApiService) -> ApiResult<Self> {
        let app_id = read_service_trimmed(service, "WECHAT_PAY_APPID")
            .or_else(|| read_service_trimmed(service, "WECHAT_MINIAPP_APPID"))
            .or_else(|| read_trimmed("WECHAT_PAY_APPID"))
            .or_else(|| read_trimmed("WECHAT_MINIAPP_APPID"))
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_APPID 配置".to_string()))?;
        let mch_id =
            read_trimmed("WECHAT_PAY_MCH_ID").unwrap_or_else(|| DEFAULT_WECHAT_MCH_ID.to_string());
        let mch_serial_no = read_trimmed("WECHAT_PAY_MCH_SERIAL_NO").ok_or_else(|| {
            ApiError::BadRequest("缺少 WECHAT_PAY_MCH_SERIAL_NO 配置".to_string())
        })?;
        let private_key = load_wechat_private_key()?;

        Ok(Self {
            app_id,
            mch_id,
            mch_serial_no,
            private_key,
            miniapp_secret: read_service_trimmed(service, "WECHAT_MINIAPP_SECRET")
                .or_else(|| read_trimmed("WECHAT_MINIAPP_SECRET")),
        })
    }
}

impl WechatMiniappConfig {
    pub fn from_env() -> ApiResult<Self> {
        Self::from_env_for_service(ApiService::Legacy)
    }

    pub fn from_env_for_service(service: ApiService) -> ApiResult<Self> {
        let app_id = read_service_trimmed(service, "WECHAT_MINIAPP_APPID")
            .or_else(|| read_service_trimmed(service, "WECHAT_PAY_APPID"))
            .or_else(|| read_trimmed("WECHAT_MINIAPP_APPID"))
            .or_else(|| read_trimmed("WECHAT_PAY_APPID"))
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_MINIAPP_APPID 配置".to_string()))?;
        let miniapp_secret = read_service_trimmed(service, "WECHAT_MINIAPP_SECRET")
            .or_else(|| read_trimmed("WECHAT_MINIAPP_SECRET"))
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_MINIAPP_SECRET 配置".to_string()))?;

        Ok(Self {
            app_id,
            miniapp_secret,
        })
    }

    pub fn from_merchant(config: &WechatPayMerchantConfig) -> ApiResult<Self> {
        let miniapp_secret = config
            .miniapp_secret
            .clone()
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_MINIAPP_SECRET 配置".to_string()))?;

        Ok(Self {
            app_id: config.app_id.clone(),
            miniapp_secret,
        })
    }
}

fn read_service_trimmed(service: ApiService, key: &'static str) -> Option<String> {
    let prefix = match service {
        ApiService::Legacy => return None,
        ApiService::Vehicle => "VEHICLE",
        ApiService::Mall => "MALL",
        ApiService::Platform => "PLATFORM",
    };
    read_trimmed(&format!("{prefix}_{key}"))
}

pub async fn exchange_miniapp_login_code(
    config: &WechatPayMerchantConfig,
    login_code: &str,
) -> ApiResult<String> {
    Ok(
        exchange_miniapp_login_session(&WechatMiniappConfig::from_merchant(config)?, login_code)
            .await?
            .openid,
    )
}

pub async fn exchange_miniapp_login_session(
    config: &WechatMiniappConfig,
    login_code: &str,
) -> ApiResult<MiniappLoginSession> {
    let login_code = login_code.trim();
    if login_code.is_empty() {
        return Err(ApiError::BadRequest("缺少微信登录凭证".to_string()));
    }
    let url = format!(
        "{WECHAT_CODE2SESSION_URL}?appid={}&secret={}&js_code={}&grant_type=authorization_code",
        config.app_id, config.miniapp_secret, login_code
    );
    let text = reqwest::get(url)
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信登录凭证换取失败: {err}")))?
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信登录响应读取失败: {err}")))?;
    let response: Code2SessionResponse = serde_json::from_str(&text)
        .map_err(|err| ApiError::BadRequest(format!("微信登录响应解析失败: {err}")))?;
    let openid = response.openid.ok_or_else(|| {
        ApiError::BadRequest(format!(
            "微信登录凭证无效: {}",
            response
                .errmsg
                .unwrap_or_else(|| response.errcode.unwrap_or_default().to_string())
        ))
    })?;

    Ok(MiniappLoginSession {
        openid,
        unionid: response.unionid,
    })
}

pub async fn exchange_miniapp_phone_number(
    config: &WechatMiniappConfig,
    phone_code: &str,
) -> ApiResult<MiniappPhoneNumber> {
    let phone_code = phone_code.trim();
    if phone_code.is_empty() {
        return Err(ApiError::BadRequest("缺少微信手机号授权凭证".to_string()));
    }

    let access_token = miniapp_access_token(config).await?;
    let url = format!("{WECHAT_GET_PHONE_NUMBER_URL}?access_token={access_token}");
    let request_body = serde_json::json!({ "code": phone_code }).to_string();
    let text = reqwest::Client::new()
        .post(url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("User-Agent", WECHAT_USER_AGENT)
        .body(request_body)
        .send()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信手机号换取失败: {err}")))?
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信手机号响应读取失败: {err}")))?;
    let response: PhoneNumberResponse = serde_json::from_str(&text)
        .map_err(|err| ApiError::BadRequest(format!("微信手机号响应解析失败: {err}")))?;
    if response.errcode.unwrap_or_default() != 0 {
        return Err(ApiError::BadRequest(format!(
            "微信手机号授权失败: {}",
            response
                .errmsg
                .unwrap_or_else(|| response.errcode.unwrap_or_default().to_string())
        )));
    }

    let phone_info = response
        .phone_info
        .ok_or_else(|| ApiError::BadRequest("微信手机号响应缺少手机号".to_string()))?;
    let phone_number = phone_info
        .pure_phone_number
        .or(phone_info.phone_number)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("微信手机号响应缺少手机号".to_string()))?;

    Ok(MiniappPhoneNumber { phone_number })
}

pub async fn miniapp_access_token(config: &WechatMiniappConfig) -> ApiResult<String> {
    let url = format!(
        "{WECHAT_ACCESS_TOKEN_URL}?grant_type=client_credential&appid={}&secret={}",
        config.app_id, config.miniapp_secret
    );
    let text = reqwest::get(url)
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信 access_token 获取失败: {err}")))?
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信 access_token 响应读取失败: {err}")))?;
    let response: AccessTokenResponse = serde_json::from_str(&text)
        .map_err(|err| ApiError::BadRequest(format!("微信 access_token 响应解析失败: {err}")))?;
    response
        .access_token
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            ApiError::BadRequest(format!(
                "微信 access_token 获取失败: {}",
                response
                    .errmsg
                    .unwrap_or_else(|| response.errcode.unwrap_or_default().to_string())
            ))
        })
}

pub fn wechat_authorization(
    config: &WechatPayMerchantConfig,
    method: &str,
    path_and_query: &str,
    body: &str,
) -> ApiResult<String> {
    let timestamp = unix_timestamp().to_string();
    let nonce_str = random_token(24);
    let message = format!("{method}\n{path_and_query}\n{timestamp}\n{nonce_str}\n{body}\n");
    let signature = sign_message(&config.private_key, &message)?;

    Ok(format!(
        "WECHATPAY2-SHA256-RSA2048 mchid=\"{}\",nonce_str=\"{}\",signature=\"{}\",timestamp=\"{}\",serial_no=\"{}\"",
        config.mch_id, nonce_str, signature, timestamp, config.mch_serial_no
    ))
}

pub fn with_wechat_headers(
    builder: reqwest::RequestBuilder,
    authorization: &str,
) -> reqwest::RequestBuilder {
    builder
        .header("Authorization", authorization)
        .header("Accept", "application/json")
        .header("User-Agent", WECHAT_USER_AGENT)
}

pub fn with_wechat_json_headers(
    builder: reqwest::RequestBuilder,
    authorization: &str,
) -> reqwest::RequestBuilder {
    with_wechat_headers(builder, authorization).header("Content-Type", "application/json")
}

pub fn sign_message(private_key: &RsaPrivateKey, message: &str) -> ApiResult<String> {
    let signing_key = SigningKey::<Sha256>::new(private_key.clone());
    let signature = signing_key.sign_with_rng(&mut OsRng, message.as_bytes());
    Ok(BASE64.encode(signature.to_bytes()))
}

pub fn load_wechat_private_key() -> ApiResult<RsaPrivateKey> {
    let pem = if let Some(value) = read_trimmed("WECHAT_PAY_PRIVATE_KEY") {
        value.replace("\\n", "\n")
    } else if let Some(path) = read_trimmed("WECHAT_PAY_PRIVATE_KEY_PATH") {
        fs::read_to_string(path)
            .map_err(|err| ApiError::BadRequest(format!("读取微信支付私钥失败: {err}")))?
    } else {
        return Err(ApiError::BadRequest(
            "缺少 WECHAT_PAY_PRIVATE_KEY 或 WECHAT_PAY_PRIVATE_KEY_PATH 配置".to_string(),
        ));
    };

    RsaPrivateKey::from_pkcs8_pem(&pem)
        .or_else(|_| RsaPrivateKey::from_pkcs1_pem(&pem))
        .map_err(|err| ApiError::BadRequest(format!("微信支付私钥格式不正确: {err}")))
}

pub fn decrypt_wechat_notification<T>(resource: &WechatNotifyResource) -> ApiResult<T>
where
    T: DeserializeOwned,
{
    if resource.algorithm != "AEAD_AES_256_GCM" {
        return Err(ApiError::BadRequest(
            "微信支付通知加密算法不支持".to_string(),
        ));
    }

    let api_v3_key = read_trimmed("WECHAT_PAY_API_V3_KEY")
        .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_API_V3_KEY 配置".to_string()))?;
    if api_v3_key.as_bytes().len() != 32 {
        return Err(ApiError::BadRequest(
            "WECHAT_PAY_API_V3_KEY 必须为32字节".to_string(),
        ));
    }
    if resource.nonce.as_bytes().len() != 12 {
        return Err(ApiError::BadRequest("微信支付通知 nonce 无效".to_string()));
    }

    let ciphertext = BASE64
        .decode(resource.ciphertext.as_bytes())
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知密文解析失败: {err}")))?;
    let cipher = Aes256Gcm::new_from_slice(api_v3_key.as_bytes())
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知密钥无效: {err}")))?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(resource.nonce.as_bytes()),
            Payload {
                msg: &ciphertext,
                aad: resource
                    .associated_data
                    .as_deref()
                    .unwrap_or_default()
                    .as_bytes(),
            },
        )
        .map_err(|_| ApiError::BadRequest("微信支付通知解密失败".to_string()))?;

    serde_json::from_slice(&plaintext)
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知内容解析失败: {err}")))
}

pub fn random_token(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

pub fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn unix_timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

pub fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

#[derive(Debug, Deserialize)]
struct Code2SessionResponse {
    openid: Option<String>,
    unionid: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PhoneNumberResponse {
    errcode: Option<i64>,
    errmsg: Option<String>,
    phone_info: Option<PhoneInfoResponse>,
}

#[derive(Debug, Deserialize)]
struct PhoneInfoResponse {
    #[serde(rename = "phoneNumber", alias = "phone_number")]
    phone_number: Option<String>,
    #[serde(rename = "purePhoneNumber", alias = "pure_phone_number")]
    pure_phone_number: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::{decrypt_wechat_notification, with_wechat_json_headers, WechatNotifyResource};

    #[test]
    fn api_v3_json_requests_include_required_headers() {
        let request = with_wechat_json_headers(
            reqwest::Client::new().post("https://api.mch.weixin.qq.com/test"),
            "WECHATPAY2-SHA256-RSA2048 test",
        )
        .build()
        .unwrap();
        let headers = request.headers();

        assert_eq!(
            headers.get("authorization").unwrap().to_str().unwrap(),
            "WECHATPAY2-SHA256-RSA2048 test",
        );
        assert_eq!(
            headers.get("accept").unwrap().to_str().unwrap(),
            "application/json",
        );
        assert_eq!(
            headers.get("content-type").unwrap().to_str().unwrap(),
            "application/json",
        );
        assert!(headers
            .get("user-agent")
            .unwrap()
            .to_str()
            .unwrap()
            .contains("RecoRouter"));
    }

    #[test]
    fn encrypted_notifications_reject_unknown_algorithms() {
        let resource = WechatNotifyResource {
            algorithm: "PLAINTEXT".to_string(),
            ciphertext: "ignored".to_string(),
            associated_data: None,
            nonce: "ignored".to_string(),
        };

        let result = decrypt_wechat_notification::<serde_json::Value>(&resource);
        assert!(result.is_err());
    }
}
