/**
 * Prometheus指标收集中间件
 * 自动记录所有HTTP请求的响应时间和状态码
 */

const prometheusMetrics = require('../monitoring/prometheusMetrics');

/**
 * 指标收集中间件
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    // 记录到Prometheus
    prometheusMetrics.recordHttpRequest(method, route, statusCode, duration);
  });

  next();
}

module.exports = metricsMiddleware;
