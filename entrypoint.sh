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

# WARP puo ricreare route IPv6 dopo la connessione; FlareSolverr deve uscire solo IPv4.
if [ "${FORCE_IPV4_ONLY:-1}" != "0" ]; then
    echo "[WARP] Forzo uscita IPv4-only..."
    for flag in /proc/sys/net/ipv6/conf/*/disable_ipv6; do
        echo 1 > "$flag" 2>/dev/null || true
    done
    sysctl -w net.ipv6.conf.all.disable_ipv6=1 >/dev/null 2>&1 || true
    sysctl -w net.ipv6.conf.default.disable_ipv6=1 >/dev/null 2>&1 || true
    ip -6 route flush table all >/dev/null 2>&1 || true
    if command -v ip6tables >/dev/null 2>&1 && ip6tables -L OUTPUT >/dev/null 2>&1; then
        ip6tables -F OUTPUT >/dev/null 2>&1 || true
        ip6tables -P OUTPUT DROP >/dev/null 2>&1 || true
        ip6tables -A OUTPUT -j REJECT >/dev/null 2>&1 || true
        echo "[WARP] Blocco firewall IPv6 applicato."
    else
        echo "[WARP] ip6tables non disponibile o IPv6 gia disattivato, uso sysctl/route."
    fi
else
    echo "[WARP] FORCE_IPV4_ONLY=0, IPv6 non bloccato."
fi

# Verifica finale IP
echo "[WARP] IP Pubblico finale IPv4:"
curl -4 -s --connect-timeout 5 https://ifconfig.me || echo "Impossibile rilevare IPv4 (VPN potrebbe essere attiva ma DNS/Routing lenti)"
echo ""

# Avvio applicazione
echo "[App] Avvio EasyStreams..."
case " $NODE_OPTIONS " in
    *"--dns-result-order="*) ;;
    *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first" ;;
esac
node stremio_addon.js
