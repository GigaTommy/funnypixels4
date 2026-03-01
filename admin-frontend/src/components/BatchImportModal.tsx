import React, { useState } from 'react';
import { Modal, Upload, Button, message, List, Card, Input, Select, Tag, Space, Row, Col, Progress, Spin, Alert } from 'antd';
import { InboxOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { patternService } from '@/services/pattern';

const { Dragger } = Upload;
const { Option } = Select;

interface AnalyzedPattern {
    fileId: string;
    file: File;
    status: 'pending' | 'analyzing' | 'success' | 'error';
    error?: string;
    data?: {
        name: string;
        category: string;
        render_type: string;
        color: string;
        unicode_char?: string;
        width: number;
        height: number;
        encoding: string;
        payload?: string;
        material_config?: any;
        preview_url?: string;
    };
}

interface BatchImportModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({ open, onCancel, onSuccess }) => {
    const [fileList, setFileList] = useState<AnalyzedPattern[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [uploading, setUploading] = useState(false);

    // 处理文件上传
    const handleUpload = async (options: any) => {
        const { file, onSuccess: uploadSuccess, onError } = options;
        const fileId = Math.random().toString(36).substr(2, 9);

        // 添加到列表
        const newItem: AnalyzedPattern = {
            fileId,
            file,
            status: 'pending'
        };

        setFileList(prev => [...prev, newItem]);

        // 开始分析
        try {
            setAnalyzing(true);
            // 更新状态为分析中
            setFileList(prev => prev.map(item =>
                item.fileId === fileId ? { ...item, status: 'analyzing' } : item
            ));

            const result = await patternService.analyzePattern(file);

            if (result.success && result.data) {
                setFileList(prev => prev.map(item =>
                    item.fileId === fileId ? {
                        ...item,
                        status: 'success',
                        data: {
                            key: `alliance_flag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique key with prefix
                            name: file.name.replace(/\.[^/.]+$/, ""), // 移除扩展名
                            category: 'alliance_flag', // Default to alliance_flag as per user request
                            render_type: 'complex', // Default to complex for image uploads
                            color: result.data.metadata?.dominantColors?.[0] || '#000000',
                            unicode_char: result.data.emojiVersion, // Optional
                            width: result.data.width || 64,
                            height: result.data.height || 64,
                            encoding: 'png_base64', // Ensure correct encoding for Material
                            payload: result.data.base64, // Use the base64 returned by backend
                            material_config: { base64: result.data.base64 }, // Critical for Material creation
                            preview_url: result.data.base64 // Use base64 for preview
                        }
                    } : item
                ));
                uploadSuccess(result);
            } else {
                throw new Error(result.message || '分析失败');
            }
        } catch (error: any) {
            setFileList(prev => prev.map(item =>
                item.fileId === fileId ? { ...item, status: 'error', error: error.message } : item
            ));
            onError(error);
        } finally {
            setAnalyzing(false);
        }
    };

    // 批量保存
    const handleSave = async () => {
        const validItems = fileList.filter(item => item.status === 'success' && item.data);

        if (validItems.length === 0) {
            message.warning('没有可导入的有效图案');
            return;
        }

        try {
            setUploading(true);
            const patternsToCreate = validItems.map(item => ({
                key: `pattern_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`,
                ...item.data
            }));

            const response = await patternService.batchCreatePatterns(patternsToCreate);

            if (response.success) {
                message.success(`成功导入 ${response.data.success} 个图案`);
                if (response.data.failed > 0) {
                    message.warning(`${response.data.failed} 个图案导入失败，请查看日志`);
                }
                onSuccess();
                setFileList([]);
            } else {
                message.error('批量导入失败');
            }
        } catch (error) {
            message.error('批量导入发生错误');
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    // 更新单个项目的字段
    const updateItemData = (fileId: string, field: string, value: any) => {
        setFileList(prev => prev.map(item => {
            if (item.fileId === fileId && item.data) {
                return {
                    ...item,
                    data: { ...item.data, [field]: value }
                };
            }
            return item;
        }));
    };

    // 移除项目
    const removeItem = (fileId: string) => {
        setFileList(prev => prev.filter(item => item.fileId !== fileId));
    };

    return (
        <Modal
            title="批量导入图案"
            open={open}
            onCancel={onCancel}
            width={1000}
            footer={[
                <Button key="cancel" onClick={onCancel}>取消</Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={uploading || analyzing}
                    onClick={handleSave}
                    disabled={fileList.filter(i => i.status === 'success').length === 0}
                >
                    导入全部 ({fileList.filter(i => i.status === 'success').length})
                </Button>
            ]}
        >
            <div style={{ marginBottom: 24 }}>
                <Dragger
                    customRequest={handleUpload}
                    showUploadList={false}
                    multiple
                    accept="image/*"
                    disabled={analyzing}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
                    <p className="ant-upload-hint">支持批量上传，系统将自动分析并生成预览</p>
                </Dragger>
            </div>

            <List
                grid={{ gutter: 16, column: 2 }}
                dataSource={fileList}
                renderItem={item => (
                    <List.Item>
                        <Card
                            size="small"
                            title={
                                <Space>
                                    {item.status === 'analyzing' && <Spin size="small" />}
                                    {item.status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                    {item.status === 'error' && <DeleteOutlined style={{ color: '#ff4d4f' }} />}
                                    <span style={{ fontSize: 13 }}>{item.file.name}</span>
                                </Space>
                            }
                            extra={
                                <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => removeItem(item.fileId)}
                                />
                            }
                            style={{
                                border: item.status === 'error' ? '1px solid #ff4d4f' : undefined
                            }}
                        >
                            {item.status === 'success' && item.data ? (
                                <Row gutter={12} align="middle">
                                    <Col span={6}>
                                        <div style={{
                                            width: 64,
                                            height: 64,
                                            backgroundImage: `url(${item.data.preview_url})`,
                                            backgroundSize: 'contain',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundColor: '#f5f5f5',
                                            border: '1px solid #eee',
                                            borderRadius: 4
                                        }} />
                                    </Col>
                                    <Col span={18}>
                                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                                            <Input
                                                placeholder="图案名称"
                                                value={item.data.name}
                                                onChange={(e) => updateItemData(item.fileId, 'name', e.target.value)}
                                                size="small"
                                            />
                                            <Space>
                                                <Select
                                                    value={item.data.category}
                                                    onChange={(v) => updateItemData(item.fileId, 'category', v)}
                                                    size="small"
                                                    style={{ width: 100 }}
                                                >
                                                    <Option value="alliance_flag">联盟旗帜</Option>
                                                    <Option value="user_pattern">用户图案</Option>
                                                    <Option value="system_pattern">系统图案</Option>
                                                    <Option value="emoji">表情</Option>
                                                </Select>
                                                <Tag color={item.data.render_type === 'complex' ? 'blue' : 'orange'}>
                                                    {item.data.render_type}
                                                </Tag>
                                                <div style={{
                                                    width: 16,
                                                    height: 16,
                                                    backgroundColor: item.data.color,
                                                    borderRadius: '50%',
                                                    border: '1px solid #ddd'
                                                }} />
                                            </Space>
                                        </Space>
                                    </Col>
                                </Row>
                            ) : item.status === 'error' ? (
                                <Alert type="error" message={item.error || '分析失败'} showIcon />
                            ) : (
                                <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                                    等待分析...
                                </div>
                            )}
                        </Card>
                    </List.Item>
                )}
            />
        </Modal>
    );
};
