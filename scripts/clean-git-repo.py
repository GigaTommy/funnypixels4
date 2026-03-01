#!/usr/bin/env python3
"""
FunnyPixels Git 仓库清理脚本
移除不应该被跟踪的文件（node_modules, .env, logs 等）
"""

import os
import subprocess
import sys
import time

def run_command(cmd, description=""):
    """执行 shell 命令"""
    if description:
        print(f"🔄 {description}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        print(f"❌ 错误: {e}")
        return False, "", str(e)

def main():
    print("=" * 60)
    print("🚀 FunnyPixels Git 仓库清理工具")
    print("=" * 60)
    print()

    # 步骤 1: 清理 git 锁文件
    print("📌 步骤 1/4: 清理 git 锁文件")
    run_command("rm -f .git/index.lock", "删除 .git/index.lock")
    print("✅ 完成\n")

    # 步骤 2: 使用 git update-index 批量移除 node_modules
    print("📌 步骤 2/4: 移除 node_modules 文件")

    success, stdout, _ = run_command("git ls-files | grep 'admin-frontend/node_modules'")
    if not success:
        print("❌ 无法获取文件列表")
        return 1

    files = stdout.strip().split('\n')
    total = len(files)
    print(f"📊 找到 {total} 个 node_modules 文件")

    if total > 0:
        print("⚠️  文件数量太大，使用批量移除方法...")

        # 方法 1: 使用 git rm 的批量删除
        batch_size = 5000
        removed = 0

        for i in range(0, total, batch_size):
            batch = files[i:i+batch_size]
            batch_file = f"/tmp/git_rm_batch_{i}.txt"

            # 写入批次文件
            with open(batch_file, 'w') as f:
                f.write('\n'.join(batch))

            # 执行批量删除
            cmd = f"xargs git rm --cached --quiet < {batch_file}"
            success, _, stderr = run_command(cmd)

            if success:
                removed += len(batch)
                print(f"✅ 进度: {removed}/{total} ({removed*100//total}%)")
            else:
                print(f"⚠️  批次 {i}-{i+len(batch)} 失败")

            # 清理临时文件
            os.remove(batch_file)

            # 避免索引冲突
            run_command("rm -f .git/index.lock")

        print(f"✅ 共移除 {removed} 个文件\n")
    else:
        print("✅ 没有 node_modules 文件需要移除\n")

    # 步骤 3: 移除其他不应该被跟踪的文件
    print("📌 步骤 3/4: 移除环境配置和日志文件")

    dangerous_files = [
        "backend/.env",
        "frontend/.env",
    ]

    for file in dangerous_files:
        cmd = f"git rm --cached --ignore-unmatch '{file}'"
        run_command(cmd, f"移除 {file}")

    print("✅ 完成\n")

    # 步骤 4: 显示当前状态
    print("📌 步骤 4/4: 显示当前状态")
    success, stdout, _ = run_command("git status --short | head -20")
    if success:
        print("📊 Git 状态（前 20 行）:")
        print(stdout)

    print()
    print("=" * 60)
    print("✅ 清理完成！")
    print("=" * 60)
    print()
    print("📝 下一步:")
    print("   1. 检查 git status 确认删除的文件")
    print("   2. 提交这些更改:")
    print("      git add .gitignore")
    print("      git commit -m 'chore: 更新 .gitignore 并移除不应该跟踪的文件'")
    print()
    print("   3. 如果想彻底清理历史（可选，会减小仓库大小）:")
    print("      git gc --aggressive --prune=now")
    print()

if __name__ == "__main__":
    main()
