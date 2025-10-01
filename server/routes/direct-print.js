const express = require('express');
const router = express.Router();
const { pool } = require('../config/database'); // Use centralized database config
const printerService = require('../services/printerService');

// Generate unique barcode number with consistent length
function generateBarcodeNumber() {
  // Use a fixed-length timestamp (13 digits) + random (5 digits) = 18 digits total
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');

  // Ensure consistent 18-digit length
  const barcode = timestamp + random;
  return barcode.padStart(18, '0').slice(-18); // Take last 18 digits
}

// Direct print endpoint
router.post('/print-barcodes', async (req, res) => {
  try {
    const { productId, quantity, existingBarcode, existingBarcodes } = req.body;

    if (!productId || !quantity) {
      return res
        .status(400)
        .json({ error: 'Product ID and quantity are required' });
    }

    // Get product details
    const [productRows] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [productId],
    );

    if (productRows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productRows[0];

    // Use existing barcodes if provided, otherwise generate new ones
    const barcodes = [];
    if (existingBarcodes && Array.isArray(existingBarcodes)) {
      // Ultra-fast bulk printing with existing barcodes
      // Skip database validation for better performance (trust frontend)
      // Only validate if barcodes array is suspiciously large
      if (existingBarcodes.length > 100) {
        const barcodePlaceholders = existingBarcodes.map(() => '?').join(',');
        const [existingBarcodesResult] = await pool.execute(
          `SELECT barcode FROM barcodes WHERE barcode IN (${barcodePlaceholders})`,
          existingBarcodes,
        );

        const existingBarcodeNumbers = existingBarcodesResult.map(
          (row) => row.barcode,
        );
        const missingBarcodes = existingBarcodes.filter(
          (barcode) => !existingBarcodeNumbers.includes(barcode),
        );

        if (missingBarcodes.length > 0) {
          return res.status(404).json({
            error: `Barcodes not found in database: ${missingBarcodes.join(
              ', ',
            )}`,
          });
        }
      }

      // Use the existing barcodes (skip individual validation for speed)
      const now = new Date();
      existingBarcodes.forEach((barcode) => {
        barcodes.push({
          barcode: barcode,
          product_id: productId,
          created_at: now, // Reuse same timestamp
        });
      });
    } else if (existingBarcode) {
      // Single existing barcode
      const [existingBarcodeRows] = await pool.execute(
        'SELECT * FROM barcodes WHERE barcode = ?',
        [existingBarcode],
      );

      if (existingBarcodeRows.length === 0) {
        return res.status(404).json({ error: 'Barcode not found in database' });
      }

      // Use the existing barcode
      barcodes.push({
        barcode: existingBarcode,
        product_id: productId,
        created_at: new Date(),
      });
    } else {
      // Ultra-fast bulk generation of new barcodes
      const now = new Date();
      const baseTimestamp = Date.now();

      // Generate all barcodes at once for better performance
      for (let i = 0; i < quantity; i++) {
        // Use base timestamp + index for faster generation
        const timestamp = (baseTimestamp + i).toString();
        const random = Math.floor(Math.random() * 100000)
          .toString()
          .padStart(5, '0');
        const barcode = (timestamp + random).padStart(18, '0').slice(-18);

        barcodes.push({
          barcode: barcode,
          product_id: productId,
          created_at: now, // Reuse same timestamp
          units_assigned: 1, // Default 1 unit per barcode for direct generation
        });
      }
    }

    // Save barcodes to database (only if they don't already exist)
    if (!existingBarcode && !existingBarcodes) {
      // Ultra-fast bulk insert for better performance
      if (barcodes.length > 1) {
        // Use bulk insert for multiple barcodes
        const values = barcodes.map(() => '(?, ?, ?, ?)').join(', ');

        const params = barcodes.flatMap((barcode) => [
          barcode.barcode,
          barcode.product_id,
          barcode.units_assigned,
          barcode.created_at,
        ]);

        await pool.execute(
          `INSERT INTO barcodes (barcode, product_id, units_assigned, created_at) VALUES ${values}`,
          params,
        );
      } else {
        // Single insert for one barcode
        await pool.execute(
          'INSERT INTO barcodes (barcode, product_id, units_assigned, created_at) VALUES (?, ?, ?, ?)',
          [
            barcodes[0].barcode,
            barcodes[0].product_id,
            barcodes[0].units_assigned,
            barcodes[0].created_at,
          ],
        );
      }
    }

    // Print barcode labels using the printer service
    try {
      const printerService = require('../services/printerService');
      let content = '';
      console.log(
        'Barcodes to print:',
        barcodes.map((b) => ({ barcode: b.barcode, product_id: b.product_id })),
      );

      for (const barcode of barcodes) {
        content += printerService.generateBarcodeLabel(
          product,
          barcode.barcode,
        );
      }

      console.log('Generated TSPL2 content length:', content.length);
      console.log('First 200 chars of content:', content.substring(0, 200));

      const printResult = await printerService.print(content);
      console.log('Print result:', printResult);

      if (printResult.fileMode) {
        res.json({
          success: true,
          message: `${barcodes.length} barcode(s) printed successfully (saved to file)`,
          barcodes: barcodes.map((b) => b.barcode),
          filePath: printResult.filePath,
          filename: printResult.filename,
          fileMode: true,
        });
      } else if (printResult.vpsMode) {
        res.json({
          success: true,
          message: `${barcodes.length} barcode(s) generated as PDF`,
          barcodes: barcodes.map((b) => b.barcode),
          pdfPath: printResult.filePath,
          filename: printResult.filename,
          vpsMode: true,
        });
      } else if (printResult.cupsMode) {
        res.json({
          success: true,
          message:
            printResult.message ||
            `${barcodes.length} barcode(s) printed successfully via CUPS`,
          barcodes: barcodes.map((b) => b.barcode),
          jobId: printResult.jobId,
          cupsMode: true,
        });
      } else if (printResult.tscMode) {
        res.json({
          success: true,
          message: `${barcodes.length} barcode(s) printed successfully via TSC USB`,
          barcodes: barcodes.map((b) => b.barcode),
        });
      } else {
        res.json({
          success: true,
          message: `${barcodes.length} barcode(s) printed successfully`,
          barcodes: barcodes.map((b) => b.barcode),
        });
      }
    } catch (printerError) {
      console.error('Printer error:', printerError);
      res.status(500).json({
        success: false,
        error: 'Failed to print barcodes',
        details: printerError.message,
      });
    }
  } catch (error) {
    console.error('Error printing barcodes:', error);
    res.status(500).json({ error: 'Failed to print barcodes' });
  }
});

