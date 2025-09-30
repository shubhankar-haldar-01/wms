/**
 * Stock Consistency Middleware
 *
 * This middleware ensures stock consistency across all tables
 * and can be used to verify data integrity.
 */

const { pool } = require("../config/database");

/**
 * Ensures stock consistency for a specific product
 * @param {Object} connection - Database connection
 * @param {number} productId - Product ID
 * @returns {Promise<number>} - Correct stock quantity
 */
async function ensureStockConsistency(connection, productId) {
  try {
    // First, fix any barcodes that are stocked in but have 0 units_assigned
    await fixBarcodeUnitsAssigned(connection, productId);

    // Calculate correct stock based on barcodes
    const [stockedInData] = await connection.execute(
      `SELECT SUM(units_assigned) as total_units FROM barcodes WHERE product_id = ? AND is_stocked_in = 1`,
      [productId]
    );

    const correctStock = stockedInData[0].total_units || 0;

    // Update inventory table
    const [inventoryExists] = await connection.execute(
      "SELECT id FROM inventory WHERE product_id = ?",
      [productId]
    );

    if (inventoryExists.length > 0) {
      await connection.execute(
        "UPDATE inventory SET quantity = ?, last_updated = NOW() WHERE product_id = ?",
        [correctStock, productId]
      );
    } else {
      await connection.execute(
        "INSERT INTO inventory (product_id, quantity, last_updated) VALUES (?, ?, NOW())",
        [productId, correctStock]
      );
    }

    // Update products table
    await connection.execute(
      "UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?",
      [correctStock, productId]
    );

    return correctStock;
  } catch (error) {
    console.error("Error ensuring stock consistency:", error);
    throw error;
  }
}

/**
 * Verifies stock consistency for a product without fixing
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} - Consistency check result
 */
async function verifyStockConsistency(productId) {
  try {
    // Get current values from different sources
    const [productResult] = await pool.execute(
      "SELECT stock_quantity FROM products WHERE id = ?",
      [productId]
    );
    const [inventoryResult] = await pool.execute(
      "SELECT quantity FROM inventory WHERE product_id = ?",
      [productId]
    );
    const [barcodeResult] = await pool.execute(
      "SELECT SUM(units_assigned) as total_units FROM barcodes WHERE product_id = ? AND is_stocked_in = 1",
      [productId]
    );

    const productsStock = productResult[0]?.stock_quantity || 0;
    const inventoryStock = inventoryResult[0]?.quantity || 0;
    const barcodeStock = barcodeResult[0]?.total_units || 0;

    const isConsistent =
      productsStock === inventoryStock && inventoryStock === barcodeStock;

    return {
      isConsistent,
      productsStock,
      inventoryStock,
      barcodeStock,
      correctStock: barcodeStock,
    };
  } catch (error) {
    console.error("Error verifying stock consistency:", error);
    throw error;
  }
}

/**
 * Fixes barcodes that are stocked in but have 0 units_assigned
 * @param {Object} connection - Database connection
 * @param {number} productId - Product ID
 * @returns {Promise<number>} - Number of barcodes fixed
 */
async function fixBarcodeUnitsAssigned(connection, productId) {
  try {
    // Find and fix barcodes that are stocked in but have 0 units_assigned
    const [updateResult] = await connection.execute(
      `UPDATE barcodes 
       SET units_assigned = 1, updated_at = NOW()
       WHERE product_id = ? 
       AND is_stocked_in = 1 
       AND units_assigned = 0`,
      [productId]
    );

    if (updateResult.affectedRows > 0) {
      console.log(
        `Fixed ${updateResult.affectedRows} barcodes with 0 units_assigned for product ${productId}`
      );
    }

    return updateResult.affectedRows;
  } catch (error) {
    console.error("Error fixing barcode units assigned:", error);
    throw error;
  }
}

/**
 * Middleware to verify stock consistency after barcode operations
 */
function stockConsistencyMiddleware() {
  return async (req, res, next) => {
    try {
      // Only apply to barcode-related operations
      if (req.path.includes("/scanner/") || req.path.includes("/stock/")) {
        // Add verification after response is sent
        const originalSend = res.send;
        res.send = function (data) {
          // Call original send first
          const result = originalSend.call(this, data);

          // Then verify consistency in background
          if (req.body && req.body.barcode) {
            // This is a barcode operation, verify consistency
            setImmediate(async () => {
              try {
                // Get product ID from barcode
                const [barcodeResult] = await pool.execute(
                  "SELECT product_id FROM barcodes WHERE barcode = ?",
                  [req.body.barcode]
                );

                if (barcodeResult.length > 0) {
                  const productId = barcodeResult[0].product_id;
                  const verification = await verifyStockConsistency(productId);

                  if (!verification.isConsistent) {
                    console.warn(
                      `Stock inconsistency detected for product ${productId}:`,
                      verification
                    );
                    // Auto-fix in background
                    const connection = await pool.getConnection();
                    try {
                      await ensureStockConsistency(connection, productId);
                      console.log(
                        `Auto-fixed stock consistency for product ${productId}`
                      );
                    } finally {
                      connection.release();
                    }
                  }
                }
              } catch (error) {
                console.error("Error in background stock verification:", error);
              }
            });
          }

          return result;
        };
      }

      next();
    } catch (error) {
      console.error("Error in stock consistency middleware:", error);
      next();
    }
  };
}

module.exports = {
  ensureStockConsistency,
  verifyStockConsistency,
  fixBarcodeUnitsAssigned,
  stockConsistencyMiddleware,
};
