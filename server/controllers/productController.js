import pool from '../database/connection.js';
import { evaluatePrizeAvailability } from '../utils/prizeAvailability.js';

/**
 * List all products with basic info, main image and stock
 */
export async function listProducts() {
  try {
    console.log('🧾 [LIST PRODUCTS] ========== START ==========');
    console.log('🧾 [LIST PRODUCTS] Timestamp:', new Date().toISOString());

    const connection = await pool.getConnection();
    console.log('✅ [LIST PRODUCTS] DB connection established');

    const [products] = await connection.execute(`
      SELECT 
        p.*,
        pp.campaign_id AS pp_campaign_id,
        pp.is_active AS pp_is_active,
        pp.tickets_required,
        pp.tickets_remaining,
        pp.countdown_start_tickets,
        pp.draw_date,
        pp.end_date as prize_end_date,
        c.status AS campaign_status,
        c.start_at AS campaign_start_at,
        c.end_at AS campaign_end_at,
        c.use_end_date AS campaign_use_end_date,
        CASE WHEN ct_win.id IS NOT NULL THEN 1 ELSE 0 END as has_winner,
        ct_win.ticket_number  as winner_ticket,
        ct_win.won_at         as winner_won_at,
        CONCAT(cust_win.first_name, ' ', cust_win.last_name) as winner_name,
        cust_win.email        as winner_email
      FROM products p
      LEFT JOIN product_prizes pp
        ON p.id = pp.product_id AND pp.is_active = 1
      LEFT JOIN campaigns c ON c.id = p.campaign_id
      LEFT JOIN campaign_tickets ct_win
        ON ct_win.product_id  = pp.product_id
       AND ct_win.campaign_id = pp.campaign_id
       AND ct_win.is_winner   = 1
      LEFT JOIN customers cust_win
        ON cust_win.id = ct_win.customer_id
      WHERE p.status != 'deleted'
      ORDER BY p.created_at DESC
    `);



    // Log a few products to see if prize data is attached
    if (products.length > 0) {
      const withPrize = products.filter(p => p.tickets_required);
      console.log(`📦 [LIST PRODUCTS] Total: ${products.length}, With Prize Info: ${withPrize.length}`);
    }

    console.log('📦 [LIST PRODUCTS] Products from DB:', products.length);
    if (products.length > 0) {
      console.log('📦 [LIST PRODUCTS] Sample product:', JSON.stringify({
        id: products[0].id,
        name: products[0].name,
        status: products[0].status
      }));
    } else {
      console.log('⚠️  [LIST PRODUCTS] NO PRODUCTS IN DATABASE!');
    }

    // Fetch categories for all products in one query (optional - table may not exist)
    let productCategories = [];
    try {
      const [categories] = await connection.execute(`
        SELECT 
          pc.product_id,
          c.id as category_id,
          c.name as category_name
        FROM product_categories pc
        JOIN categories c ON pc.category_id = c.id
      `);
      productCategories = categories;
      console.log('🏷️  [LIST PRODUCTS] Categories found:', productCategories.length);
    } catch (error) {
      console.log('⚠️  [LIST PRODUCTS] product_categories table not found, skipping...');
    }

    // Fetch images for all products in one query
    const [productImages] = await connection.execute(`
      SELECT 
        product_id,
        id,
        image_url,
        alt_text,
        is_primary,
        sort_order
      FROM product_images
      ORDER BY product_id, sort_order ASC, id ASC
    `);

    console.log('🖼️  [LIST PRODUCTS] Images found:', productImages.length);

    // Fetch colors for all products
    const [productColors] = await connection.execute(`
      SELECT product_id, id, color_name, color_code, stock_quantity
      FROM product_colors
      ORDER BY product_id, id ASC
    `);
    console.log('🎨 [LIST PRODUCTS] Colors found:', productColors.length);

    // Fetch sizes for all products
    const [productSizes] = await connection.execute(`
      SELECT product_id, id, size, stock_quantity
      FROM product_sizes
      ORDER BY product_id, id ASC
    `);
    console.log('📏 [LIST PRODUCTS] Sizes found:', productSizes.length);

    // Group categories by product
    const categoriesByProduct = {};
    for (const row of productCategories) {
      if (!categoriesByProduct[row.product_id]) {
        categoriesByProduct[row.product_id] = [];
      }
      categoriesByProduct[row.product_id].push({
        id: row.category_id,
        name: row.category_name,
      });
    }

    // Group images by product
    const imagesByProduct = {};
    for (const img of productImages) {
      if (!imagesByProduct[img.product_id]) {
        imagesByProduct[img.product_id] = [];
      }
      imagesByProduct[img.product_id].push({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
      });
    }

    // Group colors by product
    const colorsByProduct = {};
    for (const color of productColors) {
      if (!colorsByProduct[color.product_id]) {
        colorsByProduct[color.product_id] = [];
      }
      colorsByProduct[color.product_id].push({
        id: color.id,
        name: color.color_name,
        code: color.color_code,
        stock_quantity: color.stock_quantity,
      });
    }

    // Group sizes by product
    const sizesByProduct = {};
    for (const size of productSizes) {
      if (!sizesByProduct[size.product_id]) {
        sizesByProduct[size.product_id] = [];
      }
      sizesByProduct[size.product_id].push({
        id: size.id,
        size: size.size,
        stock_quantity: size.stock_quantity,
      });
    }

    // Attach categories, images, colors, sizes
    const result = products.map((p) => {
      const availability = evaluatePrizeAvailability({
        product_status: p.status,
        campaign_id: p.campaign_id,
        campaign_status: p.campaign_status,
        campaign_start_at: p.campaign_start_at,
        campaign_end_at: p.campaign_end_at,
        campaign_use_end_date: p.campaign_use_end_date,
        pp_is_active: p.pp_is_active,
        tickets_remaining: p.tickets_remaining,
        prize_end_date: p.prize_end_date,
        draw_date: p.draw_date,
        has_winner: p.has_winner,
      });

      return {
        ...p,
        is_purchasable: availability.purchasable,
        is_visible: availability.visible,
        unavailability_reasons: availability.reasons,
        categories: categoriesByProduct[p.id] || [],
        images: imagesByProduct[p.id] || [],
        colors: colorsByProduct[p.id] || [],
        sizes: sizesByProduct[p.id] || [],
      };
    });

    console.log('📊 [LIST PRODUCTS] Final result:', result.length, 'products');
    if (result.length > 0) {
      console.log('📊 [LIST PRODUCTS] Sample result:', JSON.stringify({
        id: result[0].id,
        name: result[0].name,
        categories: result[0].categories.length,
        images: result[0].images.length
      }));
    }

    connection.release();
    console.log('✅ [LIST PRODUCTS] ========== END ==========');
    
    return { success: true, products: result };
  } catch (error) {
    console.error('❌ [LIST PRODUCTS] ========== ERROR ==========');
    console.error('❌ [LIST PRODUCTS] Message:', error.message);
    console.error('❌ [LIST PRODUCTS] Stack:', error.stack);
    return { success: false, error: 'Server error while listing products' };
  }
}



