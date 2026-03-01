# Quick Test Guide - Point + SDF Architecture

## 🚀 5-Minute Quick Test

### Step 1: Start Dev Server (1 minute)

```bash
cd frontend
npm run dev
```

Wait for message: `VITE ready in XXX ms`

### Step 2: Open Test Page (30 seconds)

**URL:** http://localhost:5174/point-sdf-test

You should see:
- Purple gradient header: "🎨 Point + SDF Architecture Test"
- Info panel with architecture details
- Map loading (OpenFreeMap Liberty style)
- Instructions overlay in bottom-right corner

### Step 3: Check Console (1 minute)

Press **F12** (DevTools) → **Console** tab

**Expected logs (in order):**
```
🎨 开发模式：初始化模拟像素数据...
✅ 模拟像素数据已生成，可通过 window.__MOCK_PIXELS__ 访问
🗺️ Map loaded, initializing pixel layers...
✅ SDF icon registered: 64 px with 8 px padding
🎨 GeoJSON mock source added: 5000 features
✅ Base color layer added (SDF symbols)
✅ Base emoji layer added (text symbols)
🎉 Map initialization complete!
```

**Verify data:**
```javascript
window.__MOCK_PIXELS__        // Array of 5000 pixels
window.__TEST_MAP__           // MapLibre GL instance
```

### Step 4: Visual Check (2 minutes)

#### ✅ Basic Rendering
- **Zoom level 14** around Hangzhou, China
- **Colored squares visible** (most pixels should be colored)
- **Emoji visible** (🔥, 🌳, 🏢, etc.) - should be colorful
- **No flickering** or loading errors

#### ✅ Zoom Test
1. **Zoom IN** (scroll up or +):
   - Pixels grow smoothly
   - No "popping" or sudden jumps
   - Squares stay edge-to-edge (no gaps)

2. **Zoom OUT** (scroll down or -):
   - Pixels shrink smoothly
   - No overlapping
   - Continuous rendering

#### ✅ Pan Test
1. **Click and drag** slowly across map
2. Look for **tile boundaries** (256px grid)
3. **Should see NO SEAMS** - pixels continuous across tiles

#### ✅ Interaction Test
1. **Click any pixel** → Popup appears with:
   - Pixel ID
   - Type (color/emoji/complex)
   - Color swatch or emoji symbol
   - Timestamp

2. **Hover over pixels** → Cursor changes to pointer

### Step 5: Performance Check (30 seconds)

**Console command:**
```javascript
// Monitor frame rate
let frameCount = 0;
let lastTime = performance.now();
setInterval(() => {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
}, 16);
```

**Expected:** FPS ≥ 30 (preferably 55-60)

---

## ✅ Success Criteria

### Must Pass:
- [x] Map loads without errors
- [x] 5000 pixels visible on map
- [x] Zoom smooth (no overlap/gaps)
- [x] No tile seams visible
- [x] Click interaction works
- [x] Console shows success logs
- [x] FPS ≥ 30

### Bonus Checks:
- [ ] Emoji colorful (not monochrome)
- [ ] No console errors or warnings
- [ ] Memory stable (DevTools → Memory)
- [ ] Hotpatch batching logs appear (if WebSocket active)

---

## 🐛 Common Issues

### Issue: Map not loading
**Check:** Console for errors
**Fix:** Ensure dev server running, refresh page

### Issue: No pixels visible
**Check:** Console for "5000 features" log
**Fix:** Verify `window.__MOCK_PIXELS__` exists

### Issue: Pixels have seams
**Check:** Zoom level (seams more visible at 16-18)
**Fix:** This indicates Polygon rendering, not Point+SDF

### Issue: Emoji appear as squares (□)
**Check:** Browser emoji support
**Fix:** Test in Chrome/Firefox, check console for font warnings

### Issue: Low FPS (<30)
**Check:** GPU acceleration enabled
**Fix:** chrome://gpu → Check WebGL status

---

## 📊 Full Test Suite

For comprehensive testing, see:

1. **Visual QA:** `scripts/visual-zoom-check.md` (7 checklists)
2. **Architecture:** `docs/POINT_SDF_ARCHITECTURE.md`
3. **Results:** `TEST_RESULTS.md`

---

## 🎯 Quick Commands

```bash
# Run automated tests
node scripts/test-mock-generator.js          # Mock data validation
node scripts/test-hotpatch-batching.js --unit-test  # Batching test

# Start dev server
cd frontend && npm run dev

# TypeScript check
cd frontend && npx tsc --noEmit --skipLibCheck
```

---

## 📞 Help

**No pixels?** Check `window.__MOCK_PIXELS__.length`
**Console errors?** Check TypeScript compilation
**Performance issues?** Check GPU acceleration
**Still stuck?** Review `TEST_RESULTS.md` → Support section

---

**Total time:** ~5 minutes
**Expected result:** Working Point + SDF architecture with 5000 mock pixels
**Next step:** Complete visual-zoom-check.md for production validation
