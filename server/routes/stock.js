const express = require("express");
const Joi = require("joi");
const pool = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { ensureStockConsistency } = require("../middleware/stockConsistency");

const router = express.Router();

// Validation schemas
const stockInSchema = Joi.object({
  barcode: Joi.string().required(),
  quantity: Joi.number().integer().positive().optional().default(1),
  notes: Joi.string().allow("").optional(),
});

const stockOutSchema = Joi.object({
  barcode: Joi.string().required(),
  quantity: Joi.number().integer().positive().optional().default(1),
  notes: Joi.string().allow("").optional(),
});

// Stock In - Scan barcode to add stock
router.post("/in", authenticateToken, async (req, res) => {
  try {
    const { error, value } = stockInSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { barcode, quantity, notes } = value;

    // Find barcode and get product details
    const [barcodeRows] = await pool.execute(
      `SELECT b.*, p.*, p.stock_quantity as current_stock
       FROM barcodes b
       JOIN products p ON b.product_id = p.id
       WHERE b.barcode = ?`,
      [barcode]
    );

    if (barcodeRows.length === 0) {
      return res.status(404).json({ error: "Barcode not found" });
    }

    const barcodeData = barcodeRows[0];
    const productId = barcodeData.product_id;
    const unitsPerBarcode = barcodeData.units_assigned || 1;
    const totalUnitsToAdd = quantity * unitsPerBarcode;

    // Ensure stock consistency across all tables
    const totalUnits = await ensureStockConsistency(productId);

    // Record transaction
    await pool.execute(
      `INSERT INTO transactions (product_id, type, quantity, user_id, notes, created_at)
       VALUES (?, 'in', ?, ?, ?, NOW())`,
      [
        productId,
        totalUnitsToAdd,
        req.user.id,
        notes || "Stock in via barcode scan",
      ]
    );

    // Get updated product details
    const [updatedProduct] = await pool.execute(
      "SELECT * FROM products WHERE id = ?",
      [productId]
    );

    res.json({
      success: true,
      message: `Stock in successful: +${totalUnitsToAdd} units`,
      data: {
        product: updatedProduct[0],
        barcode: barcodeData.barcode,
        quantity_scanned: quantity,
        units_added: totalUnitsToAdd,
        new_stock: updatedProduct[0].stock_quantity,
      },
    });
  } catch (error) {
    console.error("Stock in error:", error);
    res.status(500).json({ error: "Failed to process stock in" });
  }
});

// Stock Out - Scan barcode to remove stock
router.post("/out", authenticateToken, async (req, res) => {
  try {
    const { error, value } = stockOutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { barcode, quantity, notes } = value;

    // Find barcode and get product details
    const [barcodeRows] = await pool.execute(
      `SELECT b.*, p.*, p.stock_quantity as current_stock
       FROM barcodes b
       JOIN products p ON b.product_id = p.id
       WHERE b.barcode = ?`,
      [barcode]
    );

    if (barcodeRows.length === 0) {
      return res.status(404).json({ error: "Barcode not found" });
    }

    const barcodeData = barcodeRows[0];
    const productId = barcodeData.product_id;
    const unitsPerBarcode = barcodeData.units_assigned || 1;
    const totalUnitsToRemove = quantity * unitsPerBarcode;
    const currentStock = barcodeData.current_stock;

    // Check if sufficient stock available
    if (currentStock < totalUnitsToRemove) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${currentStock} units, Required: ${totalUnitsToRemove} units`,
        data: {
          current_stock: currentStock,
          required: totalUnitsToRemove,
          shortfall: totalUnitsToRemove - currentStock,
        },
      });
    }

    // Update stock quantity
    await pool.execute(
      `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
      [totalUnitsToRemove, productId]
    );

    // Record transaction
    await pool.execute(
      `INSERT INTO transactions (product_id, type, quantity, user_id, notes, created_at)
       VALUES (?, 'out', ?, ?, ?, NOW())`,
      [
        productId,
        totalUnitsToRemove,
        req.user.id,
        notes || "Stock out via barcode scan",
      ]
    );

    // Get updated product details
    const [updatedProduct] = await pool.execute(
      "SELECT * FROM products WHERE id = ?",
      [productId]
    );

    res.json({
      success: true,
      message: `Stock out successful: -${totalUnitsToRemove} units`,
      data: {
        product: updatedProduct[0],
        barcode: barcodeData.barcode,
        quantity_scanned: quantity,
        units_removed: totalUnitsToRemove,
        new_stock: updatedProduct[0].stock_quantity,
      },
    });
  } catch (error) {
    console.error("Stock out error:", error);
    res.status(500).json({ error: "Failed to process stock out" });
  }
});

// Get stock transactions history
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, product_id, transaction_type } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        t.*,
        p.name as product_name,
        p.sku,
        u.username as user_name
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      LEFT JOIN users u ON t.user_id = u.id
    `;

    const params = [];
    const conditions = [];

    if (product_id) {
      conditions.push("t.product_id = ?");
      params.push(product_id);
    }

    if (transaction_type) {
      conditions.push("t.type = ?");
      params.push(transaction_type);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY t.created_at DESC";
    query += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const [transactions] = await pool.execute(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN products p ON t.product_id = p.id
    `;
    if (conditions.length > 0) {
      countQuery += " WHERE " + conditions.join(" AND ");
    }

    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

// Get barcode details for scanning
router.get("/barcode/:barcode", authenticateToken, async (req, res) => {
  try {
    const { barcode } = req.params;

    const [barcodeRows] = await pool.execute(
      `SELECT 
        b.*,
        p.name as product_name,
        p.sku,
        p.price,
        p.stock_quantity as current_stock,
        p.unit,
        p.status
       FROM barcodes b
       JOIN products p ON b.product_id = p.id
       WHERE b.barcode = ?`,
      [barcode]
    );

    if (barcodeRows.length === 0) {
      return res.status(404).json({ error: "Barcode not found" });
    }

    res.json({
      success: true,
      data: barcodeRows[0],
    });
  } catch (error) {
    console.error("Get barcode error:", error);
    res.status(500).json({ error: "Failed to get barcode details" });
  }
});

module.exports = router;
