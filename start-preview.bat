@echo off
cd /d "%~dp0"
echo Opening NKNSHOP preview...
start http://127.0.0.1:5500
python -m http.server 5500 --bind 127.0.0.1 --directory preview
pause
