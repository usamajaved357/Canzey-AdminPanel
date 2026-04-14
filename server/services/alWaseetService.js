import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'https://api.alwaseet-iq.net';
const AUTH_USER = 'kyib';
const AUTH_PASS = '100200300@';

let cachedToken = null;

async function login() {
  try {
    const params = new URLSearchParams();
    params.append('username', AUTH_USER);
    params.append('password', AUTH_PASS);

    const response = await fetch(`${BASE_URL}/v1/merchant/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();
    if (data.status === true) {
      cachedToken = data.data.token;
      return cachedToken;
    } else {
      throw new Error(data.msg || 'Login failed');
    }
  } catch (error) {
    console.error('Al-Waseet Login Error:', error);
    throw error;
  }
}

async function getToken() {
  if (cachedToken) return cachedToken;
  return await login();
}

export const alWaseetService = {
  async getCities() {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/v1/merchant/citys?token=${token}`);
    const data = await response.json();
    return data.data;
  },

  async getRegions(cityId) {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/v1/merchant/regions?city_id=${cityId}&token=${token}`);
    const data = await response.json();
    return data.data;
  },

  async createOrder(orderData) {
    const token = await getToken();
    
    const formData = new URLSearchParams();
    for (const key in orderData) {
      formData.append(key, orderData[key]);
    }

    const response = await fetch(`${BASE_URL}/v1/merchant/create-order?token=${token}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return await response.json();
  },

  async trackOrder(orderId) {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/v1/merchant/get-orders-by-ids-bulk?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: orderId.toString(),
      }),
    });

    const data = await response.json();
    return data.data && data.data[0] ? data.data[0] : null;
  },

  async downloadLabel(trackId, savePath) {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/v1/merchant/ticket?token=${token}&order_id=${trackId}`);
    
    if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer;
    }
    throw new Error('Failed to fetch label from Al-Waseet');
  }
};
