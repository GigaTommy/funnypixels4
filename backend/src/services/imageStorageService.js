const { db } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

class ImageStorageService {
  static async saveCustomFlagImage(imageData, orderId) {
    try {
      // 解析base64数据
      let base64Data;
      if (imageData.includes(',')) {
        base64Data = imageData.split(',')[1];
      } else {
        base64Data = imageData;
      }
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // 生成唯一的文件名
      const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
      const fileName = `custom_flag_${orderId}_${hash}.png`;
      const filePath = path.join(__dirname, '../public/uploads/custom-flags', fileName);
      
      // 确保目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // 使用sharp优化图片
      const optimizedBuffer = await sharp(imageBuffer)
        .resize(512, 512, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .png({ quality: 90 })
        .toBuffer();
      
      // 保存图片文件
      await fs.writeFile(filePath, optimizedBuffer);
      
      // 返回公共URL
      return `/uploads/custom-flags/${fileName}`;
      
    } catch (error) {
      console.error('保存自定义旗帜图片失败:', error);
      throw error;
    }
  }
  
  static async savePatternImage(rleData, patternId, width, height) {
    try {
      // 将RLE数据转换为PNG图片
      const imageBuffer = await this.convertRLEToImage(rleData, width, height);
      
      // 生成文件名
      const fileName = `pattern_${patternId}.png`;
      const filePath = path.join(__dirname, '../public/uploads/patterns', fileName);
      
      // 确保目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // 保存图片文件
      await fs.writeFile(filePath, imageBuffer);
      
      // 返回公共URL
      return `/uploads/patterns/${fileName}`;
      
    } catch (error) {
      console.error('保存图案图片失败:', error);
      throw error;
    }
  }
  
  static async convertRLEToImage(rleData, width, height) {
    // 创建像素数组
    const pixels = new Uint8Array(width * height * 4); // RGBA
    
    let pixelIndex = 0;
    for (const run of rleData) {
      const { color, count } = run;
      const [r, g, b, a = 255] = color;
      
      for (let i = 0; i < count; i++) {
        if (pixelIndex < pixels.length / 4) {
          pixels[pixelIndex * 4] = r;     // R
          pixels[pixelIndex * 4 + 1] = g; // G
          pixels[pixelIndex * 4 + 2] = b; // B
          pixels[pixelIndex * 4 + 3] = a; // A
          pixelIndex++;
        }
      }
    }
    
    // 使用sharp创建PNG图片
    return await sharp(pixels, {
      raw: {
        width: width,
        height: height,
        channels: 4
      }
    }).png().toBuffer();
  }
}

module.exports = ImageStorageService;
