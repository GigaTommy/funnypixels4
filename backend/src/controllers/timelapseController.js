const timelapseService = require('../services/timelapseService');
const logger = require('../utils/logger');

/**
 * 延时摄影生成控制器
 */
class TimelapseController {
    /**
     * 生成延时摄影帧
     * POST /api/timelapse/generate
     */
    async generate(req, res) {
        try {
            const {
                minLat, maxLat, minLng, maxLng,
                startTime, endTime,
                frameCount,
                width, height
            } = req.body;

            // 基础校验
            if (!minLat || !maxLat || !minLng || !maxLng) {
                return res.status(400).json({
                    success: false,
                    error: '缺失地理范围参数 (minLat, maxLat, minLng, maxLng)'
                });
            }

            const result = await timelapseService.generateFrames({
                minLat: parseFloat(minLat),
                maxLat: parseFloat(maxLat),
                minLng: parseFloat(minLng),
                maxLng: parseFloat(maxLng),
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                frameCount: parseInt(frameCount) || 10,
                width: parseInt(width) || 800,
                height: parseInt(height) || 800
            });

            if (!result.success) {
                return res.status(404).json(result);
            }

            res.json(result);

        } catch (error) {
            logger.error('❌ TimelapseController.generate error:', error);
            res.status(500).json({
                success: false,
                error: '延时拍摄任务失败',
                details: error.message
            });
        }
    }
}

module.exports = new TimelapseController();
