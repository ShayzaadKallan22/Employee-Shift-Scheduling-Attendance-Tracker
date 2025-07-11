//AUTHOR - SHAYZAAD

const express = require('express');
const router = express.Router();
const overtimeController = require('./overtimeController');

//Generate overtime QR
router.post('/generate', overtimeController.generateQR);

//Extend overtime
router.post('/extend', overtimeController.extendOvertime);

//End overtime
router.post('/end', overtimeController.endOvertime);

//To monitor overtime status
router.get('/status/:overtimeId', overtimeController.getSessionStatus);

//To monitor proof qr status
router.get('/proof-status/:proofQRId', overtimeController.getProofStatus);

module.exports = router;
