/**
 * Shared rules for prize product visibility and purchase eligibility.
 * Regular products (no campaign) are purchasable when status === 'active'.
 */

function toBool(value) {
  return value === 1 || value === true || value === '1' || value === 'true';
}

function isPast(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  return !Number.isNaN(d.getTime()) && d < new Date();
}

function isFuture(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  return !Number.isNaN(d.getTime()) && d > new Date();
}

/**
 * Evaluate whether a prize-linked product can be shown and purchased.
 */
export function evaluatePrizeAvailability(row) {
  const reasons = [];

  if (row.product_status && row.product_status !== 'active') {
    reasons.push('product_inactive');
  }

  const campaignId = row.campaign_id ?? row.campaignId;
  if (!campaignId) {
    return {
      purchasable: row.product_status === 'active',
      visible: row.product_status === 'active',
      reasons,
    };
  }

  if (row.campaign_status && row.campaign_status !== 'active') {
    reasons.push('campaign_inactive');
  }

  if (isFuture(row.campaign_start_at ?? row.start_at)) {
    reasons.push('campaign_not_started');
  }

  const useEndDate = toBool(row.campaign_use_end_date ?? row.use_end_date);
  if (useEndDate && isPast(row.campaign_end_at ?? row.end_at)) {
    reasons.push('campaign_ended');
  }

  if (row.pp_is_active === 0 || row.pp_is_active === false) {
    reasons.push('prize_inactive');
  }

  const remaining = row.tickets_remaining;
  if (remaining != null && Number(remaining) <= 0) {
    reasons.push('sold_out');
  }

  if (isPast(row.prize_end_date ?? row.end_date)) {
    reasons.push('prize_end_date_passed');
  }

  if (isPast(row.draw_date)) {
    reasons.push('draw_date_passed');
  }

  if (toBool(row.has_winner)) {
    reasons.push('winner_selected');
  }

  const blocked = reasons.length > 0;
  return {
    purchasable: !blocked,
    visible: !blocked,
    reasons,
  };
}

export function availabilityMessage(reasons) {
  const map = {
    product_inactive: 'This product is not active.',
    campaign_inactive: 'This prize campaign is not active.',
    campaign_not_started: 'This prize campaign has not started yet.',
    campaign_ended: 'This prize campaign has ended.',
    prize_inactive: 'This prize is not active.',
    sold_out: 'All tickets for this prize have been sold.',
    prize_end_date_passed: 'The prize entry period has ended.',
    draw_date_passed: 'The draw date has passed — entries are closed.',
    winner_selected: 'A winner has already been selected for this prize.',
    insufficient_tickets: 'Not enough tickets remaining for this quantity.',
    ticket_limit_reached: 'You have reached the maximum tickets allowed for this campaign.',
  };
  return map[reasons[0]] || 'This prize is not available for purchase.';
}

/**
 * Load product + prize + campaign context and validate a purchase.
 */
export async function validateProductPurchase(connection, { productId, quantity, customerId }) {
  const [rows] = await connection.query(
    `SELECT
       p.id AS product_id,
       p.name AS product_name,
       p.status AS product_status,
       p.campaign_id,
       p.stock_quantity,
       pp.id AS prize_id,
       pp.is_active AS pp_is_active,
       pp.tickets_remaining,
       pp.draw_date,
       pp.end_date AS prize_end_date,
       c.status AS campaign_status,
       c.start_at AS campaign_start_at,
       c.end_at AS campaign_end_at,
       c.use_end_date AS campaign_use_end_date,
       c.max_tickets_per_user,
       CASE WHEN ct_win.id IS NOT NULL THEN 1 ELSE 0 END AS has_winner
     FROM products p
     LEFT JOIN product_prizes pp
       ON pp.product_id = p.id AND pp.is_active = 1
     LEFT JOIN campaigns c ON c.id = p.campaign_id
     LEFT JOIN campaign_tickets ct_win
       ON ct_win.product_id = p.id
      AND ct_win.campaign_id = p.campaign_id
      AND ct_win.is_winner = 1
     WHERE p.id = ?`,
    [productId]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'Product not found', reasons: ['not_found'] };
  }

  const row = rows[0];

  if (row.product_status !== 'active') {
    return { ok: false, message: 'Product is not available', reasons: ['product_inactive'] };
  }

  if (row.stock_quantity < quantity) {
    return { ok: false, message: `Insufficient stock for product: ${row.product_name}`, reasons: ['insufficient_stock'] };
  }

  if (!row.campaign_id) {
    return { ok: true, row };
  }

  const availability = evaluatePrizeAvailability(row);
  if (!availability.purchasable) {
    return {
      ok: false,
      message: availabilityMessage(availability.reasons),
      reasons: availability.reasons,
    };
  }

  if (row.tickets_remaining != null && Number(row.tickets_remaining) < quantity) {
    return {
      ok: false,
      message: `Only ${row.tickets_remaining} ticket(s) remaining for this prize.`,
      reasons: ['insufficient_tickets'],
    };
  }

  if (customerId && row.max_tickets_per_user) {
    const [ticketCounts] = await connection.query(
      `SELECT COUNT(*) AS ticket_count
       FROM campaign_tickets
       WHERE campaign_id = ? AND customer_id = ?`,
      [row.campaign_id, customerId]
    );
    const currentTickets = ticketCounts[0]?.ticket_count || 0;
    if (currentTickets + quantity > row.max_tickets_per_user) {
      return {
        ok: false,
        message: `Maximum ${row.max_tickets_per_user} tickets allowed per user. You already have ${currentTickets}.`,
        reasons: ['ticket_limit_reached'],
      };
    }
  }

  return { ok: true, row };
}

/** SQL fragment: purchasable prize products for public listings */
export const PURCHASABLE_PRODUCT_SQL = `
  p.status = 'active'
  AND pp.is_active = 1
  AND pp.tickets_remaining > 0
  AND (pp.end_date IS NULL OR pp.end_date > NOW())
  AND (pp.draw_date IS NULL OR pp.draw_date > NOW())
  AND NOT EXISTS (
    SELECT 1 FROM campaign_tickets ct
    WHERE ct.product_id = p.id
      AND ct.campaign_id = p.campaign_id
      AND ct.is_winner = 1
  )
  AND c.status = 'active'
  AND (c.start_at IS NULL OR c.start_at <= NOW())
  AND (c.use_end_date = 0 OR c.end_at IS NULL OR c.end_at >= NOW())
`;
