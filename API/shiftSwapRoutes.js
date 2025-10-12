/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const express = require('express');
const router = express.Router();
const controller = require('./shiftSwapController');

router.post('/create', controller.createShiftSwap);
router.get('/colleagues/:employee_id', controller.getColleaguesSameRole);
router.post('/respond', controller.respondToSwap);
router.get('/shiftID', controller.getShiftID);
router.get('/my-requests/:employee_id', controller.getSwapRequests);
router.get('/colleague-requests/:employee_id', controller.getColleagueRequests);
router.get('/employee-shift-dates/:employee_id', controller.getEmpShiftDates);
router.get('/colleague-shift-dates/:employee_id', controller.getColleagueShiftDates);  //To fetch dates of colleagues with same role
router.get('/suggested-colleagues', controller.getSuggestedColleagues);  //To suggest colleagues for shift swap
router.get('/approval-recommendation', controller.getApprovalRecommendation);  //To get approval recommendation based on history
 
module.exports = router;
