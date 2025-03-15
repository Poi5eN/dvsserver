// routes/rootAdminRoutes.js
const { Router } = require('express');
const {
  createRootAdmin,
  loginRootAdmin,
  createSuperAdmin,
  getAllData,
  updateSuperAdmin,
  deleteSuperAdmin,
  updateAnyAdmin,
  deleteAnyAdmin,
  updateAnyThirdParty,
  deleteAnyThirdParty,
} = require('../controllers/rootAdminController');
const { singleUpload } = require('../middleware/multer');
const router = Router();

router.post('/createRootAdmin', createRootAdmin);
router.post('/loginRootAdmin', loginRootAdmin);
router.post('/createSuperAdmin', createSuperAdmin);
router.get('/getAllData', getAllData);
router.put('/updateSuperAdmin/:superAdminId', updateSuperAdmin);
router.delete('/deleteSuperAdmin/:superAdminId', deleteSuperAdmin);
router.put('/updateAdmin/:adminId', singleUpload, updateAnyAdmin);
router.delete('/deleteAdmin/:adminId', deleteAnyAdmin);
router.put('/updateThirdParty/:userId', singleUpload, updateAnyThirdParty);
router.delete('/deleteThirdParty/:userId', deleteAnyThirdParty);

module.exports = router;