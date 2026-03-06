import pool from '../database/connection.js';

/**
 * Generate unique order number
 */
function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
}

/**
 * Generate unique ticket number
 */
function generateTicketNumber(campaignId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKT-${campaignId}-${random}`;
}

/**
 * Safely parse shipping address (handles both string and object)
 */
function parseShippingAddress(address) {
  if (!address) return null;
  
  // If it's already an object, return it
  if (typeof address === 'object') {
    return address;
  }
  
  // If it's a string, try to parse it
  if (typeof address === 'string') {
    try {
      // Only parse if it looks like JSON
      if (address.startsWith('{') || address.startsWith('[')) {
        return JSON.parse(address);
      }
    } catch (e) {
      console.warn('Failed to parse shipping_address:', address);
    }
  }
  
  return null;
}

/**
 * Create new order
 */
export async function createOrder(req, res) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      customer_id,
      items,
      shipping_address,
      payment_method,
      payment_transaction_id,
      payment_status = 'pending',
      order_status = 'pending',
      notes,
      donation_amount,      // optional — must be > 1 if provided
      donation_campaign_id  // required when donation_amount is provided
    } = req.body;

    // Validate required fields
    if (!customer_id || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Customer ID and items are required'
      });
    }

    // Validate donation if provided
    const parsedDonation = donation_amount ? parseFloat(donation_amount) : 0;
    if (parsedDonation > 0) {
      if (parsedDonation <= 1) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Donation amount must be greater than 1'
        });
      }
      if (!donation_campaign_id) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'donation_campaign_id is required when donating'
        });
      }
    }

    // Validate order_status if provided
    const validOrderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (order_status && !validOrderStatuses.includes(order_status)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid order status. Must be: pending, processing, shipped, delivered, or cancelled'
      });
    }

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Fetch product details and calculate total
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const [products] = await connection.query(
        `SELECT id, name, price, sale_price, campaign_id, main_image_url, stock_quantity 
         FROM products WHERE id = ?`,
        [item.product_id]
      );

      if (products.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.product_id} not found`
        });
      }

      const product = products[0];

      // Check stock
      if (product.stock_quantity < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.name}`
        });
      }

      const price = product.sale_price || product.price;
      const subtotal = price * item.quantity;
      totalAmount += subtotal;

      orderItemsData.push({
        product_id: product.id,
        campaign_id: product.campaign_id,
        product_name: product.name,
        product_image: product.main_image_url,
        quantity: item.quantity,
        price: price,
        subtotal: subtotal,
        color: item.color || null,
        size: item.size || null
      });
    }

    // Add donation to grand total
    const grandTotal = totalAmount + parsedDonation;

    // Create order
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (order_number, customer_id, total_amount, donation_amount, payment_status, payment_method, 
        payment_transaction_id, order_status, shipping_address, customer_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        customer_id,
        grandTotal,
        parsedDonation,
        payment_status,
        payment_method || null,
        payment_transaction_id || null,
        order_status,
        shipping_address ? JSON.stringify(shipping_address) : null,
        notes || null
      ]
    );

    const orderId = orderResult.insertId;

    // Create order items and campaign tickets
    const campaignEntries = [];

    for (const itemData of orderItemsData) {
      // Insert order item
      await connection.query(
        `INSERT INTO order_items 
         (order_id, product_id, campaign_id, product_name, product_image, quantity, unit_price, total_price, color, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          itemData.product_id,
          itemData.campaign_id,
          itemData.product_name,
          itemData.product_image,
          itemData.quantity,
          itemData.price,
          itemData.subtotal,
          itemData.color,
          itemData.size
        ]
      );

      // Update product stock
      await connection.query(
        `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
        [itemData.quantity, itemData.product_id]
      );

      // Auto-create campaign tickets if product has campaign
      if (itemData.campaign_id) {
        // 1. Update the product_prizes progress count
        try {
          await connection.query(
            `UPDATE product_prizes 
             SET tickets_sold = tickets_sold + ? 
             WHERE product_id = ? AND campaign_id = ? AND is_active = 1`,
            [itemData.quantity, itemData.product_id, itemData.campaign_id]
          );
        } catch (prizeErr) {
          console.error('⚠️ Could not update product_prizes progress:', prizeErr.message);
          // We don't fail the whole order if prizes tracking fails, but we log it
        }

        // 2. Get campaign details to generate tickets
        const [campaigns] = await connection.query(
          `SELECT id, title FROM campaigns WHERE id = ?`,
          [itemData.campaign_id]
        );

        if (campaigns.length > 0) {
          const campaign = campaigns[0];

          // Create one ticket per quantity
          for (let i = 0; i < itemData.quantity; i++) {
            const ticketNumber = generateTicketNumber(itemData.campaign_id);

            await connection.query(
              `INSERT INTO campaign_tickets 
               (campaign_id, customer_id, order_id, product_id, ticket_number, 
                quantity, total_price, credits_earned)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                itemData.campaign_id,
                customer_id,
                orderId,
                itemData.product_id, // ✅ ADD product_id
                ticketNumber,
                1,
                itemData.price,
                0 // Credits can be calculated based on your logic
              ]
            );

            campaignEntries.push({
              ticket_number: ticketNumber,
              campaign_id: itemData.campaign_id,
              campaign_title: campaign.title,
              product_name: itemData.product_name
            });
          }
        }
      }
    }

    // ── Issue donation ticket (1 bonus ticket for the donated campaign) ──────
    if (parsedDonation > 0 && donation_campaign_id) {
      const [donationCampaigns] = await connection.query(
        `SELECT id, title FROM campaigns WHERE id = ?`,
        [donation_campaign_id]
      );

      if (donationCampaigns.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Donation campaign (ID: ${donation_campaign_id}) not found`
        });
      }

      const donationCampaign = donationCampaigns[0];
      const donationTicketNumber = generateTicketNumber(donation_campaign_id);

      await connection.query(
        `INSERT INTO campaign_tickets
         (campaign_id, customer_id, order_id, product_id, ticket_number,
          quantity, total_price, credits_earned, source)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 0, 'donation')`,
        [
          donation_campaign_id,
          customer_id,
          orderId,
          donationTicketNumber,
          1,
          parsedDonation
        ]
      );

      // Update product_prizes tickets_sold for donated campaign (find its active prize)
      try {
        await connection.query(
          `UPDATE product_prizes
           SET tickets_sold = tickets_sold + 1
           WHERE campaign_id = ? AND is_active = 1`,
          [donation_campaign_id]
        );
      } catch (prizeErr) {
        console.error('⚠️ Could not update product_prizes for donation:', prizeErr.message);
      }

      campaignEntries.push({
        ticket_number: donationTicketNumber,
        campaign_id: donation_campaign_id,
        campaign_title: donationCampaign.title,
        product_name: null,
        source: 'donation'
      });

      console.log(`🎁 Donation ticket issued: ${donationTicketNumber} → Campaign "${donationCampaign.title}" (${parsedDonation})`);
    }

    await connection.commit();

    // Fetch complete order details
    const [orders] = await connection.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );

    const [orderItems] = await connection.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        ...orders[0],
        shipping_address: parseShippingAddress(orders[0].shipping_address),
        items: orderItems,
        campaign_entries: campaignEntries,
        donation: parsedDonation > 0 ? {
          amount: parsedDonation,
          campaign_id: donation_campaign_id,
          ticket_issued: true
        } : null
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error creating order:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order',
      error: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * Get customer orders
 */
export async function getCustomerOrders(req, res) {
  try {
    const { customerId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        o.*,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ?
    `;
    const params = [customerId];

    if (status) {
      query += ` AND o.order_status = ?`;
      params.push(status);
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit));
    params.push(offset);

    const [orders] = await pool.execute(query, params);

    // Parse shipping_address JSON
    const ordersWithParsedAddress = orders.map(order => ({
      ...order,
      shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null
    }));

    res.json({
      success: true,
      orders: ordersWithParsedAddress,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

/**
 * Get order details by ID
 */
export async function getOrderById(req, res) {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query(
      `SELECT o.*, c.first_name, c.last_name, c.email 
       FROM orders o 
       JOIN customers c ON o.customer_id = c.id 
       WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Get order items
    const [orderItems] = await pool.execute(
      `SELECT 
        oi.*,
        c.title as campaign_title
      FROM order_items oi
      LEFT JOIN campaigns c ON oi.campaign_id = c.id
      WHERE oi.order_id = ?`,
      [orderId]
    );

    // Get campaign entries (tickets)
    const [campaignEntries] = await pool.execute(
      `SELECT 
        ct.ticket_number,
        ct.campaign_id,
        ct.status,
        c.title as campaign_title
      FROM campaign_tickets ct
      LEFT JOIN campaigns c ON ct.campaign_id = c.id
      WHERE ct.order_id = ?`,
      [orderId]
    );

    res.json({
      success: true,
      order: {
        ...order,
        shipping_address: parseShippingAddress(order.shipping_address),
        items: orderItems,
        campaign_entries: campaignEntries
      }
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

/**
 * Get all orders (Admin)
 */
export async function getAllOrders(req, res) {
  try {
    const { status, customer_id, start_date, end_date, include_items, page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = '';
    const isExport = include_items === 'true';

    if (isExport) {
      query = `
        SELECT 
          o.*,
          COALESCE(c.first_name, '') as first_name,
          COALESCE(c.last_name, '') as last_name,
          COALESCE(c.email, '') as email,
          COALESCE(c.phone_number, '') as phone_number,
          oi.product_name,
          oi.quantity as item_quantity,
          oi.unit_price as item_price,
          oi.total_price as item_total,
          oi.color as item_color,
          oi.size as item_size
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1
      `;
    } else {
      query = `
        SELECT 
          o.*,
          COALESCE(c.first_name, '') as first_name,
          COALESCE(c.last_name, '') as last_name,
          COALESCE(c.email, '') as email,
          COALESCE(c.phone_number, '') as phone_number,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE 1=1
      `;
    }
    const params = [];

    if (status) {
      query += ` AND o.order_status = ?`;
      params.push(status);
    }

    if (customer_id) {
      query += ` AND o.customer_id = ?`;
      params.push(customer_id);
    }

    if (start_date) {
      query += ` AND o.created_at >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      // Add 23:59:59 to include the whole end day
      const endDateTime = end_date.includes(' ') ? end_date : `${end_date} 23:59:59`;
      query += ` AND o.created_at <= ?`;
      params.push(endDateTime);
    }

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit));
    params.push(offset);

    console.log('📊 [GET ALL ORDERS] Query params:', params);
    console.log('📊 [GET ALL ORDERS] Limit:', parseInt(limit), 'Offset:', offset);
    console.log('📊 [GET ALL ORDERS] Params length:', params.length);

    const [orders] = await pool.query(query, params);

    // Parse shipping_address JSON
    const ordersWithParsedAddress = orders.map(order => ({
      ...order,
      shipping_address: parseShippingAddress(order.shipping_address)
    }));

    res.json({
      success: true,
      orders: ordersWithParsedAddress,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}

/**
 * Update order status (Admin)
 */
export async function updateOrderStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const [result] = await pool.execute(
      `UPDATE orders SET order_status = ? WHERE id = ?`,
      [status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

/**
 * Update payment status (Admin)
 */
export async function updatePaymentStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { payment_status } = req.body;

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const [result] = await pool.execute(
      `UPDATE orders SET payment_status = ? WHERE id = ?`,
      [payment_status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully'
    });

  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
