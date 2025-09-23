//AUTHOR - SHAYZAAD

const express = require('express');
const router = express.Router();
const normalQRController = require('./normalController');

//Get current active normal QR
router.get('/current', normalQRController.getCurrentNormalQR);

//Get proof QR by ID
//Get current proof QR
router.get('/proof/current', normalQRController.getProofQR);

module.exports = router;