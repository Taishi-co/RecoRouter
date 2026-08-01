#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const jsonOutputPath = resolve(
  projectRoot,
  'docs/data/community-marketing-agent-simulation.json',
)
const markdownOutputPath = resolve(
  projectRoot,
  'docs/community-marketing-agent-simulation.md',
)

const CONFIG = Object.freeze({
  modelVersion: '1.0.0',
  simulationDate: '2026-08-01',
  seed: 20260801,
  iterations: 50_000,
  experiment: {
    durationDays: 28,
    arms: 3,
    clustersPerArm: 300,
    averageEligibleUsersPerCluster: 180,
    clusterSizeCoefficientOfVariation: 0.25,
    conversionIntraclusterCorrelation: 0.018,
    orderIntraclusterCorrelation: 0.012,
  },
  baseline: {
    paidConversionRate: { mean: 0.09, trialStandardDeviation: 0.005 },
    ordersPerPaidUser: { mean: 1.24, trialStandardDeviation: 0.03 },
    averageOrderValueYuan: { mean: 51, trialStandardDeviation: 1.5 },
    contributionMarginRate: { mean: 0.215, trialStandardDeviation: 0.012 },
    individualOrderValueStandardDeviationYuan: 16,
    orderCountOverdispersion: 1.25,
  },
  arms: {
    control: {
      label: '现状对照',
      description: '保持当前商品、触达和权益策略，不增加本次试点营销费用。',
      conversionRelativeLift: { mean: 0, standardDeviation: 0 },
      ordersPerPaidUserRelativeLift: { mean: 0, standardDeviation: 0 },
      averageOrderValueRelativeLift: { mean: 0, standardDeviation: 0 },
      targetedUserShare: { mean: 0, standardDeviation: 0 },
      redemptionRateAmongTargeted: { mean: 0, standardDeviation: 0 },
      subsidyPerRedemptionYuan: { mean: 0, standardDeviation: 0 },
      fixedCampaignCostYuan: { mean: 0, standardDeviation: 0 },
      channelCostPerTargetedUserYuan: 0,
    },
    manual: {
      label: '人工营销',
      description: '运营人员按经验统一选品、圈人、发券和搭建活动。',
      conversionRelativeLift: { mean: 0.09, standardDeviation: 0.04 },
      ordersPerPaidUserRelativeLift: { mean: 0.025, standardDeviation: 0.018 },
      averageOrderValueRelativeLift: { mean: -0.004, standardDeviation: 0.007 },
      targetedUserShare: { mean: 0.22, standardDeviation: 0.02 },
      redemptionRateAmongTargeted: { mean: 0.055, standardDeviation: 0.009 },
      subsidyPerRedemptionYuan: { mean: 4.2, standardDeviation: 0.35 },
      fixedCampaignCostYuan: { mean: 5_000, standardDeviation: 650 },
      channelCostPerTargetedUserYuan: 0.035,
    },
    agent: {
      label: 'Agent 营销',
      description:
        'Agent 在预算、毛利、库存和频控约束下联合优化选品、人群、权益、活动与会场，执行前仍需人工审批。',
      conversionRelativeLift: { mean: 0.18, standardDeviation: 0.055 },
      ordersPerPaidUserRelativeLift: { mean: 0.055, standardDeviation: 0.022 },
      averageOrderValueRelativeLift: { mean: -0.002, standardDeviation: 0.006 },
      targetedUserShare: { mean: 0.16, standardDeviation: 0.015 },
      redemptionRateAmongTargeted: { mean: 0.06, standardDeviation: 0.009 },
      subsidyPerRedemptionYuan: { mean: 3.8, standardDeviation: 0.3 },
      fixedCampaignCostYuan: { mean: 7_500, standardDeviation: 850 },
      channelCostPerTargetedUserYuan: 0.025,
    },
  },
})

