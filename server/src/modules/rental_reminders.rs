use axum::{extract::State, routing::get, Json, Router};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/rental-reminders/check-expiry", get(check_expiry::<S>))
        .route("/api/rental-reminders/statistics", get(statistics::<S>))
}

#[derive(Debug, FromRow)]
struct ActiveRentalRow {
    id: String,
    owner_id: Option<String>,
    renter_id: Option<String>,
    rent_end_date: Option<DateTime<Utc>>,
    reminder_sent_count: Option<i32>,
}

#[derive(Debug, FromRow)]
struct ReminderContextRow {
    license_plate: Option<String>,
    owner_name: Option<String>,
    owner_phone: Option<String>,
    renter_name: Option<String>,
    renter_phone: Option<String>,
}

async fn check_expiry<S>(State(state): State<AppState<S>>) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let active_rentals = sqlx::query_as::<_, ActiveRentalRow>(
        r#"
        SELECT id, owner_id, renter_id, rent_end_date, reminder_sent_count
        FROM vehicle_rentals
        WHERE status = 'active'
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询租赁关系失败: {err}")))?;

    let mut reminders_sent = 0;
    for rental in &active_rentals {
        let Some(rent_end_date) = rental.rent_end_date else {
            continue;
        };
        let days_until_expiry = days_until(rent_end_date);
        let Some(reminder_type) = reminder_type(days_until_expiry) else {
            continue;
        };
        let already_sent: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM rental_reminders
                WHERE rental_id = $1
                  AND reminder_type = $2
                  AND is_sent = true
            )
            "#,
        )
        .bind(&rental.id)
        .bind(reminder_type)
        .fetch_one(&state.db)
        .await?;
        if already_sent {
            continue;
        }

        send_reminder(&state.db, rental, reminder_type, days_until_expiry).await?;
        sqlx::query(
            r#"
            UPDATE vehicle_rentals
            SET last_reminder_time = now(),
                reminder_sent_count = $2,
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(&rental.id)
        .bind(rental.reminder_sent_count.unwrap_or(0) + 1)
        .execute(&state.db)
        .await?;
        reminders_sent += 1;
    }

    Ok(ok(
        "检查完成",
        json!({
            "totalRentals": active_rentals.len(),
            "remindersSent": reminders_sent
        }),
    ))
}

async fn statistics<S>() -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    ok("统计功能开发中", json!({}))
}

async fn send_reminder(
    pool: &PgPool,
    rental: &ActiveRentalRow,
    reminder_type: &str,
    days_until_expiry: i64,
) -> ApiResult<()> {
    let context = sqlx::query_as::<_, ReminderContextRow>(
        r#"
        SELECT
            v.license_plate,
            owner.name AS owner_name,
            owner.phone AS owner_phone,
            renter.name AS renter_name,
            renter.phone AS renter_phone
        FROM vehicle_rentals vr
        LEFT JOIN vehicles v ON v.id = vr.vehicle_id
        LEFT JOIN users owner ON owner.id = vr.owner_id
        LEFT JOIN users renter ON renter.id = vr.renter_id
        WHERE vr.id = $1
        "#,
    )
    .bind(&rental.id)
    .fetch_one(pool)
    .await?;
    let (owner_title, owner_content, renter_title, renter_content) = reminder_content(
        &context,
        rental.rent_end_date,
        reminder_type,
        days_until_expiry,
    );

    create_system_message(
        pool,
        rental.owner_id.as_deref(),
        &owner_title,
        &owner_content,
        Some(&rental.id),
    )
    .await;
    create_system_message(
        pool,
        rental.renter_id.as_deref(),
        &renter_title,
        &renter_content,
        Some(&rental.id),
    )
    .await;
    sqlx::query(
        r#"
        INSERT INTO rental_reminders (
            rental_id, owner_id, renter_id, reminder_type, reminder_channel,
            is_sent, sent_at, sent_status
        )
        VALUES ($1, $2, $3, $4, 'system', true, now(), 'success')
        "#,
    )
    .bind(&rental.id)
    .bind(&rental.owner_id)
    .bind(&rental.renter_id)
    .bind(reminder_type)
    .execute(pool)
    .await?;
    Ok(())
}

async fn create_system_message(
    pool: &PgPool,
    user_id: Option<&str>,
    title: &str,
    content: &str,
    related_id: Option<&str>,
) {
    let Some(user_id) = user_id else {
        return;
    };
    let _ = sqlx::query(
        r#"
        INSERT INTO notifications (
            user_id, type, title, content, related_type, related_id, is_read
        )
        VALUES ($1, 'rental_reminder', $2, $3, 'vehicle_rental', $4, false)
        "#,
    )
    .bind(user_id)
    .bind(title)
    .bind(content)
    .bind(related_id)
    .execute(pool)
    .await;
}

