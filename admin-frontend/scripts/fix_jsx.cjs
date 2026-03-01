const fs = require('fs');
const content = fs.readFileSync('src/pages/Store/CustomFlagApproval.tsx', 'utf8');

// Fix the JSX structure by replacing the problematic part
const fixedContent = content.replace(
  /padding: '24px'\n      }}>\n        <Table[\s\S]*?columns={columns}[\s\S]*?dataSource={orders}[\s\S]*?rowKey="id"[\s\S]*?loading={loading}[\s\S]*?pagination={[\s\S]*?[\s\S]*?}}[\s\S]*?scroll={{ x: 1000 }}[\s\S]*?style={{[\s\S]*?borderRadius: '12px'[\s\S]*?}}[\s\S]*?\/>/g,
  `padding: '24px'\n      }}>\n        <Table\n          columns={columns}\n          dataSource={orders}\n          rowKey="id"\n          loading={loading}\n          pagination={{\n            ...pagination,\n            showSizeChanger: true,\n            showQuickJumper: true,\n            showTotal: (total, range) =>\n              \`第 \${range[0]}-\${range[1]} 条/共 \${total} 条\`,\n            onChange: (page, pageSize) => {\n              fetchPendingOrders({ current: page, pageSize });\n            },\n          }}\n          scroll={{ x: 1000 }}\n          style={{\n            borderRadius: '12px'\n          }}\n        />\n      </div>\n      </Card>`
);

fs.writeFileSync('src/pages/Store/CustomFlagApproval.tsx', fixedContent);
console.log('Fixed JSX structure');
