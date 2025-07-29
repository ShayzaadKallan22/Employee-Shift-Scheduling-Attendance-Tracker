/**
 * @author MOYO CT, 221039267
 */

const express = require('express');
const router = express.Router();
const controller = require('./shiftSwapController');
const SwapController = require('./shiftSwapController');

router.post('/create', controller.createShiftSwap);
router.get('/colleagues/:employee_id', controller.getColleaguesSameRole);
router.post('/respond', controller.respondToSwap);
router.get('/shiftID', controller.getShiftID);
router.get('/my-requests/:employee_id', SwapController.getSwapRequests);
router.get('/colleague-requests/:employee_id', SwapController.getColleagueRequests);
router.get('/employee-shift-dates/:employee_id', controller.getEmpShiftDates);
router.get('/colleague-shift-dates/:employee_id', controller.getColleagueShiftDates);



module.exports = router;
