import admin, { manualVerifyFirebaseToken } from '../config/firebase.js';
import jwt from 'jsonwebtoken';
import pool from '../database/connection.js';
import nodemailer from 'nodemailer';

const JWT_SECRET = process.env.JWT_SECRET || 'canzey_dashboard_secret_key_2024_change_this_in_production';

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send verification email
 */
async function sendVerificationEmail(email, verificationLink) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Canzey Account',
      html: `
        <h2>Welcome to Canzey!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px;">
          Verify Email
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ [EMAIL] Verification email sent to:', email);
    return true;
  } catch (error) {
    console.error('❌ [EMAIL] Error sending verification email:', error.message);
    return false;
  }
}

/**
 * Firebase Customer Sign Up
 * Creates Firebase account and stores customer in MySQL
 */
export async function firebaseCustomerSignUp(userData) {
  try {
    console.log('📝 [FIREBASE SIGNUP] Request received');
    console.log('   📊 User data:', { email: userData.email, first_name: userData.first_name, last_name: userData.last_name });

    const { email, password, first_name, last_name, phone_number, date_of_birth, gender, fcm_token } = userData;

    // Validate required fields
    if (!email || !password || !first_name || !last_name) {
      return { success: false, error: 'Email, password, first name, and last name are required' };
    }

    // Check if customer already exists in MySQL
    const connection = await pool.getConnection();
    const [existingCustomers] = await connection.execute(
      'SELECT id FROM customers WHERE email = ?',
      [email]
    );

    if (existingCustomers.length > 0) {
      connection.release();
      return { success: false, error: 'Email already registered' };
    }

    // Create Firebase user
    console.log('🔥 [FIREBASE SIGNUP] Creating Firebase user...');
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: `${first_name} ${last_name}`,
      });
      console.log('✅ [FIREBASE SIGNUP] Firebase user created:', firebaseUser.uid);

      // Send verification email
      console.log('📧 [FIREBASE SIGNUP] Sending verification email...');
      try {
        const verificationLink = await admin.auth().generateEmailVerificationLink(email);
        console.log('✅ [FIREBASE SIGNUP] Verification link generated');
        await sendVerificationEmail(email, verificationLink);
      } catch (emailError) {
        console.warn('⚠️  [FIREBASE SIGNUP] Could not send verification email:', emailError.message);
      }
    } catch (firebaseError) {
      connection.release();
      console.error('❌ [FIREBASE SIGNUP] Firebase error:', firebaseError.message);
      return { success: false, error: `Firebase error: ${firebaseError.message}` };
    }

    // Store customer in MySQL with Firebase UID
    console.log('💾 [FIREBASE SIGNUP] Storing customer in MySQL...');
    const [result] = await connection.execute(
      `INSERT INTO customers 
       (first_name, last_name, email, phone_number, date_of_birth, gender, firebase_uid, firebase_email, auth_method, status, fcm_token) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, phone_number || null, date_of_birth || null, gender || null, firebaseUser.uid, email, 'firebase', 'active', fcm_token || null]
    );

    connection.release();

    console.log('✅ [FIREBASE SIGNUP] Customer created successfully');
    console.log('   Customer ID:', result.insertId);

    return {
      success: true,
      message: 'Account created successfully',
      user: {
        id: result.insertId,
        first_name,
        last_name,
        email,
        phone_number,
        date_of_birth,
        gender,
        firebase_uid: firebaseUser.uid,
        status: 'active',
      },
    };
  } catch (error) {
    console.error('❌ [FIREBASE SIGNUP] Error:', error.message);
    return { success: false, error: 'Server error during sign up' };
  }
}

/**
 * Firebase Customer Sign In
 * Verifies Firebase token and returns customer data
 */
