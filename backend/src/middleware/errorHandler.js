export const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Error]', err);
  }

  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  if (
    err.name === 'MulterError' ||
    err.name === 'ValidationError' ||
    err.message?.includes('.xls') ||
    err.message?.includes('Invalid file type')
  ) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

