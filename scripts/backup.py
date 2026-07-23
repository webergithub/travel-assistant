#!/usr/bin/env python3
# TripMate 生产库每日备份（G-DATA-1/PR-P0-3）：SQLite 在线备份 + 14 天轮换
# 服务器 cron: 10 4 * * * /usr/bin/python3 /home/ubuntu/travel/scripts/backup.py >> /home/ubuntu/travel/backups/backup.log 2>&1
import sqlite3
import datetime
import pathlib
import sys

DB = pathlib.Path("/home/ubuntu/travel/prisma/prod.db")
DST_DIR = pathlib.Path("/home/ubuntu/travel/backups")
KEEP = 14

def main() -> int:
    if not DB.exists():
        print(f"[{datetime.datetime.now().isoformat()}] 源库不存在: {DB}")
        return 1
    DST_DIR.mkdir(exist_ok=True)
    name = DST_DIR / f"prod-{datetime.date.today().isoformat()}.db"
    src = sqlite3.connect(str(DB))
    dst = sqlite3.connect(str(name))
    try:
        src.backup(dst)  # 在线一致性备份，不锁写
    finally:
        dst.close()
        src.close()
    # 完整性校验
    chk = sqlite3.connect(str(name)).execute("PRAGMA integrity_check").fetchone()[0]
    if chk != "ok":
        print(f"[{datetime.datetime.now().isoformat()}] 备份完整性校验失败: {chk}")
        return 1
    # 轮换
    backups = sorted(DST_DIR.glob("prod-*.db"))
    for old in backups[:-KEEP]:
        old.unlink()
    print(f"[{datetime.datetime.now().isoformat()}] 备份完成 {name.name} ({name.stat().st_size} bytes), 保留 {min(len(backups), KEEP)} 份")
    return 0

if __name__ == "__main__":
    sys.exit(main())
