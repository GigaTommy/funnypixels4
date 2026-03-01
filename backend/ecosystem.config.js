module.exports = {
  apps: [
    {
      name: 'funnypixels-api',
      script: './src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        ENABLE_HTTPS: 'false'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=4096',
      watch: false,
      ignore_watch: ['node_modules', 'logs']
    }
  ]
};