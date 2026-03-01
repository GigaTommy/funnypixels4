const { db } = require('../config/database');
const { createCanvas } = require('canvas');
const logger = require('../utils/logger');

/**
 * 像素延时摄影服务 (Timelapse Service)
 * 负责根据历史记录生成区域绘制的演变过程
 */
class TimelapseService {
    /**
     * 获取指定区域的演变帧数据
     * @param {Object} options 
     * @param {number} options.minLat 
     * @param {number} options.maxLat 
     * @param {number} options.minLng 
     * @param {number} options.maxLng 
     * @param {string} options.startTime 
     * @param {string} options.endTime 
     * @param {number} options.frameCount 期待生成的帧数
     */
    async generateFrames(options) {
        const {
            minLat, maxLat, minLng, maxLng,
            startTime, endTime,
            frameCount = 10,
            width = 800,
            height = 800
        } = options;

        try {
            logger.info('🎬 开始生成延时记录帧...', { minLat, maxLat, minLng, maxLng, frameCount });

            // 1. 获取该区域内的所有历史记录，按时间排序
            const history = await db('pixels_history')
                .where('latitude', '>=', minLat)
                .where('latitude', '<=', maxLat)
                .where('longitude', '>=', minLng)
                .where('longitude', '<=', maxLng)
                .where('created_at', '>=', startTime || '1970-01-01')
                .where('created_at', '<=', endTime || new Date())
                .orderBy('created_at', 'asc');

            if (history.length === 0) {
                return { success: false, message: '该时段内无历史记录' };
            }

            // 2. 准备画布
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // 坐标映射函数
            const getX = (lng) => ((lng - minLng) / (maxLng - minLng)) * width;
            const getY = (lat) => (1 - (lat - minLat) / (maxLat - minLat)) * height; // Y轴反转

            // 像素大小 (粗略计算)
            const pixelW = (width / ((maxLng - minLng) / 0.0001)) || 2;
            const pixelH = (height / ((maxLat - minLat) / 0.0001)) || 2;

            // 3. 计算时间步长，将历史记录分段到各帧
            const totalDuration = history[history.length - 1].created_at - history[0].created_at;
            const interval = totalDuration / frameCount;

            const frames = [];
            let currentHistoryIndex = 0;

            // 背景色
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, width, height);

            for (let i = 1; i <= frameCount; i++) {
                const frameTimeLimit = new Date(history[0].created_at.getTime() + (interval * i));

                // 将该时间点之前的像素画到画布上
                while (currentHistoryIndex < history.length && history[currentHistoryIndex].created_at <= frameTimeLimit) {
                    const pixel = history[currentHistoryIndex];
                    ctx.fillStyle = pixel.color || '#000000';
                    ctx.fillRect(getX(pixel.longitude), getY(pixel.latitude), pixelW, pixelH);
                    currentHistoryIndex++;
                }

                // 保存帧内容 (Base64格式，后续可优化为Buffer并上传S3)
                frames.push(canvas.toDataURL('image/png'));
            }

            return {
                success: true,
                metadata: {
                    totalPixels: history.length,
                    frameCount: frames.length,
                    startTime: history[0].created_at,
                    endTime: history[history.length - 1].created_at
                },
                frames
            };

        } catch (error) {
            logger.error('❌ 延时记录帧生成失败:', error);
            throw error;
        }
    }

    /**
     * 生成一张包含所有帧的“长胶片”图 (Filmstrip)
     */
    async generateFilmstrip(options) {
        const result = await this.generateFrames(options);
        if (!result.success) return result;

        const { frames } = result;
        const width = 800;
        const height = 800;

        // 创建一个包含所有帧的超长画布
        const stripCanvas = createCanvas(width, height * frames.length);
        const sctx = stripCanvas.getContext('2d');

        // 可以在这里给前端提供一个大图，前端通过 background-position 播放
        // 由于 Node-canvas 加载 DataURL 有点麻烦，我们可以直接在渲染循环里画到两个地方
        // 但为了演示，先返回数组。
        return result;
    }
}

module.exports = new TimelapseService();
