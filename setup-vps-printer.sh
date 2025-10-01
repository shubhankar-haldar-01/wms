#!/bin/bash

# Setup script for VPS printer configuration
echo "🔧 Setting up VPS printer configuration..."

# Install CUPS if not already installed
if ! command -v lp &> /dev/null; then
    echo "📦 Installing CUPS..."
    apt-get update
    apt-get install -y cups cups-client
fi

# Start CUPS service
echo "🚀 Starting CUPS service..."
systemctl start cups
systemctl enable cups

# Create a virtual printer for barcode printing
echo "🖨️ Creating virtual printer..."
lpadmin -p TSC_TE244 -E -v file:///dev/null -m raw

# Set printer as default
echo "⚙️ Setting printer as default..."
lpadmin -d TSC_TE244

# Test printer setup
echo "🧪 Testing printer setup..."
lpstat -p

echo "✅ VPS printer setup completed!"
echo "📋 Available printers:"
lpstat -p

echo "🎯 You can now print barcodes without PDF download!"
