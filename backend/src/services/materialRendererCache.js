/**
 * 渲染器素材缓存
 * 管理图案素材在渲染流程中的内存缓存，提供失效机制
 */
class MaterialRendererCache {
  constructor() {
    this.patternCache = new Map();
    this.materialTextureCache = new Map();
    this.patternTTL = 5 * 60 * 1000; // 5 minutes
  }

  _now() {
    return Date.now();
  }

  _isExpired(entry) {
    if (!entry || !entry.expiresAt) {
      return false;
    }
    if (entry.expiresAt < this._now()) {
      return true;
    }
    return false;
  }

  getPattern(patternKey) {
    const cached = this.patternCache.get(patternKey);
    if (!cached) {
      return null;
    }

    if (this._isExpired(cached)) {
      this.patternCache.delete(patternKey);
      return null;
    }

    return cached.value;
  }

  setPattern(patternKey, value, ttl = this.patternTTL) {
    if (!patternKey) {
      return;
    }

    this.patternCache.set(patternKey, {
      value,
      expiresAt: this._now() + ttl
    });
  }

  invalidatePattern(patternKey) {
    if (!patternKey) {
      return;
    }
    this.patternCache.delete(patternKey);
  }

  invalidatePatternsByMaterial(materialId) {
    if (!materialId) {
      return;
    }

    for (const [key, entry] of this.patternCache.entries()) {
      if (entry?.value?.material_id === materialId) {
        this.patternCache.delete(key);
      }
    }
  }

  getMaterialTexture(cacheKey) {
    const cached = this.materialTextureCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (this._isExpired(cached)) {
      this.materialTextureCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  setMaterialTexture(cacheKey, value, ttl = this.patternTTL) {
    if (!cacheKey) {
      return;
    }

    this.materialTextureCache.set(cacheKey, {
      value,
      expiresAt: this._now() + ttl
    });
  }

  invalidateMaterial(materialId) {
    if (!materialId) {
      return;
    }

    for (const key of this.materialTextureCache.keys()) {
      if (key.startsWith(`${materialId}:`)) {
        this.materialTextureCache.delete(key);
      }
    }
  }

  clear() {
    this.patternCache.clear();
    this.materialTextureCache.clear();
  }
}

module.exports = new MaterialRendererCache();
