#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SCRIPT_DIR/key.pem" \
  -out "$SCRIPT_DIR/cert.pem" \
  -subj "/CN=localhost/O=Horizon Data Dev/C=AU"

chmod 600 "$SCRIPT_DIR/key.pem"

echo "Dev cert generated at $SCRIPT_DIR/"
echo ""
echo "To avoid browser security warnings, trust the cert in your system keychain:"
echo "  macOS:  open $SCRIPT_DIR/cert.pem  (then set 'Always Trust' in Keychain Access)"
echo "  Linux:  sudo cp $SCRIPT_DIR/cert.pem /usr/local/share/ca-certificates/horizon-data.crt && sudo update-ca-certificates"
echo "  Windows: certutil -addstore Root $SCRIPT_DIR/cert.pem"
echo ""
echo "For production: replace cert.pem and key.pem with your real certificate files."
