import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

export function resolveZmcEnvironment(envOverride = null) {
  const env = (envOverride || process.env.ZMC_ENVIRONMENT || 'sandbox').toLowerCase().trim();
  return env === 'prod' || env === 'production' ? 'prod' : 'sandbox';
}

function getCredentials(envOverride = null) {
  const env = resolveZmcEnvironment(envOverride);
  if (env === 'prod') {
    return {
      baseUrl: process.env.ZMC_PROD_URL,
      user: process.env.ZMC_PROD_USER,
      pass: process.env.ZMC_PROD_PASS,
      token: process.env.ZMC_PROD_TOKEN,
      companyId: process.env.ZMC_PROD_COMPANY_ID
    };
  }
  return {
    baseUrl: process.env.ZMC_SANDBOX_URL,
    user: process.env.ZMC_SANDBOX_USER,
    pass: process.env.ZMC_SANDBOX_PASS,
    token: process.env.ZMC_SANDBOX_TOKEN,
    companyId: process.env.ZMC_SANDBOX_COMPANY_ID
  };
}

function getAuthHeaders(creds) {
  // Official ZMC format: VToken = SHA256( BasicToken + Timestamp ), uppercase hex
  // Timestamp example: 2019-02-13T03:19:39.196+0000
  const timestamp = new Date().toISOString().replace('Z', '+0000');
  const vToken = crypto.createHash('sha256').update((creds.token || '') + timestamp).digest('hex').toUpperCase();

  return {
    Authorization: 'Basic ' + Buffer.from(`${creds.user}:${creds.pass}`).toString('base64'),
    Timestamp: timestamp,
    VToken: vToken
  };
}

function assertCredentials(creds, env) {
  const missing = [];
  if (!creds.baseUrl) missing.push('URL');
  if (!creds.user) missing.push('USER');
  if (!creds.pass) missing.push('PASS');
  if (!creds.token) missing.push('TOKEN (Basic Token for VToken hash — never sent in requests)');
  if (missing.length) {
    throw new Error(`ZMC ${env} credentials incomplete. Missing: ${missing.join(', ')}`);
  }
}

export const zmcCargoService = {
  async getCities() {
    return [
      { id: 1, name: 'Erbil' },
      { id: 2, name: 'Baghdad' },
      { id: 3, name: 'Sulaymaniyah' },
      { id: 4, name: 'Duhok' },
      { id: 5, name: 'Basra' },
      { id: 6, name: 'Kirkuk' }
    ];
  },

  async getRegions(cityId) {
    return [
      { id: 1, name: 'Center' },
      { id: 2, name: 'North' },
      { id: 3, name: 'South' }
    ];
  },

  async bookLocalShipment(shippingData) {
    const env = resolveZmcEnvironment(shippingData?.env);
    const creds = getCredentials(env);
    assertCredentials(creds, env);
    const payload = {
      sourceCompanyId: creds.companyId || '1',
      boxes: [],
      bookedShipments: [
        {
          referenceNo: shippingData.referenceNo,
          customerName: shippingData.client_name,
          phoneNo: [shippingData.client_mobile],
          city: Number(shippingData.city_id),
          address: shippingData.location || 'N/A',
          boxId: '',
          codAmmount: Number(shippingData.price),
          codCurrency: 2,
          totalWeight: Number(shippingData.total_weight || 1),
          contentType: shippingData.content_type || 'XPS',
          serviceType: shippingData.service_type || 'NCND',
          details: [
            {
              itemName: 'Order Items',
              weight: Number(shippingData.total_weight || 1),
              quantity: Number(shippingData.items_number || 1),
              price: Number(shippingData.price),
              currency: 2
            }
          ]
        }
      ]
    };

    console.log('\n--- ZMC API REQUEST (tryBookLocalShipment) ---');
    console.log('ENV:', env);
    console.log('URL:', `${creds.baseUrl}/api/tryBookLocalShipment`);
    console.log('-----------------------------------------------\n');

    const response = await fetch(`${creds.baseUrl}/api/tryBookLocalShipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(creds)
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { status: response.status, message: responseText || 'Empty response from server' };
    }
    
    return data;
  },

  async getShipmentStatus(referenceNo, envOverride = null) {
    const creds = getCredentials(envOverride);
    assertCredentials(creds, resolveZmcEnvironment(envOverride));
    // The OpenAPI spec for getting status is `/api/getShipmentStatus` with POST and body `{ "referenceId": "123" }`
    const payload = { referenceId: referenceNo };
    const response = await fetch(`${creds.baseUrl}/api/getShipmentStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(creds)
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return data;
  },

  async downloadLabel(referenceNo, version = 5, envOverride = null) {
    const creds = getCredentials(envOverride);
    assertCredentials(creds, resolveZmcEnvironment(envOverride));
    const url = `${creds.baseUrl}/api/downloadParcelSticker-V${version}?referenceNo=${referenceNo}`;
    console.log('Downloading label from:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(creds)
      }
    });

    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      return { success: false, ...data };
    }
    
    const buffer = await response.arrayBuffer();
    return { success: true, pdfBuffer: buffer };
  },

  async testConnection(envOverride = null) {
    const creds = getCredentials(envOverride);
    assertCredentials(creds, resolveZmcEnvironment(envOverride));
    try {
      // Hit status with a dummy ID to see if we get a 401 Unauthorized or successful API response structure
      const payload = { referenceId: "test-connection" };
      const response = await fetch(`${creds.baseUrl}/api/getShipmentStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(creds)
        },
        body: JSON.stringify(payload)
      });
      
      if (response.status === 401) {
        return { success: false, message: 'Unauthorized. Check ZMC credentials in .env' };
      }
      
      const data = await response.json();
      return { success: true, message: 'Connection to ZMC Cargo successful!', data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
};
