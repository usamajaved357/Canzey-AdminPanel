import pool from '../database/connection.js';
import { evaluatePrizeAvailability } from '../utils/prizeAvailability.js';

/**
 * Attach prize to product with ticket count
 */
export async function attachPrizeToProduct(prizeData) {
  try {
    console.log('🎁 [ATTACH PRIZE] Request received');
    console.log('   📊 Prize data:', prizeData);
    
    const { 
      product_id, 
      campaign_id, 
      tickets_required,
      countdown_start_tickets = 0,
      draw_date = null
    } = prizeData;

    if (!product_id || !campaign_id || !tickets_required) {
      return { success: false, error: 'Product ID, Campaign ID, and tickets_required are required' };
    }

    const connection = await pool.getConnection();
    
    // Check if product and campaign exist
    const [productCheck] = await connection.execute(
      'SELECT id, name FROM products WHERE id = ?',
      [product_id]
    );
    
    const [campaignCheck] = await connection.execute(
      'SELECT id, title FROM campaigns WHERE id = ?',
      [campaign_id]
    );
    
    if (productCheck.length === 0) {
      connection.release();
      return { success: false, error: 'Product not found' };
    }
    
    if (campaignCheck.length === 0) {
      connection.release();
      return { success: false, error: 'Campaign not found' };
    }
    
    // Check if prize already attached to this product
    const [existing] = await connection.execute(
      'SELECT id FROM product_prizes WHERE product_id = ?',
      [product_id]
    );
    
    let result;
    if (existing.length > 0) {
      // Update existing mapping
      const [updateResult] = await connection.execute(
        `UPDATE product_prizes 
         SET campaign_id = ?, tickets_required = ?, countdown_start_tickets = ?, draw_date = ?, is_active = 1
         WHERE id = ?`,
        [campaign_id, tickets_required, countdown_start_tickets, draw_date, existing[0].id]
      );
      result = { insertId: existing[0].id, affectedRows: updateResult.affectedRows };
      console.log('✅ [ATTACH PRIZE] Prize mapping updated for product', product_id);
    } else {
      // Create new product-prize mapping
      const [insertResult] = await connection.execute(
        `INSERT INTO product_prizes (product_id, campaign_id, tickets_required, countdown_start_tickets, draw_date) 
         VALUES (?, ?, ?, ?, ?)`,
        [product_id, campaign_id, tickets_required, countdown_start_tickets, draw_date]
      );
      result = insertResult;
      console.log('✅ [ATTACH PRIZE] New prize mapping created for product', product_id);
    }
    
    connection.release();
    
    console.log('✅ [ATTACH PRIZE] Prize attached successfully');
    
    return { 
      success: true, 
      message: 'Prize attached to product successfully',
      product_prize: {
        id: result.insertId,
        product_id,
        campaign_id,
        product_name: productCheck[0].name,
        campaign_title: campaignCheck[0].title,
        tickets_required,
        tickets_sold: 0,
        tickets_remaining: tickets_required,
        countdown_start_tickets,
        draw_date
      }
    };
  } catch (error) {
    console.error('❌ [ATTACH PRIZE] Error:', error.message);
    return { success: false, error: 'Server error during prize attachment' };
  }
}

/**
 * Get all product-prize mappings
 */
export async function getAllProductPrizes() {
  try {
    console.log('📋 [LIST PRODUCT PRIZES] Request received');
    
    const connection = await pool.getConnection();
    
    const [productPrizes] = await connection.execute(`
      SELECT 
        pp.id, pp.product_id, pp.campaign_id, pp.tickets_required, 
        pp.tickets_sold, pp.tickets_remaining, pp.countdown_start_tickets, pp.draw_date,
        pp.end_date,
        pp.is_active, pp.created_at, pp.updated_at,
        p.name as product_name, p.main_image_url,
        c.title as campaign_title, c.image_url as campaign_image
      FROM product_prizes pp
      JOIN products p ON pp.product_id = p.id
      JOIN campaigns c ON pp.campaign_id = c.id
      ORDER BY pp.created_at DESC
    `);
    
    connection.release();
    
    console.log('✅ [LIST PRODUCT PRIZES] Retrieved product prizes:', productPrizes.length);
    
    return { 
      success: true, 
      product_prizes: productPrizes
    };
  } catch (error) {
    console.error('❌ [LIST PRODUCT PRIZES] Error:', error.message);
    return { success: false, error: 'Server error while fetching product prizes' };
  }
}

/**
 * Update product prize (edit ticket count, etc.)
 */
