# CLASSYHEELS — Luxury Ecommerce v2

Premium responsive storefront with a production-oriented ecommerce backend scaffold.

## Included
- Luxury responsive homepage and product presentation
- USD pricing ($350–$1,750 positioning)
- Local cart persisted in browser storage
- Checkout page with shipping/customer details
- SQLite database for products, inventory, orders and order items
- Inventory validation at checkout
- Stripe Checkout integration (live card payments once keys are configured)
- Stripe webhook to mark paid orders and decrement inventory
- Protected admin API for orders and inventory updates
- Admin dashboard (`/admin.html`)
- Success/cancel checkout flow

## Run locally
1. Install Node.js 20+.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_TOKEN`, and `BASE_URL`.
4. Run `npm start` and open `http://localhost:3000`.

## Stripe
Create a Stripe account and use Stripe Checkout. Set `STRIPE_SECRET_KEY` to your secret key. Configure the webhook endpoint:
`POST https://YOUR-DOMAIN/api/stripe/webhook`
with event `checkout.session.completed`, then set `STRIPE_WEBHOOK_SECRET`.

Without Stripe keys, checkout still creates a pending order in SQLite as a safe demo mode; it does not charge a card.

## Database
SQLite file `classyheels.sqlite` is created automatically on first start. Back it up before deployment. For a large production operation, migrate the schema to managed PostgreSQL/MySQL and add a proper admin/auth provider.

## Admin
Open `/admin.html` and enter the same `ADMIN_TOKEN` from `.env`. For production, replace this simple token gate with proper authenticated admin users and role-based access.

## Production checklist
- HTTPS + secure cookies
- Strong admin authentication / MFA
- Managed database + automated backups
- Stripe live keys + verified webhook
- Email provider for order confirmations
- Tax/VAT/GST and international shipping rules
- Inventory reservation/locking for high-demand drops
- Privacy/returns/terms pages reviewed for the selling jurisdictions
