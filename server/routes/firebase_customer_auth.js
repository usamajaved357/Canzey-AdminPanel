import express from 'express';
import { firebaseCustomerSignUp, firebaseCustomerSignIn } from '../controllers/firebaseCustomerController.js';
import { updateCustomerInfo } from '../controllers/customerController.js';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../database/connection.js';
import customerAvatarUpload from '../middleware/customerAvatarUpload.js';
import { getCustomerTickets, getCustomerCreditBalance, getCustomerCreditHistory } from '../controllers/ticketController.js';

const router = express.Router();

/**
 * GET /api/firebase/customer/debug-firebase
 * ⚠️ TEMPORARY DIAGNOSTIC ENDPOINT — Remove after fixing live server issue
 * Shows Firebase config state without exposing secrets
 */
router.get('/debug-firebase', (req, res) => {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let keyStatus = 'NOT SET';
  let keyFormat = 'N/A';
  let keyStartsWith = 'N/A';

  if (privateKey) {
    const parsed = privateKey.replace(/\\n/g, '\n').replace(/\\r/g, '');
    const hasRealNewlines  = parsed.includes('\n');
    const hasBeginHeader   = parsed.includes('-----BEGIN RSA PRIVATE KEY-----') || parsed.includes('-----BEGIN PRIVATE KEY-----');
    const hasEndHeader     = parsed.includes('-----END RSA PRIVATE KEY-----')   || parsed.includes('-----END PRIVATE KEY-----');

    keyStatus = 'SET';
    keyFormat = hasRealNewlines ? 'Has real newlines ✅' : 'Missing real newlines ❌ (still escaped)';
    keyStartsWith = parsed.substring(0, 30) + '...';

    if (!hasBeginHeader || !hasEndHeader) {
      keyFormat += ' | Missing PEM headers ❌';
    } else {
      keyFormat += ' | PEM headers present ✅';
    }
  }

  res.json({
    firebase_project_id:    process.env.FIREBASE_PROJECT_ID    || '❌ NOT SET',
    firebase_client_email:  process.env.FIREBASE_CLIENT_EMAIL  || '❌ NOT SET',
    firebase_type:          process.env.FIREBASE_TYPE          || '❌ NOT SET',
    firebase_private_key:   keyStatus,
    private_key_format:     keyFormat,
    private_key_starts_with: keyStartsWith,
    node_env:               process.env.NODE_ENV               || 'not set',
    server_time_utc:        new Date().toISOString(),
  });
});


/**
 * POST /api/firebase/customer/signup
 * Firebase customer sign up
 * Body: { email, password, first_name, last_name, phone_number? }
 */
router.post('/signup', async (req, res) => {
  const { email, password, first_name, last_name, phone_number, fcm_token } = req.body;

  console.log('📨 [FIREBASE SIGNUP API] Request received');

  const result = await firebaseCustomerSignUp({
    email,
    password,
    first_name,
    last_name,
    phone_number,
    fcm_token,
  });

  if (!result.success) {
    console.log('❌ [FIREBASE SIGNUP API] Failed:', result.error);
    return res.status(400).json({
      success: false,
      message: result.error,
    });
  }

  console.log('✅ [FIREBASE SIGNUP API] Success');
  res.status(201).json(result);
});

/**
 * POST /api/firebase/customer/signin
 * Firebase customer sign in
 * Body: { firebase_token }
 */
router.post('/signin', async (req, res) => {
  const { firebase_token, fcm_token } = req.body;

  console.log('📨 [FIREBASE SIGNIN API] Request received');

  if (!firebase_token) {
    console.log('❌ [FIREBASE SIGNIN API] No token provided');
    return res.status(400).json({
      success: false,
      message: 'Firebase token is required',
    });
  }

  const result = await firebaseCustomerSignIn(firebase_token, fcm_token);

  if (!result.success) {
    console.log('❌ [FIREBASE SIGNIN API] Failed:', result.error, '| Code:', result.code);
    return res.status(400).json({
      success: false,
      message: result.error,
      error_code: result.code || 'unknown',
      existing_auth_method: result.existing_auth_method || null,
    });
  }

  console.log('✅ [FIREBASE SIGNIN API] Success');
  res.json(result);
});

/**
 * PUT /api/firebase/customer/edit
 * Update current customer's profile info in MySQL (requires our JWT token)
 * Body: { first_name?, last_name?, phone_number?, profile_url? }
 */
router.put('/edit', authenticateToken, async (req, res) => {
  try {
    console.log('📨 [FIREBASE CUSTOMER EDIT API] Request received');
    console.log('   User ID:', req.user.userId);
    console.log('   Payload:', req.body);

    const result = await updateCustomerInfo(req.user.userId, req.body);

    if (!result.success) {
      console.log('❌ [FIREBASE CUSTOMER EDIT API] Failed:', result.error);
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    console.log('✅ [FIREBASE CUSTOMER EDIT API] Success');
    res.json(result);
  } catch (error) {
    console.error('❌ [FIREBASE CUSTOMER EDIT API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during update',
    });
  }
});

/**
 * GET /api/firebase/customer/info
 * Get current customer info (requires our JWT token)
 */