export async function updateProductPrize(id, updateData) {
  try {
    console.log('📝 [UPDATE PRODUCT PRIZE] Request received');
    console.log('   🆔 ID:', id);
    console.log('   📊 Update data:', updateData);
    
    const { 
      tickets_required,
      countdown_start_tickets,
      draw_date,
      is_active
    } = updateData;

    const connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      `UPDATE product_prizes 
       SET tickets_required = ?, countdown_start_tickets = ?, draw_date = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        tickets_required, 
        countdown_start_tickets, 
        draw_date,
        is_active ? 1 : 0,
        id
      ]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return { success: false, error: 'Product prize not found' };
    }

    console.log('✅ [UPDATE PRODUCT PRIZE] Updated successfully');
    
    return { 
      success: true, 
      message: 'Product prize updated successfully'
    };
  } catch (error) {
    console.error('❌ [UPDATE PRODUCT PRIZE] Error:', error.message);
    return { success: false, error: 'Server error during update' };
  }
}

/**
 * Delete product prize mapping
 */
export async function deleteProductPrize(id) {
  try {
    console.log('🗑️ [DELETE PRODUCT PRIZE] Request received');
    console.log('   🆔 ID:', id);
    
    const connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'DELETE FROM product_prizes WHERE id = ?',
      [id]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return { success: false, error: 'Product prize not found' };
    }

    console.log('✅ [DELETE PRODUCT PRIZE] Deleted successfully');
    
    return { 
      success: true, 
      message: 'Product prize deleted successfully'
    };
  } catch (error) {
    console.error('❌ [DELETE PRODUCT PRIZE] Error:', error.message);
    return { success: false, error: 'Server error during deletion' };
  }
}

/**
 * Consume tickets when product is ordered
 */
export async function consumeProductTickets(productId, quantity = 1) {
  try {
    console.log('🎫 [CONSUME TICKETS] Request received');
    console.log('   📦 Product ID:', productId);
    console.log('   🔢 Quantity:', quantity);
    
    const connection = await pool.getConnection();
    
    // Get active product prize
    const [productPrize] = await connection.execute(
      'SELECT * FROM product_prizes WHERE product_id = ? AND is_active = 1 AND tickets_remaining > 0',
      [productId]
    );
    
    if (productPrize.length === 0) {
      connection.release();
      return { success: false, error: 'No active prize found for this product' };
    }
    
    const prize = productPrize[0];
    
    // Check if enough tickets remaining
    if (prize.tickets_remaining < quantity) {
      connection.release();
      return { success: false, error: `Only ${prize.tickets_remaining} tickets remaining` };
    }
    
    // Update ticket count
    const [result] = await connection.execute(
      'UPDATE product_prizes SET tickets_sold = tickets_sold + ? WHERE id = ?',
      [quantity, prize.id]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return { success: false, error: 'Failed to update ticket count' };
    }

    console.log('✅ [CONSUME TICKETS] Tickets consumed successfully');
    
    return { 
      success: true, 
      message: 'Tickets consumed successfully',
      tickets_consumed: quantity,
      tickets_remaining: prize.tickets_remaining - quantity,
      campaign_id: prize.campaign_id
    };
  } catch (error) {
    console.error('❌ [CONSUME TICKETS] Error:', error.message);
    return { success: false, error: 'Server error while consuming tickets' };
  }
}

/**
 * Get product prize info for frontend display
 */
export async function getProductPrizeInfo(productId) {
  try {
    console.log('📱 [PRODUCT PRIZE INFO] Request received');
    console.log('   📦 Product ID:', productId);
    
    const connection = await pool.getConnection();
    
    const [productPrize] = await connection.execute(`
      SELECT 
        pp.id, pp.tickets_required, pp.tickets_sold, pp.tickets_remaining,
        pp.countdown_start_tickets, pp.draw_date, pp.end_date, pp.is_active,
        p.status AS product_status,
        c.id AS campaign_id,
        c.title as campaign_title,
        c.image_url as campaign_image,
        c.status AS campaign_status,
        c.start_at AS campaign_start_at,
        c.end_at AS campaign_end_at,
        c.use_end_date AS campaign_use_end_date,
        CASE WHEN ct_win.id IS NOT NULL THEN 1 ELSE 0 END AS has_winner
      FROM product_prizes pp
      JOIN products p ON p.id = pp.product_id
      JOIN campaigns c ON pp.campaign_id = c.id
      LEFT JOIN campaign_tickets ct_win
        ON ct_win.product_id = pp.product_id
       AND ct_win.campaign_id = pp.campaign_id
       AND ct_win.is_winner = 1
      WHERE pp.product_id = ? AND pp.is_active = 1
    `, [productId]);
    
    connection.release();
    
    if (productPrize.length === 0) {
      return { success: true, prize_info: null };
    }
    
    const prize = productPrize[0];
    const availability = evaluatePrizeAvailability({
      product_status: prize.product_status,
      campaign_id: prize.campaign_id,
      campaign_status: prize.campaign_status,
      campaign_start_at: prize.campaign_start_at,
      campaign_end_at: prize.campaign_end_at,
      campaign_use_end_date: prize.campaign_use_end_date,
      pp_is_active: prize.is_active,
      tickets_remaining: prize.tickets_remaining,
      prize_end_date: prize.end_date,
      draw_date: prize.draw_date,
      has_winner: prize.has_winner,
    });
    
    // Determine if countdown should start
    const shouldShowCountdown = prize.tickets_sold >= prize.countdown_start_tickets;
    
    console.log('✅ [PRODUCT PRIZE INFO] Retrieved successfully');
    
    return { 
      success: true, 
      prize_info: {
        ...prize,
        is_purchasable: availability.purchasable,
        unavailability_reasons: availability.reasons,
        should_show_countdown: shouldShowCountdown,
        progress_percentage: Math.round((prize.tickets_sold / prize.tickets_required) * 100)
      }
    };
  } catch (error) {
    console.error('❌ [PRODUCT PRIZE INFO] Error:', error.message);
    return { success: false, error: 'Server error while fetching prize info' };
  }
}
