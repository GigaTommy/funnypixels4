const fs = require('fs');
let content = fs.readFileSync('src/pages/Store/CustomFlagApproval.tsx', 'utf8');

// Add the missing closing div tag
content = content.replace(
  "padding: '24px'\n      }}>\n        <Table",
  "padding: '24px'\n      }}>\n        <Table"
);

content = content.replace(
  "        />\n      </Card>",
  "        />\n      </div>\n      </Card>"
);

fs.writeFileSync('src/pages/Store/CustomFlagApproval.tsx', content);
console.log('Fixed missing closing div tag');
