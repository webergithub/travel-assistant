# TripMate 旅行助手

地图式行程规划工作台（OPC Studio 模块，线上路径 `/travel/`）。

## 核心理念（源自 2026-07 全网调研）
1. **地图为中心的行程工作区**，AI 只是生成草稿的输入方式之一，手动编辑是主干。
2. **防幻觉第一**：AI 推荐的每个地点都经 Nominatim 地理编码核验，未找到的标 ⚠。
3. 结构化行程数据（Trip → Day → Item）是主体，可拖拽、可分享、可核验。

## 技术栈
- 前端：React 18 + Vite + TypeScript + Tailwind v4 + Leaflet（CARTO 暗色底图）
- 后端：Express + TypeScript + Prisma + SQLite
- LLM：Claude（平台 key 或用户自带 key `x-user-api-key`）
- 地理：Nominatim/OSM（串行限速 1req/s + SQLite 缓存）

## 本地运行
```bash
cd backend && npm install && npx prisma db push && npm run dev   # :4100
cd frontend && npm install && npm run dev                        # :5181 (proxy /api → 4100)
```

## 功能（MVP v0.1）
- 行程 CRUD、逐日安排、想去清单（dayIndex=-1）
- 拖拽换天 / ↑↓ 排序、行内编辑（类型/时间/花费/备注）
- 地点搜索 → 地图定位 → 一键收藏
- AI 生成行程草稿（严格 JSON）+ 逐地点地图核验 + 追加/替换落库
- 只读分享链接、预算合计、游客一键体验、中英双语（opcstudio_lang）

## 部署（oracle-vm）
服务器 `/home/ubuntu/travel/`，PM2 进程 `travel`（端口 3400），nginx `location /travel/` 反代，
前端构建产物放 `public/` 由后端同进程托管。更新：本地构建 → rsync → `pm2 restart travel`。
