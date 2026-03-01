#!/usr/bin/env python3
import re
import os

files = [
    "Sources/FunnyPixels/Views/ModernAllianceView.swift",
    "Sources/FunnyPixels/Views/ModernMapView.swift",
    "Sources/FunnyPixels/Views/ModernStoreView.swift",
    "Sources/FunnyPixels/Views/AllianceView.swift",
    "Sources/FunnyPixels/Views/TrackOverlayView.swift",
    "Sources/FunnyPixels/Views/StoreView.swift",
    "Sources/FunnyPixels/Views/ProfileView.swift",
    "Sources/FunnyPixels/Views/ModernProfileView.swift",
    "Sources/FunnyPixels/Views/ModernLeaderboardView.swift",
    "Sources/FunnyPixels/Views/ModernColorPickerSheet.swift",
    "Sources/FunnyPixels/Views/MapView.swift",
    "Sources/FunnyPixels/Views/LeaderboardView.swift",
    "Sources/FunnyPixels/Views/HistoryView.swift",
    "Sources/FunnyPixels/Views/GPSStatusView.swift",
    "Sources/FunnyPixels/Views/EnhancedPixelDetailCard.swift",
    "Sources/FunnyPixels/Views/EnhancedMapControls.swift",
    "Sources/FunnyPixels/Views/ContentView.swift",
    "Sources/FunnyPixels/Views/AuthView.swift",
    "Sources/FunnyPixelsApp/FunnyPixelsApp.swift"
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Comment out #Preview blocks
    # Pattern: find #Preview { ... }
    modified = re.sub(
        r'^(#Preview\s*\{[\s\S]*?\n\})\s*$',
        r'// iOS 17+ only - commented out for iOS 16 compatibility\n// \1',
        content,
        flags=re.MULTILINE
    )
    
    if modified != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"Fixed: {filepath}")
    else:
        print(f"No changes: {filepath}")

print("Done!")
