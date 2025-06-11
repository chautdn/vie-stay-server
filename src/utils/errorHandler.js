// errorHandler.js
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
  
    // Send error response
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      // Include stack trace only in development
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
  
  module.exports = errorHandler;