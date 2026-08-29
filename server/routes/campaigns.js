import express from 'express';
import { listAllCampaigns } from '../controllers/campaignController.js';

const router = express.Router();

/**
 * GET /api/campaigns
 * Active campaigns with purchasable linked products (Flutter app)
 */
router.get('/', async (req, res) => {
  const result = await listAllCampaigns();

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: result.error,
    });
  }

  res.json({
    success: true,
    campaigns: result.campaigns,
  });
});

export default router;
