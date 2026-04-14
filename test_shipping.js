import { alWaseetService } from './server/services/alWaseetService.js';

async function testConnection() {
  console.log('🧪 Testing Al-Waseet API connection...');
  try {
    const cities = await alWaseetService.getCities();
    console.log('✅ Connection Successful!');
    console.log(`🌍 Found ${cities.length} cities.`);
    console.log('🏙️ Sample Cities:', cities.slice(0, 3).map(c => c.name).join(', '));
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
    process.exit(1);
  }
}

testConnection();
