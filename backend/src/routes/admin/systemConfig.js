const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const systemConfigService = require('../../services/systemConfig');
const logger = require('../../utils/logger');
const Joi = require('joi');
const { marked } = require('marked');

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads/legal-documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：从URL提取config_key + 时间戳 + 原扩展名
    // URL 格式: /api/system-config/configs/:key/upload
    const urlParts = req.originalUrl.split('/');
    const keyIndex = urlParts.indexOf('configs') + 1;
    const configKey = urlParts[keyIndex] || 'document';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${configKey}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB 限制
  },
  fileFilter: function (req, file, cb) {
    // 只允许 PDF 文件
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('只允许上传 PDF 文件'));
    }
    cb(null, true);
  }
});

// 配置更新的验证规则（支持版本管理）
const updateConfigSchema = Joi.object({
  config_key: Joi.string().required().max(100),
  config_value: Joi.string().allow('').required(),
  config_type: Joi.string().valid('text', 'html', 'json').default('text'),
  description: Joi.string().allow('').max(500),
  update_reason: Joi.string().allow('').max(200),
  version_number: Joi.string().allow('').max(50),
  effective_date: Joi.date().iso().allow(null),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft')
});

// 获取所有配置
router.get('/configs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const configs = await systemConfigService.getAllConfigs();

    res.json({
      success: true,
      data: configs,
      count: configs.length
    });
  } catch (error) {
    logger.error('获取系统配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取系统配置失败',
      message: error && error.message ? error.message : '未知错误'
    });
  }
});

// 获取特定配置
router.get('/configs/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const config = await systemConfigService.getConfig(key);

    if (config === null) {
      return res.status(404).json({
        success: false,
        error: '配置不存在',
        message: `配置 ${key} 不存在`
      });
    }

    // 获取完整配置对象以返回元数据
    const fullConfig = await systemConfigService.getFullConfig(key);

    res.json({
      success: true,
      data: fullConfig
    });
  } catch (error) {
    logger.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取配置失败',
      message: error && error.message ? error.message : '未知错误'
    });
  }
});

// 发布草稿配置接口
router.post('/configs/:key/publish', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params; // 这里是 baseKey (例如 user_agreement_en)
    const { reason } = req.body;

    logger.info(`Publishing draft for key: ${key}`, { userId: req.user.id });

    await systemConfigService.publishDraft(key, req.user.id, reason);

    res.json({
      success: true,
      message: 'Draft published successfully'
    });
  } catch (error) {
    logger.error('Publish draft failed:', error);
    res.status(500).json({
      success: false,
      error: '发布失败',
      message: error.message
    });
  }
});

// 文件上传API - 上传PDF文件并更新配置
router.post('/configs/:key/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    logger.info('=== 文件上传开始 ===', {
      key: req.params.key,
      hasFile: !!req.file,
      body: req.body,
      userId: req.user.id
    });

    const { key } = req.params;
    const file = req.file;

    if (!file) {
      logger.warn('未上传文件');
      return res.status(400).json({
        success: false,
        error: '未上传文件'
      });
    }

    logger.info('文件信息', {
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      path: file.path
    });

    // 从请求体中获取其他信息
    const { version_number, effective_date, status, update_reason, description } = req.body;

    // 构造文件信息
    const fileInfo = {
      filePath: file.path,
      fileName: file.originalname,
      fileType: path.extname(file.originalname).substring(1), // 移除点号
      fileSize: file.size,
      fileUrl: `/uploads/legal-documents/${file.filename}`
    };

    // 保存配置
    await systemConfigService.setConfig(
      key,
      file.originalname, // config_value 存储原始文件名
      'file', // 类型为 file
      description || `${key}文档`,
      req.user.id,
      update_reason || '上传新文档',
      version_number,
      effective_date ? new Date(effective_date) : null,
      status || 'draft',
      fileInfo
    );

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        config_key: key,
        file_name: file.originalname,
        file_size: file.size,
        file_url: fileInfo.fileUrl,
        version_number,
        status
      }
    });
  } catch (error) {
    logger.error('文件上传失败:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '文件上传失败',
      message: error && error.message ? error.message : '未知错误'
    });
  }
});

