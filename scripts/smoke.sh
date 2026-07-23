#!/bin/bash
# 部署冒烟（G-OPS-1/PR-P0-2）：触库全链路 guest→建行程→加项→分享→匿名读→清理。
# 用法: ./smoke.sh [API_BASE]   默认 https://opcstudio.cc/travel/api
# 退出码 0=通过；非 0=失败（部署脚本据此拦截）
set -u
BASE="${1:-https://opcstudio.cc/travel/api}"
PY=python3

step() { echo "→ $1"; }
fail() { echo "✗ 冒烟失败于: $1"; exit 1; }

json_get() { $PY -c "import json,sys; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }

step "health（必须触库；容忍重启空窗，最多重试 6 次）"
H=""
for i in 1 2 3 4 5 6; do
  H=$(curl -sf --max-time 15 "$BASE/health") && break
  echo "   ... 第 $i 次未就绪，5s 后重试"
  sleep 5
done
[ -n "$H" ] || fail "health 请求（重试 6 次后仍失败）"
[ "$(echo "$H" | json_get "['db']")" = "ok" ] || fail "health.db != ok → $H"

step "游客账号（写库）"
G=$(curl -sf --max-time 15 -X POST "$BASE/auth/guest" -H 'Content-Type: application/json' -d '{"lang":"zh"}') || fail "guest 创建"
TOKEN=$(echo "$G" | json_get "['token']")
[ -n "$TOKEN" ] || fail "guest 无 token → $G"
AUTH="Authorization: Bearer $TOKEN"

step "创建行程"
TRIP=$(curl -sf --max-time 15 -X POST "$BASE/trips" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"smoke 冒烟行程","destination":"冒烟市","days":2}') || fail "创建行程"
TID=$(echo "$TRIP" | json_get "['trip']['id']")
[ -n "$TID" ] || fail "行程无 id → $TRIP"

step "添加行程项"
ITEM=$(curl -sf --max-time 15 -X POST "$BASE/trips/$TID/items" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dayIndex":0,"title":"冒烟景点"}') || fail "加项"
[ -n "$(echo "$ITEM" | json_get "['item']['id']")" ] || fail "项无 id → $ITEM"

step "开启分享 + 匿名读取"
SH=$(curl -sf --max-time 15 -X POST "$BASE/trips/$TID/share" -H "$AUTH" -H 'Content-Type: application/json' -d '{"enable":true}') || fail "开分享"
SLUG=$(echo "$SH" | json_get "['shareSlug']")
[ -n "$SLUG" ] || fail "无 shareSlug → $SH"
PUB=$(curl -sf --max-time 15 "$BASE/share/$SLUG") || fail "匿名读分享"
[ "$(echo "$PUB" | json_get "['trip']['title']")" = "smoke 冒烟行程" ] || fail "分享内容不符 → $PUB"

step "清理（删行程）"
curl -sf --max-time 15 -X DELETE "$BASE/trips/$TID" -H "$AUTH" >/dev/null || fail "删除行程"

echo "✅ 冒烟通过: $BASE"