fn days_until(rent_end_date: DateTime<Utc>) -> i64 {
    let millis = rent_end_date
        .signed_duration_since(Utc::now())
        .num_milliseconds();
    (millis as f64 / 86_400_000.0).ceil() as i64
}

fn reminder_type(days_until_expiry: i64) -> Option<&'static str> {
    match days_until_expiry {
        7 => Some("7_days_before"),
        3 => Some("3_days_before"),
        1 => Some("1_day_before"),
        0 => Some("on_expiry_date"),
        days if days < 0 => Some("overdue"),
        _ => None,
    }
}

fn reminder_content(
    context: &ReminderContextRow,
    rent_end_date: Option<DateTime<Utc>>,
    reminder_type: &str,
    days_until_expiry: i64,
) -> (String, String, String, String) {
    let license_plate = context.license_plate.as_deref().unwrap_or("未填写");
    let renter_name = context.renter_name.as_deref().unwrap_or("未填写");
    let renter_phone = context
        .renter_phone
        .as_deref()
        .map(mask_phone)
        .unwrap_or_default();
    let owner_name = context.owner_name.as_deref().unwrap_or("未填写");
    let owner_phone = context
        .owner_phone
        .as_deref()
        .map(mask_phone)
        .unwrap_or_default();
    let date = rent_end_date
        .map(|value| value.date_naive().to_string())
        .unwrap_or_default();

    match reminder_type {
        "7_days_before" => (
            "租赁到期提醒".to_string(),
            format!("您的车辆（车牌号：{license_plate}）租赁将于7天后到期\n租户：{renter_name}（{renter_phone}）\n到期时间：{date}\n请及时与租户沟通续期或归还事宜"),
            "租赁即将到期提醒".to_string(),
            format!("您租赁的车辆（车牌号：{license_plate}）将于7天后到期\n车主：{owner_name}（{owner_phone}）\n到期时间：{date}\n如需续期请提前联系车主，如不续期请按时归还"),
        ),
        "3_days_before" => (
            "租赁即将到期（3天后）".to_string(),
            format!("您的车辆（车牌号：{license_plate}）租赁将于3天后到期\n租户：{renter_name}（{renter_phone}）\n到期时间：{date}\n请与租户确认是否续期，如不续期请提醒按时归还"),
            "租赁即将到期（3天后）".to_string(),
            format!("您租赁的车辆（车牌号：{license_plate}）将于3天后到期\n车主：{owner_name}（{owner_phone}）\n到期时间：{date}\n请尽快决定是否续期，如不续期请提前规划归还"),
        ),
        "1_day_before" => (
            "租赁即将到期（明天）".to_string(),
            format!("您的车辆（车牌号：{license_plate}）租赁将于明天到期！\n租户：{renter_name}（{renter_phone}）\n到期时间：{date}\n请务必与租户确认续期或归还事宜，避免逾期"),
            "租赁即将到期（明天）".to_string(),
            format!("您租赁的车辆（车牌号：{license_plate}）将于明天到期！\n车主：{owner_name}（{owner_phone}）\n到期时间：{date}\n请立即与车主确认续期或归还事宜"),
        ),
        "on_expiry_date" => (
            "租赁今天到期！".to_string(),
            format!("您的车辆（车牌号：{license_plate}）租赁今天到期！\n租户：{renter_name}（{renter_phone}）\n到期时间：{date}\n如不续期，请提醒租户立即归还车辆"),
            "租赁今天到期！".to_string(),
            format!("您租赁的车辆（车牌号：{license_plate}）今天到期！\n车主：{owner_name}（{owner_phone}）\n到期时间：{date}\n如不续期，请立即归还车辆，避免产生违约金"),
        ),
        _ => (
            "租赁已逾期！".to_string(),
            format!("您的车辆（车牌号：{license_plate}）租赁已逾期！\n租户：{renter_name}（{renter_phone}）\n应归还时间：{date}\n当前逾期天数：{}天\n请尽快与租户联系，处理车辆归还事宜", days_until_expiry.abs()),
            "租赁已逾期！请立即处理".to_string(),
            format!("您租赁的车辆（车牌号：{license_plate}）已逾期！\n车主：{owner_name}（{owner_phone}）\n应归还时间：{date}\n当前逾期天数：{}天\n请立即联系车主续期或归还车辆，逾期可能产生违约金", days_until_expiry.abs()),
        ),
    }
}

fn mask_phone(phone: &str) -> String {
    if phone.len() < 7 {
        return phone.to_string();
    }
    format!("{}****{}", &phone[..3], &phone[phone.len() - 4..])
}
