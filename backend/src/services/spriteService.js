/**
 * Production Sprite Service
 *
 * Features:
 * - Server-side emoji rendering (twemoji)
 * - Complex image resizing with Sharp (nearest-neighbor)
 * - LRU cache (max 10k sprites)
 * - Immutable caching headers
 */

const { LRUCache } = require('lru-cache');
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { db } = require('../config/database');
const twemoji = require('twemoji');
const materialAssetService = require('./materialAssetService');

// LRU cache for generated sprites (max 10k items, ~100MB)
const spriteCache = new LRUCache({
  max: 10000,
  maxSize: 100 * 1024 * 1024,
  sizeCalculation: (value) => value.length,
  ttl: 1000 * 60 * 60 * 24 // 24 hours
});

// Twemoji CDN base URL
const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72';

// Sprite version for cache-busting (increment when emoji rendering changes)
const SPRITE_VERSION = 'v2';

/**
 * Get sprite icon (emoji, complex pattern, or color)
 *
 * @param {string} key - Icon key (emoji codepoint, pattern UUID, or color pattern key)
 * @param {number} scale - Scale factor (1, 2, or 3)
 * @param {string} type - Icon type ('emoji', 'complex', or 'color')
 * @returns {Promise<Buffer>} - PNG buffer
 */
async function getSprite(key, scale = 1, type = 'emoji') {
  const cacheKey = `${type}:${key}:${scale}`;

  logger.info(`🎨 getSprite called: key="${key}", type=${type}, scale=${scale}`);

  // Check cache
  const cached = spriteCache.get(cacheKey);
  if (cached) {
    logger.info(`✅ Cache hit for ${cacheKey}, size=${cached.length} bytes`);
    return cached;
  }

  try {
    let pngBuffer;

    if (type === 'emoji') {
      logger.info(`📥 Rendering emoji: "${key}"`);
      pngBuffer = await renderEmoji(key, scale);
      logger.info(`✅ Emoji rendered successfully, size=${pngBuffer.length} bytes`);
    } else if (type === 'complex') {
      logger.info(`📥 Rendering complex pattern: "${key}"`);
      pngBuffer = await renderComplex(key, scale);
      logger.info(`✅ Complex rendered successfully, size=${pngBuffer.length} bytes`);
    } else if (type === 'color') {
      logger.info(`📥 Rendering color pattern: "${key}"`);
      pngBuffer = await renderColor(key, scale);
      logger.info(`✅ Color rendered successfully, size=${pngBuffer.length} bytes`);
    } else {
      throw new Error(`Unknown sprite type: ${type}`);
    }

    // Cache the result (user avatars use shorter TTL since they can change)
    const isUserAvatar = type === 'complex' && key.startsWith('user_avatar_');
    spriteCache.set(cacheKey, pngBuffer, isUserAvatar ? { ttl: 1000 * 60 * 5 } : undefined); // 5 min for avatars

    return pngBuffer;

  } catch (error) {
    logger.error(`❌ Sprite generation failed: ${cacheKey}`, error);
    logger.error(`❌ Returning fallback icon for ${cacheKey}`);

    // Return fallback icon
    return createFallbackIcon(scale);
  }
}

/**
 * Render emoji using Twemoji
 */
