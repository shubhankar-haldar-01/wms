const errorHandler = (err, req, res, next) => {
  console.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    user: req.user ? req.user.username : "anonymous",
  });

  // Database connection errors
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(503).json({
      success: false,
      message: "Database connection failed. Please try again later.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // MySQL specific errors
  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    return res.status(500).json({
      success: false,
      message: "Database access denied. Please contact administrator.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.code === "ER_BAD_DB_ERROR") {
    return res.status(500).json({
      success: false,
      message: "Database not found. Please contact administrator.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.code === "ER_WRONG_ARGUMENTS") {
    return res.status(500).json({
      success: false,
      message: "Database query error. Please try again.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token. Please login again.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired. Please login again.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // Validation errors
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
  }

  // File upload errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size allowed is 5MB.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: "Unexpected file field.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
      retryAfter: err.retryAfter,
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString(),
    requestId: req.id || "unknown",
  });
};

module.exports = errorHandler;
