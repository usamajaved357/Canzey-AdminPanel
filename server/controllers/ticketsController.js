import pool from '../database/connection.js';

/**
 * Get all campaign tickets (Admin only)
 */
export async function getAllTickets(req, res) {
  try {
    const { status, campaign_id, customer_id, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        ct.*,
        c.title as campaign_title,
        CONCAT(cust.first_name, ' ', cust.last_name) as customer_name,
        cust.email as customer_email,
        o.order_number
      FROM campaign_tickets ct
      LEFT JOIN campaigns c ON ct.campaign_id = c.id
      LEFT JOIN customers cust ON ct.customer_id = cust.id
      LEFT JOIN orders o ON ct.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND ct.status = ?`;
      params.push(status);
    }

    if (campaign_id) {
      query += ` AND ct.campaign_id = ?`;
      params.push(campaign_id);
    }

    if (customer_id) {
      query += ` AND ct.customer_id = ?`;
      params.push(customer_id);
    }

    query += ` ORDER BY ct.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit));
    params.push(offset);

    const [tickets] = await pool.query(query, params);

    res.json({
      success: true,
      tickets
    });

  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

/**
 * Mark a ticket as winner (Admin only)
 */
export async function markTicketAsWinner(req, res) {
  try {
    const { id } = req.params;
    const { is_winner } = req.body;

    if (is_winner) {
      const [tickets] = await pool.execute(
        `SELECT id, product_id, campaign_id FROM campaign_tickets WHERE id = ?`,
        [id]
      );

      if (tickets.length === 0) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
      }

      const ticket = tickets[0];

      if (ticket.product_id && ticket.campaign_id) {
        const [existingWinners] = await pool.execute(
          `SELECT id FROM campaign_tickets
           WHERE product_id = ? AND campaign_id = ? AND is_winner = 1 AND id != ?`,
          [ticket.product_id, ticket.campaign_id, id]
        );

        if (existingWinners.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'A winner has already been selected for this product prize.',
          });
        }
      }
    }

    const [result] = await pool.execute(
      `UPDATE campaign_tickets 
       SET is_winner = ?, won_at = ? 
       WHERE id = ?`,
      [is_winner ? 1 : 0, is_winner ? new Date() : null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      message: is_winner ? 'Ticket marked as winner' : 'Winner status removed'
    });

  } catch (error) {
    console.error('Error marking ticket as winner:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
