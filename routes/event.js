const {Router} = require('express')
const  {createEvent,getAllEvents,updateEvent,deleteEvent}  = require('../controllers/eventController')
const verifyToken = require("../middleware/auth");
const router = Router()

router.post('/createEvent',verifyToken, createEvent)
router.get('/getAllEvents',verifyToken,  getAllEvents)
router.put('/updateEvent/:eventId',verifyToken,  updateEvent)
router.delete('/deleteEvent/:eventId', verifyToken, deleteEvent)

module.exports = router