/**
 * Helper: upsert product images
 * For now we expect an array of image URLs from the admin UI.
 */
async function upsertProductImages(connection, productId, images = []) {
  // Remove existing
  await connection.execute('DELETE FROM product_images WHERE product_id = ?', [productId]);

  if (!Array.isArray(images) || images.length === 0) return;

  const values = images.map((url, index) => [
    productId,
    url,
    null, // alt_text (optional for now)
    index === 0, // is_primary
    index, // sort_order
  ]);

  await connection.query(
    'INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES ?;',
    [values]
  );
}

async function upsertProductColors(connection, productId, colors = []) {
  await connection.execute('DELETE FROM product_colors WHERE product_id = ?', [productId]);

  if (!Array.isArray(colors) || colors.length === 0) return;

  const values = colors.map((c) => [
    productId,
    c.name || c.color_name || null,
    c.code || c.color_code || null,
    c.stock_quantity || 0,
  ]);

  await connection.query(
    'INSERT INTO product_colors (product_id, color_name, color_code, stock_quantity) VALUES ?;',
    [values]
  );
}

async function upsertProductSizes(connection, productId, sizes = []) {
  await connection.execute('DELETE FROM product_sizes WHERE product_id = ?', [productId]);

  if (!Array.isArray(sizes) || sizes.length === 0) return;

  const values = sizes.map((s) => [
    productId,
    s.size || null,
    s.stock_quantity || 0,
  ]);

  await connection.query(
    'INSERT INTO product_sizes (product_id, size, stock_quantity) VALUES ?;',
    [values]
  );
}