// 更新配置
router.put('/configs/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { error, value } = updateConfigSchema.validate({
      ...req.body,
      config_key: key
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details.map(d => d.message)
      });
    }

    const { config_key, config_value, config_type, description, update_reason, version_number, effective_date, status } = value;

    await systemConfigService.setConfig(
      config_key,
      config_value,
      config_type,
      description,
      req.user.id,
      update_reason,
      version_number,
      effective_date,
      status
    );

    res.json({
      success: true,
      message: '配置更新成功',
      data: {
        config_key,
        config_value,
        config_type,
        description,
        version_number,
        effective_date,
        status
      }
    });
  } catch (error) {
    logger.error('更新配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新配置失败',
      message: error && error.message ? error.message : '未知错误'
    });
  }
});

// 删除配置
router.delete('/configs/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    const success = await systemConfigService.deleteConfig(key, req.user.id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '配置不存在',
        message: `配置 ${key} 不存在`
      });
    }

    res.json({
      success: true,
      message: '配置删除成功'
    });
  } catch (error) {
    logger.error('删除配置失败:', error);
    res.status(500).json({
      success: false,
      error: '删除配置失败',
      message: error && error.message ? error.message : '未知错误'
    });
  }
});

// 获取配置历史记录
router.get('/configs/:key/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const history = await systemConfigService.getConfigHistory(
      key,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: history,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: history.length
      }
    });
  } catch (error) {
    logger.error('获取配置历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取配置历史失败',
      message: error && error.message ? error.message : '未知错误'
    });
  }
});

// 获取归档版本列表 (status='published' 的历史记录)
router.get('/configs/:key/archived', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    // 我们获取该 key 的所有 "已发布" 历史状态，这本质上就是归档记录
    const history = await systemConfigService.getConfigHistory(
      key,
      100, // limit
      0,   // offset
      true // onlyArchived
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('获取归档记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取归档记录失败'
    });
  }
});

// ========== 多语言辅助函数 ==========

// 支持的语言列表
const SUPPORTED_LANGS = ['en', 'zh-Hans', 'ja', 'ko', 'es', 'pt-BR'];
const DEFAULT_LANG = 'en';

// 从请求中提取语言参数
function getLangFromReq(req) {
  // 优先使用 ?lang= 查询参数
  if (req.query.lang && typeof req.query.lang === 'string') {
    return req.query.lang.trim();
  }
  // 其次使用 Accept-Language 头
  const acceptLang = req.get('Accept-Language');
  if (acceptLang) {
    const primary = acceptLang.split(',')[0].split(';')[0].trim();
    return primary;
  }
  return DEFAULT_LANG;
}

// 按 fallback 链查找配置: exact → base language → en → legacy (无后缀)
async function resolveConfigByLang(baseKey, lang) {
  const candidates = [lang];

  // 添加基础语言 (如 zh-Hans → zh)
  if (lang.includes('-')) {
    candidates.push(lang.split('-')[0]);
  }

  // 添加默认语言
  if (!candidates.includes(DEFAULT_LANG)) {
    candidates.push(DEFAULT_LANG);
  }

  for (const candidate of candidates) {
    const key = `${baseKey}_${candidate}`;
    const config = await systemConfigService.getLatestPublishedConfig(key);
    if (config) return { config, resolvedLang: candidate };
  }

  // 最终 fallback: 无后缀的旧 key (向后兼容)
  const legacyConfig = await systemConfigService.getLatestPublishedConfig(baseKey);
  if (legacyConfig) return { config: legacyConfig, resolvedLang: 'zh-Hans' };

  return { config: null, resolvedLang: DEFAULT_LANG };
}

