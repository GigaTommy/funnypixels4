/**
 * 性能指标收集器
 * 收集和监控系统性能指标
 */

class PerformanceMetrics {
  constructor() {
    this.metrics = {
      // 瓦片渲染指标
      tileRenderTime: [],
      tileRenderCount: 0,
      tileCacheHits: 0,
      tileCacheMisses: 0,
      
      // WebSocket广播指标
      wsBroadcastSize: [],
      wsBroadcastCount: 0,
      wsConnections: 0,
      wsRooms: 0,
      
      // 数据库指标
      dbQueryTime: [],
      dbQueryCount: 0,
      dbConnectionPool: {
        active: 0,
        idle: 0,
        total: 0
      },
      
      // 内存指标
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0
      },
      
      // 系统指标
      cpuUsage: 0,
      uptime: 0,
      timestamp: Date.now()
    };
    
    this.startTime = Date.now();
    this.setupPeriodicCollection();
  }
  
  /**
   * 设置定期收集
   */
  setupPeriodicCollection() {
    // 每5秒收集一次系统指标
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5000);
    
    // 每30秒清理旧数据
    setInterval(() => {
      this.cleanupOldData();
    }, 30000);
  }
  
  /**
   * 记录瓦片渲染时间
   * @param tileId - 瓦片ID
   * @param renderTime - 渲染时间
   */
  recordTileRenderTime(tileId, renderTime) {
    this.metrics.tileRenderTime.push({
      tileId,
      renderTime,
      timestamp: Date.now()
    });
    
    this.metrics.tileRenderCount++;
    
    // 保持最近1000条记录
    if (this.metrics.tileRenderTime.length > 1000) {
      this.metrics.tileRenderTime = this.metrics.tileRenderTime.slice(-1000);
    }
  }
  
  /**
   * 记录瓦片缓存命中
   * @param hit - 是否命中
   */
  recordTileCacheHit(hit) {
    if (hit) {
      this.metrics.tileCacheHits++;
    } else {
      this.metrics.tileCacheMisses++;
    }
  }
  
  /**
   * 记录WebSocket广播大小
   * @param roomId - 房间ID
   * @param size - 广播大小
   */
  recordBroadcastSize(roomId, size) {
    this.metrics.wsBroadcastSize.push({
      roomId,
      size,
      timestamp: Date.now()
    });
    
    this.metrics.wsBroadcastCount++;
    
    // 保持最近1000条记录
    if (this.metrics.wsBroadcastSize.length > 1000) {
      this.metrics.wsBroadcastSize = this.metrics.wsBroadcastSize.slice(-1000);
    }
  }
  
  /**
   * 记录数据库查询时间
   * @param query - 查询名称
   * @param duration - 查询时间
   */
  recordDbQueryTime(query, duration) {
    this.metrics.dbQueryTime.push({
      query,
      duration,
      timestamp: Date.now()
    });
    
    this.metrics.dbQueryCount++;
    
    // 保持最近1000条记录
    if (this.metrics.dbQueryTime.length > 1000) {
      this.metrics.dbQueryTime = this.metrics.dbQueryTime.slice(-1000);
    }
  }
  
  /**
   * 更新WebSocket连接数
   * @param connections - 连接数
   * @param rooms - 房间数
   */
  updateWebSocketStats(connections, rooms) {
    this.metrics.wsConnections = connections;
    this.metrics.wsRooms = rooms;
  }
  
  /**
   * 更新数据库连接池状态
   * @param poolStats - 连接池统计信息
   */
  updateDbPoolStats(poolStats) {
    this.metrics.dbConnectionPool = {
      active: poolStats.active || 0,
      idle: poolStats.idle || 0,
      total: poolStats.total || 0
    };
  }
  
  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.memoryUsage = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    };
    
    this.metrics.cpuUsage = cpuUsage.user + cpuUsage.system;
    this.metrics.uptime = process.uptime();
    this.metrics.timestamp = Date.now();
  }
  
  /**
   * 清理旧数据
   */
  cleanupOldData() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟
    
    // 清理瓦片渲染时间数据
    this.metrics.tileRenderTime = this.metrics.tileRenderTime.filter(
      item => now - item.timestamp < maxAge
    );
    
    // 清理WebSocket广播数据
    this.metrics.wsBroadcastSize = this.metrics.wsBroadcastSize.filter(
      item => now - item.timestamp < maxAge
    );
    
    // 清理数据库查询数据
    this.metrics.dbQueryTime = this.metrics.dbQueryTime.filter(
      item => now - item.timestamp < maxAge
    );
  }
  
  /**
   * 获取性能报告
   * @returns 性能报告
   */
  getPerformanceReport() {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    return {
      // 瓦片渲染统计
      tileRender: {
        avgRenderTime: this.calculateAverage(this.metrics.tileRenderTime, 'renderTime'),
        totalRenders: this.metrics.tileRenderCount,
        cacheHitRate: this.calculateCacheHitRate(),
        recentRenders: this.metrics.tileRenderTime.length
      },
      
      // WebSocket统计
      websocket: {
        avgBroadcastSize: this.calculateAverage(this.metrics.wsBroadcastSize, 'size'),
        totalBroadcasts: this.metrics.wsBroadcastCount,
        activeConnections: this.metrics.wsConnections,
        activeRooms: this.metrics.wsRooms,
        recentBroadcasts: this.metrics.wsBroadcastSize.length
      },
      
      // 数据库统计
      database: {
        avgQueryTime: this.calculateAverage(this.metrics.dbQueryTime, 'duration'),
        totalQueries: this.metrics.dbQueryCount,
        connectionPool: this.metrics.dbConnectionPool,
        recentQueries: this.metrics.dbQueryTime.length
      },
      
      // 系统统计
      system: {
        memoryUsage: this.metrics.memoryUsage,
        cpuUsage: this.metrics.cpuUsage,
        uptime: this.metrics.uptime,
        totalUptime: uptime
      },
      
      // 时间戳
      timestamp: now
    };
  }
  
  /**
   * 计算平均值
   * @param data - 数据数组
   * @param field - 字段名
   * @returns 平均值
   */
  calculateAverage(data, field) {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + item[field], 0);
    return sum / data.length;
  }
  
  /**
   * 计算缓存命中率
   * @returns 缓存命中率
   */
  calculateCacheHitRate() {
    const total = this.metrics.tileCacheHits + this.metrics.tileCacheMisses;
    return total > 0 ? this.metrics.tileCacheHits / total : 0;
  }
  
  /**
   * 获取实时指标
   * @returns 实时指标
   */
  getRealtimeMetrics() {
    return {
      wsConnections: this.metrics.wsConnections,
      wsRooms: this.metrics.wsRooms,
      dbPool: this.metrics.dbConnectionPool,
      memory: this.metrics.memoryUsage,
      uptime: this.metrics.uptime,
      timestamp: Date.now()
    };
  }
  
  /**
   * 重置指标
   */
  reset() {
    this.metrics = {
      tileRenderTime: [],
      tileRenderCount: 0,
      tileCacheHits: 0,
      tileCacheMisses: 0,
      wsBroadcastSize: [],
      wsBroadcastCount: 0,
      wsConnections: 0,
      wsRooms: 0,
      dbQueryTime: [],
      dbQueryCount: 0,
      dbConnectionPool: {
        active: 0,
        idle: 0,
        total: 0
      },
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0
      },
      cpuUsage: 0,
      uptime: 0,
      timestamp: Date.now()
    };
    
    this.startTime = Date.now();
  }
  
  /**
   * 导出指标数据
   * @returns 指标数据
   */
  export() {
    return {
      metrics: this.metrics,
      startTime: this.startTime,
      exportTime: Date.now()
    };
  }
}

// 创建全局实例
const performanceMetrics = new PerformanceMetrics();

module.exports = performanceMetrics;
