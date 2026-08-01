#!/usr/bin/env python3
"""Generate the community marketing Agent casebook and methodology PDFs."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "docs/data/community-marketing-agent-simulation.json"
OUTPUT_DIR = ROOT / "output/pdf"
CASEBOOK_PATH = OUTPUT_DIR / "community-marketing-agent-casebook.pdf"
METHODOLOGY_PATH = OUTPUT_DIR / "community-marketing-agent-methodology.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 42

FONT_PATHS = [
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
    Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
]
FONT_NAME = "MarketingAgentCN"

INK = HexColor("#15332B")
INK_2 = HexColor("#35564C")
MUTED = HexColor("#688078")
GREEN = HexColor("#16835D")
GREEN_2 = HexColor("#27A978")
MINT = HexColor("#E8F6EF")
MINT_2 = HexColor("#D7F0E4")
NAVY = HexColor("#163F59")
BLUE = HexColor("#3984A8")
GOLD = HexColor("#D99B2B")
AMBER = HexColor("#FFF3D9")
RED = HexColor("#B74B4B")
RED_BG = HexColor("#FCEBEC")
PAPER = HexColor("#F7FAF8")
LINE = HexColor("#D8E6DF")
LIGHT = HexColor("#EFF5F2")


def register_font() -> None:
    for font_path in FONT_PATHS:
        if font_path.exists():
            pdfmetrics.registerFont(TTFont(FONT_NAME, str(font_path)))
            return
    raise RuntimeError("No Chinese font found for PDF generation")


def tokens(text: str) -> list[str]:
    return re.findall(r"[\u3400-\u9fff]|[A-Za-z0-9_./:%+()\[\]-]+|\s+|.", str(text))


def wrap_text(text: str, max_width: float, size: float) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text).splitlines() or [""]:
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for token in tokens(paragraph):
            if token.isspace() and not current:
                continue
            candidate = current + token
            if current and pdfmetrics.stringWidth(candidate, FONT_NAME, size) > max_width:
                lines.append(current.rstrip())
                current = token.lstrip()
            else:
                current = candidate
        if current or not lines:
            lines.append(current.rstrip())
    return lines


def draw_wrapped(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    size: float = 10,
    color=INK_2,
    leading: float | None = None,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.55
    lines = wrap_text(text, max_width, size)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFont(FONT_NAME, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(
    c: canvas.Canvas,
    items: list[str],
    x: float,
    y: float,
    width: float,
    size: float = 9.5,
    gap: float = 7,
    bullet_color=GREEN,
) -> float:
    for item in items:
        c.setFillColor(bullet_color)
        c.circle(x + 3, y - 3, 2.2, stroke=0, fill=1)
        y = draw_wrapped(c, item, x + 13, y, width - 13, size=size, leading=size * 1.5)
        y -= gap
    return y


def rounded_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=LINE, radius=12) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def draw_footer(c: canvas.Canvas, page: int, title: str, simulation=False) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(MARGIN, 28, PAGE_W - MARGIN, 28)
    c.setFont(FONT_NAME, 7.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 16, title)
    if simulation:
        c.drawCentredString(PAGE_W / 2, 16, "模拟结果 - 不是客户实绩或收益承诺")
    c.drawRightString(PAGE_W - MARGIN, 16, f"{page:02d}")


def draw_header(c: canvas.Canvas, kicker: str, title: str, subtitle: str = "") -> float:
    c.setFillColor(GREEN)
    c.setFont(FONT_NAME, 8.5)
    c.drawString(MARGIN, PAGE_H - 48, kicker.upper())
    c.setFillColor(INK)
    c.setFont(FONT_NAME, 23)
    c.drawString(MARGIN, PAGE_H - 78, title)
    y = PAGE_H - 98
    if subtitle:
        y = draw_wrapped(c, subtitle, MARGIN, y, PAGE_W - 2 * MARGIN, size=9.5, color=MUTED, leading=14)
    c.setStrokeColor(LINE)
    c.line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5)
    return y - 24


def metric_card(c: canvas.Canvas, x: float, y: float, w: float, h: float, label: str, value: str, note: str, accent=GREEN) -> None:
    rounded_box(c, x, y, w, h, white)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 5, w, 5, 3, stroke=0, fill=1)
    c.setFont(FONT_NAME, 8.2)
    c.setFillColor(MUTED)
    c.drawString(x + 12, y + h - 22, label)
    c.setFont(FONT_NAME, 19)
    c.setFillColor(INK)
    c.drawString(x + 12, y + h - 47, value)
    draw_wrapped(c, note, x + 12, y + 18, w - 24, size=7.6, color=MUTED, leading=10, max_lines=2)


def draw_title_band(c: canvas.Canvas, number: str, title: str, subtitle: str) -> None:
    c.setFillColor(INK)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(GREEN_2)
    c.circle(PAGE_W - 75, PAGE_H - 98, 92, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.circle(PAGE_W - 10, 120, 150, stroke=0, fill=1)
    c.setFillColor(MINT_2)
    c.roundRect(MARGIN, PAGE_H - 116, 84, 24, 12, stroke=0, fill=1)
    c.setFillColor(GREEN)
    c.setFont(FONT_NAME, 9)
    c.drawCentredString(MARGIN + 42, PAGE_H - 108, number)
    c.setFillColor(white)
    c.setFont(FONT_NAME, 31)
    y = PAGE_H - 186
    for line in wrap_text(title, PAGE_W - 2 * MARGIN, 31):
        c.drawString(MARGIN, y, line)
        y -= 45
    c.setFillColor(MINT_2)
    c.setFont(FONT_NAME, 13)
    y -= 8
    for line in wrap_text(subtitle, PAGE_W - 2 * MARGIN, 13):
        c.drawString(MARGIN, y, line)
        y -= 22


def new_page(c: canvas.Canvas, page_no: int, title: str, simulation=False) -> None:
    draw_footer(c, page_no, title, simulation=simulation)
    c.showPage()


def fmt_int(value: float) -> str:
    return f"{value:,.0f}"


def fmt_money(value: float) -> str:
    return f"¥{value:,.0f}"


def fmt_pct(value: float, digits=1) -> str:
    return f"{value * 100:.{digits}f}%"


def draw_bar_comparison(c: canvas.Canvas, x: float, y: float, w: float, label: str, values: list[tuple[str, float, str, object]], maximum: float) -> float:
    c.setFont(FONT_NAME, 9)
    c.setFillColor(INK)
    c.drawString(x, y, label)
    y -= 18
    for name, value, display, color in values:
        c.setFont(FONT_NAME, 8)
        c.setFillColor(MUTED)
        c.drawString(x, y + 4, name)
        bx = x + 70
        bw = max(2, (w - 125) * max(0, value) / maximum)
        c.setFillColor(LIGHT)
        c.roundRect(bx, y, w - 125, 10, 5, stroke=0, fill=1)
        c.setFillColor(color)
        c.roundRect(bx, y, bw, 10, 5, stroke=0, fill=1)
        c.setFillColor(INK)
        c.drawRightString(x + w, y + 3, display)
        y -= 19
    return y - 8


def draw_process(c: canvas.Canvas, labels: list[str], x: float, y: float, width: float, color=GREEN) -> float:
    gap = 8
    box_w = (width - gap * (len(labels) - 1)) / len(labels)
    for index, label in enumerate(labels):
        bx = x + index * (box_w + gap)
        rounded_box(c, bx, y - 48, box_w, 48, MINT if index % 2 == 0 else white, stroke=LINE, radius=8)
        c.setFillColor(color)
        c.circle(bx + 12, y - 12, 7, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 7)
        c.drawCentredString(bx + 12, y - 14.5, str(index + 1))
        draw_wrapped(c, label, bx + 23, y - 13, box_w - 29, size=7.5, color=INK, leading=10, max_lines=3)
        if index < len(labels) - 1:
            c.setStrokeColor(color)
            c.setFillColor(color)
            ax = bx + box_w + 2
            c.line(ax, y - 24, ax + gap - 4, y - 24)
            c.line(ax + gap - 7, y - 21, ax + gap - 4, y - 24)
            c.line(ax + gap - 7, y - 27, ax + gap - 4, y - 24)
    return y - 62


def draw_case_page(
    c: canvas.Canvas,
    page: int,
    title: str,
    problem: str,
    data_inputs: list[str],
    workflow: list[str],
    metrics: list[tuple[str, str]],
    calculation_title: str,
    calculation_lines: list[str],
    guardrail: str,
) -> None:
    y = draw_header(c, f"CASE {page - 3:02d}", title, problem)
    rounded_box(c, MARGIN, y - 108, 238, 108, MINT)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "Agent 需要的数据")
    draw_bullets(c, data_inputs, MARGIN + 14, y - 42, 210, size=8, gap=2)
    rounded_box(c, MARGIN + 250, y - 108, PAGE_W - 2 * MARGIN - 250, 108, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 264, y - 22, "可量化目标")
    my = y - 47
    for label, value in metrics:
        c.setFont(FONT_NAME, 8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 264, my, label)
        c.setFont(FONT_NAME, 10.5)
        c.setFillColor(GREEN)
        c.drawRightString(PAGE_W - MARGIN - 14, my, value)
        my -= 20
    y -= 128
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "受控执行链")
    y -= 14
    y = draw_process(c, workflow, MARGIN, y, PAGE_W - 2 * MARGIN)
    rounded_box(c, MARGIN, y - 146, PAGE_W - 2 * MARGIN, 146, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, calculation_title)
    cy = y - 46
    for line in calculation_lines:
        c.setFillColor(GREEN)
        c.circle(MARGIN + 18, cy - 3, 2, stroke=0, fill=1)
        cy = draw_wrapped(c, line, MARGIN + 30, cy, PAGE_W - 2 * MARGIN - 46, size=9, color=INK_2, leading=14)
        cy -= 5
    y -= 164
    rounded_box(c, MARGIN, y - 58, PAGE_W - 2 * MARGIN, 58, AMBER, stroke=HexColor("#E8CF97"), radius=10)
    c.setFont(FONT_NAME, 9)
    c.setFillColor(GOLD)
    c.drawString(MARGIN + 14, y - 20, "上线护栏")
    draw_wrapped(c, guardrail, MARGIN + 76, y - 20, PAGE_W - 2 * MARGIN - 90, size=8.5, color=INK_2, leading=13, max_lines=3)
    new_page(c, page, "社区团购营销 Agent 案例与模拟实验", simulation=True)


def generate_casebook(data: dict) -> None:
    c = canvas.Canvas(str(CASEBOOK_PATH), pagesize=A4)
    c.setTitle("社区团购营销 Agent 案例与模拟实验")
    c.setAuthor("RecoRouter")

    agent = data["arms"]["agent"]
    manual = data["arms"]["manual"]
    control = data["arms"]["control"]
    am = agent["metrics"]
    mm = manual["metrics"]
    cm = control["metrics"]

    draw_title_band(c, "FLAGSHIP PRODUCT", "社区团购营销 Agent", "案例册与可复算经营效果模拟")
    c.setFillColor(white)
    c.setFont(FONT_NAME, 12)
    c.drawString(MARGIN, 238, "经营目标 -> 选品 -> 获客 -> 发券 -> 活动 -> 会场 -> 增量复盘")
    rounded_box(c, MARGIN, 82, PAGE_W - 2 * MARGIN, 112, HexColor("#23473D"), stroke=HexColor("#3B6256"), radius=14)
    highlights = [
        ("付费转化率", fmt_pct(am["paidConversionRate"]["p50"], 2)),
        ("增量付费用户", fmt_int(am["incrementalPaidUsers"]["p50"])),
        ("增量 GMV", fmt_money(am["incrementalGmvYuan"]["p50"])),
        ("净 ROI", fmt_pct(am["roi"]["p50"])),
    ]
    card_w = (PAGE_W - 2 * MARGIN - 30) / 4
    for i, (label, value) in enumerate(highlights):
        x = MARGIN + i * (card_w + 10)
        c.setFillColor(MINT_2)
        c.setFont(FONT_NAME, 7.5)
        c.drawString(x + 10, 167, label)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 15)
        c.drawString(x + 10, 140, value)
        c.setFont(FONT_NAME, 6.8)
        c.setFillColor(HexColor("#BFD8CC"))
        c.drawString(x + 10, 111, "50,000 次模拟 P50")
    c.setFont(FONT_NAME, 8)
    c.setFillColor(HexColor("#FFD9A3"))
    c.drawString(MARGIN, 54, "重要：全部经营结果均为参数化模拟，不是客户实绩，不构成收益承诺。")
    new_page(c, 1, "社区团购营销 Agent 案例与模拟实验", simulation=True)

    y = draw_header(c, "EXECUTIVE SNAPSHOT", "模拟结果一页看懂", "同一市场环境下，对照现状、人工营销和 Agent 营销；结果为 P50。")
    grid_gap = 10
    card_w = (PAGE_W - 2 * MARGIN - 2 * grid_gap) / 3
    metric_card(c, MARGIN, y - 92, card_w, 92, "Agent 付费转化率", fmt_pct(am["paidConversionRate"]["p50"], 2), f"对照 {fmt_pct(cm['paidConversionRate']['p50'], 2)}；提升 {am['paidConversionLiftPercentagePoints']['p50']:.2f}pp")
    metric_card(c, MARGIN + card_w + grid_gap, y - 92, card_w, 92, "增量付费用户", fmt_int(am["incrementalPaidUsers"]["p50"]), f"人工营销 P50 为 {fmt_int(mm['incrementalPaidUsers']['p50'])} 人", BLUE)
    metric_card(c, MARGIN + 2 * (card_w + grid_gap), y - 92, card_w, 92, "增量订单", fmt_int(am["incrementalOrders"]["p50"]), f"P10-P90：{fmt_int(am['incrementalOrders']['p10'])}-{fmt_int(am['incrementalOrders']['p90'])}", NAVY)
    metric_card(c, MARGIN, y - 194, card_w, 92, "增量 GMV", fmt_money(am["incrementalGmvYuan"]["p50"]), f"P10-P90：{fmt_money(am['incrementalGmvYuan']['p10'])}-{fmt_money(am['incrementalGmvYuan']['p90'])}", GOLD)
    metric_card(c, MARGIN + card_w + grid_gap, y - 194, card_w, 92, "每增量付费用户成本", fmt_money(am["costPerIncrementalPaidUserYuan"]["p50"]), f"人工营销为 {fmt_money(mm['costPerIncrementalPaidUserYuan']['p50'])}", GREEN_2)
    metric_card(c, MARGIN + 2 * (card_w + grid_gap), y - 194, card_w, 92, "净 ROI", fmt_pct(am["roi"]["p50"]), f"正 ROI 概率 {fmt_pct(agent['positiveRoiProbability'])}", GREEN)
    y -= 224
    rounded_box(c, MARGIN, y - 180, PAGE_W - 2 * MARGIN, 180, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "三臂关键指标比较")
    by = y - 46
    by = draw_bar_comparison(c, MARGIN + 14, by, PAGE_W - 2 * MARGIN - 28, "付费转化率", [
        ("现状", cm["paidConversionRate"]["p50"], fmt_pct(cm["paidConversionRate"]["p50"], 2), MUTED),
        ("人工", mm["paidConversionRate"]["p50"], fmt_pct(mm["paidConversionRate"]["p50"], 2), BLUE),
        ("Agent", am["paidConversionRate"]["p50"], fmt_pct(am["paidConversionRate"]["p50"], 2), GREEN),
    ], 0.12)
    draw_bar_comparison(c, MARGIN + 14, by, PAGE_W - 2 * MARGIN - 28, "增量 ROI（负值不绘制长度）", [
        ("人工", max(0, mm["roi"]["p50"]), fmt_pct(mm["roi"]["p50"]), RED),
        ("Agent", max(0, am["roi"]["p50"]), fmt_pct(am["roi"]["p50"]), GREEN),
    ], 0.7)
    y -= 202
    rounded_box(c, MARGIN, y - 58, PAGE_W - 2 * MARGIN, 58, RED_BG, stroke=HexColor("#E8BFC1"))
    draw_wrapped(c, "解读边界：Agent 的优势来自透明先验中的更精准人群、更低补贴泄漏和联合优化。真实项目必须用客户自己的基线与随机对照替换这些先验。", MARGIN + 14, y - 19, PAGE_W - 2 * MARGIN - 28, size=8.5, color=RED, leading=13)
    new_page(c, 2, "社区团购营销 Agent 案例与模拟实验", simulation=True)

    y = draw_header(c, "EXPERIMENT DESIGN", "这个模拟实验是怎么做的", "三臂社区簇随机化 + 50,000 次 Monte Carlo，显式模拟市场、社区、策略和成本不确定性。")
    arm_w = (PAGE_W - 2 * MARGIN - 20) / 3
    arms = [
        ("A 现状对照", "保持当前商品、触达和权益策略", MUTED),
        ("B 人工营销", "运营凭经验统一选品、圈人、发券和搭活动", BLUE),
        ("C Agent 营销", "预算、毛利、库存约束下联合优化，人工审批", GREEN),
    ]
    for i, (name, desc, color) in enumerate(arms):
        x = MARGIN + i * (arm_w + 10)
        rounded_box(c, x, y - 104, arm_w, 104, white)
        c.setFillColor(color)
        c.roundRect(x, y - 7, arm_w, 7, 4, stroke=0, fill=1)
        c.setFont(FONT_NAME, 11)
        c.setFillColor(INK)
        c.drawString(x + 12, y - 30, name)
        draw_wrapped(c, desc, x + 12, y - 52, arm_w - 24, size=8, color=MUTED, leading=12, max_lines=4)
    y -= 126
    rounded_box(c, MARGIN, y - 118, PAGE_W - 2 * MARGIN, 118, MINT)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "实验规模与随机化")
    design = data["design"]
    items = [
        f"每臂 {design['clustersPerArm']} 个社区，平均每社区 {design['averageEligibleUsersPerCluster']} 名合规可触达用户，约 54,000 人/臂",
        f"周期 {design['durationDays']} 天，社区规模 CV {design['clusterSizeCoefficientOfVariation'] * 100:.0f}%",
        f"付费转化 ICC {design['conversionIntraclusterCorrelation']:.3f}，订单 ICC {design['orderIntraclusterCorrelation']:.3f}，避免把社区内相关性当独立样本",
        f"固定随机种子 {data['seed']}，重复 {data['iterations']:,} 次；相同代码与 Node 版本可复现",
    ]
    draw_bullets(c, items, MARGIN + 14, y - 44, PAGE_W - 2 * MARGIN - 28, size=8.2, gap=2)
    y -= 140
    rounded_box(c, MARGIN, y - 174, PAGE_W - 2 * MARGIN, 174, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "关键经营假设（中心值）")
    baseline = data["assumptions"]["baseline"]
    assumptions = [
        ("基线付费转化", fmt_pct(baseline["paidConversionRate"]["mean"])),
        ("每付费用户订单", f"{baseline['ordersPerPaidUser']['mean']:.2f}"),
        ("平均客单价", f"¥{baseline['averageOrderValueYuan']['mean']:.0f}"),
        ("贡献毛利率", fmt_pct(baseline["contributionMarginRate"]["mean"])),
        ("人工策略相对转化提升先验", fmt_pct(data["assumptions"]["arms"]["manual"]["conversionRelativeLift"]["mean"])),
        ("Agent 相对转化提升先验", fmt_pct(data["assumptions"]["arms"]["agent"]["conversionRelativeLift"]["mean"])),
    ]
    for i, (label, value) in enumerate(assumptions):
        col = i % 2
        row = i // 2
        x = MARGIN + 16 + col * 250
        yy = y - 50 - row * 34
        c.setFont(FONT_NAME, 8)
        c.setFillColor(MUTED)
        c.drawString(x, yy, label)
        c.setFont(FONT_NAME, 11)
        c.setFillColor(GREEN if col else NAVY)
        c.drawRightString(x + 214, yy, value)
    c.setFillColor(AMBER)
    c.roundRect(MARGIN + 14, y - 158, PAGE_W - 2 * MARGIN - 28, 30, 8, stroke=0, fill=1)
    draw_wrapped(c, "ROI =（增量 GMV × 贡献毛利率 - 活动总成本）/ 活动总成本；不是 GMV / 补贴。", MARGIN + 24, y - 141, PAGE_W - 2 * MARGIN - 48, size=8.5, color=INK)
    y -= 194
    draw_wrapped(c, "正式售前必须用客户近 8-12 周真实基线替换默认参数，再预注册实验指标与停止规则。", MARGIN, y, PAGE_W - 2 * MARGIN, size=9, color=RED)
    new_page(c, 3, "社区团购营销 Agent 案例与模拟实验", simulation=True)

    draw_case_page(
        c, 4, "周末家庭餐桌：社区级智能选品",
        "同一套商品推给所有社区，会同时制造缺货、低动销、生鲜损耗和拣货压力。",
        ["SKU 销量、GMV、成本与折后毛利", "可售库存、预警线、覆盖天数", "社区偏好、售后和履约能力"],
        ["聚合", "筛选", "评分", "模拟", "审批", "实验"],
        [("售罄率", "+5pp 至 +8pp"), ("生鲜损耗", "相对 -10% 至 -15%"), ("需求预测 WAPE", "相对 -10% 至 -20%")],
        "示例测算（不是实绩）",
        ["10 万成员按社区随机分组，各 5 万人", "对照订单率 8.0% = 4,000 单；Agent 目标 8.8% = 4,400 单", "增量订单 400；客单价 ¥45 -> 增量 GMV ¥18,000"],
        "仅选择在售、库存高于预警线、有可信成本、预估折后毛利率不低于 15% 的商品；缺成本时禁止物化。",
    )

    draw_case_page(
        c, 5, "新社区冷启动：团长与内容协同获客",
        "统一礼包和复制话术无法按社区优化渠道，也无法区分自然新增与营销新增。",
        ["社区渗透率、自提点和团长覆盖", "渠道码、触达授权与历史首购", "7 日活跃、30 日复购和投诉退订"],
        ["识别机会", "分配渠道", "生成 Brief", "频控", "簇随机", "看增量"],
        [("新客 CAC", "相对 -8% 至 -12%"), ("首购付费用户", "相对 +5% 至 +10%"), ("首版物料", "2 小时内")],
        "示例测算（不是实绩）",
        ["20 个新社区覆盖 20,000 名合规可触达用户", "历史 7 日首购率 3.0% = 600 人；目标相对提升 15% -> 3.45%", "目标首购 690 人，示例增量首购 90 人；必须用社区同期对照确认"],
        "不把 recent_first_buyers 伪装成潜客；拒绝营销用户不得触达，投诉和退订率不得恶化。",
    )

    draw_case_page(
        c, 6, "沉睡唤醒：预算约束的增量发券",
        "高核销率可能只是把券发给本来就会购买的人，补贴自然订单并不等于增长。",
        ["沉睡周期、历史订单与券响应", "预算、门槛、面额和单用户上限", "折后毛利、套利风险和营销同意"],
        ["排除风险", "估计 uplift", "分配预算", "建草稿", "留对照", "算利润"],
        [("每 ¥100 补贴增量订单", "相对 +15% 至 +25%"), ("预算偏差", "不超过 2%"), ("增量贡献利润", "> 0")],
        "示例测算（不是实绩）",
        ["传统策略补贴 ¥20,000，经对照校正带来 1,000 个增量订单", "传统效率 = 5 单 / 每 ¥100；Agent 目标 = 6 单 / 每 ¥100", "相对补贴效率目标 +20%；最终仍以增量贡献利润判定"],
        "券、活动只创建 draft；数据库幂等键防重复；当前未接入真实定向结算时 activationGate 禁止启用。",
    )

    draw_case_page(
        c, 7, "开学早餐周：一句目标生成活动与会场",
        "活动策划、商品池、文案、会场、质检分散在多人手中，首版慢且难以做多版本实验。",
        ["活动预算、商品池和库存成本", "品牌规范、禁用词与合法素材", "入口、模块、曝光、点击和支付事件"],
        ["拆目标", "组合商品", "生成机制", "编排会场", "规则质检", "A/B"],
        [("首版活动工时", "下降 60%+"), ("实验版本数", "1 -> 3 至 4"), ("收入 / 访客", "相对 +3% 至 +5%")],
        "示例输入与输出",
        ["输入：预算 ¥30,000，整体毛利率不得比基线下降超过 0.5pp", "输出：机制、排期、商品组合、团长话术、视觉 Brief、会场模块与回滚规则", "当前会场发布是全局能力，因此明确标记 all_customers，不虚构人群定向"],
        "价格、预算、库存和禁用词由确定性规则校验；模型生成内容必须经品牌和运营审批。",
    )

    draw_case_page(
        c, 8, "生鲜临期盘活：库存异常触发闭环",
        "临期库存如果只靠统一降价，容易出现毛利穿底、触达过广和局部履约过载。",
        ["库存覆盖、保质期和销量偏差", "社区需求、履约范围与拣货能力", "最低毛利、活动叠加与投诉"],
        ["识别风险", "圈定范围", "模拟机制", "校验毛利", "分批放量", "自动停"],
        [("售罄率目标", "70% -> 82%"), ("新增售出", "600 件"), ("示例增量贡献", "¥1,200")],
        "示例测算（不是实绩）",
        ["5,000 件商品需在 48 小时内销售；历史售罄 70% = 3,500 件", "目标售罄 82% = 4,100 件；新增售出 600 件", "每件扣折扣、成本和履约后仍贡献 ¥2 -> 示例增量贡献 ¥1,200"],
        "缺货、折后毛利低于阈值、投诉或履约压力触发暂停；不得为了售罄牺牲单位经济。",
    )

    y = draw_header(c, "UNCERTAINTY", "漂亮数字之外：结果区间与失败概率", "模拟主动保留负结果，不把 P50 当成确定承诺。")
    rounded_box(c, MARGIN, y - 210, PAGE_W - 2 * MARGIN, 210, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "Agent P10 / P50 / P90")
    ranges = [
        ("净 ROI", am["roi"]["p10"] * 100, am["roi"]["p50"] * 100, am["roi"]["p90"] * 100, "%", -25, 175),
        ("增量付费用户", am["incrementalPaidUsers"]["p10"], am["incrementalPaidUsers"]["p50"], am["incrementalPaidUsers"]["p90"], "人", 0, 1500),
        ("增量订单", am["incrementalOrders"]["p10"], am["incrementalOrders"]["p50"], am["incrementalOrders"]["p90"], "单", 0, 2400),
        ("增量 GMV", am["incrementalGmvYuan"]["p10"] / 10000, am["incrementalGmvYuan"]["p50"] / 10000, am["incrementalGmvYuan"]["p90"] / 10000, "万元", 0, 12),
    ]
    ry = y - 54
    for label, p10, p50, p90, unit, lo, hi in ranges:
        c.setFont(FONT_NAME, 8.5)
        c.setFillColor(INK_2)
        c.drawString(MARGIN + 16, ry + 3, label)
        x0 = MARGIN + 120
        x1 = PAGE_W - MARGIN - 25
        scale = lambda v: x0 + (v - lo) / (hi - lo) * (x1 - x0)
        c.setStrokeColor(LINE)
        c.setLineWidth(5)
        c.line(x0, ry + 5, x1, ry + 5)
        c.setStrokeColor(GREEN_2)
        c.line(scale(p10), ry + 5, scale(p90), ry + 5)
        c.setFillColor(GREEN)
        c.circle(scale(p50), ry + 5, 5, stroke=0, fill=1)
        c.setFont(FONT_NAME, 7)
        c.setFillColor(MUTED)
        c.drawCentredString(scale(p10), ry - 9, f"P10 {p10:.1f}{unit}")
        c.drawCentredString(scale(p50), ry - 9, f"P50 {p50:.1f}{unit}")
        c.drawCentredString(scale(p90), ry - 9, f"P90 {p90:.1f}{unit}")
        ry -= 42
    y -= 232
    metric_card(c, MARGIN, y - 88, 152, 88, "正 ROI 概率", fmt_pct(agent["positiveRoiProbability"]), "仍有约 14% 模拟轮次 ROI 不为正", GREEN)
    metric_card(c, MARGIN + 164, y - 88, 152, 88, "增量用户为正概率", fmt_pct(agent["positiveIncrementalPaidUsersProbability"]), "不等于统计显著概率", BLUE)
    metric_card(c, MARGIN + 328, y - 88, PAGE_W - MARGIN - (MARGIN + 328), 88, "Agent ROI P10", fmt_pct(am["roi"]["p10"]), "保留试点失败风险", RED)
    y -= 110
    rounded_box(c, MARGIN, y - 148, PAGE_W - 2 * MARGIN, 148, RED_BG, stroke=HexColor("#E8BFC1"))
    c.setFont(FONT_NAME, 11)
    c.setFillColor(RED)
    c.drawString(MARGIN + 14, y - 22, "这些数据不能证明什么")
    draw_bullets(c, [
        "不能证明任何客户已经获得 63.6% ROI；它只是默认参数下的 P50。",
        "不能用核销率、CTR 或最后点击替代增量贡献利润。",
        "没有曝光、随机分组和同期对照，就不能可信地声称转化提升来自 Agent。",
        "库存、履约、触达授权和数据质量不足时，真实结果可能显著更差。",
    ], MARGIN + 14, y - 44, PAGE_W - 2 * MARGIN - 28, size=8.5, gap=3, bullet_color=RED)
    new_page(c, 9, "社区团购营销 Agent 案例与模拟实验", simulation=True)

    y = draw_header(c, "CUSTOMER PILOT", "8 周把模拟数据换成客户实证", "目标不是继续优化 PPT，而是形成可审计、可复算的真实对照结论。")
    stages = [
        ("第 1-2 周", "数据合同与基线", "替换社区规模、CVR、客单、贡献毛利、券与履约成本"),
        ("第 3-4 周", "历史回放与 Shadow", "检验硬约束、预算、商品池、人群排除和数据延迟"),
        ("第 5-6 周", "三臂小流量实验", "按社区/团长簇随机，预注册主指标、护栏和停止规则"),
        ("第 7-8 周", "增量与单位经济复盘", "报告效应区间、异质性、失败实验与扩大权限建议"),
    ]
    for i, (period, name, desc) in enumerate(stages):
        yy = y - i * 86
        c.setFillColor(GREEN if i < 2 else NAVY)
        c.circle(MARGIN + 18, yy - 18, 16, stroke=0, fill=1)
        c.setFont(FONT_NAME, 8)
        c.setFillColor(white)
        c.drawCentredString(MARGIN + 18, yy - 21, str(i + 1))
        rounded_box(c, MARGIN + 46, yy - 60, PAGE_W - 2 * MARGIN - 46, 60, white)
        c.setFont(FONT_NAME, 8)
        c.setFillColor(GREEN)
        c.drawString(MARGIN + 60, yy - 19, period)
        c.setFont(FONT_NAME, 11)
        c.setFillColor(INK)
        c.drawString(MARGIN + 130, yy - 19, name)
        draw_wrapped(c, desc, MARGIN + 60, yy - 39, PAGE_W - 2 * MARGIN - 74, size=8, color=MUTED, leading=11, max_lines=2)
    y -= 358
    rounded_box(c, MARGIN, y - 112, PAGE_W - 2 * MARGIN, 112, MINT)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "建议验收门槛")
    draw_bullets(c, [
        "100% 正式外部动作有审批与审计；预算、库存、价格硬约束零违规。",
        "至少一个场景形成同期对照结论；扩大权限前完成两个完整营销周期。",
        "主指标用增量贡献利润，护栏覆盖退款、缺货、投诉、退订和履约时效。",
    ], MARGIN + 14, y - 44, PAGE_W - 2 * MARGIN - 28, size=8.5, gap=3)
    y -= 132
    draw_wrapped(c, "复现：node scripts/simulate-community-marketing-agent.mjs", MARGIN, y, PAGE_W - 2 * MARGIN, size=8.5, color=NAVY)
    y -= 18
    draw_wrapped(c, "来源：docs/data/community-marketing-agent-simulation.json；模拟版本 1.0.0，seed 20260801。", MARGIN, y, PAGE_W - 2 * MARGIN, size=8, color=MUTED)
    y -= 18
    draw_wrapped(c, "销售表达：我们不承诺复制别人的提升；我们用客户自己的社区、商品、预算和履约条件，给出可审计的增量结论。", MARGIN, y, PAGE_W - 2 * MARGIN, size=9, color=GREEN)
    new_page(c, 10, "社区团购营销 Agent 案例与模拟实验", simulation=True)
    c.save()


def draw_matrix(c: canvas.Canvas, x: float, y: float, widths: list[float], headers: list[str], rows: list[list[str]], row_h: float = 46) -> float:
    total_w = sum(widths)
    header_h = 30
    c.setFillColor(INK)
    c.roundRect(x, y - header_h, total_w, header_h, 8, stroke=0, fill=1)
    cx = x
    for i, header in enumerate(headers):
        c.setFont(FONT_NAME, 8)
        c.setFillColor(white)
        c.drawString(cx + 8, y - 19, header)
        cx += widths[i]
    current_y = y - header_h
    for row_index, row in enumerate(rows):
        fill = white if row_index % 2 == 0 else PAPER
        c.setFillColor(fill)
        c.setStrokeColor(LINE)
        c.rect(x, current_y - row_h, total_w, row_h, stroke=1, fill=1)
        cx = x
        for col_index, value in enumerate(row):
            draw_wrapped(c, value, cx + 8, current_y - 14, widths[col_index] - 16, size=7.5, color=INK_2, leading=10, max_lines=4)
            cx += widths[col_index]
            if col_index < len(widths) - 1:
                c.setStrokeColor(LINE)
                c.line(cx, current_y, cx, current_y - row_h)
        current_y -= row_h
    return current_y


def generate_methodology(data: dict) -> None:
    c = canvas.Canvas(str(METHODOLOGY_PATH), pagesize=A4)
    c.setTitle("社区团购营销 Agent 方法论")
    c.setAuthor("RecoRouter")

    draw_title_band(c, "6D + G METHOD", "从模型选择到 Agent 架构再到 Skills", "社区团购营销 Agent 产品化与交付方法论")
    c.setFillColor(white)
    c.setFont(FONT_NAME, 12)
    c.drawString(MARGIN, 238, "业务状态模型 × 可执行 Skills × 受控权限 × 因果实验 × 持续学习")
    rounded_box(c, MARGIN, 92, PAGE_W - 2 * MARGIN, 96, HexColor("#23473D"), stroke=HexColor("#3B6256"), radius=14)
    draw_wrapped(c, "营销 Agent 不是写文案的聊天机器人，而是在库存、毛利、预算、履约、品牌与合规约束下，把经营目标变成可审批、可执行、可实验、可复盘动作的经营系统。", MARGIN + 16, 159, PAGE_W - 2 * MARGIN - 32, size=10, color=MINT_2, leading=16)
    new_page(c, 1, "社区团购营销 Agent 方法论")

    y = draw_header(c, "METHOD OVERVIEW", "6D + G：一条从经营问题到受控执行的路径", "每一步都有明确产物，治理不是最后加上的检查表。")
    steps = [
        ("D1", "Define", "经营合同"),
        ("D2", "Data", "数据合同"),
        ("D3", "Decide", "模型组合"),
        ("D4", "Design", "Agent 架构"),
        ("D5", "Develop", "Skills"),
        ("D6", "Deploy", "实验交付"),
    ]
    for i, (code, name, output) in enumerate(steps):
        row = i // 2
        col = i % 2
        x = MARGIN + col * 255
        yy = y - row * 104
        rounded_box(c, x, yy - 84, 243, 84, white)
        c.setFillColor(GREEN if col == 0 else NAVY)
        c.circle(x + 28, yy - 28, 17, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 9)
        c.drawCentredString(x + 28, yy - 31, code)
        c.setFillColor(INK)
        c.setFont(FONT_NAME, 13)
        c.drawString(x + 56, yy - 27, name)
        c.setFillColor(MUTED)
        c.setFont(FONT_NAME, 8.5)
        c.drawString(x + 56, yy - 49, f"产物：{output}")
        c.setFillColor(GREEN_2)
        c.roundRect(x + 56, yy - 64, 116, 5, 2.5, stroke=0, fill=1)
    y -= 322
    rounded_box(c, MARGIN, y - 106, PAGE_W - 2 * MARGIN, 106, MINT)
    c.setFont(FONT_NAME, 12)
    c.setFillColor(INK)
    c.drawString(MARGIN + 16, y - 24, "G - Governance 贯穿所有步骤")
    draw_bullets(c, [
        "数据权限、个人信息、营销同意和租户隔离；",
        "预算、毛利、库存、频控、品牌与审批闸门；",
        "模型、Prompt、Skill、数据快照和动作版本可审计；",
        "全局停止、单活动回滚、失败实验与申诉机制。",
    ], MARGIN + 16, y - 48, PAGE_W - 2 * MARGIN - 32, size=8.5, gap=2)
    y -= 128
    rounded_box(c, MARGIN, y - 74, PAGE_W - 2 * MARGIN, 74, AMBER, stroke=HexColor("#E8CF97"))
    draw_wrapped(c, "北极星指标：增量贡献利润，而不是内容数量、核销率或活动期 GMV。", MARGIN + 16, y - 23, PAGE_W - 2 * MARGIN - 32, size=11, color=INK, leading=16)
    new_page(c, 2, "社区团购营销 Agent 方法论")

    y = draw_header(c, "D1 DEFINE", "先定义经营合同，再谈 Agent", "每个场景必须能被验证、被约束、被停止。")
    contract_items = [
        ("主指标", "增量贡献利润 / 增量订单 / 增量新客"),
        ("成本", "补贴、获客、模型调用、人力和履约成本"),
        ("供给", "库存、保质期、采购、拣货和配送能力"),
        ("风险", "毛利、退款、投诉、退订、缺货和时效"),
        ("周期", "小时级、日级、活动级或用户生命周期"),
        ("权限", "洞察、建议、草稿、受控执行"),
    ]
    for i, (label, value) in enumerate(contract_items):
        col = i % 2
        row = i // 2
        x = MARGIN + col * 255
        yy = y - row * 72
        rounded_box(c, x, yy - 58, 243, 58, white)
        c.setFont(FONT_NAME, 8)
        c.setFillColor(GREEN)
        c.drawString(x + 12, yy - 19, label)
        draw_wrapped(c, value, x + 12, yy - 39, 219, size=8.3, color=INK_2, leading=11, max_lines=2)
    y -= 232
    rounded_box(c, MARGIN, y - 160, PAGE_W - 2 * MARGIN, 160, INK)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(MINT_2)
    c.drawString(MARGIN + 16, y - 25, "推荐北极星公式")
    formula = [
        "增量贡献利润 = 增量收入",
        "- 增量商品成本 - 增量补贴 - 增量获客成本",
        "- 增量履约与售后成本 - Agent 运行成本",
    ]
    fy = y - 57
    for line in formula:
        c.setFont(FONT_NAME, 14 if line == formula[0] else 12)
        c.setFillColor(white if line == formula[0] else HexColor("#CBE2D7"))
        c.drawString(MARGIN + 28, fy, line)
        fy -= 28
    y -= 184
    rounded_box(c, MARGIN, y - 96, PAGE_W - 2 * MARGIN, 96, RED_BG, stroke=HexColor("#E8BFC1"))
    c.setFont(FONT_NAME, 10)
    c.setFillColor(RED)
    c.drawString(MARGIN + 14, y - 23, "失败定义也要预先写入合同")
    draw_bullets(c, ["增量利润为负", "毛利或库存越线", "投诉/退订恶化", "样本不足无法决策"], MARGIN + 14, y - 46, PAGE_W - 2 * MARGIN - 28, size=8.2, gap=1, bullet_color=RED)
    new_page(c, 3, "社区团购营销 Agent 方法论")

    y = draw_header(c, "D2 DATA", "建立营销决策数据合同", "没有曝光、版本和实验分组，就不能可信地声称转化或 ROI 提升。")
    rows = [
        ["商品", "SKU、品类、成本、售价、毛利、保质期、供应商", "选品与单位经济"],
        ["库存", "可售、在途、预警线、覆盖天数、履约范围", "缺货与损耗护栏"],
        ["用户/社区", "合法取得的交易、响应、社区特征、营销偏好", "分层与异质性"],
        ["营销", "活动、券、曝光、点击、领取、核销、预算", "增量归因与成本"],
        ["交易/履约", "支付、退款、售后、拣货、自提、时效", "贡献利润与体验"],
        ["实验", "组别、版本、曝光、干预、结果、停止规则", "因果验证"],
    ]
    y = draw_matrix(c, MARGIN, y, [75, 280, 156], ["数据域", "最低字段", "决策用途"], rows, row_h=54)
    y -= 20
    rounded_box(c, MARGIN, y - 122, PAGE_W - 2 * MARGIN, 122, MINT)
    c.setFont(FONT_NAME, 10)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "每个关键事件携带")
    draw_bullets(c, [
        "租户、去标识用户或社区 ID、活动版本、Skill 版本、模型版本；",
        "曝光与干预时间、实验组、订单/退款/履约结果；",
        "数据血缘、更新时间和权限标签。",
    ], MARGIN + 14, y - 45, PAGE_W - 2 * MARGIN - 28, size=8.5, gap=3)
    y -= 144
    draw_wrapped(c, "隐私原则：外部模型只接收聚合上下文和清除运营自由文本后的受控方案；个人信息检测在 DB 与模型调用之前执行。", MARGIN, y, PAGE_W - 2 * MARGIN, size=9, color=GREEN)
    new_page(c, 4, "社区团购营销 Agent 方法论")

    y = draw_header(c, "D3 DECIDE", "不要让一个大模型包办所有工作", "用最适合的模型、优化器与规则共同完成经营决策。")
    rows = [
        ["目标理解/复盘解释", "推理型 LLM", "中文经营理解、结构化输出、工具调用"],
        ["分类/抽取/风险初筛", "小模型或分类器", "成本、延迟、稳定性"],
        ["需求与销量预测", "时序 / GBDT", "缺货修正、节日、社区冷启动"],
        ["人群与发券", "Uplift / 因果森林", "增量效果、校准、公平性"],
        ["预算与商品组合", "线性 / 整数优化", "硬约束、可解释性"],
        ["图片与会场", "多模态 / 图像生成", "品牌、真实性、版权"],
        ["预算/价格/权限", "规则引擎", "确定性、零容忍、审计"],
        ["活动知识", "混合检索 + RAG", "新鲜度、来源、权限隔离"],
    ]
    y = draw_matrix(c, MARGIN, y, [128, 135, 248], ["任务", "推荐技术", "选型重点"], rows, row_h=45)
    y -= 20
    rounded_box(c, MARGIN, y - 92, PAGE_W - 2 * MARGIN, 92, AMBER, stroke=HexColor("#E8CF97"))
    c.setFont(FONT_NAME, 10)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "当前产品的双层决策")
    draw_wrapped(c, "确定性规划器负责聚合、算账、选品、预算和护栏；可选 LLM 只解释证据、取舍和风险，不得改写预算、审批边界或草稿状态。", MARGIN + 14, y - 46, PAGE_W - 2 * MARGIN - 28, size=8.5, color=INK_2, leading=13)
    new_page(c, 5, "社区团购营销 Agent 方法论")

    y = draw_header(c, "MODEL EVALUATION", "模型选型必须用客户任务评测", "通用榜单不能回答商品事实、工具调用、合规和成本问题。")
    dimensions = [
        ("业务方案可执行性", 20, "能否转成当前营销中心配置"),
        ("工具 / Schema 成功率", 18, "结构化输出和重试稳定性"),
        ("事实与政策准确率", 15, "商品、库存、活动与政策不编造"),
        ("合规违规率", 15, "个人信息、禁用词、差别待遇"),
        ("P95 延迟", 10, "运营交互和批处理 SLA"),
        ("单任务成本", 10, "推理、检索和审核成本"),
        ("私有化与审计", 12, "数据驻留、日志、版本和删除"),
    ]
    c.setFont(FONT_NAME, 10)
    c.setFillColor(INK)
    c.drawString(MARGIN, y, "建议使用客户自己的 100-300 个代表性任务")
    y -= 32
    for label, weight, note in dimensions:
        c.setFont(FONT_NAME, 8.5)
        c.setFillColor(INK_2)
        c.drawString(MARGIN, y + 4, label)
        bx = MARGIN + 150
        bw = 240 * weight / 20
        c.setFillColor(LIGHT)
        c.roundRect(bx, y, 240, 12, 6, stroke=0, fill=1)
        c.setFillColor(GREEN if weight >= 15 else BLUE)
        c.roundRect(bx, y, bw, 12, 6, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont(FONT_NAME, 8)
        c.drawRightString(bx + 270, y + 3, f"{weight}%")
        draw_wrapped(c, note, bx + 285, y + 4, PAGE_W - MARGIN - (bx + 285), size=7, color=MUTED, leading=9, max_lines=2)
        y -= 43
    y -= 8
    rounded_box(c, MARGIN, y - 126, PAGE_W - 2 * MARGIN, 126, white)
    c.setFont(FONT_NAME, 10)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "路由策略")
    draw_bullets(c, [
        "低风险高频任务优先规则、小模型与缓存；",
        "复杂目标拆解与解释才调用推理型 LLM；",
        "价格、预算、库存、权限永远回到确定性系统判定；",
        "模型失败时规划器仍输出完整受控方案。",
    ], MARGIN + 14, y - 45, PAGE_W - 2 * MARGIN - 28, size=8.5, gap=3)
    new_page(c, 6, "社区团购营销 Agent 方法论")

    y = draw_header(c, "D4 DESIGN", "Agent 架构：计划、模拟、校验、审批、执行、学习", "把模型放在受控系统里，而不是把系统交给模型。")
    layers = [
        ("运营台 / API", "经营目标、预算、周期、主指标", NAVY),
        ("营销总控 Agent", "状态管理、任务拆解、解释", GREEN),
        ("聚合数据 + 确定性规划器", "算账、选品、人群、预算、实验", GREEN_2),
        ("版本化 Skills", "读聚合 / 写草稿 / 生成审批包", BLUE),
        ("硬护栏", "预算、毛利、库存、隐私、权限、幂等", GOLD),
        ("人工审批 + 既有营销中心", "创建 draft；人工启用、发布、发放", INK),
        ("曝光与结果事件", "支付、退款、履约、增量与学习建议", NAVY),
    ]
    box_w = PAGE_W - 2 * MARGIN - 80
    x = MARGIN + 40
    for i, (name, desc, color) in enumerate(layers):
        yy = y - i * 75
        rounded_box(c, x, yy - 56, box_w, 56, white)
        c.setFillColor(color)
        c.roundRect(x, yy - 56, 8, 56, 4, stroke=0, fill=1)
        c.setFont(FONT_NAME, 11)
        c.setFillColor(INK)
        c.drawString(x + 22, yy - 22, name)
        c.setFont(FONT_NAME, 8)
        c.setFillColor(MUTED)
        c.drawString(x + 190, yy - 22, desc)
        if i < len(layers) - 1:
            c.setStrokeColor(LINE)
            c.line(PAGE_W / 2, yy - 56, PAGE_W / 2, yy - 74)
            c.setFillColor(LINE)
            c.circle(PAGE_W / 2, yy - 70, 2.5, stroke=0, fill=1)
    new_page(c, 7, "社区团购营销 Agent 方法论")

    y = draw_header(c, "D5 DEVELOP", "Skills：有类型、权限、版本和回滚的业务能力", "当前八项 Skill 定义由一个确定性规划器统一编排；下一阶段拆分运行记录与独立物化。")
    rows = [
        ["mall.data_profile", "聚合经营快照", "无", "自动"],
        ["mall.assortment_score", "销量/GMV/毛利/库存评分", "无", "自动"],
        ["mall.audience_segment", "商城域聚合人群", "无", "自动"],
        ["mall.coupon_design", "门槛、面额、数量、预算", "coupon:draft", "审批"],
        ["mall.campaign_design", "活动机制与规则", "campaign:draft", "审批"],
        ["mall.venue_builder", "入口、模块、商品池", "campaign:draft", "审批"],
        ["mall.experiment_design", "对照组、指标、停止条件", "无", "自动"],
        ["mall.launch_guard", "预算/毛利/库存/隐私闸门", "无", "人工放行"],
    ]
    y = draw_matrix(c, MARGIN, y, [155, 190, 90, 76], ["Skill", "职责", "写权限", "自主等级"], rows, row_h=45)
    y -= 18
    rounded_box(c, MARGIN, y - 96, PAGE_W - 2 * MARGIN, 96, MINT)
    c.setFont(FONT_NAME, 10)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "Skill 的最小治理单元")
    draw_wrapped(c, "输入 Schema + 前置条件 + 所需权限 + 幂等键 + 风险等级 + 审批策略 + 输出 Schema + 监控指标 + 回滚方式 + owner/version。", MARGIN + 14, y - 47, PAGE_W - 2 * MARGIN - 28, size=9, color=INK_2, leading=14)
    new_page(c, 8, "社区团购营销 Agent 方法论")

    y = draw_header(c, "SKILL CONTRACT", "一个可治理 Skill 应该长什么样", "提示词只是实现细节；合同才是业务能力。")
    rounded_box(c, MARGIN, y - 392, PAGE_W - 2 * MARGIN, 392, INK)
    contract = [
        "name: coupon.allocate_budget.v2",
        "owner: growth-platform",
        "inputs:",
        "  cohort_id: string",
        "  budget_cents: integer",
        "  coupon_candidates: array",
        "preconditions:",
        "  - consent_policy_passed",
        "  - exclusion_list_applied",
        "  - budget_reserved",
        "permissions:",
        "  reads: [aggregated_segments, margin_policy]",
        "  writes: [mall_coupons:draft]",
        "risk: high",
        "approval: mall_operations + finance",
        "idempotency_key: run_id + action_id",
        "outputs: [draft_id, budget_used, warnings]",
        "rollback: delete_unactivated_draft",
    ]
    cy = y - 28
    for line in contract:
        c.setFont(FONT_NAME, 9)
        c.setFillColor(MINT_2 if not line.startswith("  ") else HexColor("#A8C9BA"))
        c.drawString(MARGIN + 20, cy, line)
        cy -= 19
    y -= 416
    rounded_box(c, MARGIN, y - 128, PAGE_W - 2 * MARGIN, 128, white)
    c.setFont(FONT_NAME, 10)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "为什么不能只有 prompt")
    draw_bullets(c, [
        "Prompt 不能可靠表达数据库写权限、幂等和审批状态；",
        "模型版本变化时，Skill 合同仍能稳定校验输入和输出；",
        "失败、重试、回滚和成本必须由运行时记录，而不是靠聊天记录猜测。",
    ], MARGIN + 14, y - 46, PAGE_W - 2 * MARGIN - 28, size=8.5, gap=3)
    new_page(c, 9, "社区团购营销 Agent 方法论")

    y = draw_header(c, "AUTONOMY", "自主等级：从建议到受控执行逐级开放", "权限由动作风险决定，不由模型能力决定。")
    levels = [
        ("L0", "只读洞察", "聚合查询、诊断", GREEN),
        ("L1", "方案建议", "选品、人群、权益、实验", GREEN_2),
        ("L2", "创建草稿", "券、活动、会场 draft", BLUE),
        ("L2.5", "可审计物化", "run/action 记录、审批包、幂等", NAVY),
        ("L3", "受控自动执行", "预审批预算、暂停、回滚", GOLD),
        ("L4", "高自治", "当前不建议用于营销外部触达", RED),
    ]
    for i, (level, name, desc, color) in enumerate(levels):
        yy = y - i * 72
        c.setFillColor(color)
        c.roundRect(MARGIN, yy - 48, 56, 48, 10, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 12)
        c.drawCentredString(MARGIN + 28, yy - 29, level)
        rounded_box(c, MARGIN + 68, yy - 48, PAGE_W - 2 * MARGIN - 68, 48, white)
        c.setFont(FONT_NAME, 10)
        c.setFillColor(INK)
        c.drawString(MARGIN + 82, yy - 20, name)
        c.setFont(FONT_NAME, 8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 210, yy - 20, desc)
    y -= 450
    rounded_box(c, MARGIN, y - 92, PAGE_W - 2 * MARGIN, 92, AMBER, stroke=HexColor("#E8CF97"))
    draw_wrapped(c, "当前产品是 L2：可以自动读聚合、算方案、生成实验和创建经确认的草稿；不能自动启用、发布、发券、群发或外呼。", MARGIN + 16, y - 28, PAGE_W - 2 * MARGIN - 32, size=10, color=INK, leading=16)
    new_page(c, 10, "社区团购营销 Agent 方法论")

    y = draw_header(c, "D6 DEPLOY + G", "实验验证与治理必须一起上线", "先证明增量，再扩大权限。")
    rounded_box(c, MARGIN, y - 180, 246, 180, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 22, "因果实验")
    draw_bullets(c, [
        "按社区/团长簇随机，避免社群污染；",
        "预注册主指标、护栏和停止规则；",
        "保留不发券/不活动对照；",
        "报告效应区间与异质性，不只报均值；",
        "失败实验也进入知识库。",
    ], MARGIN + 14, y - 46, 218, size=8.5, gap=3)
    rounded_box(c, MARGIN + 258, y - 180, PAGE_W - 2 * MARGIN - 258, 180, MINT)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 272, y - 22, "上线治理")
    draw_bullets(c, [
        "个人信息最小化与营销退订；",
        "预算、频控、毛利和库存上限；",
        "模型/Skill/Prompt/数据版本审计；",
        "幂等、全局停止和单活动回滚；",
        "重要决策解释、申诉和人工复核。",
    ], MARGIN + 272, y - 46, PAGE_W - MARGIN - (MARGIN + 272) - 14, size=8.5, gap=3)
    y -= 202
    rounded_box(c, MARGIN, y - 130, PAGE_W - 2 * MARGIN, 130, INK)
    c.setFont(FONT_NAME, 10)
    c.setFillColor(MINT_2)
    c.drawString(MARGIN + 16, y - 24, "可信结果的最低条件")
    conditions = [
        "相同归因窗口", "同期对照", "稳定曝光口径", "完整成本", "护栏无恶化", "样本足够",
    ]
    for i, condition in enumerate(conditions):
        col = i % 3
        row = i // 3
        x = MARGIN + 20 + col * 165
        yy = y - 52 - row * 38
        c.setFillColor(GREEN_2)
        c.circle(x + 5, yy - 3, 5, stroke=0, fill=1)
        c.setFont(FONT_NAME, 8.5)
        c.setFillColor(white)
        c.drawString(x + 17, yy, condition)
    y -= 154
    draw_wrapped(c, "法律与治理参考：个人信息保护法、算法推荐管理规定、生成合成内容标识办法、NIST AI RMF。具体适用范围由客户法务确认。", MARGIN, y, PAGE_W - 2 * MARGIN, size=8.5, color=MUTED, leading=13)
    new_page(c, 11, "社区团购营销 Agent 方法论")

    y = draw_header(c, "DELIVERY ROADMAP", "8 周试点与产品路线图", "从 L2 受控草稿出发，用真实增量结果决定是否开放 L2.5 和 L3。")
    stages = [
        ("1-2", "定义与数据", "经营合同、数据合同、基线、权限"),
        ("3-4", "离线评测", "模型任务集、历史回放、Shadow"),
        ("5-6", "受控试点", "草稿、会场预览、三臂对照"),
        ("7-8", "增量复盘", "贡献利润、风险、扩大权限建议"),
    ]
    for i, (week, name, desc) in enumerate(stages):
        x = MARGIN + i * 128
        c.setFillColor(GREEN if i < 2 else NAVY)
        c.circle(x + 20, y - 25, 18, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 8)
        c.drawCentredString(x + 20, y - 28, week)
        c.setFont(FONT_NAME, 10)
        c.setFillColor(INK)
        c.drawString(x, y - 62, name)
        draw_wrapped(c, desc, x, y - 82, 112, size=7.5, color=MUTED, leading=10, max_lines=4)
        if i < 3:
            c.setStrokeColor(LINE)
            c.line(x + 41, y - 25, x + 126, y - 25)
    y -= 150
    rounded_box(c, MARGIN, y - 146, PAGE_W - 2 * MARGIN, 146, white)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 23, "当前 L2 已完成")
    draw_bullets(c, [
        "商城聚合快照、确定性规划器、八项 Skill 定义；",
        "预算、毛利、库存、人群、隐私、审批和幂等护栏；",
        "复用营销中心创建券、活动、会场草稿；",
        "可选模型解释，模型不可改写硬约束。",
    ], MARGIN + 14, y - 47, 235, size=8.2, gap=2)
    c.setFont(FONT_NAME, 11)
    c.setFillColor(NAVY)
    c.drawString(MARGIN + 278, y - 23, "下一阶段 L2.5 / L3")
    draw_bullets(c, [
        "run/action 审计表与独立物化接口；",
        "真实人群/商品范围结算执行；",
        "曝光、归因、自动暂停与回滚；",
        "增量测量与策略学习建议。",
    ], MARGIN + 278, y - 47, PAGE_W - MARGIN - (MARGIN + 278) - 14, size=8.2, gap=2, bullet_color=NAVY)
    y -= 170
    rounded_box(c, MARGIN, y - 118, PAGE_W - 2 * MARGIN, 118, MINT)
    c.setFont(FONT_NAME, 12)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, y - 27, "售前核心表达")
    draw_wrapped(c, "我们卖的不是 AI 写文案，而是让企业拥有一个能理解经营目标、调用现有营销中心、遵守预算与库存约束、接受人工审批，并用对照实验证明增量价值的营销执行体系。", MARGIN + 14, y - 55, PAGE_W - 2 * MARGIN - 28, size=9.5, color=GREEN, leading=15)
    y -= 142
    draw_wrapped(c, "模拟数据与复现脚本：docs/community-marketing-agent-simulation.md / scripts/simulate-community-marketing-agent.mjs", MARGIN, y, PAGE_W - 2 * MARGIN, size=8, color=MUTED)
    new_page(c, 12, "社区团购营销 Agent 方法论")
    c.save()


def main() -> None:
    register_font()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    generate_casebook(data)
    generate_methodology(data)
    print(CASEBOOK_PATH)
    print(METHODOLOGY_PATH)


if __name__ == "__main__":
    main()
