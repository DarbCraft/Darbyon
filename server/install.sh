#!/bin/bash
# Sets DårbCRÅFT up to start by itself whenever the Raspberry Pi turns on.
# Run it once, from the site folder, in one of two ways:
#
#   sudo bash server/install.sh internet    the Pi is at home and students reach
#                                           the site through an internet tunnel
#   sudo bash server/install.sh             the Pi is on the same private network
#                                           as the students (for example at school)
set -euo pipefail

MODE="${1:-network}"
if [ "$MODE" != "internet" ] && [ "$MODE" != "network" ]; then
    echo "Use:  sudo bash server/install.sh internet   or   sudo bash server/install.sh"
    exit 1
fi
if [ "$EUID" -ne 0 ]; then
    echo "Please run this with sudo."
    exit 1
fi
RUN_USER="${SUDO_USER:-}"
if [ -z "$RUN_USER" ] || [ "$RUN_USER" = "root" ]; then
    echo "Log in as your normal user and run this with sudo."
    exit 1
fi

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
case "$SITE_DIR" in
    *" "*) echo "The site folder path contains a space ($SITE_DIR). Move it somewhere without spaces."; exit 1 ;;
esac
SERVER="$SITE_DIR/server/server.py"

# The data folder belongs to your user, not to root.
sudo -u "$RUN_USER" mkdir -p "$SITE_DIR/server/data"

if ! sudo -u "$RUN_USER" python3 "$SERVER" --has-password; then
    sudo -u "$RUN_USER" python3 "$SERVER" --set-password
fi

if [ "$MODE" = "internet" ]; then
    if ! sudo -u "$RUN_USER" python3 "$SERVER" --has-class-code; then
        echo
        sudo -u "$RUN_USER" python3 "$SERVER" --set-class-code
    fi
    RUN_OPTIONS="--internet"
else
    RUN_OPTIONS="--port 80"
fi

cat > /etc/systemd/system/darbyon.service <<UNIT
[Unit]
Description=DarbCRAFT class site
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$SITE_DIR
ExecStart=/usr/bin/python3 $SERVER $RUN_OPTIONS
Restart=always
RestartSec=3
# Lets an ordinary user use the normal web port, and nothing more.
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
# The site may only write inside its own data folder.
ProtectSystem=strict
ReadWritePaths=$SITE_DIR/server/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable darbyon
systemctl restart darbyon
sleep 2

if ! systemctl is-active --quiet darbyon; then
    echo "The site did not start. See why with:  sudo journalctl -u darbyon -n 30"
    exit 1
fi

echo
echo "DårbCRÅFT is running and will start by itself whenever the Pi turns on."
if [ "$MODE" = "internet" ]; then
    echo "It is not on the internet yet. Carry on with the Tailscale steps in server/SETUP.md."
else
    echo "Open it from another device on the same network at one of:"
    echo "    http://$(hostname).local"
    for ip in $(hostname -I); do echo "    http://$ip"; done
fi
