# Donation Feature — Flutter Developer Handoff

**Feature:** Optional donation at checkout  
**API Base URL:** `https://your-api-domain.com/api` (replace with your actual base URL)  
**Auth:** Bearer token in Authorization header

---

## 1. What the Feature Does

When a customer checks out, they can optionally choose to **donate** an extra amount on top of their order total. If they donate:

- The donation amount is added to the order total sent to the backend.
- The backend automatically issues **1 bonus raffle ticket** for the chosen prize campaign.
- The ticket has `source: "donation"` so it's distinguishable from purchased tickets.

---

## 2. API Call — Create Order with Donation

### Endpoint
```
POST /api/orders
Authorization: Bearer <customer_token>
Content-Type: application/json
```

### Request Body (with donation)
```json
{
  "customer_id": 42,
  "items": [
    {
      "product_id": 7,
      "quantity": 1,
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

### Request Body (WITHOUT donation — same as before)
```json
{
  "customer_id": 42,
  "items": [ ... ],
  ...
  // simply omit donation_amount and donation_campaign_id
}
```

### Validation Rules
| Rule | Error message from server |
|---|---|
| `donation_amount` must be **> 1** | `"Donation amount must be greater than 1"` |
| `donation_campaign_id` required if donating | `"donation_campaign_id is required when donating"` |
| Campaign must be active | `"Donation campaign (ID: X) not found or not active"` |

> **Validate on the Flutter side first** before calling the API to give instant feedback.

---

## 3. Success Response
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "id": 101,
    "order_number": "ORD-1709715800000-042",
    "total_amount": 35.00,
    "donation_amount": 5.00,
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

---

## 4. Dart Models

### `DonationInfo`
```dart
class DonationInfo {
  final double amount;
  final int campaignId;
  final bool ticketIssued;

  DonationInfo({
    required this.amount,
    required this.campaignId,
    required this.ticketIssued,
  });

  Map<String, dynamic> toJson() => {
    'donation_amount': amount,
    'donation_campaign_id': campaignId,
  };

  factory DonationInfo.fromJson(Map<String, dynamic> json) => DonationInfo(
    amount: (json['amount'] as num).toDouble(),
    campaignId: json['campaign_id'] as int,
    ticketIssued: json['ticket_issued'] as bool? ?? false,
  );
}
```

### `CampaignTicketEntry` (updated to include source)
```dart
class CampaignTicketEntry {
  final String ticketNumber;
  final int campaignId;
  final String campaignTitle;
  final String? productName;
  final String source; // 'purchase' | 'direct' | 'donation'

  CampaignTicketEntry({
    required this.ticketNumber,
    required this.campaignId,
    required this.campaignTitle,
    this.productName,
    required this.source,
  });

  bool get isDonation => source == 'donation';

  factory CampaignTicketEntry.fromJson(Map<String, dynamic> json) =>
      CampaignTicketEntry(
        ticketNumber: json['ticket_number'] as String,
        campaignId: json['campaign_id'] as int,
        campaignTitle: json['campaign_title'] as String,
        productName: json['product_name'] as String?,
        source: json['source'] as String? ?? 'purchase',
      );
}
```

---

## 5. Service Method

Add this to your existing `OrderService` (or wherever you call the order API):

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class OrderService {
  static const String _baseUrl = 'https://your-api-domain.com/api';

  /// Creates an order. Pass [donation] to include a donation and get a bonus ticket.
  Future<Map<String, dynamic>> createOrder({
    required int customerId,
    required List<Map<String, dynamic>> items,
    required Map<String, dynamic> shippingAddress,
    required String paymentMethod,
    required String paymentTransactionId,
    String paymentStatus = 'paid',
    String? notes,
    DonationInfo? donation, // <-- pass this if user donates
    required String authToken,
  }) async {
    // ── Local validation ─────────────────────────────────────────────────────
    if (donation != null) {
      if (donation.amount <= 1) {
        throw Exception('Donation amount must be greater than 1');
      }
    }

    // ── Build request body ───────────────────────────────────────────────────
    final body = <String, dynamic>{
      'customer_id': customerId,
      'items': items,
      'shipping_address': shippingAddress,
      'payment_method': paymentMethod,
      'payment_transaction_id': paymentTransactionId,
      'payment_status': paymentStatus,
      if (notes != null) 'notes': notes,
      // Only include donation fields if the user actually donated
      if (donation != null) ...donation.toJson(),
    };

    // ── API call ─────────────────────────────────────────────────────────────
    final response = await http.post(
      Uri.parse('$_baseUrl/orders'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $authToken',
      },
      body: jsonEncode(body),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 201 && data['success'] == true) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Failed to create order');
    }
  }
}
```

