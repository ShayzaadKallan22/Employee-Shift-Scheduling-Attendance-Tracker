const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');

// Apply middleware
router.use(notificationController.validateManagerMiddleware);

// Routes
router.get('/', notificationController.getNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.get('/unread/latest', notificationController.getLatestUnread);

module.exports = router;
