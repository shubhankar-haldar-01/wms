const { pool } = require("../config/database");

class WarehouseMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      lastHealthCheck: null,
      criticalAlerts: 0,
      lowStockItems: 0,
      totalProducts: 0,
      totalBarcodes: 0,
      totalTransactions: 0,
    };

    this.startTime = Date.now();
    this.initializeMonitoring();
  }

  async initializeMonitoring() {
    try {
      await this.updateSystemMetrics();
      // Update metrics every 30 seconds
      setInterval(() => this.updateSystemMetrics(), 30000);
    } catch (error) {
      console.error("Failed to initialize warehouse monitoring:", error);
    }
  }

  async updateSystemMetrics() {
    try {
      // Get critical alerts count
      const [alertsResult] = await pool.execute(`
        SELECT COUNT(*) as count FROM alerts WHERE priority = 'critical' AND is_read = 0
      `);
      this.metrics.criticalAlerts = alertsResult[0].count;

      // Get low stock items count
      const [lowStockResult] = await pool.execute(`
        SELECT COUNT(*) as count FROM products WHERE stock_quantity <= low_stock_threshold
      `);
      this.metrics.lowStockItems = lowStockResult[0].count;

      // Get total counts
      const [productsResult] = await pool.execute(
        `SELECT COUNT(*) as count FROM products`
      );
      const [barcodesResult] = await pool.execute(
        `SELECT COUNT(*) as count FROM barcodes`
      );
      const [transactionsResult] = await pool.execute(
        `SELECT COUNT(*) as count FROM transactions`
      );

      this.metrics.totalProducts = productsResult[0].count;
      this.metrics.totalBarcodes = barcodesResult[0].count;
      this.metrics.totalTransactions = transactionsResult[0].count;

      this.metrics.lastHealthCheck = new Date().toISOString();
    } catch (error) {
      console.error("Failed to update system metrics:", error);
    }
  }

  recordRequest(responseTime, success) {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Calculate rolling average response time
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
        responseTime) /
      this.metrics.totalRequests;
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const successRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 0;

    return {
      ...this.metrics,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime:
        Math.round(this.metrics.averageResponseTime * 100) / 100,
    };
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async getWarehouseStatus() {
    const metrics = this.getMetrics();

    // Determine overall health status
    let status = "healthy";
    if (metrics.criticalAlerts > 0) status = "critical";
    else if (metrics.lowStockItems > 10) status = "warning";
    else if (metrics.successRate < 95) status = "degraded";

    return {
      status,
      timestamp: new Date().toISOString(),
      metrics,
      recommendations: this.getRecommendations(metrics),
    };
  }

  getRecommendations(metrics) {
    const recommendations = [];

    if (metrics.criticalAlerts > 0) {
      recommendations.push({
        priority: "high",
        message: `${metrics.criticalAlerts} critical alerts require immediate attention`,
        action: "Review and resolve critical alerts",
      });
    }

    if (metrics.lowStockItems > 10) {
      recommendations.push({
        priority: "medium",
        message: `${metrics.lowStockItems} items are low in stock`,
        action: "Consider restocking low inventory items",
      });
    }

    if (metrics.successRate < 95) {
      recommendations.push({
        priority: "high",
        message: `System success rate is ${metrics.successRate}%`,
        action: "Investigate and resolve system errors",
      });
    }

    if (metrics.averageResponseTime > 2000) {
      recommendations.push({
        priority: "medium",
        message: `Average response time is ${metrics.averageResponseTime}ms`,
        action:
          "Consider optimizing database queries or increasing server resources",
      });
    }

    return recommendations;
  }
}

// Create singleton instance
const warehouseMonitor = new WarehouseMonitor();

// Middleware to record request metrics
const recordRequestMetrics = (req, res, next) => {
  const startTime = Date.now();

  // Override res.json to capture response time and success
  const originalJson = res.json;
  res.json = function (data) {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode < 400;
    warehouseMonitor.recordRequest(responseTime, success);
    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  warehouseMonitor,
  recordRequestMetrics,
};
