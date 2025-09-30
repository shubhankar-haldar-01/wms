const express = require("express");
const Joi = require("joi");
const { pool, getTableName } = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Get low stock alerts (simplified - using products table directly)
router.get("/low-stock", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [alerts] = await pool.execute(
      `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.price as product_price,
        p.low_stock_threshold,
        p.stock_quantity as current_stock,
        CASE 
          WHEN p.stock_quantity = 0 THEN 'critical'
          WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low'
          ELSE 'normal'
        END as alert_level,
        p.updated_at as last_updated
      FROM products p
      WHERE p.stock_quantity <= p.low_stock_threshold
      ORDER BY 
        CASE 
          WHEN p.stock_quantity = 0 THEN 0
          ELSE p.stock_quantity / p.low_stock_threshold
        END ASC,
        p.updated_at DESC
      LIMIT ? OFFSET ?
    `,
      [parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM products p
      WHERE p.stock_quantity <= p.low_stock_threshold
    `);

    const total = parseInt(countResult[0].total);

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get low stock alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get alert summary
router.get("/summary", authenticateToken, async (req, res) => {
  try {
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(CASE WHEN p.stock_quantity = 0 THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold THEN 1 END) as low_stock_alerts,
        COUNT(CASE WHEN p.stock_quantity > p.low_stock_threshold THEN 1 END) as normal_stock
      FROM products p
    `);

    res.json({
      success: true,
      data: summary[0],
    });
  } catch (error) {
    console.error("Get alert summary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get recent alerts activity
router.get("/activity", authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const [activity] = await pool.execute(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as alert_count,
        COUNT(CASE WHEN type = 'in' THEN 1 END) as stock_in_count,
        COUNT(CASE WHEN type = 'out' THEN 1 END) as stock_out_count
      FROM products
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
      [parseInt(days)]
    );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Get alerts activity error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get products approaching low stock
router.get("/approaching-low-stock", authenticateToken, async (req, res) => {
  try {
    const { threshold = 0.5 } = req.query; // 50% of low stock threshold

    const [products] = await pool.execute(
      `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.price,
        p.low_stock_threshold,
        COALESCE(i.quantity, 0) as current_stock,
        ROUND((COALESCE(i.quantity, 0) / p.low_stock_threshold) * 100, 2) as stock_percentage
      FROM products p
      LEFT JOIN products i ON p.id = i.product_id
      WHERE COALESCE(i.quantity, 0) > p.low_stock_threshold 
        AND COALESCE(i.quantity, 0) <= (p.low_stock_threshold * (1 + ?))
      ORDER BY stock_percentage ASC
    `,
      [parseFloat(threshold)]
    );

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get approaching low stock error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get stock movement alerts (unusual activity)
router.get("/movement-alerts", authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const [movements] = await pool.execute(
      `
      SELECT 
        p.name as product_name,
        p.sku as product_sku,
        t.type,
        t.quantity,
        t.reference_number,
        t.created_at,
        u.username as created_by
      FROM products t
      JOIN products p ON t.product_id = p.id
      LEFT JOIN products u ON t.user_id = u.id
      WHERE t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND (t.quantity > 100 OR t.notes LIKE '%urgent%' OR t.notes LIKE '%emergency%')
      ORDER BY t.created_at DESC
      LIMIT 20
    `,
      [parseInt(days)]
    );

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error("Get movement alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get system health alerts
router.get(
  "/system-health",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const alerts = [];

      // Check for products without inventory records
      const [noInventory] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM products p
      LEFT JOIN products i ON p.id = i.product_id
      WHERE i.id IS NULL
    `);

      if (noInventory[0].count > 0) {
        alerts.push({
          type: "warning",
          message: `${noInventory[0].count} products have no inventory records`,
          severity: "medium",
        });
      }

      // Check for products with negative stock
      const [negativeStock] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM products
      WHERE quantity < 0
    `);

      if (negativeStock[0].count > 0) {
        alerts.push({
          type: "error",
          message: `${negativeStock[0].count} products have negative stock`,
          severity: "high",
        });
      }

      // Check for old transactions (no activity in 30 days)
      const [oldTransactions] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM products
      WHERE created_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);

      if (oldTransactions[0].count > 0) {
        alerts.push({
          type: "info",
          message: `${oldTransactions[0].count} transactions older than 30 days`,
          severity: "low",
        });
      }

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      console.error("Get system health alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

module.exports = router;
