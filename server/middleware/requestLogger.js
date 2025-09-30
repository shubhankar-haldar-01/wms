const requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  req.id = requestId;

  // Log request
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${
      req.url
    } - Request ID: ${requestId} - User: ${
      req.user ? req.user.username : "anonymous"
    }`
  );

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Log response
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${
        req.url
      } - Status: ${statusCode} - Duration: ${duration}ms - Request ID: ${requestId}`
    );

    // Log errors
    if (statusCode >= 400) {
      console.error(
        `[${new Date().toISOString()}] ERROR ${req.method} ${
          req.url
        } - Status: ${statusCode} - Duration: ${duration}ms - Request ID: ${requestId}`,
        {
          error: data.message || data.error,
          body: req.body,
          query: req.query,
          params: req.params,
        }
      );
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = requestLogger;
