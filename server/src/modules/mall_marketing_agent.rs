use serde_json::{json, Value};

pub const DEFAULT_BUDGET_CENTS: i64 = 300_000;
pub const DEFAULT_HORIZON_DAYS: i32 = 14;

#[derive(Debug, Clone)]
pub struct MarketingPlanInput {
    pub objective: String,
    pub mode: String,
    pub budget_cents: i64,
    pub horizon_days: i32,
    pub target_metric: String,
}

pub fn normalize_mode(value: Option<&str>) -> Option<&'static str> {
    match value.unwrap_or("full_funnel").trim() {
        "full_funnel" | "strategy" => Some("full_funnel"),
        "assortment" => Some("assortment"),
        "acquisition" => Some("acquisition"),
        "coupon" => Some("coupon"),
        "campaign" => Some("campaign"),
        "venue" => Some("venue"),
        "retention" => Some("retention"),
        "analysis" => Some("analysis"),
        _ => None,
    }
}

pub fn skill_catalog() -> Value {
    json!([
        {
            "key": "mall.data_profile",
            "name": "经营数据体检",
            "phase": "observe",
            "description": "读取商城聚合订单、商品、库存、售后、券、活动和社区数据，形成可追溯证据。",
            "reads": ["mall_orders", "mall_order_items", "mall_products", "mall_after_sales", "mall_campaigns"],
            "writes": [],
            "autonomy": "automatic",
            "riskLevel": "low"
        },
        {
            "key": "mall.assortment_score",
            "name": "选品评分",
            "phase": "diagnose",
            "description": "按近30天销量、GMV、折后毛利和库存覆盖计算透明分数，生成候选商品池。",
            "reads": ["aggregated_product_metrics"],
            "writes": [],
            "autonomy": "automatic",
            "riskLevel": "low"
        },
        {
            "key": "mall.audience_segment",
            "name": "人群分层",
            "phase": "diagnose",
            "description": "只在商城域内按首购、复购、沉睡、优惠敏感和售后风险生成聚合人群。",
            "reads": ["aggregated_customer_metrics"],
            "writes": [],
            "autonomy": "automatic",
            "riskLevel": "medium"
        },
        {
            "key": "mall.coupon_design",
            "name": "发券设计",
            "phase": "plan",
            "description": "根据客单价、预算上限和目标人群计算券门槛、面额、数量与频控。",
            "reads": ["summary", "segments", "budget"],
            "writes": ["mall_coupons:draft"],
            "autonomy": "approval_required",
            "riskLevel": "high"
        },
        {
            "key": "mall.campaign_design",
            "name": "活动生成",
            "phase": "plan",
            "description": "复用营销中心活动模型，生成商品范围、阶梯满减、展示标签和活动规则草稿。",
            "reads": ["assortment", "segments", "budget"],
            "writes": ["mall_campaigns:draft"],
            "autonomy": "approval_required",
            "riskLevel": "high"
        },
        {
            "key": "mall.venue_builder",
            "name": "会场搭建",
            "phase": "plan",
            "description": "将候选商品池编排为大促会场入口、文案、商品排序和展示配置草稿。",
            "reads": ["assortment", "campaign_display"],
            "writes": ["mall_campaigns:promotion_venue:draft"],
            "autonomy": "approval_required",
            "riskLevel": "high"
        },
        {
            "key": "mall.experiment_design",
            "name": "增量实验",
            "phase": "simulate",
            "description": "设计对照组、目标指标、护栏指标、归因窗口和停止条件。",
            "reads": ["baseline_metrics", "plan"],
            "writes": [],
            "autonomy": "automatic",
            "riskLevel": "medium"
        },
        {
            "key": "mall.launch_guard",
            "name": "上线守门",
            "phase": "approve",
            "description": "校验预算、毛利、库存、频控、隐私和审批状态；禁止 Agent 直接启用或触达。",
            "reads": ["plan", "approval", "guardrails"],
            "writes": [],
            "autonomy": "human_only",
            "riskLevel": "critical"
        }
    ])
}

