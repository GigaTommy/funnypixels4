import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // 🎯 正确注入全局辅助函数到浏览器环境
    {
      name: 'inject-global-helpers',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html.replace(
            '<head>',
            `<head>
    <script>
      // 🔧 MapLibre GL 需要的全局辅助函数 - 立即执行并全局挂载
      (function() {
        const defineProperty = Object.defineProperty;
        const defNormalProp = (obj, key, value) => {
          return key in obj ? defineProperty(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
        };

        // 在 window 和 globalThis 上都定义
        const helpers = {
          __defProp: defineProperty,
          __defNormalProp: defNormalProp,
          __publicField: (obj, key, value) => defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value)
        };

        // 直接赋值，避免使用 defineProperty 的限制
        window.__defProp = defineProperty;
        window.__defNormalProp = defNormalProp;
        window.__publicField = helpers.__publicField;

        globalThis.__defProp = defineProperty;
        globalThis.__defNormalProp = defNormalProp;
        globalThis.__publicField = helpers.__publicField;

        // 确保 global 作用域也能访问
        if (typeof global !== 'undefined') {
          global.__defProp = defineProperty;
          global.__defNormalProp = defNormalProp;
          global.__publicField = helpers.__publicField;
        }

        // 验证函数是否正确设置
        console.log('Global helpers injected:', {
          __defProp: typeof window.__defProp,
          __defNormalProp: typeof window.__defNormalProp,
          __publicField: typeof window.__publicField
        });
      })();
    </script>`
          );
        }
      }
    },
    {
      name: 'inject-global-helpers-esbuild',
      config() {
        // 为 esbuild 添加全局定义
        return {
          define: {
            __defProp: 'window.__defProp',
            __defNormalProp: 'window.__defNormalProp',
            __publicField: 'window.__publicField'
          }
        };
      }
    },
    react({
      babel: {
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-proposal-decorators', { legacy: true }]
        ]
      }
    }),
    {
      name: 'inject-build-version',
      generateBundle(options, bundle) {
        // 生成构建版本号
        const buildVersion = new Date().getTime();

        // 在sw.js中注入构建版本
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (fileName === 'sw.js') {
            const source = chunk.source.toString();
            const updatedSource = source.replace(
              /const CACHE_NAME = 'funnypixels-v1';/,
              `const CACHE_NAME = 'funnypixels-${buildVersion}';`
            );
            chunk.source = updatedSource;
          }
        }
      }
    }
  ],
  define: {
    global: 'globalThis',
    // 🔧 MapLibre GL 全局辅助函数定义 - 确保在模块编译时可用
    __defProp: 'window.__defProp',
    __defNormalProp: 'window.__defNormalProp',
    __publicField: 'window.__publicField'
  },
  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    keepNames: true,
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'], // 🔧 排除maplibre-gl，使用CDN版本
    include: [], // 确保没有任何maplibre相关的优化
    esbuildOptions: {
      target: 'es2020',
    }
  },
  worker: {
    format: 'es',
    // MapLibre GL 使用 CDN 版本，Worker 辅助函数已内置，无需额外注入
  },
  resolve: {
    alias: {
      // ✅ 移除了强制指向源代码的 alias
      // 让 maplibre-gl 使用 package.json 中的默认 main 字段（dist 版本）
      'buffer': 'buffer'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 🔧 Socket.IO 代理配置 - 完全禁用 WebSocket 代理，强制使用 polling
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: false,  // 完全禁用 WebSocket 代理
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Socket.IO proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 强制添加 HTTP 头，阻止 WebSocket 升级
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.removeHeader('Upgrade');
          });
        }
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/tiles': { // 如果有 tile 路由也加上
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    },
    // 🔧 添加静态资源处理，防止SPA fallback影响
    configureServer(server) {
      server.middlewares.use('/assets/emoji', (req, res, next) => {
        // 确保静态资源正确返回，不做SPA fallback
        if (req.url.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        } else if (req.url.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        }
        next();
      });
    }
  },
  build: {
    target: 'es2020', // 生产环境构建目标
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React 相关
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }

          // 路由相关
          if (id.includes('react-router')) {
            return 'router';
          }

          // UI 组件库
          if (id.includes('framer-motion') || id.includes('lucide-react')) {
            return 'ui-libs';
          }

          // HTTP 客户端
          if (id.includes('axios')) {
            return 'http';
          }

          // 地图相关
          if (id.includes('amap') || id.includes('map')) {
            return 'map-modules';
          }

          // 工具库
          if (id.includes('clsx') || id.includes('qrcode') || id.includes('buffer')) {
            return 'utils';
          }

          // 图像处理
          if (id.includes('canvas') || id.includes('fabric') || id.includes('sharp')) {
            return 'image-libs';
          }

          // 聊天和社交功能
          if (id.includes('socket') || id.includes('chat') || id.includes('social')) {
            return 'social';
          }

          // 管理功能
          if (id.includes('admin') || id.includes('dashboard')) {
            return 'admin';
          }

          // 第三方库
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800, // 降低警告阈值
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除console
        drop_debugger: true, // 移除debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      }
    }
  },
  base: '/',
  preview: {
    port: 4173,
    host: true
  }
})
