import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const db = new Database(path.join(__dirname, 'classyheels.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 description TEXT NOT NULL, price_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'usd',
 inventory INTEGER NOT NULL DEFAULT 0, image_class TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, stripe_session_id TEXT UNIQUE, status TEXT NOT NULL,
 customer_email TEXT, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL, shipping_json TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
 name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(product_id) REFERENCES products(id)
);`);

const seed = [
 ['the-aurelia','The Aurelia','Patent leather pump with crystal embellishment.',89500,'black',12],
 ['the-verilyn','The Vérilyn','Satin silhouette with a handcrafted bow.',129000,'blush',7],
 ['the-isadora','The Isadora','Metallic leather sculpted heel.',79500,'gold',18],
 ['the-celeste','The Celeste','Suede statement pump with gold detail.',115000,'black',5],
 ['the-seraphine','The Seraphine','Embroidered mesh with pearl detail.',149000,'bridal',3]
];
const insert = db.prepare('INSERT OR IGNORE INTO products (slug,name,description,price_cents,image_class,inventory) VALUES (?,?,?,?,?,?)');
for (const p of seed) insert.run(...p);

const stripe = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('REPLACE') ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Stripe webhook must receive the raw body before express.json().
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req,res)=>{
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook not configured');
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const order = db.prepare('SELECT id FROM orders WHERE stripe_session_id=?').get(session.id);
    if (order) {
      db.prepare('UPDATE orders SET status=?, customer_email=? WHERE id=?').run('paid', session.customer_details?.email || null, order.id);
      const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id=?').all(order.id);
      const reduce = db.prepare('UPDATE products SET inventory=MAX(inventory-?,0) WHERE id=?');
      const tx = db.transaction(rows => rows.forEach(x=>reduce.run(x.quantity,x.product_id)));
      tx(items);
    }
  }
  res.json({received:true});
});
app.use(express.json({limit:'1mb'}));
app.use(express.static(__dirname));

app.get('/api/products', (req,res)=>{
  const rows = db.prepare('SELECT id,slug,name,description,price_cents,currency,inventory,image_class FROM products WHERE active=1 ORDER BY id').all();
  res.json(rows);
});

app.get('/api/products/:slug', (req,res)=>{
  const p=db.prepare('SELECT id,slug,name,description,price_cents,currency,inventory,image_class FROM products WHERE slug=? AND active=1').get(req.params.slug);
  if(!p) return res.status(404).json({error:'Product not found'}); res.json(p);
});

app.post('/api/checkout', async (req,res)=>{
  try {
    const {items, shipping} = req.body;
    if(!Array.isArray(items) || !items.length) return res.status(400).json({error:'Your bag is empty.'});
    if(!shipping?.email) return res.status(400).json({error:'Email is required.'});
    const ids = items.map(x=>Number(x.id)).filter(Boolean);
    const products = db.prepare(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')}) AND active=1`).all(...ids);
    const byId = new Map(products.map(p=>[p.id,p]));
    const clean=[];
    for(const item of items){
      const p=byId.get(Number(item.id)); const qty=Math.max(1,Math.min(10,Number(item.quantity)||1));
      if(!p) return res.status(400).json({error:'A selected product is unavailable.'});
      if(p.inventory < qty) return res.status(409).json({error:`${p.name} has only ${p.inventory} left.`});
      clean.push({p,qty});
    }
    const amount = clean.reduce((s,x)=>s+x.p.price_cents*x.qty,0);
    const orderResult = db.prepare('INSERT INTO orders (status,customer_email,amount_cents,currency,shipping_json) VALUES (?,?,?,?,?)').run('pending',shipping.email,amount,process.env.CURRENCY||'usd',JSON.stringify(shipping));
    const orderId=orderResult.lastInsertRowid;
    const addItem=db.prepare('INSERT INTO order_items (order_id,product_id,name,quantity,unit_price_cents) VALUES (?,?,?,?,?)');
    const tx=db.transaction(rows=>rows.forEach(x=>addItem.run(orderId,x.p.id,x.p.name,x.qty,x.p.price_cents))); tx(clean);

    if(!stripe){
      return res.json({mode:'demo',orderId,message:'Checkout is connected to the order database. Add Stripe keys in .env to enable live card payments.'});
    }
    const session = await stripe.checkout.sessions.create({
      mode:'payment', customer_email:shipping.email,
      line_items: clean.map(x=>({price_data:{currency:process.env.CURRENCY||'usd',product_data:{name:x.p.name,description:x.p.description},unit_amount:x.p.price_cents},quantity:x.qty})),
      shipping_address_collection:{allowed_countries:['US','GB','AE','IN','FR','IT','DE','SG','AU','CA']},
      success_url:`${process.env.BASE_URL||'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${process.env.BASE_URL||'http://localhost:3000'}/checkout.html?cancelled=1`,
      metadata:{order_id:String(orderId)}
    });
    db.prepare('UPDATE orders SET stripe_session_id=? WHERE id=?').run(session.id,orderId);
    res.json({mode:'stripe',url:session.url});
  } catch(err){ console.error(err); res.status(500).json({error:'Unable to create checkout.'}); }
});

function admin(req,res,next){ if(!process.env.ADMIN_TOKEN || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) return res.status(401).json({error:'Unauthorized'}); next(); }
app.get('/api/admin/orders',admin,(req,res)=>res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 100').all()));
app.patch('/api/admin/products/:id',admin,(req,res)=>{
  const {inventory,price_cents,active}=req.body; const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id); if(!p) return res.status(404).json({error:'Not found'});
  db.prepare('UPDATE products SET inventory=COALESCE(?,inventory), price_cents=COALESCE(?,price_cents), active=COALESCE(?,active) WHERE id=?').run(inventory,price_cents,active,req.params.id);
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id));
});

app.get('/checkout.html',(req,res)=>res.sendFile(path.join(__dirname,'checkout.html')));
app.get('/success.html',(req,res)=>res.sendFile(path.join(__dirname,'success.html')));
app.listen(port,()=>console.log(`ClassyHeels running at http://localhost:${port}`));
