import admin from 'firebase-admin';
import https from 'https';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// ─── Private Key Parser ───────────────────────────────────────────────────────
const parsePrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/\\r/g, '');
};

// ─── Firebase Admin SDK Init ──────────────────────────────────────────────────
const serviceAccount = {
  type:                        process.env.FIREBASE_TYPE,
  project_id:                  process.env.FIREBASE_PROJECT_ID,
  private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key:                 parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  client_email:                process.env.FIREBASE_CLIENT_EMAIL,
  client_id:                   process.env.FIREBASE_CLIENT_ID,
  auth_uri:                    process.env.FIREBASE_AUTH_URI,
  token_uri:                   process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url:        process.env.FIREBASE_CLIENT_CERT_URL,
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin SDK initialized');
  console.log('   🔥 Firebase Project:', process.env.FIREBASE_PROJECT_ID || 'NOT SET - CHECK .env!');
  console.log('   📧 Service Account:', process.env.FIREBASE_CLIENT_EMAIL || 'NOT SET - CHECK .env!');
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
}

// ─── Manual JWT Verifier (Fallback when server IP is blocked from Google) ─────
//
// The Firebase Admin SDK fetches Google's public keys from:
//   https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
// If the server's IP is blocked from that URL (403 Forbidden), verifyIdToken()
// will fail. This manual verifier fetches the keys the same way but with
// configurable behavior. Fix the firewall first — this is a fallback.
//
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let _cachedKeys   = null;
let _cacheExpiry  = 0;

export async function fetchGooglePublicKeys() {
  if (_cachedKeys && Date.now() < _cacheExpiry) {
    return _cachedKeys;
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path:     '/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      method:   'GET',
      headers:  { 'Accept': 'application/json' },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Google certs returned ${res.statusCode}: ${raw.substring(0, 200)}`));
          return;
        }
        try {
          _cachedKeys  = JSON.parse(raw);
          // Respect cache-control max-age header from Google, default 1 hour
          const maxAgeMatch = (res.headers['cache-control'] || '').match(/max-age=(\d+)/);
          const ttl        = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600000;
          _cacheExpiry     = Date.now() + ttl;
          console.log('✅ [Firebase Manual] Google public keys fetched and cached');
          resolve(_cachedKeys);
        } catch (e) {
          reject(new Error('Failed to parse Google public key JSON: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * manualVerifyFirebaseToken — fallback when admin.auth().verifyIdToken() fails
 * due to server IP being blocked from fetching Google's public certs (403).
 *
 * Validates: signature, algorithm, audience (aud), issuer (iss), and expiry.
 */
export async function manualVerifyFirebaseToken(idToken) {
  const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

  // Decode header to find key ID
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header?.kid) {
    throw new Error('Token is malformed or missing kid header');
  }

  const keys = await fetchGooglePublicKeys();
  const publicKey = keys[decoded.header.kid];

  if (!publicKey) {
    throw new Error(`No Google public key found for kid: ${decoded.header.kid} — keys may have rotated`);
  }

  // Verify signature + standard claims
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience:   PROJECT_ID,
    issuer:     `https://securetoken.google.com/${PROJECT_ID}`,
  });

  return {
    uid:          payload.sub,
    email:        payload.email        || null,
    phone_number: payload.phone_number || null,
    aud:          payload.aud,
    iss:          payload.iss,
    iat:          payload.iat,
    exp:          payload.exp,
  };
}

// ─── Firebase Web Config ───────────────────────────────────────────────────────
export const firebaseWebConfig = {
  apiKey:            process.env.FIREBASE_WEB_API_KEY,
  authDomain:        process.env.FIREBASE_WEB_AUTH_DOMAIN,
  projectId:         process.env.FIREBASE_WEB_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_WEB_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID,
  appId:             process.env.FIREBASE_WEB_APP_ID,
  measurementId:     process.env.FIREBASE_WEB_MEASUREMENT_ID,
};

export default admin;
