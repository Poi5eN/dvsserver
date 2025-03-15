// routes/superAdminRoutes.js
const { Router } = require('express');
const {
  createAdmin,
  getAdminsBySuperAdmin,
  updateAdmin,
  createThirdPartyUser,
  getAllThirdPartyUsers,
  updateThirdPartyUser,
  deleteThirdPartyUser,
  loginSuperAdmin,
  createReceptionist,
  getAllReceptionists,
  updateReceptionist,
  deleteReceptionist,
} = require('../controllers/superAdminController');
const { singleUpload } = require('../middleware/multer');
const router = Router();

router.post('/loginSuperAdmin', loginSuperAdmin);
router.post('/createAdmin', singleUpload, createAdmin);
router.get('/getAdmins/:superAdminId', getAdminsBySuperAdmin);
router.put('/updateAdmin/:adminId/:superAdminId', singleUpload, updateAdmin);
router.post('/createThirdParty', singleUpload, createThirdPartyUser);
router.get('/thirdparty/:superAdminId', getAllThirdPartyUsers);
router.put('/thirdparty/:userId/:superAdminId', singleUpload, updateThirdPartyUser);
router.delete('/thirdparty/:userId/:superAdminId', deleteThirdPartyUser);
router.post('/createReceptionist', singleUpload, createReceptionist);
router.get('/receptionists/:superAdminId', getAllReceptionists);
router.put('/receptionists/:userId/:superAdminId', singleUpload, updateReceptionist);
router.delete('/receptionists/:userId/:superAdminId', deleteReceptionist);

module.exports = router;