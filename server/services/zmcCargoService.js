import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const BASE_URL = process.env.ZMC_BASE_URL || 'https://mrsltest.zmc-iraq.com/DomesticCargo';
const AUTH_USER = process.env.ZMC_AUTH_USER || 'testuser';
const AUTH_PASS = process.env.ZMC_AUTH_PASS || 'testpass';
const BASIC_TOKEN = process.env.ZMC_BASIC_TOKEN || '';

function getAuthHeaders() {
  const timestamp = new Date().toISOString().replace('Z', '+0000');
  const vToken = crypto.createHash('sha256').update(BASIC_TOKEN + timestamp).digest('hex').toUpperCase();

  return {
    'Authorization': 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64'),
    'Timestamp': timestamp,
    'VToken': vToken
  };
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
    const payload = {
      sourceCompanyId: process.env.ZMC_SOURCE_COMPANY_ID || '1',
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
    console.log('URL: ', `${BASE_URL}/api/tryBookLocalShipment`);
    console.log('METHOD: POST');
    console.log(`AUTH: Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')} (Decodes to -> Username: ${AUTH_USER} | Password: ${AUTH_PASS})`);
    console.log('HEADERS: ', {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    });
    console.log('BODY: ', JSON.stringify(payload, null, 2));
    console.log('------------------------------------------------\n');

    const response = await fetch(`${BASE_URL}/api/tryBookLocalShipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
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

  async getShipmentStatus(referenceNo) {
    // The OpenAPI spec for getting status is `/api/getShipmentStatus` with POST and body `{ "referenceId": "123" }`
    const payload = { referenceId: referenceNo };
    const response = await fetch(`${BASE_URL}/api/getShipmentStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return data;
  },

  async downloadLabel(referenceNo, version = 5) {
    const url = `${BASE_URL}/api/downloadParcelSticker-V${version}?referenceNo=${referenceNo}`;
    console.log('Downloading label from:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAuthHeaders()
      }
    });

    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      return { success: false, ...data };
    }
    
    const buffer = await response.arrayBuffer();
    return { success: true, pdfBuffer: buffer };
  },

  async testConnection() {
    try {
      // Hit status with a dummy ID to see if we get a 401 Unauthorized or successful API response structure
      const payload = { referenceId: "test-connection" };
      const response = await fetch(`${BASE_URL}/api/getShipmentStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
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
