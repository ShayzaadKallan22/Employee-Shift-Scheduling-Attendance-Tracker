/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */


const express = require('express');
const router = express.Router();
const controller = require('./profilesController');

router.get('/create/:employee_id', controller.getEmpProfile);
router.put('/update/:employee_id', controller.updateProfile);

module.exports = router;