#!/bin/bash
# CI script to detect forbidden raster layer usage

set -e

echo "🔍 Scanning for raster layer usage (forbidden in production)..."

# Search for raster type usage in frontend and backend
RASTER_USAGE=$(grep -rn "type.*:.*'raster'" frontend/src/ backend/src/ 2>/dev/null || true)

if [ -n "$RASTER_USAGE" ]; then
  echo "❌ FORBIDDEN: Raster layers detected in production code!"
  echo "$RASTER_USAGE"
  exit 1
fi

echo "✅ No raster layers found - vector-only compliance verified"
exit 0
