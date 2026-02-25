// Force IPv4 DNS resolution — server's IPv6 range is blocked by Google (googleapis.com returns 403 via IPv6)
// This ensures Firebase Admin SDK can reach Google's public key endpoint for token verification
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';

import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupDatabase } from './database/setup.js';
import adminAuthRoutes from './routes/admin_auth.js';
import adminCampaignsRoutes from './routes/admin_campaigns.js';
import adminProductsRoutes from './routes/admin_products.js';
import adminBannersRoutes from './routes/admin_banners.js';
import adminTicketStatsRoutes from './routes/admin_ticket_stats.js';
import adminProductPrizesRoutes from './routes/admin_product_prizes.js';
import adminNotificationsRoutes from './routes/admin_notifications.js';
import adminDrawsRoutes from './routes/admin_draws.js';
import firebaseCustomerAuthRoutes from './routes/firebase_customer_auth.js';
import campaignsRoutes from './routes/campaigns.js';
import drawsRoutes from './routes/draws.js';
import campaignParticipationRoutes from './routes/campaign_participation.js';
import dynamicContentRoutes from './routes/dynamic_content.js';
import ordersRoutes from './routes/orders.js';
import ticketsRoutes from './routes/tickets.js';
import dashboardRoutes from './routes/dashboard.js';
import bannersRoutes from './routes/banners.js';
import productPrizesRoutes from './routes/product_prizes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin/campaigns', adminCampaignsRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/admin/banners', adminBannersRoutes);
app.use('/api/admin/tickets', adminTicketStatsRoutes);
app.use('/api/admin/product-prizes', adminProductPrizesRoutes);
app.use('/api/admin/notifications', adminNotificationsRoutes);
app.use('/api/admin/draws', adminDrawsRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/firebase/customer', firebaseCustomerAuthRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/draws', drawsRoutes);
app.use('/api', campaignParticipationRoutes);
app.use('/api/content', dynamicContentRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/v1/public/banners', bannersRoutes);
app.use('/api/v1/public', productPrizesRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message
  });
});

// Start server
async function start() {
  try {
    await setupDatabase();
    app.listen(PORT, () => {
      // console.log(`✅ Server running on http://localhost:${PORT}`);
      // console.log('\n📝 Admin API Endpoints:');
      // console.log('   POST   /api/admin/signin     - Admin sign in');
      // console.log('   POST   /api/admin/signup     - Create new admin (admin only)');
      // console.log('   GET    /api/admin/userinfo   - Get admin info');
      // console.log('   POST   /api/admin/logout     - Admin logout');
      // console.log('\n📝 Customer API Endpoints:');
      // console.log('   POST   /api/customer/signin  - Customer sign in');
      // console.log('   POST   /api/customer/signup  - Customer sign up');
      // console.log('   GET    /api/customer/info    - Get customer info');
      // console.log('   PUT    /api/customer/edit    - Update customer info');
      // console.log('   POST   /api/customer/logout  - Customer logout');
      // console.log('\n📝 Other:');
      // console.log('   GET    /api/health           - Health check');
    });
  } catch (err) {
    console.error('❌ Failed to start server::', err);
    process.exit(1);
  }
}

start();
