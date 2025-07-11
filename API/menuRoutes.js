/**
 * @author MOYO CT, 221039267
 */


const express = require('express');
const router = express.Router();
const controller = require('./menuController');

router.get('/respond/:employee_id', controller.getEmpDetails);

module.exports = router;