/**
 * Create a new product with categories and images
 */
export async function createProduct(productData) {
  const connection = await pool.getConnection();

  try {
    console.log('📝 [CREATE PRODUCT] Request received');
    console.log('   Product data:', productData);

    const {
      name,
      slug,
      description,
      sku,
      price,
      sale_price,
      stock_quantity,
      status = 'active',
      category = '',
      sub_category = '',
      for_gender = '',
      is_customized = false,
      tags = [],
      campaign_id = null,
      image_urls = [],
    } = productData;

    // Parse colors and sizes if they come as JSON strings (from FormData)
    let colors = productData.colors || [];
    let sizes = productData.sizes || [];
    
    if (typeof colors === 'string') {
      try { colors = JSON.parse(colors); } catch (e) { colors = []; }
    }
    if (typeof sizes === 'string') {
      try { sizes = JSON.parse(sizes); } catch (e) { sizes = []; }
    }
    
    console.log('   Parsed colors:', colors);
    console.log('   Parsed sizes:', sizes);

    if (!name || price === undefined) {
      return { success: false, error: 'Name and price are required' };
    }

    const safeInt = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
      const parsed = parseInt(val);
      return isNaN(parsed) ? null : parsed;
    };

    // ⚠️ Store exactly what the user typed (no UTC conversion)
    // datetime-local input sends "2026-02-22T05:00" — we strip the T and store as-is
    const toMysqlDatetime = (val) => {
      if (!val || val === '' || val === 'null' || val === 'undefined') return null;
      // Replace the T separator → MySQL datetime format: "2026-02-22 05:00:00"
      const clean = String(val).trim().replace('T', ' ');
      // Pad seconds if missing (datetime-local gives HH:MM, MySQL wants HH:MM:SS)
      return clean.length === 16 ? clean + ':00' : clean.slice(0, 19);
    };

    const parsedCampaignId = safeInt(productData.campaign_id);
    const parsedTickets = safeInt(productData.tickets_required);

    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO products 
       (name, slug, description, sku, price, sale_price, stock_quantity, category, sub_category, for_gender, is_customized, tags, campaign_id, main_image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug || null,
        description || null,
        sku || null,
        price,
        sale_price || null,
        stock_quantity || 0,
        category || null,
        sub_category || null,
        for_gender || null,
        is_customized || false,
        Array.isArray(tags) && tags.length > 0 ? tags.join(',') : (tags || null),
        parsedCampaignId,
        image_urls[0] || null,
        status,
      ]
    );

    const productId = result.insertId;

    // Images
    await upsertProductImages(connection, productId, image_urls);

    await upsertProductColors(connection, productId, colors);
    await upsertProductSizes(connection, productId, sizes);

    // Prize Management
    console.log('🏆 [CREATE PRODUCT] Prize Check - parsedCampaignId:', parsedCampaignId, 'parsedTickets:', parsedTickets);
    
    if (parsedCampaignId && parsedTickets) {
      console.log('🏆 [CREATE PRODUCT] Saving prize info for product:', productId, 'with values:', {
        campaign: parsedCampaignId,
        tickets: parsedTickets,
        countdown: safeInt(productData.countdown_start_tickets) || 0,
        draw_date: productData.draw_date || null
      });
      
      await connection.execute(
        `INSERT INTO product_prizes (product_id, campaign_id, tickets_required, countdown_start_tickets, draw_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, parsedCampaignId, parsedTickets, safeInt(productData.countdown_start_tickets) || 0, toMysqlDatetime(productData.draw_date), toMysqlDatetime(productData.prize_end_date)]
      );
    } else {
      console.log('⚠️ [CREATE PRODUCT] NOT saving prize data. Reason:');
      if (!parsedCampaignId) console.log('   - parsedCampaignId is', parsedCampaignId);
      if (!parsedTickets) console.log('   - parsedTickets is', parsedTickets);
    }

    await connection.commit();
    connection.release();

    console.log('✅ [CREATE PRODUCT] Product created with ID', productId);
    return { success: true, product_id: productId, message: 'Product created successfully' };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ [CREATE PRODUCT] Error:', error);

    // Handle duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('slug')) {
        return { success: false, error: 'A product with this URL slug already exists. Please change the Name or Slug.' };
      }
      if (error.message.includes('sku')) {
        return { success: false, error: 'A product with this SKU already exists.' };
      }
      return { success: false, error: 'This product already exists (duplicate entry).' };
    }

    return { success: false, error: 'Server error while creating product' };
  }
}

/**
 * Get single product with categories and images
 */
export async function getProductById(productId) {
  try {
    const connection = await pool.getConnection();

    const [products] = await connection.execute(
      `SELECT 
        p.*, 
        (SELECT tickets_required FROM product_prizes WHERE product_id = p.id ORDER BY id DESC LIMIT 1) as tickets_required,
        (SELECT countdown_start_tickets FROM product_prizes WHERE product_id = p.id ORDER BY id DESC LIMIT 1) as countdown_start_tickets,
        (SELECT draw_date FROM product_prizes WHERE product_id = p.id ORDER BY id DESC LIMIT 1) as draw_date,
        (SELECT end_date FROM product_prizes WHERE product_id = p.id ORDER BY id DESC LIMIT 1) as prize_end_date
       FROM products p 
       WHERE p.id = ?`,
      [productId]
    );

    if (products.length === 0) {
      connection.release();
      return { success: false, error: 'Product not found' };
    }

    const product = products[0];
    const categories = [];

    const [colors] = await connection.execute(
      `SELECT id, color_name, color_code, stock_quantity
       FROM product_colors
       WHERE product_id = ?
       ORDER BY id ASC`,
      [productId]
    );

    const [sizes] = await connection.execute(
      `SELECT id, size, stock_quantity
       FROM product_sizes
       WHERE product_id = ?
       ORDER BY id ASC`,
      [productId]
    );

    const [images] = await connection.execute(
      `SELECT id, image_url, alt_text, is_primary, sort_order
       FROM product_images
       WHERE product_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );

    connection.release();

    return {
      success: true,
      product: {
        ...product,
        categories,
        images,
        colors,
        sizes,
      },
    };
  } catch (error) {
    console.error('❌ [GET PRODUCT] Error:', error.message);
    return { success: false, error: 'Server error while fetching product' };
  }
}

