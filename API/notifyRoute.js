/**
 * @author MOYO CT, 221039267
 */


const express = require('express');
const router = express.Router();
const controller = require('./notifyController');

//Get all notifications for a given employee
router.get('/:employeeId', controller.getEmpNotifications);

//Mark specific notification as read
router.put('/read/:notificationId', controller.markAsRead);

module.exports = router;