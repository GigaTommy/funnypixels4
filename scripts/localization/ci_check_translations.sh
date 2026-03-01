#!/bin/bash
# CI wrapper for localization checks.
# Usage: bash scripts/localization/ci_check_translations.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Checking missing translations ==="
node "$SCRIPT_DIR/l10n_cli.js" check

echo ""
echo "=== Checking format specifiers ==="
node "$SCRIPT_DIR/check_format_specifiers.js"

echo ""
echo "=== All localization checks passed ==="
