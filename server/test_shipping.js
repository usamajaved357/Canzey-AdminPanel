import { alWaseetService } from './services/alWaseetService.js';

async function testConnection() {
  console.log('🧪 Testing Al-Waseet API connection...');
  try {
    const cities = await alWaseetService.getCities();
    console.log('✅ Connection Successful!');
    console.log(`🌍 Found ${cities.length} cities.`);
    if (cities.length > 0) {
      console.log('📦 First City Raw Data:', JSON.stringify(cities[0]));
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
    process.exit(1);
  }
}

testConnection();
