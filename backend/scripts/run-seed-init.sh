#!/bin/bash

echo "开始初始化生产环境Seed数据..."
echo

# 切换到脚本所在目录的上级目录
cd "$(dirname "$0")/.."

echo "检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

node --version

echo
echo "执行Seed数据初始化..."
node scripts/init-production-seed.js

echo
echo "Seed数据初始化完成！"
