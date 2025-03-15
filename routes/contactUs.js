const {Router} = require('express')
const  {contactUs ,getContactUs}  = require('../controllers/contactUsController')
const router = Router()

router.post('/', contactUs)
router.get('/', getContactUs)

module.exports = router