/**
 * Donate-a-T-shirt rules.
 *  - Normal (delivered) item: 1 raffle ticket, reduces stock, shipped.
 *  - Donated item: 2 raffle tickets, does NOT reduce stock, never shipped.
 */

export const TICKETS_PER_NORMAL_ITEM = 1;
export const TICKETS_PER_DONATED_ITEM = 2;

/**
 * Split an order line into deliverable/donated units and compute its tickets.
 * Returns { ok: false, message } when the input is invalid.
 */
export function splitOrderLine({ quantity, donatedQuantity, donate }) {
  const qty = Number.parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return { ok: false, message: 'Each item must have a quantity of at least 1' };
  }

  let donated = 0;
  if (donatedQuantity !== undefined && donatedQuantity !== null && donatedQuantity !== '') {
    donated = Number.parseInt(donatedQuantity, 10);
    if (!Number.isInteger(donated)) {
      return { ok: false, message: 'Invalid donated quantity' };
    }
  } else if (donate === true || donate === 1 || donate === 'true') {
    donated = qty;
  }

  if (donated < 0 || donated > qty) {
    return { ok: false, message: 'Donated quantity must be between 0 and the item quantity' };
  }

  const deliverable = qty - donated;
  return {
    ok: true,
    quantity: qty,
    donated,
    deliverable,
    tickets: deliverable * TICKETS_PER_NORMAL_ITEM + donated * TICKETS_PER_DONATED_ITEM,
  };
}
