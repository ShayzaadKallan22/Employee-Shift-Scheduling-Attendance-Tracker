const express = require('express');
const router = express.Router();
const { register, login, logout } = require('./authController');

router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);

module.exports = router;