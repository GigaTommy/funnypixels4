import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableProps } from 'antd/es/table';

interface CustomTableProps<T> extends Omit<TableProps<T>, 'columns' | 'dataSource'> {
  columns: ColumnsType<T>;
  dataSource?: T[];
  loading?: boolean;
  onSearch?: (values: any) => void;
  searchForm?: React.ReactNode;
  refresh?: () => void;
  pagination?: TableProps<T>['pagination'];
  rowKey?: string;
}

function CustomTable<T extends Record<string, any>>({
  columns,
  dataSource,
  loading = false,
  onSearch,
  searchForm,
  refresh,
  pagination,
  rowKey = 'id',
  ...props
}: CustomTableProps<T>) {
  const [data, setData] = useState<T[]>(dataSource || []);
  const [paginationState, setPaginationState] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    ...pagination,
  });

  // 当外部dataSource变化时更新内部状态
  useEffect(() => {
    setData(dataSource || []);
  }, [dataSource]);

  const handleTableChange = (
    pagination: any,
    filters: any,
    sorter: any,
    extra: any
  ) => {
    if (pagination) {
      setPaginationState(pagination);
    }
  };

  return (
    <div>
      {searchForm && (
        <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 6 }}>
          {searchForm}
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          {onSearch && (
            <Button icon={<SearchOutlined />} onClick={() => onSearch({})}>
              搜索
            </Button>
          )}
          {refresh && (
            <Button onClick={refresh}>
              刷新
            </Button>
          )}
        </Space>
      </div>

      <Table
        {...props}
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={paginationState}
        onChange={handleTableChange}
        rowKey={rowKey}
        scroll={{ x: 'max-content' }}
        size="middle"
      />
    </div>
  );
}

export default CustomTable;