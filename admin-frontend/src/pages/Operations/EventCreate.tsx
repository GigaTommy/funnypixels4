
import React, { useState, useEffect } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import { ProForm, ProFormText, ProFormSelect, ProFormDateTimeRangePicker, ProFormDateTimePicker, ProFormTextArea, ProFormDigit, ProFormGroup, ProFormList, ProFormUploadButton } from '@ant-design/pro-components'
import { Card, App } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { eventService } from '@/services'
import RegionSelector from '@/components/Event/RegionSelector'
import dayjs from 'dayjs'

const EventCreate: React.FC = () => {
    const { message } = App.useApp()
    const navigate = useNavigate()
    const params = useParams<{ id: string }>()
    const [searchParams] = useSearchParams();
    const cloneId = searchParams.get('cloneId');

    const isEdit = !!params.id
    const [loading, setLoading] = useState(false)
    const [form] = ProForm.useForm()

    // Get Token for Upload
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');

    useEffect(() => {
        if (isEdit && params.id) {
            loadEvent(params.id)
        } else if (cloneId) {
            loadEvent(cloneId, true)
        }
    }, [params.id, cloneId])

    const loadEvent = async (id: string, isClone: boolean = false) => {
        try {
            setLoading(true)
            const data = await eventService.getEvent(id)

            // If cloning, modify specific fields
            if (isClone) {
                data.title = `${data.title} (副本)`;
                data.status = 'draft';
                // Reset times if needed, or keep them
                data.publish_time = undefined;
                data.signup_end_time = undefined;
            }

            form.setFieldsValue({
                ...data,
                dateRange: data.start_time ? [data.start_time, data.end_time] : undefined,
                publish_time: data.publish_time,
                signup_end_time: data.signup_end_time,
                // Boundary is now passed as object to EventMap
                boundary: typeof data.boundary === 'string' ? JSON.parse(data.boundary) : data.boundary,
                // Config fields extraction
                min_level: data.config?.rules?.min_level,
                cost_amount: data.config?.rules?.cost?.amount,
                cost_currency: data.config?.rules?.cost?.currency,

                config_raw: typeof data.config === 'string' ? data.config : JSON.stringify({ ...data.config, rewards: undefined, rules: undefined }, null, 2),

                ranking_rewards: data.config?.rewards?.rankingRewards?.map((r: any) => ({
                    ...r,
                    rewards_points: r.rewards.points,
                    rewards_pixels: r.rewards.pixels,
                    rewards_flag: r.rewards.exclusiveFlag,
                })) || [],
                // Banner handling
                banner_url: data.banner_url ? [{
                    uid: '-1',
                    name: 'banner.png',
                    status: 'done',
                    url: data.banner_url,
                    response: { data: { imageUrl: data.banner_url } } // Mock response structure for ProForm
                }] : []
            })
        } catch (error) {
            message.error('加载活动详情失败')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (values: any) => {
        setLoading(true)
        try {
            // Process rewards
            const rankingRewards = values.ranking_rewards?.map((r: any) => ({
                rank_min: r.rank_min,
                rank_max: r.rank_max,
                target: r.target,
                rewards: {
                    points: r.rewards_points,
                    pixels: r.rewards_pixels,
                    exclusiveFlag: r.rewards_flag,
                }
            })) || [];

            const configRaw = values.config_raw ? JSON.parse(values.config_raw) : {};

            // Integrate Rules
            const rules = {
                min_level: values.min_level,
                cost: (values.cost_amount) ? {
                    amount: values.cost_amount,
                    currency: values.cost_currency || 'coins'
                } : undefined
            };

            const config = {
                ...configRaw,
                rules,
                rewards: {
                    rankingRewards
                }
            };

            // Banner URL extraction
            const bannerUrl = values.banner_url && values.banner_url.length > 0
                ? (values.banner_url[0].response?.data?.imageUrl || values.banner_url[0].url)
                : '';

            const payload = {
                title: values.title,
                description: values.description,
                type: values.type,
                banner_url: bannerUrl,
                start_time: values.dateRange[0],
                end_time: values.dateRange[1],
                publish_time: values.publish_time,
                signup_end_time: values.signup_end_time,
                status: values.status,
                // Boundary is already object from EventMap, no need to parse
                boundary: values.boundary ? values.boundary : null,
                config: config,
            }

            if (isEdit && params.id) {
                await eventService.updateEvent(params.id, payload)
                message.success('更新成功')
            } else {
                await eventService.createEvent(payload)
                message.success('创建成功')
            }
            navigate('/operations/events/list')
        } catch (error) {
            console.error(error)
            message.error(isEdit ? '更新失败' : '创建失败')
        } finally {
            setLoading(false)
        }
    }

    return (
        <PageContainer title={isEdit ? "编辑活动" : "新建活动"}>
            <Card>
                <ProForm
                    form={form}
                    onFinish={handleSubmit}
                    submitter={{
                        searchConfig: {
                            submitText: isEdit ? '更新活动' : '创建活动',
                        },
                        resetButtonProps: {
                            style: { display: 'none' },
                        },
                    }}
                    loading={loading}
                >
                    <ProFormGroup title="基础信息">
                        <ProFormText
                            name="title"
                            label="活动名称"
                            width="md"
                            placeholder="请输入活动名称"
                            rules={[{ required: true, message: '请输入活动名称' }]}
                        />
                        <ProFormSelect
                            name="type"
                            label="活动类型"
                            width="md"
                            valueEnum={{
                                leaderboard: '排行榜冲刺',
                                territory_control: '领地争夺',
                                cooperation: '全服共建',
                                war: '阵营大战'
                            }}
                            placeholder="请选择活动类型"
                            rules={[{ required: true, message: '请选择活动类型' }]}
                        />
                    </ProFormGroup>

                    <ProFormUploadButton
                        name="banner_url"
                        label="活动Banner"
                        max={1}
                        fieldProps={{
                            name: 'image',
                            listType: 'picture-card',
                            headers: {
                                Authorization: token ? `Bearer ${token}` : '',
                            }
                        }}
                        action="/api/images/upload"
                        extra="支持jpg/png/webp, 5MB以内"
                    />

                    <ProFormTextArea
                        name="description"
                        label="活动描述 (支持Markdown)"
                        placeholder="请输入详细描述，支持Markdown语法..."
                        fieldProps={{ rows: 4 }}
                    />

                    <ProFormGroup title="时间设置">
                        <ProFormDateTimeRangePicker
                            name="dateRange"
                            label="活动时间"
                            rules={[{ required: true, message: '请选择活动时间范围' }]}
                        />
                        <ProFormDateTimePicker
                            name="publish_time"
                            label="发布时间 (预热)"
                            tooltip="到达此时间后，状态若为draft则自动通过/变为Published，用户可见但不可游玩"
                        />
                        <ProFormDateTimePicker
                            name="signup_end_time"
                            label="报名截止时间"
                            tooltip="此时间后禁止新用户报名"
                        />
                    </ProFormGroup>

                    <ProFormGroup title="地理围栏配置">
                        <ProForm.Item
                            name="boundary"
                            label="活动区域"
                            rules={[{ required: true, message: '请选择或绘制活动区域' }]}
                            style={{ width: '100%' }}
                        >
                            <RegionSelector />
                        </ProForm.Item>
                    </ProFormGroup>

                    <ProFormGroup title="准入与规则">
                        <ProFormDigit
                            name="min_level"
                            label="最低等级限制"
                            width="xs"
                            min={0}
                            fieldProps={{ precision: 0 }}
                            tooltip="0为不限制"
                        />
                        <ProFormDigit
                            name="cost_amount"
                            label="报名费用"
                            width="xs"
                            min={0}
                            fieldProps={{ precision: 0 }}
                        />
                        <ProFormSelect
                            name="cost_currency"
                            label="货币类型"
                            width="xs"
                            valueEnum={{
                                coins: '金币',
                                gems: '钻石'
                            }}
                            initialValue="coins"
                        />
                        <ProFormSelect
                            name="status"
                            label="初始状态"
                            width="sm"
                            valueEnum={{
                                draft: '草稿',
                                published: '已发布 (预热)',
                                active: '进行中 (立即开始)',
                            }}
                            initialValue="draft"
                            rules={[{ required: true, message: '请选择状态' }]}
                        />
                    </ProFormGroup>

                    <ProFormTextArea
                        name="config_raw"
                        label="其他高级配置 (JSON)"
                        initialValue="{}"
                        placeholder="额外的高级配置参数..."
                        fieldProps={{
                            rows: 2,
                            style: { fontFamily: 'monospace' }
                        }}
                    />

                    <Card title="奖品配置 (自动兑付)" style={{ marginTop: 24, marginBottom: 24 }} size="small">
                        <ProFormList
                            name="ranking_rewards"
                            label="排名奖励"
                            initialValue={[
                                { rank_min: 1, rank_max: 1, target: 'alliance_members', rewards_points: 1000, rewards_flag: '' }
                            ]}
                            deleteIconProps={{ tooltipText: '删除此档位' }}
                        >
                            <ProFormGroup key="group">
                                <ProFormDigit
                                    name="rank_min"
                                    label="排名起"
                                    width="xs"
                                    min={1}
                                    rules={[{ required: true }]}
                                />
                                <ProFormDigit
                                    name="rank_max"
                                    label="排名止"
                                    width="xs"
                                    min={1}
                                    rules={[{ required: true }]}
                                />
                                <ProFormSelect
                                    name="target"
                                    label="发放对象"
                                    width="sm"
                                    options={[
                                        { label: '联盟全体成员', value: 'alliance_members' },
                                        { label: '仅盟主', value: 'alliance_leader' },
                                        { label: '个人(MVP)', value: 'user' },
                                    ]}
                                    rules={[{ required: true }]}
                                />
                            </ProFormGroup>
                            <ProFormGroup title="奖励内容">
                                <ProFormDigit
                                    name="rewards_points"
                                    label="积分奖励"
                                    width="xs"
                                    fieldProps={{ precision: 0 }}
                                />
                                <ProFormDigit
                                    name="rewards_pixels"
                                    label="像素点奖励"
                                    width="xs"
                                    fieldProps={{ precision: 0 }}
                                />
                                <ProFormText
                                    name="rewards_flag"
                                    label="专属旗帜ID"
                                    width="md"
                                    placeholder="输入旗帜资源ID"
                                />
                            </ProFormGroup>
                        </ProFormList>
                    </Card>
                </ProForm>
            </Card>
        </PageContainer>
    )
}

export default EventCreate
