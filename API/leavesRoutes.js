/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const express = require('express');
const router = express.Router();
const leaveController = require('./leavesController');

router.get('/remaining/:employee_id/:leave_type_id', leaveController.getRemainingLeaveDays);
router.post('/request', leaveController.requestLeave);
router.get('/all', leaveController.getAllLeaveRequests);
router.post('/respond', leaveController.respondToLeave);
router.get('/my/:employee_id', leaveController.getMyLeaveRequests);
router.delete('/cancel/:leave_id', leaveController.cancelLeave);

module.exports = router;
