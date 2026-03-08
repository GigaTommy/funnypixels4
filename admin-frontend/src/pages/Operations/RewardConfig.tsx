import React, { useState, useEffect, useCallback } from 'react'
import { Card, InputNumber, Button, Spin, message, Space, Typography } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { rewardConfigService, RewardConfigItem } from '@/services/rewardConfig'

const { Title, Text } = Typography

/** Helper: build a key→value map from config list */
function toMap(items: RewardConfigItem[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const item of items) {
    m[item.config_key] = Number(item.config_value) || 0
  }
  return m
}

const DEFAULTS: Record<string, number> = {
  'reward_config.share_points': 5,
  'reward_config.share_daily_cap': 10,
  'reward_config.daily_bonus_points': 50,
  'rate_limit.reward_claim_max': 30,
  'reconciliation.drift_critical_threshold': 1000,
  'reconciliation.users_warning_threshold': 10,
}

const RewardConfig: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, number>>({ ...DEFAULTS })

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const items = await rewardConfigService.getAll()
      const map = toMap(items)
      setValues(prev => ({ ...prev, ...map }))
    } catch {
      message.error('Failed to load configs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const handleSave = async (groupKey: string, keys: string[]) => {
    setSaving(groupKey)
    try {
      const configs: Record<string, number> = {}
      for (const k of keys) {
        configs[k] = values[k] ?? DEFAULTS[k]
      }
      await rewardConfigService.update(configs)
      await rewardConfigService.refreshCache()
      message.success('Saved & cache refreshed')
    } catch {
      message.error('Save failed')
    } finally {
      setSaving(null)
    }
  }

  const set = (key: string, val: number | null) => {
    setValues(prev => ({ ...prev, [key]: val ?? 0 }))
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Reward Config</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchConfigs}>Refresh</Button>
      </div>

      {/* Card 1: Reward Points */}
      <Card
        title="Reward Points"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving === 'reward'}
            onClick={() => handleSave('reward', [
              'reward_config.share_points',
              'reward_config.share_daily_cap',
              'reward_config.daily_bonus_points',
            ])}
          >
            Save
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>Share Reward</Text>
              <br />
              <Text type="secondary">Points per share action</Text>
            </div>
            <InputNumber
              min={0}
              max={100}
              value={values['reward_config.share_points']}
              onChange={v => set('reward_config.share_points', v)}
              style={{ width: 120 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>Share Daily Cap</Text>
              <br />
              <Text type="secondary">Max share rewards per day</Text>
            </div>
            <InputNumber
              min={1}
              max={100}
              value={values['reward_config.share_daily_cap']}
              onChange={v => set('reward_config.share_daily_cap', v)}
              style={{ width: 120 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>Daily Bonus Points</Text>
              <br />
              <Text type="secondary">Bonus for completing all daily tasks</Text>
            </div>
            <InputNumber
              min={0}
              max={500}
              value={values['reward_config.daily_bonus_points']}
              onChange={v => set('reward_config.daily_bonus_points', v)}
              style={{ width: 120 }}
            />
          </div>
        </Space>
      </Card>

      {/* Card 2: Rate Limit */}
      <Card
        title="Rate Limit"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving === 'rate'}
            onClick={() => handleSave('rate', ['rate_limit.reward_claim_max'])}
          >
            Save
          </Button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text strong>Reward Claim Rate Limit</Text>
            <br />
            <Text type="secondary">Max requests per user per minute</Text>
          </div>
          <InputNumber
            min={5}
            max={200}
            value={values['rate_limit.reward_claim_max']}
            onChange={v => set('rate_limit.reward_claim_max', v)}
            style={{ width: 120 }}
            addonAfter="/min"
          />
        </div>
      </Card>

      {/* Card 3: Reconciliation */}
      <Card
        title="Reconciliation Thresholds"
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving === 'recon'}
            onClick={() => handleSave('recon', [
              'reconciliation.drift_critical_threshold',
              'reconciliation.users_warning_threshold',
            ])}
          >
            Save
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>Critical Drift Threshold</Text>
              <br />
              <Text type="secondary">Total points drift above which alert is critical</Text>
            </div>
            <InputNumber
              min={100}
              value={values['reconciliation.drift_critical_threshold']}
              onChange={v => set('reconciliation.drift_critical_threshold', v)}
              style={{ width: 120 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>Users Warning Threshold</Text>
              <br />
              <Text type="secondary">Number of mismatched users above which alert is warning</Text>
            </div>
            <InputNumber
              min={1}
              value={values['reconciliation.users_warning_threshold']}
              onChange={v => set('reconciliation.users_warning_threshold', v)}
              style={{ width: 120 }}
            />
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default RewardConfig
