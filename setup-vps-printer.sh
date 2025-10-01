#!/bin/bash

# Setup script for VPS printer configuration
echo "🔧 Setting up VPS printer configuration..."

# Install CUPS if not already installed
if ! command -v lp &> /dev/null; then
    echo "📦 Installing CUPS..."
    apt-get update
    apt-get install -y cups cups-client cups-bsd
fi

# Start CUPS service
echo "🚀 Starting CUPS service..."
systemctl start cups
systemctl enable cups

# Wait for CUPS to start
sleep 3

# Create a virtual printer for barcode printing
echo "🖨️ Creating virtual printer..."
lpadmin -p TSC_TE244 -E -v file:///dev/null -m raw -D "TSC Barcode Printer" -L "WMS Barcode Printer"

# Set printer as default
echo "⚙️ Setting printer as default..."
lpadmin -d TSC_TE244

# Enable and start the printer
echo "🔄 Enabling printer..."
cupsenable TSC_TE244
cupsaccept TSC_TE244

# Test printer setup
echo "🧪 Testing printer setup..."
lpstat -p

# Test print job
echo "📄 Testing print job..."
echo "SIZE 50 mm, 25 mm
GAP 2 mm, 2 mm
DIRECTION 1
REFERENCE 0,0
OFFSET 0 mm
SET PEEL OFF
DENSITY 7
SPEED 4
CLS
TEXT 140,15,\"2\",0,1,1,\"SKU: TEST001\"
BARCODE 70,60,\"128\",50,0,0,2,2,\"123456789012\"
TEXT 60,140,\"3\",0,1,1,\"123456789012\"
PRINT 1
CUT" | lp -d TSC_TE244 -o raw

echo "✅ VPS printer setup completed!"
echo "📋 Available printers:"
lpstat -p

echo "📊 Printer queue status:"
lpq

echo "🎯 You can now print barcodes and they will appear in the printer queue!"
