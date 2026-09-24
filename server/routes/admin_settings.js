import express from 'express';
import { getAdminSettings, updateAdminSettings } from '../controllers/settingsController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', getAdminSettings);
router.put('/', updateAdminSettings);

export default router;