function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function createNormalSampler(random) {
  let spare = null
  return (mean = 0, standardDeviation = 1) => {
    if (standardDeviation === 0) return mean
    if (spare !== null) {
      const value = spare
      spare = null
      return mean + value * standardDeviation
    }

    let first = 0
    let second = 0
    let radiusSquared = 0
    do {
      first = random() * 2 - 1
      second = random() * 2 - 1
      radiusSquared = first * first + second * second
    } while (radiusSquared === 0 || radiusSquared >= 1)

    const multiplier = Math.sqrt((-2 * Math.log(radiusSquared)) / radiusSquared)
    spare = second * multiplier
    return mean + first * multiplier * standardDeviation
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function sampleAssumption(normal, assumption, minimum, maximum) {
  return clamp(
    normal(assumption.mean, assumption.standardDeviation),
    minimum,
    maximum,
  )
}

function quantile(sortedValues, probability) {
  if (sortedValues.length === 0) return null
  const index = (sortedValues.length - 1) * probability
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedValues[lower]
  return (
    sortedValues[lower] * (upper - index) +
    sortedValues[upper] * (index - lower)
  )
}

function summarize(values, digits = 4) {
  const finiteValues = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (finiteValues.length === 0) {
    return { mean: null, p10: null, p50: null, p90: null, sampleCount: 0 }
  }
  const round = (value) => Number(value.toFixed(digits))
  return {
    mean: round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length),
    p10: round(quantile(finiteValues, 0.1)),
    p50: round(quantile(finiteValues, 0.5)),
    p90: round(quantile(finiteValues, 0.9)),
    sampleCount: finiteValues.length,
  }
}

function createMetricStore() {
  return {
    eligibleUsers: [],
    paidConversionRate: [],
    paidConversionLiftPercentagePoints: [],
    incrementalPaidUsers: [],
    incrementalOrders: [],
    incrementalGmvYuan: [],
    campaignCostYuan: [],
    costPerIncrementalPaidUserYuan: [],
    roi: [],
    positiveRoiCount: 0,
    positiveIncrementalPaidUsersCount: 0,
  }
}

function simulateObservedArm({
  arm,
  armKey,
  baseConversion,
  baseOrdersPerPaidUser,
  baseAverageOrderValue,
  normal,
}) {
  const { experiment } = CONFIG
  const expectedUsers =
    experiment.clustersPerArm * experiment.averageEligibleUsersPerCluster
  const clusterSizeStandardDeviation =
    Math.sqrt(experiment.clustersPerArm) *
    experiment.averageEligibleUsersPerCluster *
    experiment.clusterSizeCoefficientOfVariation
  const eligibleUsers = Math.max(
    1,
    Math.round(normal(expectedUsers, clusterSizeStandardDeviation)),
  )

  const conversionLift = sampleAssumption(
    normal,
    arm.conversionRelativeLift,
    -0.08,
    0.4,
  )
  const expectedConversionRate = clamp(baseConversion * (1 + conversionLift), 0.005, 0.6)
  const conversionDesignEffect =
    1 +
    (experiment.averageEligibleUsersPerCluster - 1) *
      experiment.conversionIntraclusterCorrelation
  const conversionSamplingError = Math.sqrt(
    (expectedConversionRate * (1 - expectedConversionRate) * conversionDesignEffect) /
      eligibleUsers,
  )
  const paidConversionRate = clamp(
    normal(expectedConversionRate, conversionSamplingError),
    0,
    1,
  )
  const paidUsers = Math.round(eligibleUsers * paidConversionRate)

  const ordersPerPaidUserLift = sampleAssumption(
    normal,
    arm.ordersPerPaidUserRelativeLift,
    -0.08,
    0.2,
  )
  const expectedOrders = Math.max(
    paidUsers,
    paidUsers * baseOrdersPerPaidUser * (1 + ordersPerPaidUserLift),
  )
  const orderDesignEffect =
    1 +
    (experiment.averageEligibleUsersPerCluster - 1) *
      experiment.orderIntraclusterCorrelation
  const observedOrders = Math.max(
    paidUsers,
    Math.round(
      normal(
        expectedOrders,
        Math.sqrt(
          expectedOrders * CONFIG.baseline.orderCountOverdispersion * orderDesignEffect,
        ),
      ),
    ),
  )

  const averageOrderValueLift = sampleAssumption(
    normal,
    arm.averageOrderValueRelativeLift,
    -0.05,
    0.05,
  )
  const expectedAverageOrderValue = Math.max(
    1,
    baseAverageOrderValue * (1 + averageOrderValueLift),
  )
  const observedAverageOrderValue = Math.max(
    1,
    normal(
      expectedAverageOrderValue,
      (CONFIG.baseline.individualOrderValueStandardDeviationYuan *
        Math.sqrt(orderDesignEffect)) /
        Math.sqrt(Math.max(1, observedOrders)),
    ),
  )
  const gmvYuan = observedOrders * observedAverageOrderValue

  let campaignCostYuan = 0
  if (armKey !== 'control') {
    const targetedUserShare = sampleAssumption(
      normal,
      arm.targetedUserShare,
      0.03,
      0.5,
    )
    const redemptionRate = sampleAssumption(
      normal,
      arm.redemptionRateAmongTargeted,
      0.005,
      0.2,
    )
    const subsidyPerRedemption = sampleAssumption(
      normal,
      arm.subsidyPerRedemptionYuan,
      0.5,
      10,
    )
    const fixedCost = sampleAssumption(
      normal,
      arm.fixedCampaignCostYuan,
      500,
      20_000,
    )
    const targetedUsers = eligibleUsers * targetedUserShare
    const redemptions = Math.max(
      0,
      normal(
        targetedUsers * redemptionRate,
        Math.sqrt(targetedUsers * redemptionRate * (1 - redemptionRate)),
      ),
    )
    campaignCostYuan =
      fixedCost +
      redemptions * subsidyPerRedemption +
      targetedUsers * arm.channelCostPerTargetedUserYuan
  }

  return {
    eligibleUsers,
    paidUsers,
    paidConversionRate: paidUsers / eligibleUsers,
    orders: observedOrders,
    gmvYuan,
    campaignCostYuan,
  }
}

function runSimulation() {
  const random = createRandom(CONFIG.seed)
  const normal = createNormalSampler(random)
  const stores = Object.fromEntries(
    Object.keys(CONFIG.arms).map((armKey) => [armKey, createMetricStore()]),
  )

  for (let iteration = 0; iteration < CONFIG.iterations; iteration += 1) {
    const baseConversion = clamp(
      normal(
        CONFIG.baseline.paidConversionRate.mean,
        CONFIG.baseline.paidConversionRate.trialStandardDeviation,
      ),
      0.06,
      0.13,
    )
    const baseOrdersPerPaidUser = clamp(
      normal(
        CONFIG.baseline.ordersPerPaidUser.mean,
        CONFIG.baseline.ordersPerPaidUser.trialStandardDeviation,
      ),
      1.05,
      1.5,
    )
    const baseAverageOrderValue = clamp(
      normal(
        CONFIG.baseline.averageOrderValueYuan.mean,
        CONFIG.baseline.averageOrderValueYuan.trialStandardDeviation,
      ),
      42,
      62,
    )
    const contributionMarginRate = clamp(
      normal(
        CONFIG.baseline.contributionMarginRate.mean,
        CONFIG.baseline.contributionMarginRate.trialStandardDeviation,
      ),
      0.16,
      0.27,
    )

    const observations = Object.fromEntries(
      Object.entries(CONFIG.arms).map(([armKey, arm]) => [
        armKey,
        simulateObservedArm({
          arm,
          armKey,
          baseConversion,
          baseOrdersPerPaidUser,
          baseAverageOrderValue,
          normal,
        }),
      ]),
    )
    const control = observations.control
    const controlOrdersPerEligibleUser = control.orders / control.eligibleUsers
    const controlGmvPerEligibleUser = control.gmvYuan / control.eligibleUsers

    for (const [armKey, observation] of Object.entries(observations)) {
      const store = stores[armKey]
      const incrementalPaidUsers =
        observation.paidUsers - control.paidConversionRate * observation.eligibleUsers
      const incrementalOrders =
        observation.orders - controlOrdersPerEligibleUser * observation.eligibleUsers
      const incrementalGmvYuan =
        observation.gmvYuan - controlGmvPerEligibleUser * observation.eligibleUsers
      const incrementalContributionYuan = incrementalGmvYuan * contributionMarginRate
      const roi =
        armKey === 'control'
          ? Number.NaN
          : (incrementalContributionYuan - observation.campaignCostYuan) /
            observation.campaignCostYuan
      const costPerIncrementalPaidUserYuan =
        armKey !== 'control' && incrementalPaidUsers > 0
          ? observation.campaignCostYuan / incrementalPaidUsers
          : Number.NaN

      store.eligibleUsers.push(observation.eligibleUsers)
      store.paidConversionRate.push(observation.paidConversionRate)
      store.paidConversionLiftPercentagePoints.push(
        (observation.paidConversionRate - control.paidConversionRate) * 100,
      )
      store.incrementalPaidUsers.push(
        armKey === 'control' ? 0 : incrementalPaidUsers,
      )
      store.incrementalOrders.push(armKey === 'control' ? 0 : incrementalOrders)
      store.incrementalGmvYuan.push(armKey === 'control' ? 0 : incrementalGmvYuan)
      store.campaignCostYuan.push(observation.campaignCostYuan)
      store.costPerIncrementalPaidUserYuan.push(costPerIncrementalPaidUserYuan)
      store.roi.push(roi)
      if (roi > 0) store.positiveRoiCount += 1
      if (incrementalPaidUsers > 0) store.positiveIncrementalPaidUsersCount += 1
    }
  }

  return Object.fromEntries(
    Object.entries(stores).map(([armKey, store]) => {
      const isControl = armKey === 'control'
      return [
        armKey,
        {
          label: CONFIG.arms[armKey].label,
          description: CONFIG.arms[armKey].description,
          metrics: {
            eligibleUsers: { unit: 'users', ...summarize(store.eligibleUsers, 0) },
            paidConversionRate: {
              unit: 'rate',
              ...summarize(store.paidConversionRate, 6),
            },
            paidConversionLiftPercentagePoints: {
              unit: 'percentage_points',
              ...summarize(store.paidConversionLiftPercentagePoints, 4),
            },
            incrementalPaidUsers: {
              unit: 'users',
              ...summarize(store.incrementalPaidUsers, 1),
            },
            incrementalOrders: {
              unit: 'orders',
              ...summarize(store.incrementalOrders, 1),
            },
            incrementalGmvYuan: {
              unit: 'CNY',
              ...summarize(store.incrementalGmvYuan, 2),
            },
            campaignCostYuan: {
              unit: 'CNY',
              ...summarize(store.campaignCostYuan, 2),
            },
            costPerIncrementalPaidUserYuan: {
              unit: 'CNY_per_incremental_paid_user',
              ...summarize(store.costPerIncrementalPaidUserYuan, 2),
              note: isControl
                ? '对照组无增量营销成本，不计算。'
                : '仅在增量付费用户大于 0 的模拟轮次计算。',
            },
            roi: {
              unit: 'rate',
              ...summarize(store.roi, 6),
              formula:
                '(增量 GMV × 贡献毛利率 - 本次活动总成本) / 本次活动总成本',
            },
          },
          positiveRoiProbability: isControl
            ? null
            : Number((store.positiveRoiCount / CONFIG.iterations).toFixed(6)),
          positiveIncrementalPaidUsersProbability: isControl
            ? null
            : Number(
                (store.positiveIncrementalPaidUsersCount / CONFIG.iterations).toFixed(6),
              ),
        },
      ]
    }),
  )
}

function formatInteger(value) {
  return value === null ? '—' : Math.round(value).toLocaleString('zh-CN')
}

function formatYuan(value, digits = 0) {
  return value === null
    ? '—'
    : `¥${value.toLocaleString('zh-CN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}`
}

function formatPercent(value, digits = 1) {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`
}

function formatPercentagePoints(value, digits = 2) {
  return value === null ? '—' : `${value.toFixed(digits)}pp`
}

function interval(metric, formatter) {
  return `${formatter(metric.p50)}（P10 ${formatter(metric.p10)} / P90 ${formatter(metric.p90)}）`
}

function createMarkdown(result) {
  const { control, manual, agent } = result.arms
  const agentVersusManual = {
    conversionDifferencePercentagePoints:
      (agent.metrics.paidConversionRate.p50 - manual.metrics.paidConversionRate.p50) *
      100,
    incrementalPaidUsersDifference:
      agent.metrics.incrementalPaidUsers.p50 - manual.metrics.incrementalPaidUsers.p50,
    incrementalOrdersDifference:
      agent.metrics.incrementalOrders.p50 - manual.metrics.incrementalOrders.p50,
    incrementalGmvDifferenceYuan:
      agent.metrics.incrementalGmvYuan.p50 - manual.metrics.incrementalGmvYuan.p50,
    roiDifferencePercentagePoints:
      (agent.metrics.roi.p50 - manual.metrics.roi.p50) * 100,
  }

  const rows = Object.values(result.arms)
    .map((arm) => {
      const metrics = arm.metrics
      return `| ${arm.label} | ${interval(metrics.paidConversionRate, (value) => formatPercent(value, 2))} | ${interval(metrics.incrementalPaidUsers, formatInteger)} | ${interval(metrics.incrementalOrders, formatInteger)} | ${interval(metrics.incrementalGmvYuan, formatYuan)} | ${interval(metrics.costPerIncrementalPaidUserYuan, formatYuan)} | ${interval(metrics.roi, formatPercent)} | ${formatPercent(arm.positiveRoiProbability)} |`
    })
    .join('\n')

  return `# 社区团购营销 Agent 三臂模拟实验

> **重要声明：以下全部结果来自固定参数的 Monte Carlo 模拟，不是客户实绩，不是收益承诺，也不能代替客户自己的随机对照试验。**

- 模拟版本：${CONFIG.modelVersion}
- 固定随机种子：${CONFIG.seed}
- Monte Carlo 次数：${CONFIG.iterations.toLocaleString('zh-CN')}
- 实验周期：${CONFIG.experiment.durationDays} 天

## 1. 实验问题

在相同市场环境和用户规模下，对比三种经营方式：

1. **现状对照：**维持当前商品、触达和权益策略；
2. **人工营销：**由运营按经验统一选品、圈人、发券和搭活动；
3. **Agent 营销：**由 Agent 在库存、毛利、预算和频控约束下联合优化，所有执行动作仍经人工审批。

模拟回答的是：在这些透明假设成立时，三组的增量付费用户、订单、GMV 和 ROI 可能落在哪个范围。它不能证明 Agent 已经在真实客户中产生这些收益。

## 2. 实验设计

- 随机化单位：社区簇，降低同一微信群、团长或自提点之间的信息污染；
- 每臂 ${CONFIG.experiment.clustersPerArm} 个社区，平均每社区 ${CONFIG.experiment.averageEligibleUsersPerCluster} 名合规可触达用户；
- 每臂约 ${(CONFIG.experiment.clustersPerArm * CONFIG.experiment.averageEligibleUsersPerCluster).toLocaleString('zh-CN')} 人，三臂合计约 ${(CONFIG.experiment.arms * CONFIG.experiment.clustersPerArm * CONFIG.experiment.averageEligibleUsersPerCluster).toLocaleString('zh-CN')} 人；
- 社区规模变异系数 ${formatPercent(CONFIG.experiment.clusterSizeCoefficientOfVariation, 0)}；
- 付费转化率组内相关系数 ICC = ${CONFIG.experiment.conversionIntraclusterCorrelation}，订单 ICC = ${CONFIG.experiment.orderIntraclusterCorrelation}；
- 每轮同时抽取市场基线、社区簇抽样误差、策略响应、客单价和成本波动；
- 所有增量指标均以当轮同期对照组按用户规模归一后计算。

## 3. 透明假设

### 3.1 基线经营假设

| 参数 | 中心值 | 每轮不确定性 | 说明 |
|---|---:|---:|---|
| 28 天付费转化率 | ${formatPercent(CONFIG.baseline.paidConversionRate.mean)} | 标准差 ${formatPercentagePoints(CONFIG.baseline.paidConversionRate.trialStandardDeviation * 100)} | 需要用客户历史数据替换 |
| 每付费用户订单数 | ${CONFIG.baseline.ordersPerPaidUser.mean.toFixed(2)} | 标准差 ${CONFIG.baseline.ordersPerPaidUser.trialStandardDeviation.toFixed(2)} | 同一周期内复购 |
| 平均客单价 | ${formatYuan(CONFIG.baseline.averageOrderValueYuan.mean)} | 标准差 ${formatYuan(CONFIG.baseline.averageOrderValueYuan.trialStandardDeviation)} | 每轮共同市场波动 |
| 贡献毛利率 | ${formatPercent(CONFIG.baseline.contributionMarginRate.mean)} | 标准差 ${formatPercent(CONFIG.baseline.contributionMarginRate.trialStandardDeviation)} | 商品收入扣除采购、履约等变动成本，尚未扣本次营销成本 |

### 3.2 策略效果与成本假设

| 参数 | 人工营销 | Agent 营销 | 采用理由与边界 |
|---|---:|---:|---|
| 付费转化相对提升 | 均值 ${formatPercent(CONFIG.arms.manual.conversionRelativeLift.mean)}，标准差 ${formatPercent(CONFIG.arms.manual.conversionRelativeLift.standardDeviation)} | 均值 ${formatPercent(CONFIG.arms.agent.conversionRelativeLift.mean)}，标准差 ${formatPercent(CONFIG.arms.agent.conversionRelativeLift.standardDeviation)} | 是待验证先验，不是已实现效果；Agent 假设受益于选品、人群、权益和会场联合优化 |
| 每付费用户订单数相对提升 | ${formatPercent(CONFIG.arms.manual.ordersPerPaidUserRelativeLift.mean)} | ${formatPercent(CONFIG.arms.agent.ordersPerPaidUserRelativeLift.mean)} | 反映组合购与复购，不计 28 天后的长期价值 |
| 客单价相对变化 | ${formatPercent(CONFIG.arms.manual.averageOrderValueRelativeLift.mean)} | ${formatPercent(CONFIG.arms.agent.averageOrderValueRelativeLift.mean)} | 考虑优惠导致的轻微稀释，不假设客单价暴涨 |
| 被定向用户比例 | ${formatPercent(CONFIG.arms.manual.targetedUserShare.mean)} | ${formatPercent(CONFIG.arms.agent.targetedUserShare.mean)} | Agent 用更窄人群减少自然订单补贴 |
| 定向人群核销率 | ${formatPercent(CONFIG.arms.manual.redemptionRateAmongTargeted.mean)} | ${formatPercent(CONFIG.arms.agent.redemptionRateAmongTargeted.mean)} | 只用于估算补贴成本，核销本身不是成功指标 |
| 单次核销补贴 | ${formatYuan(CONFIG.arms.manual.subsidyPerRedemptionYuan.mean, 2)} | ${formatYuan(CONFIG.arms.agent.subsidyPerRedemptionYuan.mean, 2)} | 由平台承担的平均权益成本 |
| 试点固定成本 | ${formatYuan(CONFIG.arms.manual.fixedCampaignCostYuan.mean)} | ${formatYuan(CONFIG.arms.agent.fixedCampaignCostYuan.mean)} | 人工含策划/搭建；Agent 含平台、推理、监控及人工审批成本 |
| 单个定向用户渠道成本 | ${formatYuan(CONFIG.arms.manual.channelCostPerTargetedUserYuan, 3)} | ${formatYuan(CONFIG.arms.agent.channelCostPerTargetedUserYuan, 3)} | 短信、素材分摊或团长触达等变动成本 |

Agent 的先验值有意保持在可被真实 A/B 测试证伪的范围，没有假设转化翻倍、零成本获客或无限库存。正式售前应先用客户近 8—12 周基线替换本表，再运行脚本。

## 4. 结果

表格统一展示中位数 P50，并在括号中给出 P10 / P90。P10—P90 是模型不确定区间，不是统计置信区间。

| 实验臂 | 付费转化率 | 增量付费用户 | 增量订单 | 增量 GMV | 每增量付费用户成本 | ROI | 正 ROI 概率 |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows}

其中：

- ROI =（增量 GMV × 贡献毛利率 − 本次活动总成本）÷ 本次活动总成本；
- 增量付费用户成本也可称增量 CAC；仅在当轮增量付费用户大于 0 时计算；
- 对照组没有本次增量营销成本，因此 ROI、增量 CAC 和正 ROI 概率不适用；
- 增量付费用户、增量订单和增量 GMV 允许在低分位为负，这是实验风险，不应隐藏。

## 5. Agent 相对人工营销的模拟差异

按各自 P50 做描述性比较：

- 付费转化率高 ${formatPercentagePoints(agentVersusManual.conversionDifferencePercentagePoints)}；
- 增量付费用户多约 ${formatInteger(agentVersusManual.incrementalPaidUsersDifference)} 人；
- 增量订单多约 ${formatInteger(agentVersusManual.incrementalOrdersDifference)} 单；
- 增量 GMV 多约 ${formatYuan(agentVersusManual.incrementalGmvDifferenceYuan)}；
- ROI 高约 ${formatPercentagePoints(agentVersusManual.roiDifferencePercentagePoints)}。

这组差异来自脚本中的效果先验，不是 Agent 的固有属性。真实试点如果没有足够的数据质量、库存、履约能力、触达授权或运营审批，结果可能显著更差。

## 6. 如何用于客户试点

1. 用客户自己的社区规模、历史转化、客单价、贡献毛利、券成本和履约成本替换默认参数；
2. 先锁定一项主指标，例如“每社区 28 天增量贡献利润”，其他指标作为护栏；
3. 按社区/团长簇随机分配三臂，避免同群用户交叉污染；
4. 实验期间固定统计口径，记录缺货、退款、投诉、取消关注和履约超时；
5. 预先声明停止规则，不因中途数据好看而提前结束；
6. 最终用真实对照差异替换模拟先验，并按社区分层报告不确定性。

## 7. 模型未覆盖的风险

- 团长跨社区传播、用户跨社区下单等网络干扰；
- 极端天气、节假日、竞品补贴和供应中断；
- SKU 级缺货替代、退款、售后和 28 天后的留存价值；
- 不同社区、人群和商品之间更复杂的异质性；
- 模型上线后的策略漂移、人工审批延迟及执行偏差。

因此，本模拟适合做售前价值量级讨论、试点预算和实验设计，不适合单独作为采购回报承诺。

## 8. 复现

在项目根目录运行：

\`\`\`bash
node scripts/simulate-community-marketing-agent.mjs
\`\`\`

脚本不依赖第三方包，固定使用随机种子 ${CONFIG.seed}，将覆盖生成：

- \`docs/data/community-marketing-agent-simulation.json\`
- \`docs/community-marketing-agent-simulation.md\`

在 Node.js 版本和脚本内容不变时，重复运行结果应完全一致。
`
}

