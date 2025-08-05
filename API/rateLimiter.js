const rateLimit = require('express-rate-limit');

const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many OTP attempts, please try again later',
  skipSuccessfulRequests: true
});

module.exports = { otpRateLimiter };