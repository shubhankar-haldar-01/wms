const { pool } = require("../config/database");

const dbHealthCheck = async (req, res, next) => {
  try {
    // Test database connection
    await pool.execute("SELECT 1 as test");
    next();
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({
      success: false,
      message: "Database connection failed. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = dbHealthCheck;
