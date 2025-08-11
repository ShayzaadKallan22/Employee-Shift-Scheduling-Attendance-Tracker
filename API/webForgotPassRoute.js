//Author : Katlego Mmadi
const express = require('express');
const router = express.Router();
const controller = require('./webForgotPassController');
const { otpRateLimiter } = require('./rateLimiter');

router.post('/forgot-password', controller.forgotPassword);
router.post('/verify-otp', otpRateLimiter, controller.verifyOTP);
router.post('/reset-password', controller.resetPassword);

module.exports = router;