@echo off
title Toko Aneka - Aplikasi Kasir & Stokis
echo ========================================================
echo        MEMULAI APLIKASI WEB TOKO ANEKA
echo ========================================================
echo.
echo Membuka server lokal dan browser...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
