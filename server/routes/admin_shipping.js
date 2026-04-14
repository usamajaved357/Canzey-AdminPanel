import express from 'express';
import { 
  getCities, 
  getRegions, 
  createShipment, 
  getShipmentStatus 
} from '../controllers/shippingController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All shipping routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/cities', getCities);
router.get('/regions/:cityId', getRegions);
router.post('/create', createShipment);
router.get('/status/:trackId', getShipmentStatus);

export default router;