pub fn build_plan(context: &Value, input: &MarketingPlanInput) -> Value {
    let paid_orders = json_path_i64(context, &["summary", "paidOrders"]);
    let gmv_cents = json_path_i64(context, &["summary", "gmvCents"]);
    let avg_order_cents = json_path_i64(context, &["summary", "avgOrderCents"]);
    let low_stock_products = json_path_i64(context, &["summary", "lowStockProducts"]);
    let repeat_rate_bps = json_path_i64(context, &["summary", "repeatUserRateBps"]);
    let active_communities = json_path_i64(context, &["communities", "activePickupPoints"]);
    let active_leaders = json_path_i64(context, &["communities", "activeLeaders"]);
    let threshold_cents = if avg_order_cents > 0 {
        (((avg_order_cents * 12 / 10) + 99) / 100 * 100).clamp(2_900, 19_900)
    } else {
        4_900
    };
    let discount_cents = (((threshold_cents / 10) + 99) / 100 * 100).clamp(300, 1_500);
    let discount_rate_bps = discount_cents * 10_000 / threshold_cents.max(1);
    let coupon_budget_cents = input.budget_cents * 35 / 100;
    let campaign_budget_cents = input.budget_cents * 40 / 100;
    let acquisition_budget_cents = input.budget_cents * 15 / 100;
    let reserve_budget_cents =
        input.budget_cents - coupon_budget_cents - campaign_budget_cents - acquisition_budget_cents;
    let coupon_quantity = if coupon_budget_cents >= discount_cents {
        (coupon_budget_cents / discount_cents).min(5_000)
    } else {
        0
    };

    let top_products = context
        .get("topProducts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let max_quantity = top_products
        .iter()
        .filter_map(|product| product.get("quantity").and_then(Value::as_i64))
        .max()
        .unwrap_or(1)
        .max(1);
    let max_sales_cents = top_products
        .iter()
        .filter_map(|product| product.get("salesCents").and_then(Value::as_i64))
        .max()
        .unwrap_or(1)
        .max(1);
    let mut eligible_products: Vec<Value> = top_products
        .iter()
        .filter_map(|product| {
            let stock = product.get("stock").and_then(Value::as_i64).unwrap_or(0);
            let alert = product
                .get("stockAlertThreshold")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            let margin = product
                .get("grossMarginBps")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            let is_on_sale =
                product.get("productStatus").and_then(Value::as_str) == Some("on_sale");
            let post_discount_margin_bps = margin - discount_rate_bps;
            if !is_on_sale || stock <= alert || margin <= 0 || post_discount_margin_bps < 1_500 {
                return None;
            }

            let quantity = product.get("quantity").and_then(Value::as_i64).unwrap_or(0);
            let sales_cents = product
                .get("salesCents")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            let stock_cover_days = product
                .get("stockCoverDays")
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let score_bps = normalized_score(quantity, max_quantity, 3_000)
                + normalized_score(sales_cents, max_sales_cents, 2_000)
                + normalized_score(post_discount_margin_bps.min(5_000), 5_000, 3_000)
                + ((stock_cover_days.clamp(0.0, 30.0) / 30.0) * 2_000.0).round() as i64;
            let mut scored = product.clone();
            let object = scored.as_object_mut()?;
            object.insert("assortmentScoreBps".to_string(), json!(score_bps));
            object.insert(
                "estimatedPostDiscountMarginBps".to_string(),
                json!(post_discount_margin_bps),
            );
            Some(scored)
        })
        .collect();
    eligible_products.sort_by_key(|product| {
        std::cmp::Reverse(
            product
                .get("assortmentScoreBps")
                .and_then(Value::as_i64)
                .unwrap_or(0),
        )
    });
    let selected_products = eligible_products.into_iter().take(6).collect::<Vec<_>>();
    let selected_product_ids = selected_products
        .iter()
        .filter_map(|product| product.get("productId").and_then(Value::as_str))
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let selected_product_items = selected_products
        .iter()
        .enumerate()
        .filter_map(|(index, product)| {
            let product_id = product.get("productId")?.as_str()?;
            Some(json!({
                "productId": product_id,
                "sku": product.get("sku").and_then(Value::as_str).unwrap_or(""),
                "productName": product.get("productName").and_then(Value::as_str).unwrap_or(""),
                "sortOrder": index + 1
            }))
        })
        .collect::<Vec<_>>();
    let product_names = selected_products
        .iter()
        .filter_map(|product| product.get("productName").and_then(Value::as_str))
        .take(3)
        .collect::<Vec<_>>()
        .join("、");

    let top_category = context
        .get("topCategories")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("categoryName"))
        .and_then(Value::as_str)
        .unwrap_or("生鲜商品");
    let audience = match input.mode.as_str() {
        "acquisition" => "community_prospects",
        "retention" => "sleeping_customers",
        "campaign" => "repeat_customers",
        "coupon" if repeat_rate_bps >= 2_500 => "coupon_sensitive",
        _ => "recent_first_buyers",
    };
    let audience_name = segment_name(audience);
    let audience_count = segment_count(context, audience);
    let experiment_audience = if input.mode == "acquisition" {
        "community_prospects"
    } else {
        audience
    };

    let run_id = format!("marketing-run-{}", uuid::Uuid::new_v4().simple());
    let coupon_code = format!(
        "AGENT-{}",
        run_id
            .trim_start_matches("marketing-run-")
            .chars()
            .take(12)
            .collect::<String>()
            .to_ascii_uppercase()
    );
    let selection_summary = if product_names.is_empty() {
        "当前没有足够的成交商品数据，先补充商品池与基线数据".to_string()
    } else {
        format!("优先测试{product_names}等商品，排除低库存和已知低毛利候选")
    };
    let community_summary = if active_communities > 0 {
        format!("覆盖{active_communities}个活跃自提点、{active_leaders}名活跃团长")
    } else {
        "当前没有可用的活跃自提点基线，获客动作先保持为待接入草稿".to_string()
    };
    let has_safe_products = !selected_products.is_empty();
    let has_budget = input.budget_cents > 0;
    let has_audience = audience_count > 0;
    let coupon_executable = has_budget && has_audience && coupon_quantity > 0;
    let campaign_executable = coupon_executable && has_safe_products;
    let venue_executable = has_safe_products;
    let margin_guard = if has_safe_products {
        "按建议优惠折算后，候选商品预估毛利率不低于15%；发布前仍需读取实时成本复核"
    } else {
        "没有商品同时通过成本完整、库存高于预警线和折后毛利率不低于15%的护栏，禁止创建活动或会场草稿"
    };
    let coupon_blocked_reason = if !has_budget {
        "预算为0，不能生成可物化券草稿"
    } else if !has_audience {
        "目标人群规模为0，不能生成可物化券草稿"
    } else if coupon_quantity == 0 {
        "券预算不足以覆盖至少一张券的最坏核销成本"
    } else {
        ""
    };
    let campaign_blocked_reason = if !coupon_executable {
        coupon_blocked_reason
    } else if !has_safe_products {
        margin_guard
    } else {
        ""
    };
    let venue_blocked_reason = if venue_executable { "" } else { margin_guard };

    let all_actions = json!([
        {
            "id": "assortment-hero-pool",
            "kind": "assortment",
            "title": "生成主推选品池",
            "audience": "all_customers",
            "reason": selection_summary,
            "evidence": [
                format!("近30天成交商品样本 {} 个", top_products.len()),
                format!("当前低库存在售商品 {low_stock_products} 个"),
                "透明评分：销量30%、GMV 20%、折后毛利30%、库存覆盖20%"
            ],
            "expectedImpact": {
                "metric": "会场商品点击率",
                "target": "+5%~10%",
                "classification": "pilot_target"
            },
            "risk": if selected_product_ids.is_empty() { "数据不足" } else { "需复核实时库存与成本" },
            "requiresApproval": false,
            "executable": has_safe_products,
            "blockedReason": if has_safe_products { "" } else { margin_guard },
            "draft": {
                "productIds": selected_product_ids,
                "products": selected_products,
                "scoringVersion": "assortment-v1",
                "generatedBy": "marketing-agent"
            }
        },
        {
            "id": "acquisition-community-leader",
            "kind": "acquisition",
            "title": "团长裂变获客包",
            "audience": "community_prospects",
            "reason": community_summary,
            "evidence": [
                format!("活跃自提点 {active_communities} 个"),
                format!("活跃团长 {active_leaders} 名"),
                "只生成渠道素材和追踪方案，不自动外呼或群发"
            ],
            "expectedImpact": {
                "metric": "新客首购转化率",
                "target": "+8%~15%",
                "classification": "pilot_target"
            },
            "risk": "需确认触达授权、渠道码和团长激励规则",
            "requiresApproval": true,
            "executable": false,
            "blockedReason": "获客渠道尚未接入受控执行器，本期只生成方案",
            "draft": {
                "channel": "community_leader",
                "budgetCents": acquisition_budget_cents,
                "contentBrief": format!("围绕{top_category}与社区当日达，生成团长群素材、首购利益点和渠道码"),
                "tracking": ["leaderId", "pickupPointId", "campaignId", "firstPaidOrder"],
                "generatedBy": "marketing-agent"
            }
        },
        {
            "id": "coupon-targeted",
            "kind": "coupon",
            "title": format!("{audience_name}定向满减券"),
            "audience": audience,
            "reason": format!("按客单价设置门槛，并用预算硬上限控制最坏核销成本；当前可识别人群约{audience_count}人。"),
            "evidence": [
                format!("近30天客单价约¥{:.2}", avg_order_cents as f64 / 100.0),
                format!("券面折扣率约{:.1}%", discount_rate_bps as f64 / 100.0),
                format!("券预算上限¥{:.2}", coupon_budget_cents as f64 / 100.0)
            ],
            "expectedImpact": {
                "metric": if audience == "sleeping_customers" { "沉睡召回率" } else { "目标人群下单转化率" },
                "target": "+8%~15%",
                "classification": "pilot_target"
            },
            "risk": if coupon_executable { "当前商城尚未执行 rules.audience，人群券只能建草稿；接入人群执行引擎前禁止启用" } else { coupon_blocked_reason },
            "requiresApproval": true,
            "executable": coupon_executable,
            "blockedReason": coupon_blocked_reason,
            "draft": {
                "name": format!("{audience_name}满{}减{}", threshold_cents / 100, discount_cents / 100),
                "code": coupon_code,
                "couponType": "full_reduction",
                "thresholdCents": threshold_cents,
                "discountCents": discount_cents,
                "totalQuantity": coupon_quantity,
                "perUserLimit": 1,
                "status": "draft",
                "description": format!("{audience_name}定向试点券，满足门槛后抵扣；启用前需审批。"),
                "rules": {
                    "audience": audience,
                    "budgetCapCents": coupon_budget_cents,
                    "horizonDays": input.horizon_days,
                    "runId": run_id,
                    "idempotencyKey": format!("{run_id}:coupon-targeted"),
                    "activationGate": "audience_engine_required",
                    "generatedBy": "marketing-agent"
                }
            }
        },
        {
            "id": "campaign-category-growth",
            "kind": "campaign",
            "title": format!("{top_category}增长活动"),
            "audience": audience,
            "reason": "围绕高贡献品类组织阶梯满减，复用现有营销中心的规则与前台展示能力。",
            "evidence": [
                format!("近30天GMV ¥{:.2}", gmv_cents as f64 / 100.0),
                format!("高贡献品类：{top_category}"),
                format!("活动预算上限¥{:.2}", campaign_budget_cents as f64 / 100.0)
            ],
            "expectedImpact": {
                "metric": "目标品类支付GMV",
                "target": "+6%~12%",
                "classification": "pilot_target"
            },
            "risk": margin_guard,
            "requiresApproval": true,
            "executable": campaign_executable,
            "blockedReason": campaign_blocked_reason,
            "draft": {
                "name": format!("{top_category}定向满减试点"),
                "campaignType": "full_reduction",
                "budgetCents": campaign_budget_cents,
                "status": "draft",
                "rules": {
                    "scope": "products",
                    "productIds": selected_product_ids,
                    "categoryName": top_category,
                    "audience": audience,
                    "tiers": [{ "thresholdCents": threshold_cents, "discountCents": discount_cents }],
                    "display": {
                        "title": format!("{top_category}限时满减"),
                        "tagText": format!("满{}减{}", threshold_cents / 100, discount_cents / 100),
                        "iconText": "减",
                        "backgroundColor": "#FFF1E5",
                        "textColor": "#E85D04",
                        "ruleExplanation": "活动人群购买指定商品，满足门槛后自动优惠。",
                        "limitText": "限指定人群和活动商品；优惠以下单页为准。"
                    },
                    "experiment": { "holdoutBps": 1000, "attributionDays": input.horizon_days },
                    "runId": run_id,
                    "idempotencyKey": format!("{run_id}:campaign-category-growth"),
                    "activationGate": "scoped_pricing_engine_required",
                    "generatedBy": "marketing-agent"
                }
            }
        },
        {
            "id": "venue-community-group-buy",
            "kind": "venue",
            "title": "社区团购主题会场",
            "audience": "all_customers",
            "reason": "把选品、利益点与活动规则装配为可预览会场，复用营销中心 promotion_venue 配置。",
            "evidence": [
                format!("候选商品 {} 个", selected_products.len()),
                format!("主推品类：{top_category}"),
                "会场只创建草稿，不自动发布"
            ],
            "expectedImpact": {
                "metric": "会场访问到支付转化率",
                "target": "+5%~10%",
                "classification": "pilot_target"
            },
            "risk": if selected_product_ids.is_empty() { "商品池为空，需运营补选" } else { "需检查图片素材、价格一致性和库存" },
            "requiresApproval": true,
            "executable": venue_executable,
            "blockedReason": venue_blocked_reason,
            "draft": {
                "name": format!("{top_category}社区团购试点会场"),
                "campaignType": "promotion_venue",
                "budgetCents": 0,
                "status": "draft",
                "rules": {
                    "title": format!("邻里一起拼 · {top_category}专场"),
                    "subtitle": "今日精选，社区到点自提",
                    "copy": "热销好货集中开团，库存与到货时间以下单页为准。",
                    "display": {
                        "title": format!("{top_category}社区专场"),
                        "tagText": "邻里拼",
                        "iconText": "拼",
                        "backgroundColor": "#F4FBF5",
                        "textColor": "#153A24",
                        "ruleExplanation": "活动期间，会场内商品按页面活动规则享受优惠。",
                        "limitText": "限会场商品参与，具体优惠以下单页为准。"
                    },
                    "buttonText": "进入会场",
                    "iconText": "拼",
                    "backgroundColor": "#F4FBF5",
                    "textColor": "#153A24",
                    "entryPosition": "home_after_banner",
                    "sortOrder": 10,
                    "items": selected_product_items,
                    "runId": run_id,
                    "idempotencyKey": format!("{run_id}:venue-community-group-buy"),
                    "generatedBy": "marketing-agent"
                }
            }
        },
        {
            "id": "experiment-incrementality",
            "kind": "experiment",
            "title": "10% 对照组增量实验",
            "audience": experiment_audience,
            "reason": "把自然增长与活动增量拆开，避免只看核销率或活动期GMV造成误判。",
            "evidence": [
                format!("归因窗口 {} 天", input.horizon_days),
                format!("主指标：{}", input.target_metric),
                "至少保留10%随机对照组"
            ],
            "expectedImpact": {
                "metric": "可归因增量",
                "target": "统计显著且单位经济为正",
                "classification": "decision_rule"
            },
            "risk": "样本不足时只报告区间，不做确定性结论",
            "requiresApproval": false,
            "executable": false,
            "blockedReason": "当前尚未接入曝光、分组和归因事件，本期只生成实验设计",
            "draft": {
                "holdoutBps": 1000,
                "primaryMetric": input.target_metric,
                "guardrailMetrics": ["券后毛利额", "退款率", "缺货取消率", "投诉率"],
                "attributionDays": input.horizon_days,
                "stopConditions": ["预算消耗达到100%", "券后毛利率低于15%", "缺货取消率超过基线2个百分点"]
            }
        }
    ]);
    let actions = Value::Array(
        all_actions
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|action| {
                action
                    .get("kind")
                    .and_then(Value::as_str)
                    .map(|kind| mode_includes_action(&input.mode, kind))
                    .unwrap_or(false)
            })
            .collect(),
    );
    let action_count = actions.as_array().map(Vec::len).unwrap_or(0);

    json!({
        "runId": run_id,
        "version": "community-group-buy-v1",
        "objective": input.objective,
        "scenario": input.mode,
        "status": "awaiting_approval",
        "summary": format!(
            "基于近30天{}笔支付订单，按“{}”场景形成{}类候选动作；所有商业写操作只允许在人工确认后创建草稿。",
            paid_orders,
            input.mode,
            action_count
        ),
        "decisionBasis": {
            "windowDays": 30,
            "paidOrders": paid_orders,
            "gmvCents": gmv_cents,
            "avgOrderCents": avg_order_cents,
            "repeatUserRateBps": repeat_rate_bps,
            "audience": audience,
            "audienceCount": audience_count,
            "topCategory": top_category,
            "selectedProductCount": selected_products.len()
        },
        "budget": {
            "capCents": input.budget_cents,
            "couponCents": coupon_budget_cents,
            "campaignCents": campaign_budget_cents,
            "acquisitionCents": acquisition_budget_cents,
            "reserveCents": reserve_budget_cents,
            "policy": "硬预算上限；未配置商品成本时禁止自动上线"
        },
        "stages": [
            { "key": "observe", "name": "观察", "status": "completed", "skills": ["mall.data_profile"], "output": "30天聚合经营快照" },
            { "key": "diagnose", "name": "诊断", "status": "completed", "skills": ["mall.assortment_score", "mall.audience_segment"], "output": "商品池、人群与风险" },
            { "key": "plan", "name": "规划", "status": "completed", "skills": ["mall.coupon_design", "mall.campaign_design", "mall.venue_builder"], "output": "六类候选动作" },
            { "key": "simulate", "name": "模拟", "status": "completed", "skills": ["mall.experiment_design"], "output": "预算分配与增量实验" },
            { "key": "approve", "name": "审批", "status": "waiting", "skills": ["mall.launch_guard"], "output": "等待运营逐项确认" },
            { "key": "execute", "name": "执行", "status": "blocked", "skills": [], "output": "仅在审批后创建草稿；启用仍需人工" },
            { "key": "learn", "name": "复盘", "status": "pending", "skills": ["mall.experiment_design"], "output": "试点结束后计算增量与单位经济" }
        ],
        "actions": actions,
        "experiment": {
            "design": "随机保留10%目标人群作为对照组，比较相同归因窗口内的支付转化和券后毛利。",
            "primaryMetric": input.target_metric,
            "target": "+8%~15%（试点目标，不是已实现结果）",
            "guardrails": ["券后毛利率≥15%", "退款率不高于基线+1个百分点", "缺货取消率不高于基线+2个百分点"],
            "minimumDecision": "样本不足时延长试点，不以单日波动决定全量发布"
        },
        "guardrails": [
            { "key": "draft_only", "level": "critical", "rule": "Agent 只能创建 draft，禁止直接启用活动、发布会场或批量发券" },
            { "key": "budget_cap", "level": "critical", "rule": format!("本次方案总预算不得超过¥{:.2}", input.budget_cents as f64 / 100.0) },
            { "key": "unit_economics", "level": "high", "rule": margin_guard },
            { "key": "inventory", "level": "high", "rule": "低库存商品不进入主推池；发布前再次读取实时库存" },
            { "key": "activation_gate", "level": "critical", "rule": "当前定向券与商品范围尚未接入真实结算执行；带 activationGate 的 Agent 草稿禁止启用" },
            { "key": "idempotency", "level": "high", "rule": "草稿携带幂等键，并由数据库唯一索引与原子写入防止重复创建" },
            { "key": "privacy", "level": "critical", "rule": "模型只接收聚合指标，不传手机号、地址、姓名或用户级明细" },
            { "key": "contact_consent", "level": "critical", "rule": "没有触达授权时不得外呼、群发或自动邀请入群" }
        ],
        "skills": skill_catalog(),
        "approval": {
            "required": true,
            "currentState": "waiting",
            "approverRole": "mall_operations",
            "canAutoExecute": ["read_aggregates", "score_products", "design_experiment"],
            "mustApprove": ["create_coupon_draft", "create_campaign_draft", "create_venue_draft"],
            "humanOnly": ["activate_campaign", "publish_venue", "issue_coupon", "send_message", "change_budget"]
        }
    })
}

