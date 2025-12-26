/**
 * PM2 Ecosystem Configuration
 * Process manager configuration for production deployments
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'taatom-api',
      script: './src/server.js',
      instances: process.env.PM2_INSTANCES || 1, // Use 'max' for cluster mode
      exec_mode: process.env.PM2_EXEC_MODE || 'fork', // 'fork' or 'cluster'
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart configuration
      autorestart: true,
      watch: false, // Set to true for development, false for production
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      
      // Graceful shutdown
      kill_timeout: 10000, // Wait 10 seconds for graceful shutdown
      wait_ready: true, // Wait for app to be ready
      listen_timeout: 10000, // Timeout for app to start listening
      
      // Advanced options
      min_uptime: '10s', // Minimum uptime before considering app stable
      max_restarts: 10, // Maximum restarts in 1 minute
      restart_delay: 4000, // Delay between restarts
      
      // Source map support
      source_map_support: true,
      
      // Instance variables (for cluster mode)
      instance_var: 'INSTANCE_ID',
      
      // Node.js options
      node_args: [
        '--max-old-space-size=2048', // 2GB heap size
        '--enable-source-maps', // Enable source maps
      ],
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/taatom-backend.git',
      path: '/var/www/taatom-backend',
      'post-deploy': 'npm install --omit=dev && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get update && apt-get install -y git',
    },
  },
};

