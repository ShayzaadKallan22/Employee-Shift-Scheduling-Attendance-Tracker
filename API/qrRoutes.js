/**
 * @author MOYO CT, 221039267
 */


const express = require('express');
const router = express.Router();
const controller = require('./qrCodeController');


router.post('/scan', controller.scanQR);
module.exports = router;