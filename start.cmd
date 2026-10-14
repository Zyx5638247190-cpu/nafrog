@echo off
rem 启动 奶蛙大战奶龙 本地服务并打开浏览器
cd /d "%~dp0"
start "" http://localhost:5173/
node server.mjs 5173
