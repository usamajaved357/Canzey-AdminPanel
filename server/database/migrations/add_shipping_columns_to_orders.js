import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Migration: Add Al-Waseet shipping columns to orders table
 */
async function migrate() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'canzey-app-db',
  };

  console.log('📡 Connecting to database for migration...');
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const columnsToAdd = [
      { name: 'shipping_company', definition: "VARCHAR(100) DEFAULT NULL" },
      { name: 'shipping_track_id', definition: "VARCHAR(255) DEFAULT NULL" },
      { name: 'shipping_status', definition: "VARCHAR(100) DEFAULT NULL" },
      { name: 'shipping_label_url', definition: "VARCHAR(500) DEFAULT NULL" },
      { name: 'admin_notes', definition: "TEXT DEFAULT NULL" }
    ];

    for (const col of columnsToAdd) {
      try {
        await connection.execute(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added ${col.name} column to orders table`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️ ${col.name} already exists, skipping.`);
        } else {
          console.error(`❌ Error adding column ${col.name}:`, err.message);
        }
      }
    }

    await connection.end();
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

migrate();
