/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const express = require('express');
const router = express.Router();
const shiftController = require('./shiftController');

router.get('/upcoming/:employeeId', shiftController.getUpcomingShifts);

module.exports = router;