# Installa il server locale di GymBuilder (06/10/2026): operazione pianificata
# all'accesso, finestra nascosta, registro in server.log. Poi lo pubblica su
# internet con Tailscale Funnel: https://<nome-pc>.<tailnet>.ts.net:10000
# Per toglierlo:  Unregister-ScheduledTask "GymBuilder - Server locale" -Confirm:$false
#                 tailscale funnel --https=10000 off
$ErrorActionPreference = "Stop"
$cartella = $PSScriptRoot
if (-not (Test-Path (Join-Path $cartella ".env"))) { throw "Manca server-locale\.env (variabili copiate da Vercel)" }
if (-not (Test-Path (Join-Path $cartella "..\dist\index.html"))) { throw "Manca dist: npm ci; npm run build (con le VITE_ di server-locale\.env)" }

$node = (Get-Command node).Source
$comando = "`"$node`" --env-file=.env server.mjs >> server.log 2>&1"
$azione = New-ScheduledTaskAction -Execute "conhost.exe" -Argument "--headless cmd /c `"$comando`"" -WorkingDirectory $cartella
$quando = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$regole = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "GymBuilder - Server locale" -Action $azione -Trigger $quando -Settings $regole -Force | Out-Null
Start-ScheduledTask -TaskName "GymBuilder - Server locale"

tailscale funnel --bg --https=10000 http://127.0.0.1:3001
tailscale funnel status
