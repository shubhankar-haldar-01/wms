module.exports = {
  apps: [
    {
      name: 'wms-app',
      script: './server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
        DB_HOST: '31.97.61.5',
        DB_USER: 'wms',
        DB_PASSWORD: 'Kalbazaar@177',
        DB_NAME: 'wms_db',
        DB_PORT: 3306,
        DB_MAX_CONNECTIONS: 20,
        DB_CONNECTION_TIMEOUT: 10000,
        JWT_SECRET: 'your-secret-key',
        PRINTER_CONNECTION_TYPE: 'auto',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '',
        REDIS_CACHE_TTL: 3600,
      },
    },
  ],
};
