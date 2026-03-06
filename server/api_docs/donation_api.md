# Donation on Order — API Reference

**Base path:** `/api/orders`

---

## Overview

When a customer places an order they can optionally **donate** an extra amount on top of their cart total.

Rules:
- Donation is **optional** — omit `donation_amount` or set it to `0` for no donation.
- Donation amount must be **strictly greater than 1** (no currency assumption — works for any currency).
- `donation_campaign_id` **must** be supplied whenever `donation_amount > 0`.
- The referenced campaign must **exist and be `active`**.
- One **bonus `campaign_ticket`** (source = `'donation'`) is automatically issued for the donated campaign.
- `total_amount` stored on the order = cart subtotal + donation.
- `donation_amount` is stored separately on the order for reporting.

---

## Create Order with Donation

### `POST /api/orders`

**Authentication:** Bearer token (customer)

### Request Body

```json
{
  "customer_id": 42,
  "items": [
    {
      "product_id": 7,
      "quantity": 2,
      "color": "Black",
      "size": "M"
    }
  ],
  "shipping_address": {
    "street": "123 Main St",
    "city": "Karachi",
    "country": "PK"
  },
  "payment_method": "card",
  "payment_transaction_id": "txn_abc123",
  "payment_status": "paid",

  "donation_amount": 5.00,
  "donation_campaign_id": 3
}
```

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `customer_id` | integer | ✅ | |
| `items` | array | ✅ | At least one item |
| `shipping_address` | object | ❌ | JSON object |
| `payment_method` | string | ❌ | e.g. `"card"`, `"cash"` |
| `payment_transaction_id` | string | ❌ | Gateway reference |
| `payment_status` | string | ❌ | Default: `"pending"` |
| `order_status` | string | ❌ | Default: `"pending"` |
| `notes` | string | ❌ | Customer note |
| `donation_amount` | number | ❌ | Must be **> 1** if provided |
| `donation_campaign_id` | integer | ⚠️ | Required **only** when `donation_amount > 0` |

---

### Success Response `201`

```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "id": 101,
    "order_number": "ORD-1709715800000-042",
    "customer_id": 42,
    "total_amount": 35.00,
    "donation_amount": 5.00,
    "payment_status": "paid",
    "order_status": "pending",
    "items": [ ... ],
    "campaign_entries": [
      {
        "ticket_number": "TKT-3-AB12CD",
        "campaign_id": 3,
        "campaign_title": "Summer Giveaway",
        "product_name": "Black T-Shirt",
        "source": "purchase"
      },
      {
        "ticket_number": "TKT-3-XY99ZZ",
        "campaign_id": 3,
        "campaign_title": "Summer Giveaway",
        "product_name": null,
        "source": "donation"
      }
    ],
    "donation": {
      "amount": 5.00,
      "campaign_id": 3,
      "ticket_issued": true
    }
  }
}
```

> **Note:** `campaign_entries` now includes both regular `"purchase"` tickets from bought products and the `"donation"` ticket. The donation entry has `product_name: null` and `source: "donation"`.

---

### Error Responses

| HTTP | `message` | Cause |
|---|---|---|
| `400` | `"Donation amount must be greater than 1"` | `donation_amount <= 1` |
| `400` | `"donation_campaign_id is required when donating"` | `donation_amount > 0` but no campaign ID |
| `400` | `"Donation campaign (ID: X) not found or not active"` | Campaign doesn't exist or is inactive |

---

## Database Changes

### `orders` table
```sql
ALTER TABLE orders
ADD COLUMN donation_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
  COMMENT 'Optional donation amount added on top of order total'
  AFTER total_amount;
```

### `campaign_tickets` table
```sql
ALTER TABLE campaign_tickets
MODIFY COLUMN source ENUM('purchase', 'direct', 'donation') DEFAULT 'direct';
```

---

## How to Read Donations in Admin

To query all donation tickets:
```sql
SELECT 
  ct.ticket_number,
  ct.total_price   AS donation_amount,
  ct.created_at,
  c.title          AS campaign_title,
  cu.first_name,
  cu.last_name,
  cu.email,
  o.order_number
FROM campaign_tickets ct
JOIN campaigns c   ON ct.campaign_id = c.id
JOIN customers cu  ON ct.customer_id = cu.id
JOIN orders o      ON ct.order_id = o.id
WHERE ct.source = 'donation'
ORDER BY ct.created_at DESC;
```

---

## Revert / Rollback

To undo the DB changes:
```sql
-- Remove donation_amount column from orders
ALTER TABLE orders DROP COLUMN donation_amount;

-- Revert source ENUM back (removes 'donation' value)
ALTER TABLE campaign_tickets
MODIFY COLUMN source ENUM('purchase', 'direct') DEFAULT 'direct';
```

> ⚠️ Reverting the ENUM will fail if any rows already have `source = 'donation'`. Delete or update those rows first.
