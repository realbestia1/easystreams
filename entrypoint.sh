#!/bin/bash

# 1. Avvio il demone in background con log su file
echo "[WARP] Avvio warp-svc..."
mkdir -p /run/cloudflare-warp
warp-svc --accept-tos > /app/warp-svc.log 2>&1 &

# 2. Aspetto che il demone sia effettivamente pronto
echo "[WARP] In attesa che il demone risponda..."
for i in {1..15}; do
    if warp-cli --accept-tos status > /dev/null 2>&1; then
        echo "[WARP] Demone pronto."
        break
    fi
    echo "[WARP] In attesa del socket ($i/15)..."
    sleep 2
done

# 3. Gestione Registrazione (stile EasyProxy: pulizia e rinnovo)
echo "[WARP] Configurazione registrazione..."
warp-cli --accept-tos registration delete > /dev/null 2>&1 || true
warp-cli --accept-tos registration new

# 4. Configurazione Modalità e Connessione
warp-cli --accept-tos mode warp
warp-cli --accept-tos connect

# 5. Attesa connessione effettiva
echo "[WARP] Tentativo di connessione..."
for i in {1..20}; do
    STATUS=$(warp-cli --accept-tos status)
    if [[ $STATUS == *"Status update: Connected"* ]]; then
        echo "[WARP] Connesso con successo!"
        break
    fi
    echo "[WARP] Stato attuale: $(echo "$STATUS" | grep 'Status update:' | cut -d' ' -f3-) ($i/20)"
    sleep 2
done

# Verifica finale IP
echo "[WARP] IP Pubblico finale:"
curl -s --connect-timeout 5 https://ifconfig.me || echo "Impossibile rilevare IP (VPN potrebbe essere attiva ma DNS/Routing lenti)"
echo ""

# Avvio applicazione
echo "[App] Avvio EasyStreams..."
node stremio_addon.js