// 多语言 UI 字符串
const i18nStrings = {
  en: {
    back: 'Back', download: 'Download', loading: 'Loading document...',
    loadFailed: 'Document failed to load', downloadHint: 'You can try downloading the document directly:',
    pdfViewer: '📄 PDF Document Viewer', lastUpdated: 'Last updated:',
    pageError: 'Page Error', errorOccurred: 'An error occurred',
    goBack: 'Go Back', langTag: 'en'
  },
  'zh-Hans': {
    back: '返回', download: '下载', loading: '正在加载文档...',
    loadFailed: '文档加载失败', downloadHint: '您可以尝试直接下载文档查看：',
    pdfViewer: '📄 PDF文档查看器', lastUpdated: '最后更新时间：',
    pageError: '页面错误', errorOccurred: '出现了错误',
    goBack: '返回', langTag: 'zh-CN'
  },
  zh: {
    back: '返回', download: '下载', loading: '正在加载文档...',
    loadFailed: '文档加载失败', downloadHint: '您可以尝试直接下载文档查看：',
    pdfViewer: '📄 PDF文档查看器', lastUpdated: '最后更新时间：',
    pageError: '页面错误', errorOccurred: '出现了错误',
    goBack: '返回', langTag: 'zh-CN'
  },
  ja: {
    back: '戻る', download: 'ダウンロード', loading: 'ドキュメントを読み込み中...',
    loadFailed: 'ドキュメントの読み込みに失敗しました', downloadHint: 'ドキュメントを直接ダウンロードできます：',
    pdfViewer: '📄 PDFドキュメントビューア', lastUpdated: '最終更新日：',
    pageError: 'ページエラー', errorOccurred: 'エラーが発生しました',
    goBack: '戻る', langTag: 'ja'
  },
  ko: {
    back: '뒤로', download: '다운로드', loading: '문서 로딩 중...',
    loadFailed: '문서 로딩 실패', downloadHint: '문서를 직접 다운로드할 수 있습니다:',
    pdfViewer: '📄 PDF 문서 뷰어', lastUpdated: '최종 업데이트:',
    pageError: '페이지 오류', errorOccurred: '오류가 발생했습니다',
    goBack: '뒤로', langTag: 'ko'
  },
  es: {
    back: 'Volver', download: 'Descargar', loading: 'Cargando documento...',
    loadFailed: 'Error al cargar el documento', downloadHint: 'Puede intentar descargar el documento directamente:',
    pdfViewer: '📄 Visor de PDF', lastUpdated: 'Última actualización:',
    pageError: 'Error de página', errorOccurred: 'Se ha producido un error',
    goBack: 'Volver', langTag: 'es'
  },
  'pt-BR': {
    back: 'Voltar', download: 'Baixar', loading: 'Carregando documento...',
    loadFailed: 'Falha ao carregar documento', downloadHint: 'Você pode tentar baixar o documento diretamente:',
    pdfViewer: '📄 Visualizador de PDF', lastUpdated: 'Última atualização:',
    pageError: 'Erro na página', errorOccurred: 'Ocorreu um erro',
    goBack: 'Voltar', langTag: 'pt-BR'
  }
};

function getLocalizedStrings(lang) {
  return i18nStrings[lang] || i18nStrings[lang.split('-')[0]] || i18nStrings[DEFAULT_LANG];
}

// ========== 公开 API ==========

// 公开API：获取最新的法律文档汇总信息
router.get('/public/latest-legal', async (req, res) => {
  try {
    const lang = getLangFromReq(req);
    const { config: userAgreement } = await resolveConfigByLang('user_agreement', lang);
    const { config: privacyPolicy } = await resolveConfigByLang('privacy_policy', lang);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const langParam = `?lang=${encodeURIComponent(lang)}`;

    res.json({
      success: true,
      data: {
        user_agreement: {
          version: userAgreement?.version_number || '1.0.0',
          effective_date: userAgreement?.effective_date || null,
          url: `${baseUrl}/api/system-config/public/user-agreement${langParam}`,
          file_url: userAgreement?.file_url ? `${baseUrl}${userAgreement.file_url}` : null
        },
        privacy_policy: {
          version: privacyPolicy?.version_number || '1.0.0',
          effective_date: privacyPolicy?.effective_date || null,
          url: `${baseUrl}/api/system-config/public/privacy-policy${langParam}`,
          file_url: privacyPolicy?.file_url ? `${baseUrl}${privacyPolicy.file_url}` : null
        }
      }
    });
  } catch (error) {
    logger.error('获取法律文档汇总信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取法律文档汇总信息失败'
    });
  }
});

// 公开API：获取用户协议（支持HTML内容和PDF文件，支持多语言）
router.get('/public/user-agreement', async (req, res) => {
  try {
    const lang = getLangFromReq(req);
    const strings = getLocalizedStrings(lang);

    // 预览模式支持：如果是管理员想看草稿，可以通过 ?preview=draft (注意：这里暂未鉴权，仅做功能演示，实际应保护)
    const previewMode = req.query.preview === 'draft';
    const baseKey = 'user_agreement';

    let config;
    if (previewMode) {
      // 尝试直接获取草稿 Key (带 _draft 后缀)
      const draftKey = `${baseKey}_${lang}_draft`;
      // 使用 getFullConfig 而不是 getLatestPublishedConfig
      const draftConfig = await systemConfigService.getFullConfig(draftKey);
      config = draftConfig;
    }

    if (!config) {
      // 正常流程：获取已发布的配置
      const result = await resolveConfigByLang(baseKey, lang);
      config = result.config;
    }

    const titleMap = {
      en: 'User Agreement', 'zh-Hans': '用户协议', zh: '用户协议',
      ja: '利用規約', ko: '이용약관', es: 'Acuerdo de usuario', 'pt-BR': 'Acordo do Usuário'
    };
    const title = titleMap[lang] || titleMap[lang.split('-')[0]] || titleMap[DEFAULT_LANG];

    // 如果是PDF文件，返回PDF查看器
    if (config?.file_url) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = config.file_url;
      const pdfHtml = generatePDFViewer(title, fileUrl, baseUrl, strings);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(pdfHtml);
    }

    // 如果只有HTML内容，返回HTML页面
    if (config?.config_value && (config.config_type === 'html' || config.config_type === 'text')) {
      const policyHtml = generatePolicyPage(title, config.config_value, strings);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(policyHtml);
    }

    // 最后的默认 Fallback
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const defaultFileUrl = `${baseUrl}/uploads/legal-documents/user_agreement_initial.pdf`;
    const pdfHtml = generatePDFViewer(title, defaultFileUrl, baseUrl, strings);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(pdfHtml);

  } catch (error) {
    logger.error('获取用户协议失败:', error);
    const lang = getLangFromReq(req);
    const strings = getLocalizedStrings(lang);
    const errorHtml = generateErrorPage(strings.pageError, strings.errorOccurred, strings);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
  }
});

