const { db } = require('../config/database');
const logger = require('../utils/logger');
const geocodingService = require('./geocodingService');

/**
 * Async Geocoding Queue Service
 * Processes geocoding requests in the background without blocking pixel writes
 */
class GeocodingQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.batchSize = 50;
    this.processInterval = 2000; // Process every 2 seconds
    this.maxRetries = 3;
    this.processorInterval = null;
  }

  /**
   * Start the background processor
   */
  start() {
    if (this.processorInterval) {
      return;
    }

    logger.info('Starting geocoding queue processor');
    this.processorInterval = setInterval(() => {
      this.processQueue();
    }, this.processInterval);
  }

  /**
   * Stop the background processor
   */
  stop() {
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
      logger.info('Stopped geocoding queue processor');
    }
  }

  /**
   * Add pixel to geocoding queue
   * @param {Object} pixel - Pixel data with id, latitude, longitude
   */
  enqueue(pixel) {
    if (!pixel.id || !pixel.latitude || !pixel.longitude) {
      return;
    }

    this.queue.push({
      pixelId: pixel.id,
      gridId: pixel.grid_id,
      latitude: pixel.latitude,
      longitude: pixel.longitude,
      retries: 0,
      enqueuedAt: Date.now()
    });
  }

  /**
   * Add multiple pixels to geocoding queue
   * @param {Array} pixels - Array of pixel data
   */
  enqueueBatch(pixels) {
    for (const pixel of pixels) {
      this.enqueue(pixel);
    }
  }

  /**
   * Process queued geocoding requests
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Take a batch from the queue
      const batch = this.queue.splice(0, this.batchSize);

      if (batch.length === 0) {
        return;
      }

      logger.debug(`Processing geocoding batch: ${batch.length} pixels`);

      // Process each item with rate limiting
      const results = [];
      const failedItems = [];

      for (const item of batch) {
        try {
          const locationInfo = await geocodingService.reverseGeocodeWithTimeout(
            item.latitude,
            item.longitude,
            3000 // 3 second timeout for background processing
          );

          if (locationInfo.geocoded) {
            results.push({
              pixelId: item.pixelId,
              gridId: item.gridId,
              locationInfo
            });
          } else {
            // Retry later if geocoding failed
            if (item.retries < this.maxRetries) {
              item.retries++;
              failedItems.push(item);
            }
          }
        } catch (error) {
          logger.warn(`Geocoding failed for pixel ${item.pixelId}:`, error.message);
          if (item.retries < this.maxRetries) {
            item.retries++;
            failedItems.push(item);
          }
        }

        // Small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Batch update pixels with geocoding results
      if (results.length > 0) {
        await this.updatePixelsWithGeodata(results);
      }

      // Re-queue failed items
      if (failedItems.length > 0) {
        this.queue.push(...failedItems);
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Geocoding batch processed: ${results.length} updated, ${failedItems.length} retrying, ${processingTime}ms`);

    } catch (error) {
      logger.error('Geocoding queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Update pixels with geocoding data
   * @param {Array} results - Array of {pixelId, gridId, locationInfo}
   */
  async updatePixelsWithGeodata(results) {
    try {
      // Use transaction for batch update
      await db.transaction(async (trx) => {
        for (const result of results) {
          const { pixelId, locationInfo } = result;

          // Process city name
          let cityName = '未知城市';
          if (Array.isArray(locationInfo.city) && locationInfo.city.length > 0) {
            cityName = locationInfo.city[0];
          } else if (locationInfo.city && typeof locationInfo.city === 'string') {
            cityName = locationInfo.city;
          } else if (locationInfo.province) {
            cityName = locationInfo.province;
          }

          await trx('pixels')
            .where('id', pixelId)
            .update({
              country: locationInfo.country,
              province: locationInfo.province,
              city: cityName,
              district: locationInfo.district,
              adcode: locationInfo.adcode,
              formatted_address: locationInfo.formatted_address,
              geocoded: true,
              geocoded_at: new Date()
            });
        }
      });

      logger.debug(`Updated ${results.length} pixels with geocoding data`);
    } catch (error) {
      logger.error('Failed to update pixels with geocoding data:', error);
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
      processInterval: this.processInterval
    };
  }

  /**
   * Flush all remaining items (for graceful shutdown)
   */
  async flush() {
    logger.info(`Flushing geocoding queue: ${this.queue.length} items`);

    while (this.queue.length > 0) {
      await this.processQueue();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Singleton instance
const geocodingQueue = new GeocodingQueue();

module.exports = geocodingQueue;
