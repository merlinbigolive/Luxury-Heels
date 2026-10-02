const products=[
{id:1,name:'The Aurelia',price_cents:89500,meta:'Patent leather · Crystal embellishment',image:'assets/product-aurelia.jpg',badge:'NEW SEASON'},
{id:2,name:'The Vérilyn',price_cents:129000,meta:'Satin · Handcrafted bow',image:'assets/product-verilyn.jpg',badge:'BACK IN STOCK'},
{id:3,name:'The Isadora',price_cents:79500,meta:'Metallic leather · Sculpted heel',image:'assets/product-isadora.jpg',badge:'NEW SEASON'},
{id:4,name:'The Celeste',price_cents:115000,meta:'Suede · Gold detail',image:'assets/product-celeste.jpg',badge:'LIMITED EDITION'},
{id:5,name:'The Seraphine',price_cents:149000,meta:'Embroidered mesh · Pearl detail',image:'assets/product-seraphine.jpg',badge:'PRIVATE RESERVE'},
{id:6,name:'The Elara',price_cents:67500,meta:'Satin · Fine crystal trim',image:'assets/collection-essential.jpg',badge:'BACK IN STOCK'},
{id:7,name:'The Valentina',price_cents:109500,meta:'Patent leather · Sculpted heel',image:'assets/collection-signature.jpg',badge:'NEW SEASON'},
{id:8,name:'The Amara',price_cents:125000,meta:'Silk satin · Hand-finished bow',image:'assets/collection-icon.jpg',badge:'NEW SEASON'},
{id:9,name:'The Aureline',price_cents:149500,meta:'Lace · Crystal ornament',image:'assets/collection-reserve.jpg',badge:'PRIVATE RESERVE'},
{id:10,name:'The Celine',price_cents:54500,meta:'Leather · Minimal pump',image:'assets/product-aurelia.jpg',badge:'ESSENTIAL EDIT'},
{id:11,name:'The Vivienne',price_cents:87500,meta:'Satin · Pearl detail',image:'assets/product-verilyn.jpg',badge:'NEW SEASON'},
{id:12,name:'The Solène',price_cents:119500,meta:'Metallic leather · Fine heel',image:'assets/product-isadora.jpg',badge:'LIMITED EDITION'}
];
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(c/100);
let bag=JSON.parse(localStorage.getItem('classyheels-bag')||'[]');
const grid=document.querySelector('#productGrid');
products.forEach((p,i)=>grid.insertAdjacentHTML('beforeend',`<article class="product"><div class="productImage"><img src="${p.image}" alt="${p.name}"><span class="badge">${p.badge}</span><button class="wish">♡</button></div><h3>${p.name}</h3><div class="price">${money(p.price_cents)}</div><div class="meta">${p.meta}</div><button class="add" data-i="${i}">ADD TO BAG</button></article>`));
function save(){localStorage.setItem('classyheels-bag',JSON.stringify(bag));}
function render(){document.querySelector('#cartCount').textContent=bag.reduce((n,x)=>n+x.quantity,0);document.querySelector('#cartItems').innerHTML=bag.length?bag.map((p,i)=>`<div class="cartRow"><div><b>${p.name}</b><small>${money(p.price_cents)} · Qty ${p.quantity}</small></div><button onclick="bag.splice(${i},1);save();render()">Remove</button></div>`).join(''):'Your bag is empty.';}
function openCart(){document.querySelector('#cart').classList.add('open');document.querySelector('#overlay').classList.add('show')}
function closeCart(){document.querySelector('#cart').classList.remove('open');document.querySelector('#overlay').classList.remove('show')}
document.addEventListener('click',e=>{if(e.target.matches('.add')){const p=products[+e.target.dataset.i],existing=bag.find(x=>x.id===p.id);existing?existing.quantity++:bag.push({...p,quantity:1});save();render();openCart()}if(e.target.matches('.filterBtn'))document.querySelector('#filterPanel').classList.toggle('open')});
document.querySelector('#cartBtn').onclick=openCart;document.querySelector('#close').onclick=closeCart;document.querySelector('#overlay').onclick=closeCart;document.querySelector('#menu').onclick=()=>document.querySelector('#mobileNav').classList.toggle('open');document.querySelector('.checkout').onclick=()=>{if(bag.length)location.href='/checkout.html'};render();
