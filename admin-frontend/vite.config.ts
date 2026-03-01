import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/types': resolve(__dirname, 'src/types'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 8000,
    host: true,
    proxy: {
      '/api': {
        // 支持环境变量配置后端地址，默认使用 localhost
        target: process.env.VITE_BACKEND_URL || 'http://192.168.0.3:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500, // 稍微调高告警阈值
    reportCompressedSize: false, // 禁用以减少内存占用
    minify: 'esbuild', // 使用极速压缩
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 核心基础库
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'core-react';
          }
          // UI组件库 - 进一步细分
          if (id.includes('node_modules/antd')) {
            return 'ui-antd';
          }
          if (id.includes('node_modules/@ant-design/pro-')) {
            return 'ui-pro';
          }
          if (id.includes('node_modules/@ant-design/icons')) {
            return 'ui-icons';
          }
          if (id.includes('node_modules/@ant-design/charts') || id.includes('node_modules/recharts')) {
            return 'ui-charts';
          }
          // 工具类库
          if (id.includes('node_modules/lodash') || id.includes('node_modules/dayjs') || id.includes('node_modules/axios')) {
            return 'utils';
          }
        },
      },
    },
  },
})