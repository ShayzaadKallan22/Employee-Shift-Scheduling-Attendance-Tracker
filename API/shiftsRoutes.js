//AUTHOR - SHAYZAAD

const express = require('express');
const router = express.Router();
const shiftController = require('./shiftsController');

router.get('/all', shiftController.getAllShifts);

router.get('/todays', shiftController.getTodaysShifts);

module.exports = router;