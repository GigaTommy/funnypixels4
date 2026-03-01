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

def remove_preview_blocks(content):
    """Remove all lines from first occurrence of '// iOS 17+' or '#Preview' to end of file"""
    lines = content.split('\n')
    
    # Find first preview line
    preview_start = -1
    for i, line in enumerate(lines):
        if '// iOS 17+ only' in line or (line.strip().startswith('#Preview') and '{' in line):
            preview_start = i
            break
    
    if preview_start >= 0:
        # Remove everything from preview_start onwards
        return '\n'.join(lines[:preview_start])
    
    return content

for filepath in files:
    if not os.path.exists(filepath):
        print(f"Skip (not found): {filepath}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = remove_preview_blocks(content)
    
    # Add trailing newline if not present
    if modified and not modified.endswith('\n'):
        modified += '\n'
    
    if modified != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"Fixed: {filepath}")
    else:
        print(f"No changes: {filepath}")

print("Done!")
