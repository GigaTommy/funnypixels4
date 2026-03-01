import React from 'react';
import { ProTable, ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Space } from 'antd';

interface SafeProTableProps {
  columns: ProColumns<any>[];
  actionRef?: React.MutableRefObject<ActionType | undefined>;
  rowKey?: string;
  search?: any;
  request?: any;
  columnsState?: any;
  pagination?: any;
  dateFormatter?: string;
  headerTitle?: string;
  toolBarRender?: (() => React.ReactNode[]) | false;
  options?: any;
  [key: string]: any;
}

/**
 * SafeProTable - ProTable的安全包装器
 * 在Strict Mode下禁用有问题的功能，避免findDOMNode警告
 */
const SafeProTable: React.FC<SafeProTableProps> = (props) => {
  const {
    columns,
    actionRef,
    rowKey = 'id',
    search,
    request,
    columnsState,
    pagination,
    dateFormatter,
    headerTitle,
    toolBarRender,
    options,
    ...restProps
  } = props;

  // 自定义标题栏
  const renderHeader = () => {
    if (headerTitle) {
      return (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{headerTitle}</h2>
          {toolBarRender && typeof toolBarRender === 'function' && (
            <Space>{toolBarRender()}</Space>
          )}
        </div>
      );
    }
    return null;
  };

  // 检测是否在Strict Mode下运行
  const isStrictMode = React.StrictMode !== undefined;

  // 在Strict Mode下禁用有问题的功能
  const safeProps = isStrictMode ? {
    ...restProps,
    // 禁用会导致findDOMNode警告的功能
    toolBarRender: undefined,
    options: undefined,
    headerTitle: undefined,
    // 保留核心功能
    columns,
    actionRef,
    rowKey,
    search,
    request,
    columnsState,
    pagination,
    dateFormatter,
  } : props;

  return (
    <>
      {renderHeader()}
      <ProTable {...safeProps} />
    </>
  );
};

export default SafeProTable;