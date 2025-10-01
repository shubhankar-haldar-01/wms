#!/bin/bash

# Production deployment script for Warehouse Management System

echo "🚀 Starting production deployment for WMS..."

mkdir -p logs temp uploads
chmod 755 logs temp uploads

export NODE_ENV=production

echo "🧹 Cleaning previous PM2 processes..."
pm2 delete wms-app 2>/dev/null || echo "No previous process to clean"

echo "📦 Building application..."

# Ensure client directory structure exists
echo "🔧 Ensuring client directory structure exists..."
mkdir -p client/public
mkdir -p client/src

# Check if client/package.json exists
if [ ! -f "client/package.json" ]; then
    echo "❌ client/package.json not found. Please ensure the client directory is properly uploaded."
    exit 1
fi

# Create index.html if it doesn't exist
if [ ! -f "client/public/index.html" ]; then
    echo "📝 Creating missing index.html file..."
    cat > client/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Warehouse Management System"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>WMS - Warehouse Management System</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
fi

# Create manifest.json if it doesn't exist
if [ ! -f "client/public/manifest.json" ]; then
    echo "📝 Creating missing manifest.json file..."
    cat > client/public/manifest.json << 'EOF'
{
  "short_name": "WMS",
  "name": "Warehouse Management System",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
EOF
fi

echo "✅ Client public files verified/created"

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

echo "🖨️ Setting up printer configuration..."
if [ -f "setup-vps-printer.sh" ]; then
    chmod +x setup-vps-printer.sh
    ./setup-vps-printer.sh
else
    echo "⚠️ Printer setup script not found, continuing..."
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