async function renderEmoji(emoji, scale) {
  const size = 64 * scale; // Base size 64px
  const padding = 8 * scale; // Padding to match SDF square (8px at scale 1)
  const emojiSize = size - 2 * padding; // Actual emoji rendering size (48px at scale 1)

  // Get codepoint(s) for the emoji
  const codepoint = getEmojiCodepoint(emoji);
  const urls = [
    // Try 72x72 first (original size)
    `${TWEMOJI_CDN}/${codepoint}.png`,
    // Try alternative CDN path
    `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${codepoint}.png`,
    // Try GitHub raw content
    `https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/${codepoint}.png`
  ];

  for (const url of urls) {
    try {
      logger.info(`📥 Loading emoji "${emoji}" from: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: {
          'User-Agent': 'FunnyPixels/1.0'
        }
      });

      // 🔧 修复：Resize emoji to match SDF square's effective size (with padding)
      // 由于emoji可能不是正方形（如⚔️是72x70），需要特殊处理
      // Step 1: 先resize到最大可能的尺寸（保持宽高比）
      const resizedEmoji = await sharp(response.data)
        .resize(emojiSize, emojiSize, {
          kernel: 'nearest',
          fit: 'inside', // 保持宽高比，确保不超出emojiSize x emojiSize
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      // Step 2: 获取resize后的实际尺寸
      const resizedMeta = await sharp(resizedEmoji).metadata();

      // Step 3: 创建emojiSize x emojiSize的透明画布
      const emojiCanvas = await sharp({
        create: {
          width: emojiSize,
          height: emojiSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .png()
        .toBuffer();

      // Step 4: 计算居中位置
      const offsetX = Math.floor((emojiSize - resizedMeta.width) / 2);
      const offsetY = Math.floor((emojiSize - resizedMeta.height) / 2);

      // Step 5: 将resize后的emoji居中放置到画布上（使其成为正方形）
      const squaredEmoji = await sharp(emojiCanvas)
        .composite([{
          input: resizedEmoji,
          top: offsetY,
          left: offsetX
        }])
        .png()
        .toBuffer();

      // Step 6: 添加外层padding，创建最终的size x size sprite (64x64 for scale 1)
      const finalBuffer = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([{
          input: squaredEmoji,
          top: padding,
          left: padding
        }])
        .png({ compressionLevel: 6 })
        .toBuffer();

      logger.info(`✅ Successfully loaded emoji "${emoji}" from Twemoji CDN (${emojiSize}px with ${padding}px padding, centered to square)`);
      return finalBuffer;

    } catch (error) {
      logger.warn(`⚠️ Failed to load from ${url}: ${error.message}`);
      continue; // Try next URL
    }
  }

  // All URLs failed - use fallback
  logger.error(`❌ All emoji loading methods failed for "${emoji}", using fallback icon`);
  return createEmojiFallbackIcon(emoji, scale);
}

/**
 * Create emoji fallback icon with better visual
 * Shows the emoji character (grayscale) on a neutral background
 * 🔧 Modified to match SDF square padding (8px)
 */
async function createEmojiFallbackIcon(emoji, scale) {
  const size = 64 * scale;
  const padding = 8 * scale;
  const innerSize = size - 2 * padding;

  // Create a better-looking fallback with neutral background
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}"
            fill="#374151" stroke="#1F2937" stroke-width="${Math.max(1, scale * 2)}"
            rx="${innerSize * 0.125}"/>
      <text x="50%" y="50%" dy=".35em" text-anchor="middle" dominant-baseline="central"
            font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, EmojiSymbols, sans-serif"
            font-size="${innerSize * 0.7}"
            fill="#FFFFFF">
        ${emoji}
      </text>
    </svg>`;

  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

/**
 * Render color pattern as solid color square
 */
async function renderColor(patternKey, scale) {
  const size = 64 * scale; // Base size 64px
  const padding = 8 * scale; // Padding to match emoji square (8px at scale 1)
  const innerSize = size - 2 * padding; // Actual color square size (48px at scale 1)

  // Look up the pattern in database to get the color value
  const pattern = await db('pattern_assets')
    .where('key', patternKey)
    .select('color', 'name')
    .first();

  if (!pattern || !pattern.color) {
    logger.warn(`⚠️ Color pattern not found or missing color: ${patternKey}`);
    // Use a default color if pattern not found
    const defaultColor = '#CCCCCC';
    return renderColorSquare(defaultColor, size, padding, innerSize, scale);
  }

  logger.info(`🎨 Rendering color: ${pattern.color} for pattern: ${patternKey}`);
  return renderColorSquare(pattern.color, size, padding, innerSize, scale);
}

/**
 * Render a solid color square with padding
 */
async function renderColorSquare(color, size, padding, innerSize, scale) {
  // Create SVG with solid color square
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}"
            fill="${color}" rx="${innerSize * 0.125}"/>
    </svg>`;

  const pngBuffer = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 6 })
    .toBuffer();

  return pngBuffer;
}

/**
 * Render avatar sprite directly from pixel data (comma-separated hex colors)
 * Uses Sharp to create PNG from raw RGBA buffer — no Canvas dependency needed
 */
function renderAvatarFromPixelData(pixelData, outputSize) {
  const colorArray = pixelData.split(',');
  const gridSize = Math.round(Math.sqrt(colorArray.length));
  if (gridSize < 1 || gridSize * gridSize !== colorArray.length) {
    throw new Error(`Invalid pixel data: ${colorArray.length} colors, expected perfect square`);
  }

  // Create raw RGBA buffer at grid resolution
  const rawBuffer = Buffer.alloc(gridSize * gridSize * 4);
  for (let i = 0; i < colorArray.length; i++) {
    const hex = colorArray[i].trim().replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const offset = i * 4;
    rawBuffer[offset] = r;
    rawBuffer[offset + 1] = g;
    rawBuffer[offset + 2] = b;
    rawBuffer[offset + 3] = 255; // fully opaque
  }

  // Create PNG: raw pixels → resize to output size with nearest-neighbor
  return sharp(rawBuffer, { raw: { width: gridSize, height: gridSize, channels: 4 } })
    .resize(outputSize, outputSize, { kernel: 'nearest', fit: 'cover' })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Render complex pattern/material
 */
async function renderComplex(patternId, scale) {
  const size = 64 * scale;

  let asset = null;

  // Special handling for user avatars: dynamically query from users table
  // 用户头像不预存在 pattern_assets，避免每次更新头像都写数据库
  if (patternId.startsWith('user_avatar_')) {
    const userId = patternId.replace('user_avatar_', '');
    const user = await db('users')
      .where('id', userId)
      .select('avatar_url', 'avatar')
      .first();

    if (user && user.avatar) {
      // Render directly from pixel data (source of truth, avoids broken PNG files)
      logger.info(`🎨 Rendering user avatar from pixel data: userId=${userId}, pixelCount=${user.avatar.split(',').length}`);
      try {
        const pngBuffer = renderAvatarFromPixelData(user.avatar, size);
        if (pngBuffer) return pngBuffer;
      } catch (pixelError) {
        logger.warn(`⚠️ Failed to render from pixel data, falling back to avatar_url: ${pixelError.message}`);
      }
    }

    if (user && user.avatar_url) {
      logger.info(`🔍 动态加载用户头像: userId=${userId}, url=${user.avatar_url}`);
      asset = {
        file_url: user.avatar_url,
        imageUrl: user.avatar_url
      };
    } else if (!user) {
      logger.warn(`⚠️ 用户头像未找到: ${patternId}`);
    }
  } else {
    // First try to find in pattern_assets table (for custom flags and other patterns)
    // We search by key or ID as they are the reliable identifiers
    asset = await db('pattern_assets')
      .where(function () {
        this.where({ key: patternId });
        if (!isNaN(patternId)) {
          this.orWhere({ id: parseInt(patternId) });
        }
      })
      .whereNull('deleted_at')
      .first();
  }

  // Legacy: try patterns table if not found (skip for user_avatar_)
  if (!asset && !patternId.startsWith('user_avatar_')) {
    const pattern = await db('patterns')
      .where({ id: patternId })
      .orWhere({ material_id: patternId })
      .first();

    if (pattern) {
      asset = {
        file_url: pattern.image_url || pattern.asset_url,
        file_path: pattern.file_path,
        material_id: pattern.material_id // Keep material_id if available
      };
    }
  }

  // If asset found but no URL, try to infer path for custom flags
  if (asset) {
    const imageUrl = asset.file_url || asset.file_path;
    if (imageUrl) {
      // Use the found URL
      asset.imageUrl = imageUrl;
    }

    // If still no imageUrl, try to infer for custom flags
    if (!asset.imageUrl && patternId.startsWith('custom_flag_')) {
      // Try to infer custom flag file path
      logger.info(`🔍 Inferring custom flag path for: ${patternId}`);

      // List possible file variations
      const fs = require('fs');
      const path = require('path');

      const baseName = patternId;
      const possiblePaths = [
        `public/uploads/custom-flags/${baseName}.png`,
        `uploads/custom-flags/${baseName}.png`,
        `public/uploads/custom-flags/${baseName}_*.png`,
        `uploads/custom-flags/${baseName}_*.png`
      ];

      for (const possiblePath of possiblePaths) {
        if (possiblePath.includes('*')) {
          // Handle wildcard pattern
          const dirPath = possiblePath.substring(0, possiblePath.lastIndexOf('/'));
          const filePattern = possiblePath.substring(possiblePath.lastIndexOf('/') + 1);

          try {
            const files = fs.readdirSync(path.join(__dirname, '../', dirPath))
              .filter(file => file.startsWith(baseName) && file.endsWith('.png'));

            if (files.length > 0) {
              const fullPath = path.join(dirPath, files[0]);
              asset.imageUrl = `/${fullPath}`;
              logger.info(`✅ Found custom flag file: ${fullPath}`);
              break;
            }
          } catch (err) {
            // Directory doesn't exist, continue
          }
        } else {
          // Handle exact path
          const fullPath = path.join(__dirname, '../', possiblePath);
          if (fs.existsSync(fullPath)) {
            asset.imageUrl = `/${possiblePath}`;
            logger.info(`✅ Found custom flag file: ${possiblePath}`);
            break;
          }
        }
      }
    }
  }

  // Special handling for custom flags: try direct file lookup even if no DB record
  let imageUrl = asset?.imageUrl;

  if (!imageUrl && patternId.startsWith('custom_flag_')) {
    logger.info(`🔍 Direct file lookup for custom flag: ${patternId}`);

    const fs = require('fs');
    const path = require('path');

    const baseName = patternId;
    const possibleDirs = [
      'public/uploads/custom-flags',
      'uploads/custom-flags',
      'src/public/uploads/custom-flags'
    ];

    for (const dir of possibleDirs) {
      try {
        const fullDirPath = path.join(__dirname, '../', dir);
        if (fs.existsSync(fullDirPath)) {
          const files = fs.readdirSync(fullDirPath)
            .filter(file => file.startsWith(baseName) && file.endsWith('.png'));

          if (files.length > 0) {
            // Determine correct URL path based on directory
            let urlPath;
            if (dir.startsWith('public/')) {
              urlPath = `/${dir.substring(7)}/${files[0]}`; // Remove 'public/' prefix
            } else if (dir.startsWith('src/public/')) {
              urlPath = `/${dir.substring(11)}/${files[0]}`; // Remove 'src/public/' prefix
            } else {
              urlPath = `/${dir}/${files[0]}`;
            }

            imageUrl = urlPath;
            logger.info(`✅ Found custom flag file: ${dir}/${files[0]} -> ${urlPath}`);
            break;
          }
        }
      } catch (err) {
        // Directory doesn't exist, continue
      }
    }
  }

  if (!imageUrl) {
    // If no direct URL, check Material system
    const materialId = asset?.material_id || patternId;
    const materialVersion = asset?.material_version;

    logger.info(`🔍 Checking Material system for: ${materialId} (version: ${materialVersion || 'latest'})`);

    try {
      // Get the active sprite_sheet variant for this material
      const variant = await materialAssetService.getActiveVariant(materialId, 'sprite_sheet', materialVersion);

      if (variant) {
        if (variant.storage_key && process.env.CDN_BASE_URL) {
          imageUrl = `${process.env.CDN_BASE_URL}/${variant.storage_key}`;
          logger.info(`✅ Found Material variant URL: ${imageUrl}`);
        } else if (variant.payload) {
          // If no CDN, but has payload, we use it directly
          const buffer = Buffer.from(variant.payload, 'base64');
          logger.info(`✅ Using Material variant payload (${buffer.length} bytes)`);

          return sharp(buffer)
            .resize(size, size, { fit: 'fill' })
            .png()
            .toBuffer();
        }
      }
    } catch (materialError) {
      logger.warn(`⚠️ Material lookup failed for ${materialId}:`, materialError.message);
    }
  }

  if (!imageUrl) {
    logger.info(`🗂️ Using OSM fallback for: ${patternId} (no image URL found)`);
    return createOSMFallbackIcon(patternId, scale);
  }

  // Convert HTTP URLs to local file paths and load from filesystem
  let localFilePath = null;

  // backend root: backend/src/services -> ../../ -> backend/
  const backendRoot = path.resolve(__dirname, '..', '..');

  if (imageUrl.startsWith('http')) {
    // Convert HTTP URL to local file path
    // Match any local server URL (localhost, LAN IPs, configured base URL) containing /uploads/
    const uploadsIndex = imageUrl.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      const relativePath = imageUrl.substring(uploadsIndex + 1); // strip leading '/' -> uploads/materials/...
      localFilePath = path.join(backendRoot, 'public', relativePath);
      logger.info(`🔄 Converting HTTP URL to local path: ${imageUrl} -> ${localFilePath}`);
    } else {
      // External URL, try HTTP download
      logger.info(`🌐 Loading external URL: ${imageUrl}`);
    }
  } else if (imageUrl.startsWith('/')) {
    // Already a local path
    if (imageUrl.startsWith('/uploads/')) {
      localFilePath = path.join(backendRoot, 'public', imageUrl.substring(1));
    } else {
      localFilePath = path.join(backendRoot, imageUrl);
    }
  } else {
    // Relative path
    localFilePath = path.join(backendRoot, imageUrl);
  }

  // Try to load from local filesystem first
  if (localFilePath && fs.existsSync(localFilePath)) {
    try {
      logger.info(`📁 Loading image from local filesystem: ${localFilePath}`);
      const imageBuffer = fs.readFileSync(localFilePath);

      // Resize using Sharp with nearest-neighbor (preserve pixel-art style)
      const pngBuffer = await sharp(imageBuffer)
        .resize(size, size, {
          kernel: 'nearest', // Critical: preserve pixel-art aesthetics
          fit: 'cover'
        })
        .png({ compressionLevel: 6 })
        .toBuffer();

      logger.info(`✅ Successfully loaded and resized local image: ${patternId}`);
      return pngBuffer;
    } catch (fileError) {
      logger.warn(`⚠️ Failed to process local file: ${localFilePath}, trying HTTP fallback`, fileError.message);
    }
  }

  // Fallback to HTTP download for external URLs or if local file fails
  if (imageUrl.startsWith('http') && (!localFilePath || !fs.existsSync(localFilePath))) {
    try {
      logger.info(`🌐 Downloading image via HTTP: ${imageUrl}`);

      // 🔧 特殊处理：DiceBear SVG头像需要增加超时时间
      const isDiceBear = imageUrl.includes('dicebear.com');
      const timeout = isDiceBear ? 10000 : 5000; // DiceBear使用10秒超时

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: timeout,
        headers: {
          'User-Agent': 'FunnyPixels-SpriteService/1.0'
        }
      });

      // Resize using Sharp with nearest-neighbor (preserve pixel-art style)
      // 🔧 DiceBear返回SVG，Sharp可以直接处理
      const pngBuffer = await sharp(response.data)
        .resize(size, size, {
          kernel: isDiceBear ? 'lanczos3' : 'nearest', // SVG用lanczos3，像素艺术用nearest
          fit: 'cover',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // 透明背景
        })
        .png({ compressionLevel: 6 })
        .toBuffer();

      logger.info(`✅ Successfully loaded and resized HTTP image: ${patternId} (DiceBear: ${isDiceBear})`);
      return pngBuffer;
    } catch (downloadError) {
      logger.warn(`⚠️ Failed to download image via HTTP: ${imageUrl}`, downloadError.message);

      // 🔧 对于DiceBear失败，使用基于用户ID的默认颜色，而不是灰色问号
      if (imageUrl.includes('dicebear.com') && patternId.startsWith('user_avatar_')) {
        logger.info(`🎨 DiceBear failed, using PersonalColorPalette fallback for: ${patternId}`);
        const userId = patternId.replace('user_avatar_', '');
        return renderPersonalColorAvatar(userId, size);
      }
    }
  }

  // If all loading methods fail, use intelligent fallback
  // 🔧 对于用户头像，使用PersonalColorPalette而不是灰色问号
  if (patternId.startsWith('user_avatar_')) {
    logger.warn(`🎨 All loading methods failed for user avatar, using PersonalColorPalette fallback: ${patternId}`);
    const userId = patternId.replace('user_avatar_', '');
    return renderPersonalColorAvatar(userId, size);
  }

  // For other patterns, use OSM fallback
  logger.warn(`🗂️ Using OSM fallback for: ${patternId} (all loading methods failed)`);
  return createOSMFallbackIcon(patternId, scale);
}

/**
 * 渲染基于PersonalColorPalette的默认头像
 * 用于DiceBear失败时的回退
 * ✅ 重要：从pattern_assets表查询颜色，数据库是唯一数据源
 */
async function renderPersonalColorAvatar(userId, size) {
  const crypto = require('crypto');

  // PersonalColorPalette - 16色hex值（与iOS端一致）
  // 仅用于计算索引和生成pattern key，实际颜色值从数据库获取
  const colorHexValues = [
    'e53e3e',  // 红色
    'dd6b20',  // 橙色
    'd69e2e',  // 黄色
    '38a169',  // 绿色
    '319795',  // 青色
    '3182ce',  // 蓝色
    '5a67d8',  // 靛蓝
    '805ad5',  // 紫色
    'd53f8c',  // 粉色
    'c53030',  // 深红
    '2d3748',  // 灰色
    '744210',  // 棕色
    '276749',  // 深绿
    '2a4365',  // 深蓝
    '553c9a',  // 深紫
    '97266d'   // 深粉
  ];

  // 使用SHA256哈希userId，与iOS端逻辑一致
  const hash = crypto.createHash('sha256').update(userId).digest();
  const index = hash[0] % colorHexValues.length;
  const colorHex = colorHexValues[index];

  // 生成pattern key（与iOS端AllianceDrawingPatternProvider一致）
  const patternKey = `personal_color_${colorHex}`;

  // 从pattern_assets表查询颜色（数据库是唯一数据源）
  const pattern = await db('pattern_assets')
    .where('key', patternKey)
    .select('color', 'name')
    .first();

  if (!pattern || !pattern.color) {
    logger.warn(`⚠️ Personal color pattern not found in DB: ${patternKey}, using fallback`);
    // 如果数据库中找不到，使用硬编码fallback（应该不会发生）
    const fallbackColor = `#${colorHex.toUpperCase()}`;
    logger.info(`🎨 Personal color avatar for userId=${userId.substring(0, 8)}...: ${fallbackColor} (index=${index}, FALLBACK)`);
    const padding = 8;
    const innerSize = size - 2 * padding;
    return renderColorSquare(fallbackColor, size, padding, innerSize, 1);
  }

  logger.info(`🎨 Personal color avatar for userId=${userId.substring(0, 8)}...: ${pattern.color} (index=${index}, from DB: ${patternKey})`);

  // 渲染方格（像素格子），与其他颜色pattern保持一致
  const padding = 8;
  const innerSize = size - 2 * padding;
  return renderColorSquare(pattern.color, size, padding, innerSize, 1);
}

/**
 * Generate simple SVG icon for OSM fallback
 */
async function generateSimpleSVGIcon(iconConfig, size) {
  const svg = `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${iconConfig.bg || '#E5E7EB'}" rx="${size * 0.125}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.28}" fill="${iconConfig.fg || '#6B7280'}"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${size * 0.28}" fill="#FFFFFF" font-weight="600">
      ${iconConfig.glyph || '?'}
    </text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Get OSM icon configuration for different pattern types
 */
function getOSMIconConfig(patternId) {
  const map = {
    office: { glyph: 'O', bg: '#E0F2FE', fg: '#0284C7' },
    swimming_pool: { glyph: 'P', bg: '#E0F7FA', fg: '#0EA5E9' },
    gate: { glyph: 'G', bg: '#F1F5F9', fg: '#475569' },
    lift_gate: { glyph: 'LG', bg: '#F1F5F9', fg: '#475569' },
    sports_centre: { glyph: 'S', bg: '#ECFCCB', fg: '#65A30D' },
    ferry_terminal: { glyph: 'F', bg: '#F5F3FF', fg: '#7C3AED' },
    // Additional common OSM features
    hospital: { glyph: 'H', bg: '#FEE2E2', fg: '#DC2626' },
    school: { glyph: 'S', bg: '#FEF3C7', fg: '#D97706' },
    shop: { glyph: 'S', bg: '#F3E8FF', fg: '#9333EA' },
    restaurant: { glyph: 'R', bg: '#FED7AA', fg: '#EA580C' },
    parking: { glyph: 'P', bg: '#E5E7EB', fg: '#374151' },
    pharmacy: { glyph: 'P', bg: '#DBEAFE', fg: '#2563EB' },
    bank: { glyph: 'B', bg: '#DCFCE7', fg: '#16A34A' },
    fuel: { glyph: 'F', bg: '#FFEDD5', fg: '#C2410C' },
    hotel: { glyph: 'H', bg: '#FCE7F3', fg: '#BE185D' },
    library: { glyph: 'L', bg: '#E0E7FF', fg: '#4F46E5' }
  };
  return map[patternId] || { glyph: '·', bg: '#E5E7EB', fg: '#6B7280' };
}

/**
 * Create OSM fallback icon for missing complex patterns
 */
async function createOSMFallbackIcon(patternId, scale = 1) {
  const base = 64 * Math.max(1, Math.min(scale, 4));
  const iconConfig = getOSMIconConfig(patternId);
  return generateSimpleSVGIcon(iconConfig, base);
}

/**
 * Create fallback icon (gray square with border) - kept for emoji fallbacks
 */
async function createFallbackIcon(scale) {
  const size = 64 * scale;

  // Create a better-looking fallback icon (gray square with border)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#666666" stroke="#333333" stroke-width="${Math.max(1, scale * 2)}" rx="${size * 0.125}"/>
      <text x="${size / 2}" y="${size / 2 + scale * 8}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${scale * 16}" font-weight="bold">?</text>
    </svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

/**
 * Convert emoji to Unicode codepoint (for Twemoji CDN)
 * Filters out variation selectors (FE0F, FEOF) since Twemoji doesn't use them in filenames
 */
function getEmojiCodepoint(emoji) {
  const codepoints = [];

  for (const char of emoji) {
    const code = char.codePointAt(0);
    if (code) {
      // Skip variation selectors (FE0F, FE0E) as Twemoji doesn't use them in filenames
      if (code !== 0xFE0F && code !== 0xFE0E) {
        codepoints.push(code.toString(16));
      }
    }
  }

  return codepoints.join('-');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    size: spriteCache.size,
    calculatedSize: spriteCache.calculatedSize,
    maxSize: spriteCache.maxSize
  };
}

/**
 * Clear sprite cache
 */
function clearCache() {
  spriteCache.clear();
  logger.warn('⚠️ Sprite cache cleared');
}

module.exports = {
  getSprite,
  renderComplex,
  renderColor,
  createOSMFallbackIcon,
  createFallbackIcon,
  getCacheStats,
  clearCache,
  SPRITE_VERSION
};
// Force reload
