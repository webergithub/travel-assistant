#!/bin/bash
# TripMate 标准发布流水线：测试→构建→上传→db push→重启→冒烟→拉备份
# 冒烟失败即退出非零（G-OPS-1）。KI-10 教训固化：db push 是流水线固定步骤。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/7 后端类型检查 + 测试 =="
(cd backend && npx tsc --noEmit && npm test >/dev/null) && echo "   测试通过"

echo "== 2/7 前端构建 =="
(cd frontend && npm run build >/dev/null) && echo "   构建完成"

echo "== 3/7 上传 =="
# 注意：--delete 会清掉服务器上不在本地 backend/ 的内容，必须排除服务器侧独有目录（scripts/backups/public）
rsync -az --delete --exclude node_modules --exclude '*.db' --exclude '.env' --exclude dist --exclude test \
  --exclude scripts --exclude backups --exclude public backend/ oracle-vm:/home/ubuntu/travel/
scp -q scripts/backup.py oracle-vm:/home/ubuntu/travel/scripts/backup.py 2>/dev/null || \
  ssh oracle-vm "mkdir -p /home/ubuntu/travel/scripts" && scp -q scripts/backup.py oracle-vm:/home/ubuntu/travel/scripts/backup.py
rsync -az --delete frontend/dist/ oracle-vm:/home/ubuntu/travel/public/

echo "== 4/7 prisma db push（schema 同步，幂等） =="
ssh oracle-vm "cd /home/ubuntu/travel && npx prisma db push 2>&1 | tail -1"

echo "== 5/7 重启 =="
ssh oracle-vm "~/.npm-global/bin/pm2 restart travel >/dev/null && sleep 4"

echo "== 6/7 线上冒烟 =="
if ! ./scripts/smoke.sh https://opcstudio.cc/travel/api; then
  echo "!! 冒烟失败，pm2 日志尾部："
  ssh oracle-vm "tail -15 /home/ubuntu/.pm2/logs/travel-error.log"
  exit 1
fi

echo "== 7/7 拉取最新备份到本地 =="
mkdir -p backups
LATEST=$(ssh oracle-vm "ls -t /home/ubuntu/travel/backups/prod-*.db 2>/dev/null | head -1" || true)
if [ -n "$LATEST" ]; then
  scp -q "oracle-vm:$LATEST" backups/ && echo "   已拉取 $(basename "$LATEST")"
else
  echo "   （服务器尚无备份文件）"
fi

echo "✅ 发布完成"