/**
 * Update product
 */
export async function updateProduct(productId, productData) {
  const connection = await pool.getConnection();

  try {
    console.log('📝 [UPDATE PRODUCT] Request received');
    console.log('   Product ID:', productId);
    console.log('   Raw productData keys:', Object.keys(productData));
    console.log('   campaign_id (raw):', productData.campaign_id, 'type:', typeof productData.campaign_id);
    console.log('   tickets_required (raw):', productData.tickets_required, 'type:', typeof productData.tickets_required);
    console.log('   countdown_start_tickets (raw):', productData.countdown_start_tickets, 'type:', typeof productData.countdown_start_tickets);

    const {
      name,
      slug,
      description,
      sku,
      price,
      sale_price,
      stock_quantity,
      status,
      category = '',
      sub_category = '',
      for_gender = '',
      is_customized = false,
      tags = [],
      campaign_id = null,
      image_urls = [],
    } = productData;

    // Parse colors and sizes if they come as JSON strings (from FormData)
    let colors = productData.colors || [];
    let sizes = productData.sizes || [];
    
    if (typeof colors === 'string') {
      try { colors = JSON.parse(colors); } catch (e) { colors = []; }
    }
    if (typeof sizes === 'string') {
      try { sizes = JSON.parse(sizes); } catch (e) { sizes = []; }
    }

    
    const safeInt = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
      const parsed = parseInt(val);
      return isNaN(parsed) ? null : parsed;
    };

    // ⚠️ Store exactly what the user typed — no UTC conversion
    const toMysqlDatetime = (val) => {
      if (!val || val === '' || val === 'null' || val === 'undefined') return null;
      const clean = String(val).trim().replace('T', ' ');
      return clean.length === 16 ? clean + ':00' : clean.slice(0, 19);
    };


    const parsedCampaignId = safeInt(productData.campaign_id);
    const parsedTickets = safeInt(productData.tickets_required);

    await connection.beginTransaction();

    await connection.execute(
      `UPDATE products
       SET name = ?, slug = ?, description = ?, sku = ?, price = ?, sale_price = ?, 
           stock_quantity = ?, status = ?, category = ?, sub_category = ?, for_gender = ?, is_customized = ?, tags = ?, campaign_id = ?, main_image_url = ?
       WHERE id = ?`,
      [
        name,
        slug || null,
        description || null,
        sku || null,
        price,
        sale_price || null,
        stock_quantity || 0,
        status,
        category || null,
        sub_category || null,
        for_gender || null,
        is_customized || false,
        Array.isArray(tags) && tags.length > 0 ? tags.join(',') : (tags || null),
        parsedCampaignId,
        image_urls[0] || null,
        productId,
      ]
    );

    // Images
    await upsertProductImages(connection, productId, image_urls);

    await upsertProductColors(connection, productId, colors);
    await upsertProductSizes(connection, productId, sizes);

    // Prize Management
    console.log('🏆 [UPDATE PRODUCT] Prize Check - parsedCampaignId:', parsedCampaignId, 'parsedTickets:', parsedTickets);
    
    if (parsedCampaignId && parsedTickets) {
      // Check if exists
      const [existing] = await connection.execute(
        'SELECT id FROM product_prizes WHERE product_id = ?',
        [productId]
      );

      console.log('   Found existing prize records:', existing.length);

      if (existing.length > 0) {
        console.log('🏆 [UPDATE PRODUCT] Updating prize ID:', existing[0].id, 'with values:', {
          campaign: parsedCampaignId,
          tickets: parsedTickets,
          countdown: safeInt(productData.countdown_start_tickets) || 0,
          draw_date: productData.draw_date || null
        });
        
        await connection.execute(
          `UPDATE product_prizes 
           SET campaign_id = ?, tickets_required = ?, countdown_start_tickets = ?, draw_date = ?, end_date = ?, is_active = 1
           WHERE id = ?`,
          [parsedCampaignId, parsedTickets, safeInt(productData.countdown_start_tickets) || 0, toMysqlDatetime(productData.draw_date), toMysqlDatetime(productData.prize_end_date), existing[0].id]
        );
      } else {
        console.log('🏆 [UPDATE PRODUCT] Inserting new prize for product:', productId, 'with values:', {
          campaign: parsedCampaignId,
          tickets: parsedTickets,
          countdown: safeInt(productData.countdown_start_tickets) || 0,
          draw_date: productData.draw_date || null
        });
        
        await connection.execute(
          `INSERT INTO product_prizes (product_id, campaign_id, tickets_required, countdown_start_tickets, draw_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [productId, parsedCampaignId, parsedTickets, safeInt(productData.countdown_start_tickets) || 0, toMysqlDatetime(productData.draw_date), toMysqlDatetime(productData.prize_end_date)]
        );
      }
    } else {
      console.log('⚠️ [UPDATE PRODUCT] NOT saving prize data. Reason:');
      if (!parsedCampaignId) console.log('   - parsedCampaignId is', parsedCampaignId);
      if (!parsedTickets) console.log('   - parsedTickets is', parsedTickets);
    }

    await connection.commit();
    connection.release();

    console.log('✅ [UPDATE PRODUCT] Product updated successfully');
    return { success: true, message: 'Product updated successfully' };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ [UPDATE PRODUCT] Error:', error);

    // Handle duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('slug')) {
        return { success: false, error: 'A product with this URL slug already exists. Please change the Name or Slug.' };
      }
      if (error.message.includes('sku')) {
        return { success: false, error: 'A product with this SKU already exists.' };
      }
      return { success: false, error: 'This product already exists (duplicate entry).' };
    }

    return { success: false, error: 'Server error while updating product' };
  }
}

/**
 * Delete product
 */
export async function deleteProduct(productId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Important: Handle foreign key constraints for tables that might not have ON DELETE CASCADE
    
    // 1. Update order_items to set product_id to NULL (to preserve order history)
    // Some older database versions might have ON DELETE RESTRICT by default
    await connection.execute('UPDATE order_items SET product_id = NULL WHERE product_id = ?', [productId]);

    // 2. Delete from product_prizes (this mapping is no longer needed if product is gone)
    try {
      await connection.execute('DELETE FROM product_prizes WHERE product_id = ?', [productId]);
    } catch (e) {
      // Ignore if table doesn't exist
    }

    // Note: product_images, product_colors, and product_sizes have ON DELETE CASCADE
    // in the setup.js schema, so they will be automatically deleted when the product is deleted.
    
    // Delete product
    const [result] = await connection.execute('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, error: 'Product not found or already deleted' };
    }

    await connection.commit();
    connection.release();

    console.log('✅ [DELETE PRODUCT] Product deleted successfully');
    return { success: true, message: 'Product deleted successfully' };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ [DELETE PRODUCT] Error:', error.message);
    return { success: false, error: 'Server error while deleting product' };
  }
}

/**
 * Update product status
 */
export async function updateProductStatus(productId, status) {
  try {
    const connection = await pool.getConnection();

    await connection.execute(
      'UPDATE products SET status = ? WHERE id = ?',
      [status, productId]
    );

    connection.release();

    console.log('✅ [UPDATE STATUS] Product status updated');
    return { success: true, message: 'Product status updated successfully' };
    return { success: true, message: 'Product status updated successfully' };
  } catch (error) {
    console.error('❌ [UPDATE STATUS] Error:', error.message);
    return { success: false, error: 'Server error while updating product status' };
  }
}

/**
 * List all categories
 */
export async function listCategories() {
  try {
    const connection = await pool.getConnection();

    const [categories] = await connection.execute(
      'SELECT id, name, slug, description, parent_id, created_at FROM categories ORDER BY name ASC'
    );

    connection.release();

    console.log('✅ [LIST CATEGORIES] Found', categories.length, 'categories');
    return { success: true, categories };
  } catch (error) {
    console.error('❌ [LIST CATEGORIES] Error:', error.message);
    return { success: false, error: 'Server error while listing categories' };
  }
}

/**
 * Create a new category
 */
export async function createCategory(categoryData) {
  try {
    const connection = await pool.getConnection();

    const { name, slug, description, parent_id } = categoryData;

    if (!name) {
      return { success: false, error: 'Category name is required' };
    }

    const [result] = await connection.execute(
      'INSERT INTO categories (name, slug, description, parent_id) VALUES (?, ?, ?, ?)',
      [name, slug || null, description || null, parent_id || null]
    );

    connection.release();

    console.log('✅ [CREATE CATEGORY] Category created with ID', result.insertId);
    return { success: true, category_id: result.insertId, message: 'Category created successfully' };
  } catch (error) {
    console.error('❌ [CREATE CATEGORY] Error:', error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, error: 'A category with this name or slug already exists' };
    }
    
    return { success: false, error: 'Server error while creating category' };
  }
}
