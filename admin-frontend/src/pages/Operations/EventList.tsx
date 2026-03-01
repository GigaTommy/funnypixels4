
import React, { useRef, useState } from 'react'
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import { Button, App, Modal, Tag, Space } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import SafeProTable from '@/components/SafeProTable'
import { eventService, Event } from '@/services'
import { useNavigate } from 'react-router-dom'

const EventList: React.FC = () => {
    const { message } = App.useApp()
    const actionRef = useRef<ActionType>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)

    const handleDelete = async (id: string) => {
        try {
            setLoading(true)
            await eventService.deleteEvent(id)
            message.success('删除成功')
            actionRef.current?.reload()
        } catch (error) {
            message.error('删除失败')
        } finally {
            setLoading(false)
        }
    }

    const columns: ProColumns<Event>[] = [
        {
            title: '活动名称',
            dataIndex: 'title',
            copyable: true,
            ellipsis: true,
            formItemProps: {
                rules: [{ required: true, message: '此项为必填项' }],
            },
        },
        {
            title: '类型',
            dataIndex: 'type',
            valueEnum: {
                leaderboard: { text: '排行榜冲刺', status: 'Processing' },
                territory_control: { text: '领地争夺', status: 'Error' },
                cooperation: { text: '全服共建', status: 'Success' },
            },
        },
        {
            title: '开始时间',
            dataIndex: 'start_time',
            valueType: 'dateTime',
            sorter: true,
            hideInSearch: true,
        },
        {
            title: '结束时间',
            dataIndex: 'end_time',
            valueType: 'dateTime',
            sorter: true,
            hideInSearch: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
                draft: { text: '草稿', status: 'Default' },
                published: { text: '已发布', status: 'Processing' },
                active: { text: '进行中', status: 'Success' },
                ended: { text: '已结束', status: 'Error' },
            },
        },
        {
            title: '操作',
            valueType: 'option',
            render: (text, record, _, action) => [
                <a
                    key="edit"
                    onClick={() => {
                        navigate(`/operations/events/edit/${record.id}`)
                    }}
                >
                    <EditOutlined /> 编辑
                </a>,
                <a
                    key="clone"
                    onClick={() => {
                        navigate(`/operations/events/create?cloneId=${record.id}`)
                    }}
                >
                    <CopyOutlined /> 克隆
                </a>,
                <a
                    key="delete"
                    style={{ color: 'red' }}
                    onClick={() => {
                        Modal.confirm({
                            title: '确认删除',
                            content: '确定要删除这个活动吗？',
                            onOk: () => handleDelete(record.id),
                        })
                    }}
                >
                    <DeleteOutlined /> 删除
                </a>,
            ],
        },
    ]

    return (
        <SafeProTable
            headerTitle="活动列表"
            actionRef={actionRef}
            rowKey="id"
            search={{
                labelWidth: 120,
            }}
            toolBarRender={() => [
                <Button
                    type="primary"
                    key="primary"
                    onClick={() => {
                        navigate('/operations/events/create')
                    }}
                >
                    <PlusOutlined /> 新建活动
                </Button>,
            ]}
            request={async (params, sort, filter) => {
                try {
                    const response = await eventService.getEvents({
                        current: params.current,
                        pageSize: params.pageSize,
                        status: params.status as string,
                    })

                    const data = response
                    return {
                        data: data.list,
                        success: true,
                        total: data.total,
                    }
                } catch (error) {
                    return {
                        data: [],
                        success: false,
                        total: 0,
                    }
                }
            }}
            columns={columns}
        />
    )
}

export default EventList
