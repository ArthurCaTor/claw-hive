# 重启检查清单

## 只重启 claw-hive（不停 Proxy）

```bash
# 杀掉并重启主服务器
pkill -f "node src/server.js"
cd /home/arthur/claw-hive
node src/server.js &
```

**影响**: claw-hive 重启，Proxy 也需要手动重启

---

## 完整重启（Proxy 模式）

```bash
cd /home/arthur/claw-hive
./fix-proxy.sh start
```

**影响**: claw-hive + Proxy + Gateway 全部重启

---

## 恢复正常（停 Proxy）

```bash
cd /home/arthur/claw-hive
./fix-proxy.sh stop
```

---

## 快速检查

```bash
./fix-proxy.sh status
```

---

## 关键点

1. **Proxy (8999) 不是独立服务** - 由 claw-hive 控制
2. **Gateway 独立运行** - 需要单独启动
3. **用脚本代替手动命令** - 减少出错
