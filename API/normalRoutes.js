const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');

router.use(notificationController.validateManager);

router.get('/', notificationController.getNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.get('/unread/latest', notificationController.getLatestUnread);
router.patch('/:notification_id/:read_status', notificationController.toggleReadStatus);
router.patch('/mark-all-read', notificationController.markAllAsRead);

module.exports = router;