// 公开API：获取隐私政策（支持HTML内容和PDF文件，支持多语言）
router.get('/public/privacy-policy', async (req, res) => {
  try {
    const lang = getLangFromReq(req);
    const strings = getLocalizedStrings(lang);

    // 预览模式支持
    const previewMode = req.query.preview === 'draft';
    const baseKey = 'privacy_policy';

    let config;
    if (previewMode) {
      const draftKey = `${baseKey}_${lang}_draft`;
      const draftConfig = await systemConfigService.getFullConfig(draftKey);
      config = draftConfig;
    }

    if (!config) {
      const result = await resolveConfigByLang(baseKey, lang);
      config = result.config;
    }

    const titleMap = {
      en: 'Privacy Policy', 'zh-Hans': '隐私政策', zh: '隐私政策',
      ja: 'プライバシーポリシー', ko: '개인정보 처리방침', es: 'Política de Privacidad', 'pt-BR': 'Política de Privacidade'
    };
    const title = titleMap[lang] || titleMap[lang.split('-')[0]] || titleMap[DEFAULT_LANG];

    // 如果是PDF文件，返回PDF查看器
    if (config?.file_url) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = config.file_url;
      const pdfHtml = generatePDFViewer(title, fileUrl, baseUrl, strings);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(pdfHtml);
    }

    // 如果只有HTML内容，返回HTML页面
    if (config?.config_value && (config.config_type === 'html' || config.config_type === 'text')) {
      const policyHtml = generatePolicyPage(title, config.config_value, strings);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(policyHtml);
    }

    // 最后的默认 Fallback
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const defaultFileUrl = `${baseUrl}/uploads/legal-documents/privacy_policy_initial.pdf`;
    const pdfHtml = generatePDFViewer(title, defaultFileUrl, baseUrl, strings);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(pdfHtml);

  } catch (error) {
    logger.error('获取隐私政策失败:', error);
    const lang = getLangFromReq(req);
    const strings = getLocalizedStrings(lang);
    const errorHtml = generateErrorPage(strings.pageError, strings.errorOccurred, strings);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
  }
});

