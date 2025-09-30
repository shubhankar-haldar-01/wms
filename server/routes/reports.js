const express = require("express");
const { pool, getTableName } = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Get comprehensive reports data
router.get(
  "/",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { period = 30 } = req.query;
      const days = parseInt(period);

      // Get basic metrics
      const [
        [totalProductsResult],
        [inventoryValueResult],
        [lowStockResult],
        [transactionsResult],
        [inStockResult],
      ] = await Promise.all([
        pool.execute("SELECT COUNT(*) as count FROM products"),
        pool.execute(`
        SELECT COALESCE(SUM(p.price * p.stock_quantity), 0) as total_value
        FROM products p
      `),
        pool.execute(`
        SELECT COUNT(*) as count
        FROM products p
        WHERE p.stock_quantity <= p.low_stock_threshold
      `),
        pool.execute(`
        SELECT COUNT(*) as count
        FROM products
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      `),
        pool.execute(`
        SELECT COUNT(*) as count
        FROM products p
        WHERE p.stock_quantity > p.low_stock_threshold
      `),
      ]);

      const reports = {
        overview: {
          totalProducts: parseInt(totalProductsResult[0].count),
          inventoryValue: parseFloat(inventoryValueResult[0].total_value),
          lowStockProducts: parseInt(lowStockResult[0].count),
          inStockProducts: parseInt(inStockResult[0].count),
          recentTransactions: parseInt(transactionsResult[0].count),
        },
      };

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      console.error("Get reports error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get inventory value report
router.get(
  "/inventory-value",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const [inventoryValue] = await pool.execute(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          p.price,
          COALESCE(i.quantity, 0) as stock_quantity,
          (p.price * COALESCE(i.quantity, 0)) as total_value
        FROM products p
        LEFT JOIN products i ON p.id = i.product_id
        ORDER BY total_value DESC
      `);

      const totalValue = inventoryValue.reduce(
        (sum, item) => sum + item.total_value,
        0
      );

      res.json({
        success: true,
        data: {
          inventoryValue,
          totalValue,
        },
      });
    } catch (error) {
      console.error("Get inventory value report error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get stock movement report
router.get(
  "/stock-movement",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { period = 30 } = req.query;
      const days = parseInt(period);

      const [movements] = await pool.execute(`
        SELECT 
          DATE(t.created_at) as date,
          t.type,
          COUNT(*) as transaction_count,
          SUM(t.quantity) as total_quantity,
          COUNT(DISTINCT t.product_id) as unique_products
        FROM products t
        WHERE t.created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY DATE(t.created_at), t.type
        ORDER BY date DESC
      `);

      res.json({
        success: true,
        data: movements,
      });
    } catch (error) {
      console.error("Get stock movement report error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get top products report
router.get(
  "/top-products",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { period = 30, limit = 10 } = req.query;
      const days = parseInt(period);
      const limitCount = parseInt(limit);

      const [topProducts] = await pool.execute(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          p.price,
          p.stock_quantity as current_stock,
          COUNT(t.id) as transaction_count,
          SUM(CASE WHEN t.type = 'in' THEN t.quantity ELSE 0 END) as total_in,
          SUM(CASE WHEN t.type = 'out' THEN t.quantity ELSE 0 END) as total_out,
          SUM(t.quantity) as total_movement
        FROM products p
        LEFT JOIN transactions t ON p.id = t.product_id 
          AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY p.id, p.name, p.sku, p.price, p.stock_quantity
        ORDER BY total_movement DESC
        LIMIT ${limitCount}
      `);

      res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      console.error("Get top products report error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get low stock report
router.get(
  "/low-stock",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const [lowStockProducts] = await pool.execute(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          p.price,
          p.low_stock_threshold,
          COALESCE(i.quantity, 0) as current_stock,
          CASE 
            WHEN COALESCE(i.quantity, 0) = 0 THEN 'critical'
            WHEN COALESCE(i.quantity, 0) <= p.low_stock_threshold THEN 'low'
            ELSE 'normal'
          END as stock_status,
          ROUND((COALESCE(i.quantity, 0) / p.low_stock_threshold) * 100, 2) as stock_percentage
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE COALESCE(i.quantity, 0) <= p.low_stock_threshold
        ORDER BY 
          CASE 
            WHEN COALESCE(i.quantity, 0) = 0 THEN 0
            ELSE COALESCE(i.quantity, 0) / p.low_stock_threshold
          END ASC
      `);

      res.json({
        success: true,
        data: lowStockProducts,
      });
    } catch (error) {
      console.error("Get low stock report error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get transaction summary report
router.get(
  "/transaction-summary",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { period = 30 } = req.query;
      const days = parseInt(period);

      const [summary] = await pool.execute(`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN type = 'in' THEN 1 END) as in_transactions,
          COUNT(CASE WHEN type = 'out' THEN 1 END) as out_transactions,
          SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as total_in_quantity,
          SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as total_out_quantity,
          COUNT(DISTINCT product_id) as unique_products,
          COUNT(DISTINCT user_id) as unique_users
        FROM transactions
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      `);

      res.json({
        success: true,
        data: summary[0],
      });
    } catch (error) {
      console.error("Get transaction summary report error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// ABC Analysis endpoint
router.get(
  "/abc-analysis",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { period = 30 } = req.query;
      const days = parseInt(period);

      // Get products with their transaction values
      const [products] = await pool.execute(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          p.price,
          p.stock_quantity,
          COALESCE(SUM(t.quantity * p.price), 0) as total_value,
          COUNT(t.id) as transaction_count
        FROM products p
        LEFT JOIN transactions t ON p.id = t.product_id 
          AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY p.id, p.name, p.sku, p.price, p.stock_quantity
        ORDER BY total_value DESC
      `);

      // Calculate ABC classification
      const totalValue = products.reduce(
        (sum, product) => sum + parseFloat(product.total_value),
        0
      );

      let cumulativeValue = 0;
      const abcProducts = products.map((product) => {
        cumulativeValue += parseFloat(product.total_value);
        const percentage =
          totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;

        let category = "C";
        if (percentage <= 80) category = "A";
        else if (percentage <= 95) category = "B";

        return {
          ...product,
          percentage: Math.round(percentage * 100) / 100,
          category,
        };
      });

      // Group by category
      const abcSummary = {
        A: abcProducts.filter((p) => p.category === "A"),
        B: abcProducts.filter((p) => p.category === "B"),
        C: abcProducts.filter((p) => p.category === "C"),
      };

      res.json({
        success: true,
        data: {
          products: abcProducts,
          summary: abcSummary,
          totalValue: totalValue,
          period: days,
        },
      });
    } catch (error) {
      console.error("ABC Analysis error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Stock movements endpoint
router.get(
  "/stock-movements",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { period = 30 } = req.query;
      const days = parseInt(period);

      // Get daily stock movements
      const [movements] = await pool.execute(`
        SELECT 
          DATE(created_at) as date,
          type,
          COUNT(*) as transaction_count,
          SUM(quantity) as total_quantity,
          COUNT(DISTINCT product_id) as unique_products
        FROM transactions
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY DATE(created_at), type
        ORDER BY date DESC, type
      `);

      // Get product-wise movements
      const [productMovements] = await pool.execute(`
        SELECT 
          p.name,
          p.sku,
          SUM(CASE WHEN t.type = 'in' THEN t.quantity ELSE 0 END) as total_in,
          SUM(CASE WHEN t.type = 'out' THEN t.quantity ELSE 0 END) as total_out,
          COUNT(t.id) as transaction_count
        FROM products p
        LEFT JOIN transactions t ON p.id = t.product_id 
          AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        GROUP BY p.id, p.name, p.sku
        HAVING transaction_count > 0
        ORDER BY transaction_count DESC
        LIMIT 20
      `);

      res.json({
        success: true,
        data: {
          dailyMovements: movements,
          productMovements: productMovements,
          period: days,
        },
      });
    } catch (error) {
      console.error("Stock movements error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Recent transactions endpoint
router.get(
  "/recent-transactions",
  authenticateToken,
  requireRole(["admin", "user"]),
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const limitCount = parseInt(limit);

      const [transactions] = await pool.execute(`
        SELECT 
          t.*,
          p.name as product_name,
          p.sku as product_sku,
          u.username as created_by_username
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        LEFT JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC
        LIMIT ${limitCount}
      `);

      res.json({
        success: true,
        data: {
          transactions: transactions,
          count: transactions.length,
        },
      });
    } catch (error) {
      console.error("Recent transactions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

module.exports = router;
