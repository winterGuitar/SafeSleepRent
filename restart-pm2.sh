#!/bin/bash

echo "========================================"
echo "       SafeSleepRent 重启脚本 (PM2)"
echo "========================================"
echo

echo "[1/3] 重启后端服务 (PM2)..."
cd /root/SafeSleepRent/server
pm2 restart server.js 2>/dev/null || pm2 start server.js --name "bed-backend"
echo "✓ 后端服务已重启"
echo

echo "[2/3] 重启 Nginx 服务..."
sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx
echo "✓ Nginx 服务已重启"
echo

echo "[3/3] 检查服务状态..."
echo "---"
pm2 list
echo
sudo systemctl status nginx --no-pager -l | head -n 5
echo

echo "========================================"
echo "         重启完成！"
echo "========================================"
echo
