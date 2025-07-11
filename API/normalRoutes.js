//AUTHOR - SHAYZAAD

const express = require('express');
const router = express.Router();
const normalQRController = require('./normalController');

//Get current active normal QR
router.get('/current', normalQRController.getCurrentNormalQR);

//Get proof QR by ID
router.get('/proof/:qrId', normalQRController.getProofQR);

module.exports = router;