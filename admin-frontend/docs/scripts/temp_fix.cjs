const fs = require('fs');
let content = fs.readFileSync('src/pages/Store/CustomFlagApproval.tsx', 'utf8');

// Fix the unclosed div issue around line 531
content = content.replace(
  "padding: '24px'\n      }}>\n\n        <Table",
  "padding: '24px'\n      }}>\n        <Table>"
);

fs.writeFileSync('src/pages/Store/CustomFlagApproval.tsx', content);
console.log('Fixed JSX structure');
