/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const express = require('express');
const router = express.Router();
const controller = require('./messagesController');

//GET eligible employees for new conversations (same role + managers)
router.get('/eligible/:employeeId', controller.getEligibleEmployees);

router.get('/partners/:employeeId', controller.getConversationPartners);

//GET conversation between two users
router.get('/:employeeId/:otherUserId', controller.getConversation);

//POST send a message/reply
router.post('/reply', controller.sendMessage);

//PATCH mark messages as read
router.patch('/mark-read', controller.markMessagesAsRead);

module.exports = router;