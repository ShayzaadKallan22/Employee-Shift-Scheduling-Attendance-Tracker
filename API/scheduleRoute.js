/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */


const express = require('express');
const router = express.Router();
const scheduleController = require('./scheduleController');

router.get('/employee/:id/shifts', scheduleController.getEmpShifts);

module.exports = router;