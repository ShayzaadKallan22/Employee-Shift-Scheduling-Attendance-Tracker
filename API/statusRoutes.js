// statusRoutes.js
const express = require('express');
const router = express.Router();
const statusController = require('./statusController');

// Get all employees with status
router.get('/employees', statusController.getEmployees);

// Get all roles
router.get('/roles', statusController.getRoles);

module.exports = router;