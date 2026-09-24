import pool from '../database/connection.js';
import { validateProductPurchase } from '../utils/prizeAvailability.js';
import { splitOrderLine } from '../utils/donation.js';
import { isDonateEnabled } from './settingsController.js';

function hasShippingAddress(address) {
  if (!address) return false;
  if (typeof address === 'string') return address.trim().length > 0;
  if (typeof address === 'object') return Object.keys(address).length > 0;
  return false;
}

/**
 * Normalise total_units / donated_items (SUM returns strings) and derive deliverable_items.
 */
function withDonationCounts(order) {
  const totalUnits = Number(order.total_units) || 0;
  const donated = Math.min(Number(order.donated_items) || 0, totalUnits);
  return {
    ...order,
    total_units: totalUnits,
    donated_items: donated,
    deliverable_items: totalUnits - donated,
    is_fully_donated: totalUnits > 0 && donated === totalUnits,
  };
}

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
    let donateEnabled = null;

    for (const item of items) {
      const line = splitOrderLine({
        quantity: item.quantity,
        donatedQuantity: item.donated_quantity,
        donate: item.donate,
      });

      if (!line.ok) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: line.message });
      }

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

      if (line.donated > 0) {
        if (donateEnabled === null) {
          donateEnabled = await isDonateEnabled(connection);
        }
        if (!donateEnabled) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Donating T-shirts is currently turned off. Please uncheck donation and try again.',
            reasons: ['donation_disabled'],
          });
        }
        if (!product.campaign_id) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `"${product.name}" is not linked to a prize, so it can't be donated for tickets.`,
            reasons: ['donation_not_allowed'],
          });
        }
      }

      const purchaseCheck = await validateProductPurchase(connection, {
        productId: product.id,
        quantity: line.quantity,
        stockQuantity: line.deliverable,
        ticketCount: product.campaign_id ? line.tickets : line.quantity,
        customerId: customer_id,
      });

      if (!purchaseCheck.ok) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: purchaseCheck.message,
          reasons: purchaseCheck.reasons,
        });
      }

      const price = product.sale_price || product.price;
      const subtotal = price * line.quantity;
      totalAmount += subtotal;

      orderItemsData.push({
        product_id: product.id,
        campaign_id: product.campaign_id,
        product_name: product.name,
        product_image: product.main_image_url,
        quantity: line.quantity,
        donated_quantity: line.donated,
        deliverable_quantity: line.deliverable,
        ticket_count: line.tickets,
        price: price,
        subtotal: subtotal,
        color: item.color || null,
        size: item.size || null
      });
    }

    const deliverableItems = orderItemsData.reduce((sum, i) => sum + i.deliverable_quantity, 0);
    const donatedItems = orderItemsData.reduce((sum, i) => sum + i.donated_quantity, 0);

    if (deliverableItems > 0 && !hasShippingAddress(shipping_address)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'A shipping address is required for items that will be delivered.',
        reasons: ['shipping_address_required'],
      });
    }

    // Fully donated orders have nothing to deliver.
    const storedShippingAddress = deliverableItems > 0 && shipping_address
      ? JSON.stringify(shipping_address)
      : null;

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
        storedShippingAddress,
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
         (order_id, product_id, campaign_id, product_name, product_image, quantity, donated_quantity, unit_price, total_price, color, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          itemData.product_id,
          itemData.campaign_id,
          itemData.product_name,
          itemData.product_image,
          itemData.quantity,
          itemData.donated_quantity,
          itemData.price,
          itemData.subtotal,
          itemData.color,
          itemData.size
        ]
      );

      // Donated units are not taken from stock
      if (itemData.deliverable_quantity > 0) {
        await connection.query(
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
          [itemData.deliverable_quantity, itemData.product_id]
        );
      }

      // Auto-create campaign tickets if product has campaign
      if (itemData.campaign_id) {
        const ticketCount = itemData.ticket_count;

        // 1. Update the product_prizes progress count
        const [prizeUpdate] = await connection.query(
          `UPDATE product_prizes
           SET tickets_sold = tickets_sold + ?
           WHERE product_id = ? AND campaign_id = ? AND is_active = 1
           AND tickets_remaining >= ?`,
          [ticketCount, itemData.product_id, itemData.campaign_id, ticketCount]
        );

        if (prizeUpdate.affectedRows === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Prize tickets are no longer available for this product.',
          });
        }

        // 2. Get campaign details to generate tickets
        const [campaigns] = await connection.query(
          `SELECT id, title FROM campaigns WHERE id = ?`,
          [itemData.campaign_id]
        );

        if (campaigns.length > 0) {
          const campaign = campaigns[0];

          // 1 ticket per delivered unit, 2 per donated unit
          const normalTickets = itemData.deliverable_quantity;
          for (let i = 0; i < ticketCount; i++) {
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
              product_name: itemData.product_name,
              source: 'purchase',
              from_donated_item: i >= normalTickets
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
        deliverable_items: deliverableItems,
        donated_items: donatedItems,
        donation_summary: {
          deliverable_items: deliverableItems,
          donated_items: donatedItems,
          total_tickets: campaignEntries.length,
        },
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
        COUNT(oi.id) as items_count,
        COALESCE(SUM(oi.quantity), 0) as total_units,
        COALESCE(SUM(oi.donated_quantity), 0) as donated_items
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

    const orderIds = orders.map(o => o.id);
    const itemsByOrder = new Map();
    const ticketsByOrder = new Map();

    if (orderIds.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id`,
        [orderIds]
      );
      for (const item of itemRows) {
        const quantity = Number(item.quantity) || 0;
        const donated = Math.min(Number(item.donated_quantity) || 0, quantity);
        const list = itemsByOrder.get(item.order_id) || [];
        list.push({ ...item, donated_quantity: donated, deliverable_quantity: quantity - donated });
        itemsByOrder.set(item.order_id, list);
      }

      const [ticketRows] = await pool.query(
        `SELECT ct.order_id, ct.ticket_number, ct.campaign_id, ct.status, ct.source,
                c.title AS campaign_title
         FROM campaign_tickets ct
         LEFT JOIN campaigns c ON ct.campaign_id = c.id
         WHERE ct.order_id IN (?)
         ORDER BY ct.id`,
        [orderIds]
      );
      for (const ticket of ticketRows) {
        const list = ticketsByOrder.get(ticket.order_id) || [];
        list.push(ticket);
        ticketsByOrder.set(ticket.order_id, list);
      }
    }

    const ordersWithParsedAddress = orders.map(order => withDonationCounts({
      ...order,
      shipping_address: parseShippingAddress(order.shipping_address),
      items: itemsByOrder.get(order.id) || [],
      campaign_entries: ticketsByOrder.get(order.id) || [],
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

    const items = orderItems.map(item => {
      const quantity = Number(item.quantity) || 0;
      const donated = Math.min(Number(item.donated_quantity) || 0, quantity);
      return {
        ...item,
        donated_quantity: donated,
        deliverable_quantity: quantity - donated,
      };
    });

    res.json({
      success: true,
      order: withDonationCounts({
        ...order,
        shipping_address: parseShippingAddress(order.shipping_address),
        items,
        total_units: items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
        donated_items: items.reduce((sum, i) => sum + i.donated_quantity, 0),
        campaign_entries: campaignEntries
      })
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
          COALESCE(oi.donated_quantity, 0) as item_donated_quantity,
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
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count,
          (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) as total_units,
          (SELECT COALESCE(SUM(donated_quantity), 0) FROM order_items WHERE order_id = o.id) as donated_items
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
    const ordersWithParsedAddress = orders.map(order => {
      const parsed = { ...order, shipping_address: parseShippingAddress(order.shipping_address) };
      return isExport ? parsed : withDonationCounts(parsed);
    });

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