export async function firebaseCustomerSignIn(firebaseToken, fcmToken = null) {
  try {
    console.log('📝 [FIREBASE SIGNIN] Request received');

    if (!firebaseToken) {
      return { success: false, error: 'Firebase token is required' };
    }

    // ── Pre-verification token inspection ──────────────────────────────────
    // Trim any accidental whitespace/newlines from token
    const cleanToken = firebaseToken.trim().replace(/["']/g, '');
    if (cleanToken !== firebaseToken) {
      console.warn('⚠️  [FIREBASE SIGNIN] Token had leading/trailing whitespace or quotes — trimmed!');
    }

    console.log('🔥 [FIREBASE SIGNIN] Verifying Firebase token...');
    console.log('   Token length (original):', firebaseToken.length);
    console.log('   Token length (cleaned):', cleanToken.length);
    console.log('   Token preview:', cleanToken.substring(0, 30) + '...');

    // Decode WITHOUT verification to inspect claims
    try {
      const parts = cleanToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        console.log('   📦 Token aud (audience):', payload.aud);
        console.log('   📦 Token iss (issuer):', payload.iss);
        console.log('   📦 Token sub (uid):', payload.sub);
        console.log('   📦 Token iat:', new Date(payload.iat * 1000).toISOString());
        console.log('   📦 Token exp:', new Date(payload.exp * 1000).toISOString());
        console.log('   📦 Server project:', process.env.FIREBASE_PROJECT_ID);
        console.log('   📦 Audience match:', payload.aud === process.env.FIREBASE_PROJECT_ID ? '✅ YES' : '❌ NO — MISMATCH!');
      } else {
        console.error('   ❌ Token does NOT have 3 JWT parts — it is malformed! Parts:', parts.length);
      }
    } catch (decodeErr) {
      console.error('   ❌ Failed to decode token payload:', decodeErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(cleanToken, false);
      console.log('✅ [FIREBASE SIGNIN] Token verified:', decodedToken.uid);
      console.log('   Firebase project (aud):', decodedToken.aud);
      console.log('   Token issued at:', new Date(decodedToken.iat * 1000).toISOString());
      console.log('   Token expires at:', new Date(decodedToken.exp * 1000).toISOString());
    } catch (firebaseError) {
      const isCertFetchError = firebaseError.message?.includes('Error fetching public keys') ||
                               firebaseError.message?.includes('certificate') ||
                               firebaseError.message?.includes('403');

      if (isCertFetchError) {
        // ── Fallback: Server IP is blocked from Google cert endpoint ──────────
        console.warn('⚠️  [FIREBASE SIGNIN] Admin SDK cert fetch blocked (403). Trying manual JWT verification...');
        try {
          decodedToken = await manualVerifyFirebaseToken(cleanToken);
          console.log('✅ [FIREBASE SIGNIN] Manual verification succeeded! UID:', decodedToken.uid);
          console.log('   ⚠️  NOTE: Fix the server firewall to unblock www.googleapis.com for long-term reliability.');
        } catch (manualError) {
          console.error('❌ [FIREBASE SIGNIN] Manual verification also failed:', manualError.message);
          console.error('   The server IP is completely blocked from Google APIs.');
          console.error('   ACTION REQUIRED: Contact hosting provider to allow outbound HTTPS to www.googleapis.com');
          return { success: false, error: 'Server cannot reach Google to verify token. Contact support.', code: 'server/firewall-blocked' };
        }
      } else {
        console.error('❌ [FIREBASE SIGNIN] Token verification failed!');
        console.error('   Error code:', firebaseError.code);
        console.error('   Error message:', firebaseError.message);
        console.error('   Server FIREBASE_PROJECT_ID env:', process.env.FIREBASE_PROJECT_ID);
        return { success: false, error: 'Invalid or expired Firebase token', code: firebaseError.code };
      }
    }

    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email || null;
    const firebasePhone = decodedToken.phone_number || null;
    const authMethod = firebaseEmail ? 'email' : 'phone';

    console.log('📱 [FIREBASE SIGNIN] Auth method:', authMethod);
    console.log('   Email:', firebaseEmail || 'N/A');
    console.log('   Phone:', firebasePhone || 'N/A');

    // Find customer in MySQL
    console.log('🔍 [FIREBASE SIGNIN] Looking up customer in MySQL...');
    const connection = await pool.getConnection();
    const [customers] = await connection.execute(
      'SELECT * FROM customers WHERE firebase_uid = ?',
      [firebaseUid]
    );

    if (customers.length === 0) {
      console.log('⚠️  [FIREBASE SIGNIN] Customer not found, creating new customer...');

      // Auto-create customer if not exists
      // Handle both email and phone auth methods
      try {
        const [result] = await connection.execute(
          `INSERT INTO customers 
           (first_name, last_name, email, phone_number, firebase_uid, auth_method, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            decodedToken.name?.split(' ')[0] || 'User',
            decodedToken.name?.split(' ')[1] || '',
            firebaseEmail,      // NULL for phone users
            firebasePhone,      // NULL for email users
            firebaseUid,
            authMethod,
            'active',
          ]
        );

        const [newCustomer] = await connection.execute(
          'SELECT id, first_name, last_name, email, phone_number, profile_url, date_of_birth, gender, status FROM customers WHERE id = ?',
          [result.insertId]
        );

        connection.release();

        // Generate our JWT token
        const token = jwt.sign(
          { userId: result.insertId, email: firebaseEmail, phone: firebasePhone, userType: 'customer' },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('✅ [FIREBASE SIGNIN] New customer created and logged in');
        console.log('   Customer ID:', result.insertId);
        console.log('   Auth method:', authMethod);

        return {
          success: true,
          token,
          user: { ...newCustomer[0], firebase_uid: firebaseUid },
        };
      } catch (insertError) {
        connection.release();
        console.error('❌ [FIREBASE SIGNIN] Failed to create customer:', insertError.message);
        return { success: false, error: 'Failed to create customer account' };
      }
    }

    const customer = customers[0];

    if (customer.status !== 'active') {
      connection.release();
      return { success: false, error: 'Account is not active' };
    }

    // Update FCM token if provided
    if (fcmToken) {
      console.log('📱 [FIREBASE SIGNIN] Updating FCM token');
      await connection.execute(
        'UPDATE customers SET fcm_token = ? WHERE id = ?',
        [fcmToken, customer.id]
      );
    }

    connection.release();

    // Generate our JWT token
    const token = jwt.sign(
      { userId: customer.id, email: customer.email, userType: 'customer' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ [FIREBASE SIGNIN] Customer logged in successfully');

    return {
      success: true,
      token,
      user: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone_number: customer.phone_number,
        profile_url: customer.profile_url,
        date_of_birth: customer.date_of_birth,
        gender: customer.gender,
        status: customer.status,
        firebase_uid: customer.firebase_uid,
      },
    };
  } catch (error) {
    console.error('❌ [FIREBASE SIGNIN] Error:', error.message);
    return { success: false, error: 'Server error during sign in' };
  }
}

/**
 * Verify Firebase Token (for middleware)
 */
export async function verifyFirebaseToken(token) {
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (error) {
    console.error('Firebase token verification error:', error.message);
    return null;
  }
}
