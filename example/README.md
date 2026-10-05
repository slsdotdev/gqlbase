# Farmers Market Platform — gqlbase example

This is gqlbase's end-to-end test project. `gqlbase.config.js` generates the schema types, the AppSync schema and resolver types, Zod validators and a dsqlbase schema from `src/schema/`. The resolvers in `src/resolvers/` use that output, and the specs in `test/` call them against an in-memory PGlite database. See [Testing](../docs/internals/testing.md).

```bash
npm run codegen -w example   # generate into example/generated
npm test -w example          # codegen, typecheck, then the specs
```

The schema models a multi-vendor marketplace. The `@access(allow: [...])` directive describes three audiences:

| Audience | Who           | Purpose                                           |
| -------- | ------------- | ------------------------------------------------- |
| `ADMIN`  | Platform ops  | Vendor onboarding, order routing, payouts, config |
| `VENDOR` | Seller staff  | Inventory, fulfillment, earnings, team mgmt       |
| `SHOP`   | End customers | Browse, cart, checkout, orders, reviews           |

`@access`, `@auth` and `@cacheControl` are the schema's own directives. gqlbase passes them through unchanged; nothing prunes on them. Tenancy is gqlbase's `transform.tenancy` with the `@scope` directive (`vendor` and `user` scopes).

---

## File Map

```
src/schema/
├── base.graphql           Scalars, directives, interfaces, shared enums/types
├── users.graphql          Users, addresses, preferences, auth tokens
├── vendors.graphql        Vendors, applications, members, markets, schedules
├── catalog.graphql        Categories, products, variants, inventory, pricing
├── orders.graphql         Cart, orders, vendor-orders, line items, fulfillment
├── payments.graphql       Payment methods, transactions, payouts, refunds, coupons
├── reviews.graphql        Reviews, responses, votes, reports, moderation
├── notifications.graphql  Multi-channel notifications with union payloads
├── search-audit.graphql   Search unions, wishlists, saved search, audit log, config
├── subscriptions.graphql  Real-time subscription events with interface + union
├── ledger.graphql         Custom and 64-bit scalars (Currency, SafeInt)
├── integrations.graphql   A model in another data source (a service, not a table)
└── visibility.graphql     Type-level @serverOnly and @clientOnly
```

---

## Domain Relationships (simplified)

```
User ──┬── Address[]
       ├── UserPreferences
       ├── VendorMember ──── Vendor
       ├── Cart ──── CartItem[] ──── ProductVariant
       ├── Order[]
       ├── Review[]
       ├── Wishlist[] ──── WishlistItem[]
       ├── PaymentMethod[]
       └── Notification[]

Vendor ──┬── VendorApplication
         ├── VendorMember[] ──── User
         ├── Product[] ──┬── ProductVariant[] ──── InventoryRecord
         │               ├── PriceHistoryEntry[]
         │               └── Review[]
         ├── OperatingSchedule[]
         ├── MarketVendorAssignment[] ──── MarketLocation
         ├── VendorOrder[] ──┬── LineItem[]
         │                   └── Fulfillment
         └── VendorPayout[]

Order ──┬── VendorOrder[] (one per vendor in the order)
        ├── PaymentTransaction[]
        ├── OrderTimelineEvent[]
        └── CouponRedemption[]
```

---

## Key Design Decisions

### Multi-Vendor Order Splitting

A single customer `Order` is split into `VendorOrder` groups (one per
vendor). Each `VendorOrder` has its own fulfillment lifecycle, allowing
independent processing. The customer sees a unified order; vendors only
see their slice.

### Monetary Values

All money fields use the `Money` type (`amount: Decimal, currency: Currency`)
— never bare floats. `Decimal` is a string-encoded fixed-precision scalar
to avoid IEEE 754 drift.

### Snapshot Denormalization

`OrderAddress`, `LineItem.productName`, `WishlistItem.productName` etc.
are frozen at write time. Edits to source entities don't retroactively
mutate historical records.

### Soft Deletes & Versioning

Entities implement `SoftDeletable` for logical deletion and `Versioned`
for optimistic concurrency control via integer version vectors.

### Tenancy and Visibility

Vendor-owned and user-owned models are in the `vendor` and `user` tenancy scopes: their `vendorId` / `userId` is a claim, never part of the API ([Tenancy](../docs/guide/tenancy.md)). Field and type visibility uses gqlbase's `@serverOnly`, `@clientOnly`, `@readOnly`, `@writeOnly` and friends ([Field visibility](../docs/guide/field-visibility.md)).

---

## GraphQL Features Used

| Feature           | Usage                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Custom Scalars    | `DateTime`, `Date`, `Decimal`, `URL`, `EmailAddress`, etc.                                                                            |
| Interfaces        | `Node`, `Timestamped`, `Auditable`, `SoftDeletable`, `Versioned`, `SubscriptionEvent`                                                 |
| Unions            | `NotificationPayload`, `SearchResult`, `AuditPayload`, `LiveEvent`, `MediaSubject` (a polymorphic relation target)                    |
| Custom Directives | `@access`, `@auth`, `@cacheControl` (passed through)                                                                                  |
| gqlbase           | `@model`, relations, visibility, `@scope`, `@dataSource`, `@embedded`, `@index`/`@unique`, column defaults, `@computed`, `@constraint` |
| Subscriptions     | Order updates, inventory alerts, platform event firehose                                                                              |
| Enums             | 40+ enums covering statuses, types, roles, permissions                                                                                |
| Input Types       | Dedicated inputs for embedded value objects                                                                                           |
| Documentation     | Description strings on all types, fields, and enum values                                                                             |
