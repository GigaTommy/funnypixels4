#!/bin/bash

# Convert all WAV files to M4A format
# Using macOS built-in afconvert tool

SOUNDS_DIR="/Users/ginochow/code/funnypixels3/FunnyPixelsApp/FunnyPixelsApp/Resources/Sounds"

echo "🎵 Converting WAV files to M4A format..."
echo "📂 Directory: $SOUNDS_DIR"
echo ""

# Counter for converted files
converted=0
skipped=0

cd "$SOUNDS_DIR" || exit 1

for wav_file in *.wav; do
    if [ -f "$wav_file" ]; then
        # Get filename without extension
        filename="${wav_file%.wav}"
        m4a_file="${filename}.m4a"

        # Skip if M4A already exists and is newer
        if [ -f "$m4a_file" ] && [ "$m4a_file" -nt "$wav_file" ]; then
            echo "⏭️  Skipping $wav_file (M4A already exists)"
            ((skipped++))
            continue
        fi

        echo "🔄 Converting: $wav_file → $m4a_file"

        # Convert using afconvert (macOS built-in)
        # -f m4af: M4A format
        # -d aac: AAC codec
        # -b 128000: 128kbps bitrate (good quality, small size)
        afconvert "$wav_file" -f m4af -d aac -b 128000 "$m4a_file" 2>/dev/null

        if [ $? -eq 0 ]; then
            # Get file sizes
            wav_size=$(stat -f%z "$wav_file" 2>/dev/null || echo "0")
            m4a_size=$(stat -f%z "$m4a_file" 2>/dev/null || echo "0")

            # Calculate size reduction
            if [ "$wav_size" -gt 0 ]; then
                reduction=$(echo "scale=1; (1 - $m4a_size / $wav_size) * 100" | bc)
                echo "   ✅ Size: $(numfmt --to=iec-i --suffix=B $wav_size) → $(numfmt --to=iec-i --suffix=B $m4a_size) (${reduction}% smaller)"
            else
                echo "   ✅ Done"
            fi

            ((converted++))
        else
            echo "   ❌ Failed to convert $wav_file"
        fi
        echo ""
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   ✅ Converted: $converted files"
echo "   ⏭️  Skipped: $skipped files"
echo ""

# Calculate total sizes
total_wav=$(find . -name "*.wav" -exec stat -f%z {} + | awk '{s+=$1} END {print s}')
total_m4a=$(find . -name "*.m4a" -exec stat -f%z {} + | awk '{s+=$1} END {print s}')

if [ -n "$total_wav" ] && [ "$total_wav" -gt 0 ] && [ -n "$total_m4a" ] && [ "$total_m4a" -gt 0 ]; then
    echo "💾 Total WAV size: $(numfmt --to=iec-i --suffix=B $total_wav)"
    echo "💾 Total M4A size: $(numfmt --to=iec-i --suffix=B $total_m4a)"

    reduction=$(echo "scale=1; (1 - $total_m4a / $total_wav) * 100" | bc)
    echo "📉 Total reduction: ${reduction}%"
else
    echo "💾 Total WAV size: ${total_wav:-0} bytes"
    echo "💾 Total M4A size: ${total_m4a:-0} bytes"
fi

echo ""
echo "🎉 Conversion complete!"
echo ""
echo "⚠️  Note: WAV files are kept for backup."
echo "   You can delete them after confirming M4A files work correctly."
