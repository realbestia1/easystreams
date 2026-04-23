#!/bin/bash

# Start WARP daemon
warpd &
sleep 2

# Register and Connect WARP
echo "[WARP] Registro e connetto..."
warp-cli --accept-tos register
warp-cli --accept-tos set-mode warp
warp-cli --accept-tos connect

# Wait for WARP to be connected
MAX_RETRIES=10
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
    STATUS=$(warp-cli --accept-tos status)
    if [[ $STATUS == *"Status update: Connected"* ]]; then
        echo "[WARP] Connesso con successo!"
        break
    fi
    echo "[WARP] In attesa di connessione ($COUNT/$MAX_RETRIES)..."
    sleep 2
    ((COUNT++))
done

# Show IP to verify VPN
echo "[WARP] IP Pubblico rilevato:"
curl -s https://ifconfig.me || echo "Impossibile rilevare IP"
echo ""

# Start the main application
echo "[App] Avvio EasyStreams..."
node stremio_addon.js
