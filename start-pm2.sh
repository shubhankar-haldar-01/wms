#!/bin/bash

# Production deployment script for Warehouse Management System

echo "🚀 Starting production deployment for WMS..."

mkdir -p logs temp uploads
chmod 755 logs temp uploads

export NODE_ENV=production

echo "🧹 Cleaning previous PM2 processes..."
pm2 delete wms-app 2>/dev/null || echo "No previous process to clean"

echo "📦 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    
    # Verify build directory exists
    if [ ! -d "client/build" ]; then
        echo "❌ Build directory not found after build process"
        exit 1
    fi
    
    if [ ! -f "client/build/index.html" ]; then
        echo "❌ Build index.html not found after build process"
        exit 1
    fi
    
    echo "✅ Build verification completed"
else
    echo "❌ Build failed"
    exit 1
fi

if [ ! -f server/.env ]; then
    echo "⚠️  Warning: server/.env file not found."
    echo "💡 Create server/.env file with your production configuration"
    echo "📝 Example:"
    echo "   NODE_ENV=production"
    echo "   PORT=5001"
    echo "   DB_HOST=localhost"
    echo "   DB_USER=wms_user"
    echo "   DB_PASSWORD=your_password"
    echo "   DB_NAME=wms_db"
    echo "   PRINTER_CONNECTION_TYPE=pdf"
fi

echo "🔄 Starting application with PM2..."
pm2 start ecosystem.config.js --env production

echo "💾 Saving PM2 configuration..."
pm2 save

echo "📊 PM2 Status:"
pm2 list

echo "📝 Recent logs:"
pm2 logs wms-app --lines 15

echo "🏥 Performing health check..."
sleep 5
if pm2 show wms-app | grep -q "online"; then
    echo "✅ Application is running successfully!"
    echo "🌐 Access your WMS at: http://localhost:5001"
    echo "📊 Monitor with: pm2 monit"
    echo "📝 View logs with: pm2 logs wms-app"
else
    echo "❌ Application failed to start properly"
    echo "🔍 Check logs with: pm2 logs wms-app"
    exit 1
fi

echo "🎉 WMS deployment completed successfully!"