// PDF文档查看页面
router.get('/public/view-document', async (req, res) => {
  try {
    const { file, title } = req.query;

    if (!file) {
      const errorHtml = generateErrorPage('文档查看', '缺少文件参数');
      return res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pdfHtml = generatePDFViewer(title || '文档', file, baseUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(pdfHtml);

  } catch (error) {
    logger.error('查看文档失败:', error);
    const errorHtml = generateErrorPage('文档查看', '查看文档失败');
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
  }
});

// 生成PDF查看器HTML页面
function generatePDFViewer(title, fileUrl, baseUrl, strings = null) {
  if (!strings) strings = getLocalizedStrings('zh-Hans');
  // 确保 fileUrl 是绝对路径用于下载/预览组件
  const absoluteFileUrl = fileUrl.startsWith('http') ? fileUrl : `${baseUrl}${fileUrl}`;
  return `<!DOCTYPE html>
<html lang="${strings.langTag || 'zh-CN'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - FunnyPixels</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }

        .header {
            background: white;
            border-bottom: 1px solid #e0e0e0;
            padding: 16px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #1890ff;
            text-decoration: none;
            cursor: default;
        }

        .document-title {
            font-size: 18px;
            font-weight: 500;
            color: #333;
        }

        .back-btn {
            background: #1890ff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
            transition: background-color 0.3s;
        }

        .back-btn:hover {
            background: #40a9ff;
        }

        .container {
            max-width: 1000px;
            margin: 20px auto;
            padding: 0 20px;
        }

        .pdf-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
            height: 80vh;
        }

        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }

        .download-hint {
            margin-top: 16px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        .download-link {
            color: #1890ff;
            text-decoration: none;
        }
        
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 10px;
            }
            
            .back-btn {
                position: absolute;
                left: 20px;
                top: 20px;
                padding: 4px 10px;
            }
            
            .logo {
                margin-top: 30px;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <div class="logo">FunnyPixels</div>
            <div class="document-title">${title}</div>
            <a href="#" onclick="window.history.back(); return false;" class="back-btn">${strings.back || '返回'}</a>
        </div>
    </header>

    <div class="container">
        <div class="pdf-container">
            <iframe src="${absoluteFileUrl}#toolbar=0" title="${title}">
                <p>${strings.loading || '正在加载文档...'}</p>
            </iframe>
        </div>
        <div class="download-hint">
            ${strings.downloadHint || '您可以尝试直接下载文档查看：'} <a href="${absoluteFileUrl}" target="_blank" class="download-link" download>${strings.download || '下载'} PDF</a>
            <div style="margin-top: 8px; font-size: 12px; color: #999;">
                ${strings.lastUpdated || '最后更新时间：'} ${new Date().toLocaleDateString()}
            </div>
        </div>
    </div>
</body>
</html>`;
}

// 生成HTML文档页面 (Markdown渲染用)
function generatePolicyPage(title, contentMarkdown, strings = null) {
  if (!strings) strings = getLocalizedStrings('zh-Hans');

  // 简单的 Markdown 转 HTML 配置
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  const contentHtml = marked(contentMarkdown || '');

  return `<!DOCTYPE html>
<html lang="${strings.langTag || 'zh-CN'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - FunnyPixels</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .header {
            background: white;
            border-bottom: 1px solid #e0e0e0;
            padding: 16px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
            max-width: 800px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #1890ff;
        }

        .back-btn {
            color: #666;
            text-decoration: none;
            font-size: 14px;
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .container {
            max-width: 800px;
            margin: 20px auto;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            min-height: 80vh;
        }

        /* Markdown Styles */
        .markdown-body h1 { font-size: 24px; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .markdown-body h2 { font-size: 20px; margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
        .markdown-body h3 { font-size: 18px; margin-top: 20px; margin-bottom: 12px; font-weight: 600; }
        .markdown-body p { margin-bottom: 16px; color: #444; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 16px; padding-left: 24px; }
        .markdown-body li { margin-bottom: 6px; }
        .markdown-body strong { color: #000; font-weight: 600; }
        .markdown-body blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; padding: 0 1em; margin: 0 0 16px 0; }
        .markdown-body a { color: #0366d6; text-decoration: none; }
        .markdown-body a:hover { text-decoration: underline; }
        .markdown-body hr { height: 1px; background-color: #e1e4e8; border: none; margin: 24px 0; }
        
        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 16px;
        }
        .markdown-body th, .markdown-body td {
            border: 1px solid #dfe2e5;
            padding: 8px 12px;
            text-align: left;
        }
        .markdown-body th {
            background-color: #f6f8fa;
            font-weight: 600;
        }

        @media (max-width: 768px) {
            .container {
                margin: 0;
                border-radius: 0;
                padding: 20px;
            }
            .header-content {
                padding: 0 16px;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <div class="logo">FunnyPixels</div>
            <a href="#" onclick="window.history.back(); return false;" class="back-btn">${strings.back || '返回'}</a>
        </div>
    </header>

    <div class="container">
        <div class="markdown-body">
            ${contentHtml}
        </div>
        <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
           ${strings.lastUpdated || '最后更新时间：'} ${new Date().toLocaleDateString()}
        </div>
    </div>
</body>
</html>`;
}

// 错误页面
function generateErrorPage(title, message, strings = null) {
  if (!strings) strings = getLocalizedStrings('zh-Hans');
  return `<!DOCTYPE html>
<html lang="${strings.langTag || 'zh-CN'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding-top: 50px; color: #666; background-color: #f5f5f5; }
        h1 { color: #333; margin-bottom: 20px; }
        p { font-size: 16px; }
        .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #1890ff; color: white; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>${strings.pageError || '页面错误'}</h1>
    <p>${message}</p>
    <a href="#" onclick="window.history.back(); return false;" class="btn">${strings.goBack || '返回'}</a>
</body>
</html>`;
}

module.exports = router;