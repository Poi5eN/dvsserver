const express = require("express");
const { createsellItem, returnsellItem, getSalesRecords, multiItemSell} = require("../controllers/inventoryController");
const verifyToken = require("../middleware/auth");

const router = express.Router();

router.post('/createsellItem', verifyToken, createsellItem);
router.post('/multiItemSell', verifyToken, multiItemSell);
router.put('/returnsellItem', verifyToken, returnsellItem);
router.get('/getSalesRecords', verifyToken, getSalesRecords);
// router.get('/getsellItems', verifyToken, getsellItems);
// router.delete('/deleteExam/:examId', verifyToken, deleteExam);
// router.put('/updateExam', verifyToken, updateExam);

module.exports = router;