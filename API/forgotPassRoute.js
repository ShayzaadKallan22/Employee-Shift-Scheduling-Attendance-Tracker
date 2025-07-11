/**
 * @author MOYO CT, 221039267
 */

const express = require('express');
const router = express.Router();
//const authController = require('./authController');
const controller = require('./forgotPasswordController');

//router.post('/login', authController.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);


module.exports = router;