router.get('/info', authenticateToken, async (req, res) => {
  try {
    console.log('📨 [FIREBASE CUSTOMER INFO API] Request received');
    console.log('   User ID:', req.user.userId);

    const connection = await pool.getConnection();
    const [customers] = await connection.execute(
      'SELECT id, first_name, last_name, email, phone_number, profile_url, date_of_birth, gender, status, firebase_uid, created_at, updated_at, fcm_token FROM customers WHERE id = ?',
      [req.user.userId]
    );
    connection.release();

    if (customers.length === 0) {
      console.log('❌ [FIREBASE CUSTOMER INFO API] Customer not found');
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    console.log('✅ [FIREBASE CUSTOMER INFO API] Customer info retrieved');
    res.json({
      success: true,
      user: customers[0],
    });
  } catch (error) {
    console.error('❌ [FIREBASE CUSTOMER INFO API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/**
 * POST /api/firebase/customer/avatar
 * Upload/update customer's own profile image (requires our JWT token)
 * Body: multipart/form-data with field "avatar"
 */
router.post('/avatar', authenticateToken, customerAvatarUpload.single('avatar'), async (req, res) => {
  try {
    console.log('📨 [FIREBASE CUSTOMER AVATAR API] Request received');
    console.log('   User ID:', req.user.userId);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Avatar image is required'
      });
    }

    // Build relative URL
    let relativePath = `/uploads/customers/${req.file.filename}`;

    // Update profile_url in database
    const result = await updateCustomerInfo(req.user.userId, { profile_url: relativePath });

    if (!result.success) {
      console.log('❌ [FIREBASE CUSTOMER AVATAR API] Failed:', result.error);
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    console.log('✅ [FIREBASE CUSTOMER AVATAR API] Avatar updated');
    res.json({
      success: true,
      message: 'Avatar updated successfully',
      user: result.user
    });
  } catch (error) {
    console.error(' [FIREBASE CUSTOMER AVATAR API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during avatar upload'
    });
  }
});

/**
 * GET /api/firebase/customer/tickets
 * Get customer's tickets (requires our JWT token)
 */
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    console.log(' [CUSTOMER TICKETS API] Request received');
    console.log('   Customer ID:', req.user.userId);

    const result = await getCustomerTickets(req.user.userId);

    if (!result.success) {
      console.log(' [CUSTOMER TICKETS API] Failed:', result.error || result.message);
      return res.status(500).json({
        success: false,
        message: result.error || result.message || 'Server error while fetching tickets',
      });
    }

    console.log(' [CUSTOMER TICKETS API] Success - Found', result.tickets?.length || 0, 'tickets');
    res.json(result);
  } catch (error) {
    console.error(' [CUSTOMER TICKETS API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tickets',
    });
  }
});

/**
 * GET /api/firebase/customer/credits
 * Get customer's credit balance (requires our JWT token)
 */
router.get('/credits', authenticateToken, async (req, res) => {
  try {
    console.log(' [CUSTOMER CREDITS API] Request received');
    console.log('   Customer ID:', req.user.userId);

    const result = await getCustomerCreditBalance(req.user.userId);

    if (!result.success) {
      console.log(' [CUSTOMER CREDITS API] Failed:', result.error);
      return res.status(500).json({
        success: false,
        message: result.error || 'Server error while fetching credits',
      });
    }

    console.log(' [CUSTOMER CREDITS API] Success');
    res.json(result);
  } catch (error) {
    console.error(' [CUSTOMER CREDITS API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching credits',
    });
  }
});

/**
 * GET /api/firebase/customer/credits/history
 * Get customer's credit history (requires our JWT token)
 */
router.get('/credits/history', authenticateToken, async (req, res) => {
  try {
    console.log(' [CUSTOMER CREDIT HISTORY API] Request received');
    console.log('   Customer ID:', req.user.userId);

    const result = await getCustomerCreditHistory(req.user.userId);

    if (!result.success) {
      console.log(' [CUSTOMER CREDIT HISTORY API] Failed:', result.error);
      return res.status(500).json({
        success: false,
        message: result.error || 'Server error while fetching credit history',
      });
    }

    console.log(' [CUSTOMER CREDIT HISTORY API] Success');
    res.json(result);
  } catch (error) {
    console.error(' [CUSTOMER CREDIT HISTORY API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching credit history',
    });
  }
});

/**
 * PUT /api/firebase/customer/fcm-token
 * Update customer's FCM token (requires our JWT token)
 * Body: { fcm_token }
 */
router.put('/fcm-token', authenticateToken, async (req, res) => {
  try {
    console.log('📱 [FCM TOKEN UPDATE API] Request received');
    console.log('   User ID:', req.user.userId);

    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE customers SET fcm_token = ? WHERE id = ?',
      [fcm_token, req.user.userId]
    );
    connection.release();

    console.log('✅ [FCM TOKEN UPDATE API] FCM token updated');

    res.json({
      success: true,
      message: 'FCM token updated successfully',
    });
  } catch (error) {
    console.error('❌ [FCM TOKEN UPDATE API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during FCM token update',
    });
  }
});

export default router;
