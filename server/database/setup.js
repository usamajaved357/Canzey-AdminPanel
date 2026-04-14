import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Setup database - create database, tables, and seed admin user
 */
export async function setupDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  };

  console.log('📡 [DB SETUP] Connecting to:', dbConfig.host, 'as', dbConfig.user);
  console.log('🔑 [DB SETUP] Password provided:', !!dbConfig.password);

  try {
    // First, connect without database to create it
    const tempConnection = await mysql.createConnection(dbConfig);

    const dbName = process.env.DB_NAME || 'canzey-app-db';

    // Create database if it doesn't exist
    await tempConnection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database '${dbName}' ready`);

    await tempConnection.end();

    // Now connect to the database and create tables
    const connection = await mysql.createConnection({
      ...dbConfig,
      database: dbName,
    });

    // Create admin_users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'admin', 'manager', 'staff') DEFAULT 'staff',
        profile_url VARCHAR(500),
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ admin_users table ready');

    // Create customers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone_number VARCHAR(50),
        password_hash VARCHAR(255),
        profile_url VARCHAR(500),
        date_of_birth DATE,
        gender ENUM('male', 'female', 'other', 'prefer_not_to_say') DEFAULT NULL,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        address VARCHAR(500),
        city VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        firebase_uid VARCHAR(255) UNIQUE,
        firebase_email VARCHAR(255),
        auth_method ENUM('local', 'firebase', 'email', 'phone') DEFAULT 'local',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_phone (phone_number),
        INDEX idx_firebase_uid (firebase_uid),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ customers table ready');

    // Create campaigns table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category ENUM('exclusive', 'cash', 'electronics', 'featured', 'new', 'premium') DEFAULT 'featured',
        image_url VARCHAR(500),
        ticket_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        credits_per_ticket INT NOT NULL DEFAULT 0,
        max_tickets_per_user INT DEFAULT NULL,
        status ENUM('active', 'inactive', 'closed') DEFAULT 'active',
        start_at TIMESTAMP NULL,
        end_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_dates (start_at, end_at),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ campaigns table ready');

    // Create campaign_tickets table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS campaign_tickets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        customer_id INT NOT NULL,
        order_id INT DEFAULT NULL,
        product_id INT DEFAULT NULL,
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        total_price DECIMAL(10,2) NOT NULL,
        credits_earned INT NOT NULL,
        status ENUM('active', 'used', 'expired') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_winner BOOLEAN DEFAULT FALSE,
        won_at TIMESTAMP NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        INDEX idx_customer_id (customer_id),
        INDEX idx_campaign_id (campaign_id),
        INDEX idx_product_id (product_id),
        INDEX idx_order_id (order_id),
        INDEX idx_ticket_number (ticket_number),
        INDEX idx_is_winner (is_winner)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Add columns if they don't exist (for existing databases)
    const columnsToAdd = [
      { name: 'order_id', definition: 'INT DEFAULT NULL AFTER customer_id' },
      { name: 'product_id', definition: 'INT DEFAULT NULL AFTER order_id' },
      { name: 'is_winner', definition: 'BOOLEAN DEFAULT FALSE' },
      { name: 'won_at', definition: 'TIMESTAMP NULL' }
    ];

    for (const col of columnsToAdd) {
      try {
        await connection.execute(`ALTER TABLE campaign_tickets ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added ${col.name} column to campaign_tickets table`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Error adding column ${col.name}:`, err.message);
        }
      }
    }

    // Backfill product_id from order_items if it's currently NULL
    try {
      // We look for any order_item in that same order/campaign to link the ticket to a product
      await connection.execute(`
        UPDATE campaign_tickets ct
        SET ct.product_id = (
          SELECT oi.product_id 
          FROM order_items oi 
          WHERE oi.order_id = ct.order_id 
          AND oi.campaign_id = ct.campaign_id
          LIMIT 1
        )
        WHERE ct.product_id IS NULL AND ct.order_id IS NOT NULL
      `);
      console.log('✅ Backfilled product_id for existing campaign tickets');
    } catch (err) {
      console.log('ℹ️ Could not backfill product_id:', err.message);
    }
    
    console.log('✅ campaign_tickets table ready');

    // Create customer_credits table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customer_credits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        customer_id INT NOT NULL,
        ticket_id INT,
        credits INT NOT NULL,
        type ENUM('earned', 'spent', 'expired') DEFAULT 'earned',
        description VARCHAR(255),
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES campaign_tickets(id) ON DELETE SET NULL,
        INDEX idx_customer_id (customer_id),
        INDEX idx_expires_at (expires_at),
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ customer_credits table ready');

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        description TEXT,
        sku VARCHAR(100) UNIQUE,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        sale_price DECIMAL(10,2) DEFAULT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        category VARCHAR(100) DEFAULT NULL,
        sub_category VARCHAR(100) DEFAULT NULL,
        for_gender VARCHAR(20) DEFAULT NULL,
        is_customized BOOLEAN DEFAULT FALSE,
        tags VARCHAR(500) DEFAULT NULL,
        campaign_id INT DEFAULT NULL,
        main_image_url VARCHAR(500),
        status ENUM('active', 'inactive', 'draft') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sku (sku),
        INDEX idx_status (status),
        INDEX idx_slug (slug),
        INDEX idx_stock (stock_quantity),
        INDEX idx_category (category),
        INDEX idx_campaign_id (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Add campaign_id column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE products ADD COLUMN campaign_id INT DEFAULT NULL AFTER tags
      `);
      console.log('✅ Added campaign_id column to products table');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        // Column already exists, ignore
      }
    }
    
    console.log('✅ products table ready');

    // Create categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        description TEXT,
        parent_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
        INDEX idx_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ categories table ready');

    // Create product_categories pivot table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_categories (
        product_id INT NOT NULL,
        category_id INT NOT NULL,
        PRIMARY KEY (product_id, category_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id),
        INDEX idx_category_id (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ product_categories table ready');

    // Create product_images table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id),
        INDEX idx_is_primary (is_primary)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ product_images table ready');

    // Create product_colors table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_colors (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        color_name VARCHAR(50) NOT NULL,
        color_code VARCHAR(7) NOT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ product_colors table ready');

    // Create product_sizes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_sizes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        size VARCHAR(20) NOT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ product_sizes table ready');

    // Create sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_user_id INT NOT NULL,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ sessions table ready');

    // Create campaign_images table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS campaign_images (
        id INT PRIMARY KEY AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        INDEX idx_campaign_id (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ campaign_images table ready');

    // Create banners table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255),
        image_url VARCHAR(500) NOT NULL,
        width INT DEFAULT 1080,
        height INT DEFAULT 400,
        priority INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        link_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_active (is_active),
        INDEX idx_priority (priority)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ banners table ready');

    // Create dynamic_content table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dynamic_content (
        id INT PRIMARY KEY AUTO_INCREMENT,
        key_name VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content_type ENUM('promo','ad','notification','banner','popup','other') DEFAULT 'promo',
        status ENUM('active','inactive','scheduled','expired') DEFAULT 'active',
        priority INT DEFAULT 0,
        start_date DATETIME DEFAULT NULL,
        end_date DATETIME DEFAULT NULL,
        metadata JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key_name (key_name),
        INDEX idx_status (status),
        INDEX idx_content_type (content_type),
        INDEX idx_priority (priority)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ dynamic_content table ready');

    // Create orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        customer_id INT DEFAULT NULL,
        guest_token VARCHAR(255) DEFAULT NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(10,2) DEFAULT 0.00,
        shipping_amount DECIMAL(10,2) DEFAULT 0.00,
        discount_amount DECIMAL(10,2) DEFAULT 0.00,
        payment_method VARCHAR(50) DEFAULT NULL,
        payment_transaction_id VARCHAR(255) DEFAULT NULL,
        payment_status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
        order_status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
        shipping_address TEXT,
        billing_address TEXT,
        customer_notes TEXT,
        admin_notes TEXT,
        shipping_company VARCHAR(100) DEFAULT NULL,
        shipping_track_id VARCHAR(255) DEFAULT NULL,
        shipping_status VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        INDEX idx_order_number (order_number),
        INDEX idx_customer_id (customer_id),
        INDEX idx_guest_token (guest_token),
        INDEX idx_payment_status (payment_status),
        INDEX idx_order_status (order_status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Add payment_transaction_id column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE orders ADD COLUMN payment_transaction_id VARCHAR(255) DEFAULT NULL AFTER payment_method
      `);
      console.log('✅ Added payment_transaction_id column to orders table');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        // Column already exists, ignore
      }
    }
    
    console.log('✅ orders table ready');

    // Create order_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        product_id INT DEFAULT NULL,
        campaign_id INT DEFAULT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_sku VARCHAR(100),
        product_image VARCHAR(500),
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        color VARCHAR(50),
        size VARCHAR(20),
        customization_details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
        INDEX idx_order_id (order_id),
        INDEX idx_product_id (product_id),
        INDEX idx_campaign_id (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add campaign_id column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`
        ALTER TABLE order_items ADD COLUMN campaign_id INT DEFAULT NULL AFTER product_id
      `);
      console.log('✅ Added campaign_id column to order_items table');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        // Column already exists, ignore
      }
    }

    // Rename price to unit_price and subtotal to total_price if needed
    const columnRenames = [
      { old: 'price', new: 'unit_price', def: 'DECIMAL(10,2) NOT NULL' },
      { old: 'subtotal', new: 'total_price', def: 'DECIMAL(10,2) NOT NULL' }
    ];

    for (const rename of columnRenames) {
      try {
        // Check if old column exists and new one doesn't
        const [oldCols] = await connection.execute(`SHOW COLUMNS FROM order_items LIKE '${rename.old}'`);
        const [newCols] = await connection.execute(`SHOW COLUMNS FROM order_items LIKE '${rename.new}'`);
        
        if (oldCols.length > 0 && newCols.length === 0) {
          await connection.execute(`ALTER TABLE order_items CHANGE COLUMN ${rename.old} ${rename.new} ${rename.def}`);
          console.log(`✅ Renamed ${rename.old} to ${rename.new} in order_items`);
        }
      } catch (err) {
        console.error(`❌ Error migrating column ${rename.old}:`, err.message);
      }
    }

    // Add color and size if they don't exist
    const itemsColsToAdd = [
      { name: 'color', definition: 'VARCHAR(50) AFTER total_price' },
      { name: 'size', definition: 'VARCHAR(20) AFTER color' },
      { name: 'product_image', definition: 'VARCHAR(500) AFTER product_sku' }
    ];

    for (const col of itemsColsToAdd) {
      try {
        await connection.execute(`ALTER TABLE order_items ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added ${col.name} column to order_items table`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          // ignore
        }
      }
    }

    console.log('✅ order_items table ready');

    // Create product_prizes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_prizes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        campaign_id INT NOT NULL,
        tickets_required INT NOT NULL DEFAULT 1,
        tickets_sold INT DEFAULT 0,
        tickets_remaining INT GENERATED ALWAYS AS (tickets_required - tickets_sold) STORED,
        countdown_start_tickets INT DEFAULT 0,
        draw_date DATETIME DEFAULT NULL,
        end_date DATETIME DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        INDEX idx_product_campaign (product_id, campaign_id),
        INDEX idx_campaign (campaign_id),
        INDEX idx_tickets_remaining (tickets_remaining),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ product_prizes table ready');

    // Migration logic for product_prizes
    const prizeColsToAdd = [
      { name: 'draw_date', definition: 'DATETIME DEFAULT NULL AFTER countdown_start_tickets' },
      { name: 'end_date', definition: 'DATETIME DEFAULT NULL AFTER draw_date' }
    ];

    for (const col of prizeColsToAdd) {
      try {
        await connection.execute(`ALTER TABLE product_prizes ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added ${col.name} column to product_prizes table`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Error adding column ${col.name} to product_prizes:`, err.message);
        }
      }
    }

    // Seed master admin user
    await seedMasterAdmin(connection);

    await connection.end();
    console.log('✅ Database setup complete');

  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    throw error;
  }
}

/**
 * Seed master admin user if it doesn't exist
 */
async function seedMasterAdmin(connection) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@canzey.com';
    const adminPassword = process.env.ADMIN_PASS || 'Admin@123456';

    // Check if admin already exists
    const [rows] = await connection.execute(
      'SELECT id FROM admin_users WHERE email = ?',
      [adminEmail]
    );

    if (rows.length > 0) {
      console.log('✅ Master admin user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create master admin
    await connection.execute(
      `INSERT INTO admin_users 
       (first_name, last_name, email, phone_number, password_hash, role, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Master', 'Admin', adminEmail, '+1-000-000-0000', hashedPassword, 'super_admin', 'active']
    );

    console.log('✅ Master admin user created');
    console.log(`   📧 Email: ${adminEmail}`);
    console.log(`   🔑 Password: ${adminPassword}`);
    console.log('   ⚠️  Change password after first login!');

  } catch (error) {
    console.error('❌ Error seeding master admin:', error.message);
    throw error;
  }
}