pub fn fallback_answer(question: &str, context: &Value, plan: &Value) -> String {
    let paid_orders = json_path_i64(context, &["summary", "paidOrders"]);
    let gmv_cents = json_path_i64(context, &["summary", "gmvCents"]);
    let avg_order_cents = json_path_i64(context, &["summary", "avgOrderCents"]);
    let actions = plan
        .get("actions")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let action_count = actions.len();
    let action_summary = actions
        .iter()
        .filter_map(|action| match action.get("kind").and_then(Value::as_str) {
            Some("assortment") => Some("智能选品"),
            Some("acquisition") => Some("团长获客"),
            Some("coupon") => Some("定向发券"),
            Some("campaign") => Some("活动生成"),
            Some("venue") => Some("会场搭建"),
            Some("experiment") => Some("增量实验"),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("、");
    let action_summary = if action_summary.is_empty() {
        "经营诊断"
    } else {
        action_summary.as_str()
    };
    format!(
        "基于商城近30天聚合数据：支付订单{paid_orders}单，GMV ¥{:.2}，客单价约¥{:.2}。已形成{action_count}类动作：{action_summary}。所有优惠券、活动和会场只会创建为草稿，必须经运营审批后才能启用。你的目标：{question}",
        gmv_cents as f64 / 100.0,
        avg_order_cents as f64 / 100.0,
    )
}

fn mode_includes_action(mode: &str, kind: &str) -> bool {
    match mode {
        "full_funnel" => true,
        "assortment" | "analysis" => matches!(kind, "assortment" | "experiment"),
        "acquisition" => matches!(kind, "acquisition" | "experiment"),
        "coupon" => matches!(kind, "coupon" | "experiment"),
        "campaign" => matches!(kind, "assortment" | "campaign" | "experiment"),
        "venue" => matches!(kind, "assortment" | "venue" | "experiment"),
        "retention" => matches!(kind, "coupon" | "campaign" | "experiment"),
        _ => false,
    }
}

fn segment_name(key: &str) -> &'static str {
    match key {
        "recent_first_buyers" => "近30天首购用户",
        "community_prospects" => "社区潜在人群（待接入）",
        "repeat_customers" => "复购用户",
        "sleeping_customers" => "沉睡用户",
        "coupon_sensitive" => "优惠敏感用户",
        "after_sale_risk" => "售后风险用户",
        _ => "目标用户",
    }
}

fn segment_count(context: &Value, key: &str) -> i64 {
    context
        .get("segments")
        .and_then(Value::as_array)
        .and_then(|segments| {
            segments
                .iter()
                .find(|segment| segment.get("key").and_then(Value::as_str) == Some(key))
        })
        .and_then(|segment| segment.get("count"))
        .and_then(Value::as_i64)
        .unwrap_or(0)
}

fn normalized_score(value: i64, maximum: i64, weight: i64) -> i64 {
    if value <= 0 || maximum <= 0 || weight <= 0 {
        return 0;
    }
    ((value as i128 * weight as i128) / maximum as i128).clamp(0, weight as i128) as i64
}

fn json_path_i64(value: &Value, path: &[&str]) -> i64 {
    let mut current = value;
    for key in path {
        let Some(next) = current.get(*key) else {
            return 0;
        };
        current = next;
    }
    current.as_i64().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_context() -> Value {
        json!({
            "summary": {
                "paidOrders": 200,
                "gmvCents": 1_880_000,
                "avgOrderCents": 9_400,
                "lowStockProducts": 1,
                "repeatUserRateBps": 2_800
            },
            "topCategories": [{ "categoryName": "水果", "salesCents": 900_000 }],
            "topProducts": [{
                "productId": "p-1",
                "sku": "FRUIT-1",
                "productName": "蓝莓",
                "productStatus": "on_sale",
                "quantity": 80,
                "salesCents": 640_000,
                "stock": 100,
                "stockAlertThreshold": 10,
                "stockCoverDays": 37.5,
                "grossMarginBps": 3_000
            }],
            "segments": [
                { "key": "recent_first_buyers", "count": 30 },
                { "key": "coupon_sensitive", "count": 20 }
            ],
            "communities": { "activePickupPoints": 3, "activeLeaders": 2 }
        })
    }

    #[test]
    fn normalizes_legacy_strategy_mode() {
        assert_eq!(normalize_mode(Some("strategy")), Some("full_funnel"));
        assert_eq!(normalize_mode(Some("unknown")), None);
    }

    #[test]
    fn plan_covers_the_full_marketing_loop() {
        let input = MarketingPlanInput {
            objective: "提升社区团购首购转化".to_string(),
            mode: "full_funnel".to_string(),
            budget_cents: 300_000,
            horizon_days: 14,
            target_metric: "支付转化率".to_string(),
        };
        let plan = build_plan(&fixture_context(), &input);
        let kinds = plan["actions"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|action| action["kind"].as_str())
            .collect::<Vec<_>>();

        assert_eq!(plan["status"], "awaiting_approval");
        assert!(kinds.contains(&"assortment"));
        assert!(kinds.contains(&"acquisition"));
        assert!(kinds.contains(&"coupon"));
        assert!(kinds.contains(&"campaign"));
        assert!(kinds.contains(&"venue"));
        assert!(kinds.contains(&"experiment"));
    }

    #[test]
    fn every_executable_asset_is_draft_only() {
        let input = MarketingPlanInput {
            objective: "做一次活动".to_string(),
            mode: "campaign".to_string(),
            budget_cents: 100_000,
            horizon_days: 7,
            target_metric: "GMV".to_string(),
        };
        let plan = build_plan(&fixture_context(), &input);
        for action in plan["actions"].as_array().unwrap() {
            if matches!(
                action["kind"].as_str(),
                Some("coupon" | "campaign" | "venue")
            ) {
                assert_eq!(action["draft"]["status"], "draft");
            }
        }
        assert_eq!(plan["approval"]["required"], true);
    }

    #[test]
    fn zero_budget_and_unsafe_products_block_materialization() {
        let mut context = fixture_context();
        context["topProducts"][0]["grossMarginBps"] = json!(1_000);
        let input = MarketingPlanInput {
            objective: "零预算分析".to_string(),
            mode: "full_funnel".to_string(),
            budget_cents: 0,
            horizon_days: 7,
            target_metric: "增量毛利".to_string(),
        };
        let plan = build_plan(&context, &input);
        let actions = plan["actions"].as_array().unwrap();
        let coupon = actions
            .iter()
            .find(|action| action["kind"] == "coupon")
            .unwrap();
        let campaign = actions
            .iter()
            .find(|action| action["kind"] == "campaign")
            .unwrap();
        let venue = actions
            .iter()
            .find(|action| action["kind"] == "venue")
            .unwrap();

        assert_eq!(coupon["executable"], false);
        assert_eq!(coupon["draft"]["totalQuantity"], 0);
        assert_eq!(campaign["executable"], false);
        assert_eq!(venue["executable"], false);
        assert_eq!(plan["decisionBasis"]["selectedProductCount"], 0);
    }

    #[test]
    fn scenario_mode_only_returns_relevant_actions() {
        let input = MarketingPlanInput {
            objective: "只做选品".to_string(),
            mode: "assortment".to_string(),
            budget_cents: 100_000,
            horizon_days: 7,
            target_metric: "增量毛利".to_string(),
        };
        let plan = build_plan(&fixture_context(), &input);
        let kinds = plan["actions"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|action| action["kind"].as_str())
            .collect::<Vec<_>>();

        assert_eq!(kinds, vec!["assortment", "experiment"]);

        let answer = fallback_answer(&input.objective, &fixture_context(), &plan);
        assert!(answer.contains("智能选品、增量实验"));
        assert!(!answer.contains("定向发券"));
        assert!(!answer.contains("会场搭建"));
    }

    #[test]
    fn coupon_code_is_unique_to_the_plan_run() {
        let input = MarketingPlanInput {
            objective: "生成券草稿".to_string(),
            mode: "coupon".to_string(),
            budget_cents: 100_000,
            horizon_days: 7,
            target_metric: "支付转化率".to_string(),
        };
        let first = build_plan(&fixture_context(), &input);
        let second = build_plan(&fixture_context(), &input);
        let first_code = &first["actions"][0]["draft"]["code"];
        let second_code = &second["actions"][0]["draft"]["code"];

        assert!(first_code.as_str().unwrap().starts_with("AGENT-"));
        assert_ne!(first_code, second_code);
    }

    #[test]
    fn assortment_excludes_off_sale_products_and_emits_a_score() {
        let mut context = fixture_context();
        context["topProducts"][0]["productStatus"] = json!("off_sale");
        let input = MarketingPlanInput {
            objective: "选安全商品".to_string(),
            mode: "assortment".to_string(),
            budget_cents: 100_000,
            horizon_days: 7,
            target_metric: "增量毛利".to_string(),
        };
        let blocked_plan = build_plan(&context, &input);
        assert_eq!(blocked_plan["decisionBasis"]["selectedProductCount"], 0);

        context["topProducts"][0]["productStatus"] = json!("on_sale");
        let plan = build_plan(&context, &input);
        let score = plan["actions"][0]["draft"]["products"][0]["assortmentScoreBps"]
            .as_i64()
            .unwrap();
        assert!(score > 0);
    }

    #[test]
    fn acquisition_does_not_relabel_recent_buyers_as_prospects() {
        let input = MarketingPlanInput {
            objective: "获取新社区首购".to_string(),
            mode: "acquisition".to_string(),
            budget_cents: 100_000,
            horizon_days: 7,
            target_metric: "首购转化率".to_string(),
        };
        let plan = build_plan(&fixture_context(), &input);
        let actions = plan["actions"].as_array().unwrap();

        assert_eq!(plan["decisionBasis"]["audience"], "community_prospects");
        assert!(actions.iter().all(|action| action["kind"] != "coupon"));
        assert!(actions
            .iter()
            .all(|action| action["audience"] == "community_prospects"));
    }

    #[test]
    fn venue_is_explicitly_global_until_scoped_delivery_exists() {
        let input = MarketingPlanInput {
            objective: "搭建主题会场".to_string(),
            mode: "venue".to_string(),
            budget_cents: 100_000,
            horizon_days: 7,
            target_metric: "会场支付转化率".to_string(),
        };
        let plan = build_plan(&fixture_context(), &input);
        let venue = plan["actions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|action| action["kind"] == "venue")
            .unwrap();

        assert_eq!(venue["audience"], "all_customers");
    }
}
