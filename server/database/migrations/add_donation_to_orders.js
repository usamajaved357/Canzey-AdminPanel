import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration: Add donation support to orders
 *
 * Changes:
 *  1. orders table  — add `donation_amount` column (DECIMAL, nullable, default 0)
 *  2. campaign_tickets — extend `source` ENUM to include 'donation'
 */
async function addDonationSupport() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'canzey-app-db',
  });

  console.log('🔄 Running donation migration...');

  // ── 1. Add donation_amount to orders ──────────────────────────────────────
  try {
    await connection.execute(`
      ALTER TABLE orders
      ADD COLUMN donation_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Optional donation amount added on top of order total'
        AFTER total_amount
    `);
    console.log('✅ Added donation_amount column to orders');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  donation_amount already exists in orders, skipping');
    } else {
      throw err;
    }
  }

  // ── 2. Extend campaign_tickets.source ENUM to include 'donation' ──────────
  try {
    await connection.execute(`
      ALTER TABLE campaign_tickets
      MODIFY COLUMN source ENUM('purchase', 'direct', 'donation') DEFAULT 'direct'
        COMMENT 'How this ticket was obtained: purchase=bought product, direct=admin/manual, donation=order donation'
    `);
    console.log("✅ Extended campaign_tickets.source ENUM to include 'donation'");
  } catch (err) {
    console.error('❌ Failed to extend source ENUM:', err.message);
    throw err;
  }

  await connection.end();
  console.log('🎉 Donation migration completed successfully!');
}

addDonationSupport().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
