const express = require("express");
const { pool } = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Update all barcodes for a product to be stocked in
router.post(
  "/stock-in-all",
  authenticateToken,
  requireRole(["admin", "manager"]),
  async (req, res) => {
    try {
      const { product_id } = req.body;

      if (!product_id) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      // Update all barcodes for the product to be stocked in
      const [result] = await pool.execute(
        `UPDATE barcodes SET is_stocked_in = 1, units_assigned = 1 WHERE product_id = ?`,
        [product_id]
      );

      // Get updated counts
      const [totalCount] = await pool.execute(
        `SELECT COUNT(*) as count FROM barcodes WHERE product_id = ?`,
        [product_id]
      );

      const [stockedInCount] = await pool.execute(
        `SELECT COUNT(*) as count FROM barcodes WHERE product_id = ? AND is_stocked_in = 1`,
        [product_id]
      );

      // Update product stock quantity based on sum of units_assigned
      const [stockedInData] = await pool.execute(
        `SELECT SUM(units_assigned) as total_units FROM barcodes WHERE product_id = ? AND is_stocked_in = 1`,
        [product_id]
      );
      const totalUnits = stockedInData[0].total_units || 0;

      await pool.execute(
        `UPDATE products SET stock_quantity = ? WHERE id = ?`,
        [totalUnits, product_id]
      );

      res.json({
        success: true,
        message: `Updated ${result.affectedRows} barcodes to stocked in status`,
        data: {
          total_barcodes: totalCount[0].count,
          stocked_in_barcodes: stockedInCount[0].count,
          updated_product_stock: stockedInCount[0].count,
        },
      });
    } catch (error) {
      console.error("Error updating barcodes:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update barcodes",
        error: error.message,
      });
    }
  }
);

// Set specific counts for a product
router.post(
  "/set-counts",
  authenticateToken,
  requireRole(["admin", "manager"]),
  async (req, res) => {
    try {
      const { product_id, barcode_count, stock_quantity } = req.body;

      if (
        !product_id ||
        barcode_count === undefined ||
        stock_quantity === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Product ID, barcode count, and stock quantity are required",
        });
      }

      // Step 1: Set all barcodes to not stocked in first
      await pool.execute(
        `UPDATE barcodes SET is_stocked_in = 0, units_assigned = 0 WHERE product_id = ?`,
        [product_id]
      );

      // Step 2: Set only the specified number of barcodes as stocked in
      const [result] = await pool.execute(
        `
        UPDATE barcodes 
        SET is_stocked_in = 1 
        WHERE product_id = ? 
        AND id IN (
          SELECT id FROM (
            SELECT id FROM barcodes 
            WHERE product_id = ? 
            ORDER BY id 
            LIMIT ?
          ) as subquery
        )
      `,
        [product_id, product_id, barcode_count]
      );

      // Step 3: Calculate and set product stock quantity based on sum of units_assigned
      const [stockedInData] = await pool.execute(
        `SELECT SUM(units_assigned) as total_units FROM barcodes WHERE product_id = ? AND is_stocked_in = 1`,
        [product_id]
      );

      const actualStockQuantity = stockedInData[0].total_units || 0;

      await pool.execute(
        `UPDATE products SET stock_quantity = ? WHERE id = ?`,
        [actualStockQuantity, product_id]
      );

      // Verify counts
      const [stockedInCount] = await pool.execute(
        `SELECT COUNT(*) as count FROM barcodes WHERE product_id = ? AND is_stocked_in = 1`,
        [product_id]
      );

      const [productStock] = await pool.execute(
        `SELECT stock_quantity FROM products WHERE id = ?`,
        [product_id]
      );

      res.json({
        success: true,
        message: `Set barcode count to ${barcode_count} and stock to ${actualStockQuantity}`,
        data: {
          barcode_count: stockedInCount[0].count,
          stock_quantity: productStock[0].stock_quantity,
        },
      });
    } catch (error) {
      console.error("Error setting counts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to set counts",
        error: error.message,
      });
    }
  }
);

module.exports = router;