---

## 6. Suggested UI Flow (Checkout Screen)

```
┌────────────────────────────────────────┐
│         Order Summary                  │
│  Item: Black T-Shirt x1     $30.00     │
│  ─────────────────────────────────     │
│  💛 Would you like to donate?          │
│                                        │
│  [ Toggle: Yes / No ]                  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ Select Prize to Support:         │  │
│  │  ▼ Summer Giveaway               │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Donation Amount:                      │
│  ┌──────────┐                          │
│  │  5.00    │  (must be > 1)           │
│  └──────────┘                          │
│                                        │
│  Subtotal:           $30.00            │
│  Donation:           + $5.00           │
│  ─────────────────────────────────     │
│  Total:              $35.00            │
│                                        │
│  [ Place Order ]                       │
└────────────────────────────────────────┘
```

### Key UI rules:
1. **Toggle is OFF by default** — no donation fields shown.
2. When toggled ON, show:
   - Dropdown to select the active prize/campaign (fetch from `/api/campaigns?status=active`)
   - Amount text field with keyboard type `number`
3. **Validate before submit:**
   - Amount must be a valid number
   - Amount must be **> 1**
   - A campaign must be selected
4. Show real-time updated total = cart total + donation amount

---

## 7. Getting Available Campaigns for Donation Dropdown

```
GET /api/campaigns?status=active
Authorization: Bearer <token>
```

Use the returned list to populate the campaign dropdown. Each item has:
- `id` → use as `donation_campaign_id`
- `title` → display name

```dart
// Example Dart call
Future<List<Map<String, dynamic>>> fetchActiveCampaigns(String authToken) async {
  final response = await http.get(
    Uri.parse('$_baseUrl/campaigns?status=active'),
    headers: {'Authorization': 'Bearer $authToken'},
  );
  final data = jsonDecode(response.body);
  return List<Map<String, dynamic>>.from(data['campaigns']);
}
```

---

## 8. Showing Donation Ticket After Order

After a successful order, check `campaign_entries` for entries where `source == 'donation'`:

```dart
final entries = (orderData['campaign_entries'] as List)
    .map((e) => CampaignTicketEntry.fromJson(e))
    .toList();

final donationTickets = entries.where((e) => e.isDonation).toList();
final purchaseTickets = entries.where((e) => !e.isDonation).toList();

// Show a special "Thank you for donating! 🎁" card
// with donationTickets[0].ticketNumber
```

---

## 9. Error Handling

```dart
try {
  final result = await orderService.createOrder(
    // ... params
    donation: userDonated ? DonationInfo(
      amount: donationAmount,
      campaignId: selectedCampaignId,
      ticketIssued: false,
    ) : null,
    authToken: token,
  );
  // Handle success
} catch (e) {
  // Show error message to user
  showSnackBar(e.toString());
}
```

---

## 10. Checklist for Flutter Dev

- [ ] Add `DonationInfo` model
- [ ] Update `CampaignTicketEntry` model with `source` field and `isDonation` getter
- [ ] Update `createOrder` service method to accept optional `DonationInfo`
- [ ] Add donation UI toggle to checkout screen
- [ ] Fetch active campaigns for dropdown
- [ ] Real-time total calculation (cart + donation)
- [ ] Client-side validation: amount > 1, campaign selected
- [ ] Post-order success screen: show donation ticket separately with a "thank you" card