const arms = runSimulation()
const result = {
  disclaimer:
    '以下全部结果来自固定参数的 Monte Carlo 模拟，不是客户实绩，不是收益承诺，也不能代替客户自己的随机对照试验。',
  modelVersion: CONFIG.modelVersion,
  simulationDate: CONFIG.simulationDate,
  seed: CONFIG.seed,
  iterations: CONFIG.iterations,
  design: CONFIG.experiment,
  assumptions: {
    baseline: CONFIG.baseline,
    arms: CONFIG.arms,
  },
  metricDefinitions: {
    incrementalPaidUsers:
      '实验臂付费用户 - 同轮对照组付费转化率 × 实验臂合规可触达用户数',
    incrementalOrders:
      '实验臂订单数 - 同轮对照组人均订单数 × 实验臂合规可触达用户数',
    incrementalGmvYuan:
      '实验臂 GMV - 同轮对照组人均 GMV × 实验臂合规可触达用户数',
    roi: '(增量 GMV × 贡献毛利率 - 本次活动总成本) / 本次活动总成本',
    costPerIncrementalPaidUserYuan:
      '本次活动总成本 / 增量付费用户；仅在增量付费用户大于 0 的轮次计算',
  },
  arms,
}

mkdirSync(dirname(jsonOutputPath), { recursive: true })
writeFileSync(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
writeFileSync(markdownOutputPath, createMarkdown(result), 'utf8')

console.log(
  `Community marketing Agent simulation complete: ${CONFIG.iterations.toLocaleString('en-US')} iterations, seed ${CONFIG.seed}.`,
)
console.log(`JSON: ${jsonOutputPath}`)
console.log(`Markdown: ${markdownOutputPath}`)
