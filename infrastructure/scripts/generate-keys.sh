#!/bin/sh
# generate-keys.sh
# Run once before first docker compose up.
# Generates the RS256 key pair used to sign and verify JWTs.
# Keys are mounted as read-only volumes into auth-service and user-service.

set -e

KEYS_DIR="$(dirname "$0")/../../keys"
mkdir -p "$KEYS_DIR"

if [ -f "$KEYS_DIR/private.pem" ]; then
  echo "Keys already exist at $KEYS_DIR — skipping generation."
  echo "Delete them and re-run this script to rotate keys."
  exit 0
fi

echo "Generating RS256 key pair..."
openssl genrsa -out "$KEYS_DIR/private.pem" 2048
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

chmod 600 "$KEYS_DIR/private.pem"
chmod 644 "$KEYS_DIR/public.pem"

echo "Done. Keys written to:"
echo "  Private: $KEYS_DIR/private.pem"
echo "  Public:  $KEYS_DIR/public.pem"
echo ""
echo "IMPORTANT: Add keys/ to .gitignore — never commit private keys."