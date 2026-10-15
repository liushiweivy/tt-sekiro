@echo off
rem tt-sekiro harness: serve project root and open browser test shell
set PY=C:\Users\4v\AppData\Local\Programs\Python\Python312\python.exe
start "" http://127.0.0.1:8822/harness/index.html
"%PY%" -m http.server 8822 --bind 127.0.0.1 --directory "%~dp0"
