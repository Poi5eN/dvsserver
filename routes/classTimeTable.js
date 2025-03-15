const express = require("express");
const verifyToken = require("../middleware/auth");
const { 
    createClassTimeTable, 
    deleteClassTimeTable, 
    getClassTimeTable, 
    updateClassTimeTable 
} = require("../controllers/classTimeTableController");

const router = express.Router();

router.post('/createClassTimeTable', verifyToken, createClassTimeTable);
router.delete('/deleteClassTimeTable/:timeTableId', verifyToken, deleteClassTimeTable);
router.get('/getClassTimeTable', verifyToken, getClassTimeTable);
router.put('/updateClassTimeTable', verifyToken, updateClassTimeTable);

module.exports = router;