#!/usr/bin/env node

// Print processor script for virtual printer
// This script processes TSPL2 commands and creates readable output files

const fs = require('fs');
const path = require('path');

// Get the input from stdin (CUPS sends print jobs via stdin)
let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk.toString();
});

process.stdin.on('end', () => {
  try {
    // Create output directory if it doesn't exist
    const outputDir = '/var/spool/cups/print-output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate output filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `barcode-${timestamp}.txt`);

    // Process TSPL2 commands and create readable output
    let output = '';
    output += '='.repeat(50) + '\n';
    output += 'BARCODE PRINT JOB\n';
    output += `Generated: ${new Date().toLocaleString()}\n`;
    output += '='.repeat(50) + '\n\n';

    // Parse TSPL2 commands and create readable format
    const lines = inputData.split('\n');
    let inBarcode = false;
    let barcodeData = '';
    let skuData = '';

    for (const line of lines) {
      if (line.includes('TEXT') && line.includes('SKU:')) {
        // Extract SKU
        const skuMatch = line.match(/"([^"]+)"/);
        if (skuMatch) {
          skuData = skuMatch[1];
        }
      } else if (line.includes('BARCODE') && line.includes('128')) {
        // Extract barcode data
        const barcodeMatch = line.match(/"([^"]+)"/);
        if (barcodeMatch) {
          barcodeData = barcodeMatch[1];
        }
      } else if (line.includes('TEXT') && line.includes('center')) {
        // Extract barcode number
        const textMatch = line.match(/"([^"]+)"/);
        if (textMatch && !barcodeData) {
          barcodeData = textMatch[1];
        }
      }
    }

    // Create readable output
    if (skuData) {
      output += `SKU: ${skuData}\n`;
    }
    if (barcodeData) {
      output += `Barcode: ${barcodeData}\n`;
    }

    output += '\n' + '='.repeat(50) + '\n';
    output += 'RAW TSPL2 COMMANDS:\n';
    output += '='.repeat(50) + '\n';
    output += inputData;
    output += '\n' + '='.repeat(50) + '\n';
    output += 'END OF PRINT JOB\n';

    // Write to file
    fs.writeFileSync(outputFile, output);

    console.log(`Print job processed and saved to: ${outputFile}`);
    console.log(`SKU: ${skuData || 'N/A'}`);
    console.log(`Barcode: ${barcodeData || 'N/A'}`);
  } catch (error) {
    console.error('Error processing print job:', error);
    process.exit(1);
  }
});

process.stdin.on('error', (error) => {
  console.error('Error reading input:', error);
  process.exit(1);
});