// Print existing barcode endpoint
router.post('/print-existing-barcode', async (req, res) => {
  try {
    const { barcodeNumber } = req.body;

    if (!barcodeNumber) {
      return res.status(400).json({ error: 'Barcode number is required' });
    }

    // Get barcode details
    const [barcodeRows] = await pool.execute(
      'SELECT b.*, p.* FROM barcodes b JOIN products p ON b.product_id = p.id WHERE b.barcode = ?',
      [barcodeNumber],
    );

    if (barcodeRows.length === 0) {
      return res.status(404).json({ error: 'Barcode not found' });
    }

    const barcodeData = barcodeRows[0];

    // Print the barcode label
    await printerService.printBarcodeLabels(barcodeData, [barcodeNumber]);

    res.json({
      success: true,
      message: 'Barcode printed successfully',
      barcodes: [barcodeNumber],
    });
  } catch (error) {
    console.error('Error printing existing barcode:', error);
    res.status(500).json({ error: 'Failed to print barcode' });
  }
});

// Test printer connection endpoint
router.post('/test-printer', async (req, res) => {
  try {
    const result = await printerService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Printer test error:', error);
    res.status(500).json({ error: 'Failed to test printer' });
  }
});

// Get printer status endpoint
router.get('/printer-status', async (req, res) => {
  try {
    const PrinterService = require('../services/printerService');
    const printerService = new PrinterService();
    const result = await printerService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Printer status error:', error);
    res.status(500).json({ error: 'Failed to get printer status' });
  }
});

// Get printer queue status endpoint
router.get('/printer-queue', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Get printer queue status
    const { stdout: queueOutput } = await execAsync(
      'lpq 2>/dev/null || echo "No jobs waiting"',
    );
    const { stdout: printerStatus } = await execAsync(
      'lpstat -p 2>/dev/null || echo "No printers found"',
    );

    // Parse queue information
    const hasJobs =
      !queueOutput.includes('No jobs waiting') && queueOutput.trim().length > 0;
    const jobCount = hasJobs
      ? queueOutput.split('\n').filter((line) => line.includes('TSC_TE244'))
          .length
      : 0;

    res.json({
      success: true,
      data: {
        hasJobs: hasJobs,
        jobCount: jobCount,
        queueOutput: queueOutput.trim(),
        printerStatus: printerStatus.trim(),
        printerOnline:
          printerStatus.includes('TSC_TE244') &&
          !printerStatus.includes('No printers found'),
      },
    });
  } catch (error) {
    console.error('Printer queue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printer queue status',
      data: {
        hasJobs: false,
        jobCount: 0,
        queueOutput: 'Error checking queue',
        printerStatus: 'Error checking printers',
        printerOnline: false,
      },
    });
  }
});

module.exports = router;
