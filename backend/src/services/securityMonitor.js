const { redis, redisUtils } = require('../config/database');

class SecurityMonitor {
  constructor() {
    this.securityEvents = [];
    this.suspiciousIPs = new Map();
    this.failedLoginAttempts = new Map();
    this.rateLimitViolations = new Map();

    this.startMonitoring();
  }

  // 记录安全事件
  async logSecurityEvent(event) {
    const securityEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity || 'medium',
      ip: event.ip,
      userId: event.userId,
      userAgent: event.userAgent,
      details: event.details,
      action: event.action || 'logged'
    };

    // 添加到内存缓存
    this.securityEvents.push(securityEvent);

    // 保持最近1000个事件
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // 存储到Redis
    await this.storeSecurityEvent(securityEvent);

    // 检查是否需要告警
    await this.checkForAlerts(securityEvent);

    // 记录到控制台
    console.log(`🚨 安全事件: ${securityEvent.type} - ${securityEvent.ip} - ${securityEvent.details}`);

    return securityEvent;
  }

  // 生成事件ID
  generateEventId() {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 存储安全事件到Redis
  async storeSecurityEvent(event) {
    try {
      const key = `security_event:${event.id}`;
      await redisUtils.setex(key, 86400, JSON.stringify(event)); // 24小时过期

      // 添加到事件列表
      await redisUtils.lpush('security_events', event.id);
      await redisUtils.ltrim('security_events', 0, 999); // 保持最近1000个事件ID
    } catch (error) {
      console.error('存储安全事件失败:', error);
    }
  }

  // 检查告警条件
  async checkForAlerts(event) {
    const alerts = [];

    // 检查失败登录次数
    if (event.type === 'failed_login') {
      const failedCount = this.failedLoginAttempts.get(event.ip) || 0;
      this.failedLoginAttempts.set(event.ip, failedCount + 1);

      if (failedCount + 1 >= 5) {
        alerts.push({
          type: 'brute_force_attempt',
          severity: 'high',
          message: `检测到暴力破解尝试: ${event.ip}`,
          details: { failedAttempts: failedCount + 1 }
        });
      }
    }

    // 检查可疑IP活动
    if (event.type === 'suspicious_activity') {
      const suspiciousCount = this.suspiciousIPs.get(event.ip) || 0;
      this.suspiciousIPs.set(event.ip, suspiciousCount + 1);

      if (suspiciousCount + 1 >= 3) {
        alerts.push({
          type: 'suspicious_ip',
          severity: 'medium',
          message: `检测到可疑IP活动: ${event.ip}`,
          details: { suspiciousActivities: suspiciousCount + 1 }
        });
      }
    }

    // 检查速率限制违规
    if (event.type === 'rate_limit_violation') {
      const violationCount = this.rateLimitViolations.get(event.ip) || 0;
      this.rateLimitViolations.set(event.ip, violationCount + 1);

      if (violationCount + 1 >= 10) {
        alerts.push({
          type: 'rate_limit_abuse',
          severity: 'high',
          message: `检测到速率限制滥用: ${event.ip}`,
          details: { violations: violationCount + 1 }
        });
      }
    }

    // 发送告警
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  // 发送告警
  async sendAlert(alert) {
    const alertData = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      ...alert
    };

    // 存储告警
    await redisUtils.setex(`security_alert:${alertData.id}`, 86400, JSON.stringify(alertData));
    await redisUtils.lpush('security_alerts', alertData.id);

    // 记录告警
    console.error(`🚨 安全告警: ${alert.type} - ${alert.message}`);

    // 这里可以集成外部告警系统（邮件、短信、Slack等）
    // await this.sendExternalAlert(alertData);
  }

  // 记录失败登录
  async logFailedLogin(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'failed_login',
      severity: 'medium',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 记录成功登录
  async logSuccessfulLogin(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'successful_login',
      severity: 'low',
      ip,
      userId,
      details,
      action: 'allowed'
    });
  }

  // 记录可疑活动
  async logSuspiciousActivity(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'suspicious_activity',
      severity: 'medium',
      ip,
      userId,
      details,
      action: 'monitored'
    });
  }

  // 记录速率限制违规
  async logRateLimitViolation(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'rate_limit_violation',
      severity: 'medium',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 记录SQL注入尝试
  async logSQLInjectionAttempt(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'sql_injection_attempt',
      severity: 'high',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 记录XSS尝试
  async logXSSAttempt(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'xss_attempt',
      severity: 'high',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 记录未授权访问
  async logUnauthorizedAccess(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'unauthorized_access',
      severity: 'medium',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 记录权限提升尝试
  async logPrivilegeEscalationAttempt(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'privilege_escalation_attempt',
      severity: 'high',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 获取安全事件统计
  async getSecurityStats() {
    const stats = {
      totalEvents: this.securityEvents.length,
      eventsByType: {},
      eventsBySeverity: {},
      recentAlerts: [],
      suspiciousIPs: Array.from(this.suspiciousIPs.entries()),
      failedLoginAttempts: Array.from(this.failedLoginAttempts.entries()),
      rateLimitViolations: Array.from(this.rateLimitViolations.entries())
    };

    // 统计事件类型
    for (const event of this.securityEvents) {
      stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
      stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
    }

    // 获取最近告警
    try {
      const recentAlertIds = await redisUtils.lrange('security_alerts', 0, 9);
      for (const alertId of recentAlertIds) {
        const alertData = await redisUtils.get(`security_alert:${alertId}`);
        if (alertData) {
          stats.recentAlerts.push(JSON.parse(alertData));
        }
      }
    } catch (error) {
      console.error('获取告警数据失败:', error);
    }

    return stats;
  }

  // 记录GPS模拟尝试
  async logGPSSpoofingAttempt(ip, userId, details) {
    return await this.logSecurityEvent({
      type: 'gps_spoofing_attempt',
      severity: 'high',
      ip,
      userId,
      details,
      action: 'blocked'
    });
  }

  // 速度校验：检查两次采样点之间的速度是否异常
  // @param {Object} lastPos {lat, lng, timestamp}
  // @param {Object} currentPos {lat, lng, timestamp} 
  // @returns {boolean} true if speed is suspicious
  isSpeedSuspicious(lastPos, currentPos) {
    if (!lastPos) return false;

    const timeDiffSeconds = (currentPos.timestamp - lastPos.timestamp) / 1000;
    if (timeDiffSeconds <= 0) return true; // 零时间差或负时间差不正常

    const distance = this.calculateDistance(lastPos.lat, lastPos.lng, currentPos.lat, currentPos.lng);
    const speedKmh = (distance / 1000) / (timeDiffSeconds / 3600);

    // 预设上限：1200 km/h (喷气式客机巡航速度左右)
    // 对于大多数步行/跑步应用，这个值可以设置得更低 (例如 150 km/h)
    return speedKmh > 1200;
  }

  // 哈弗辛公式计算两点距离 (单位：米)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 地球半径
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // 检查IP是否被标记为可疑
  isIPSuspicious(ip) {
    const suspiciousCount = this.suspiciousIPs.get(ip) || 0;
    return suspiciousCount >= 3;
  }

  // 检查IP是否被标记为暴力破解
  isIPBruteForce(ip) {
    const failedCount = this.failedLoginAttempts.get(ip) || 0;
    return failedCount >= 5;
  }

  // 检查IP是否被标记为速率限制滥用
  isIPRateLimitAbuse(ip) {
    const violationCount = this.rateLimitViolations.get(ip) || 0;
    return violationCount >= 10;
  }

  // 清理过期的IP记录
  cleanupExpiredRecords() {
    const now = Date.now();
    const expirationTime = 24 * 60 * 60 * 1000; // 24小时

    // 清理失败登录记录
    for (const [ip, timestamp] of this.failedLoginAttempts.entries()) {
      if (now - timestamp > expirationTime) {
        this.failedLoginAttempts.delete(ip);
      }
    }

    // 清理可疑IP记录
    for (const [ip, timestamp] of this.suspiciousIPs.entries()) {
      if (now - timestamp > expirationTime) {
        this.suspiciousIPs.delete(ip);
      }
    }

    // 清理速率限制违规记录
    for (const [ip, timestamp] of this.rateLimitViolations.entries()) {
      if (now - timestamp > expirationTime) {
        this.rateLimitViolations.delete(ip);
      }
    }
  }

  // 启动监控
  startMonitoring() {
    // 每小时清理过期记录
    setInterval(() => {
      this.cleanupExpiredRecords();
    }, 60 * 60 * 1000);

    // 每5分钟输出安全统计
    setInterval(async () => {
      const stats = await this.getSecurityStats();
      if (stats.totalEvents > 0) {
        console.log('📊 安全监控统计:', {
          totalEvents: stats.totalEvents,
          recentAlerts: stats.recentAlerts.length,
          suspiciousIPs: stats.suspiciousIPs.length
        });
      }
    }, 5 * 60 * 1000);
  }

  // 获取安全事件列表
  async getSecurityEvents(limit = 100, offset = 0) {
    try {
      const eventIds = await redisUtils.lrange('security_events', offset, offset + limit - 1);
      const events = [];

      for (const eventId of eventIds) {
        const eventData = await redisUtils.get(`security_event:${eventId}`);
        if (eventData) {
          events.push(JSON.parse(eventData));
        }
      }

      return events;
    } catch (error) {
      console.error('获取安全事件失败:', error);
      return [];
    }
  }

  // 获取告警列表
  async getSecurityAlerts(limit = 50, offset = 0) {
    try {
      const alertIds = await redisUtils.lrange('security_alerts', offset, offset + limit - 1);
      const alerts = [];

      for (const alertId of alertIds) {
        const alertData = await redisUtils.get(`security_alert:${alertId}`);
        if (alertData) {
          alerts.push(JSON.parse(alertData));
        }
      }

      return alerts;
    } catch (error) {
      console.error('获取安全告警失败:', error);
      return [];
    }
  }
}

// 创建全局实例
const securityMonitor = new SecurityMonitor();

module.exports = securityMonitor;
