// Products catalog
const products = [
  {
    id: 'tcl-tv',
    name: 'TCL 55" Smart TV',
    desc: '4K UHD Android TV with HDR & voice control',
    image: 'https://images.unsplash.com/photo-1593359677879-a4b92e8c6923?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    desc: 'Latest Apple smartphone · A18 chip · stunning camera',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'macbook',
    name: 'MacBook Air / Pro',
    desc: 'M-series power · lightweight · all-day battery',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'hp-laptop',
    name: 'HP Laptop',
    desc: 'Reliable performance for work, study & entertainment',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'samsung-phone',
    name: 'Samsung Galaxy Phone',
    desc: 'Flagship Android · vibrant display · pro camera',
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'microwave',
    name: 'Microwave Oven',
    desc: 'Fast heating · multiple modes · modern kitchen essential',
    image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'cooker',
    name: 'Electric Cooker / Stove',
    desc: 'Efficient cooking · easy to clean · family size',
    image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'fridge',
    name: 'Refrigerator',
    desc: 'Spacious · energy efficient · keeps food fresh longer',
    image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'airpods',
    name: 'Apple AirPods Pro',
    desc: 'Active noise cancellation · spatial audio · all-day comfort',
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'playstation',
    name: 'PlayStation 5',
    desc: 'Next-gen gaming · ultra-fast SSD · immersive graphics',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'smartwatch',
    name: 'Smart Watch',
    desc: 'Fitness tracking · heart rate · notifications on your wrist',
    image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'speaker',
    name: 'Bluetooth Speaker',
    desc: 'Powerful bass · portable · long battery life',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'ipad',
    name: 'iPad / Tablet',
    desc: 'Crystal clear display · perfect for work, study & streaming',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'washing-machine',
    name: 'Washing Machine',
    desc: 'Front-load · multiple wash programs · energy efficient',
    image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'blender',
    name: 'Blender / Juicer',
    desc: 'Smoothies, juices & more · powerful motor · easy clean',
    image: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=500&h=350&q=80'
  },
  {
    id: 'camera',
    name: 'Digital Camera',
    desc: 'Capture every moment in high quality · great for beginners',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&h=350&q=80'
  }
];

// Backend API base URL – change this when you deploy
// Local: http://localhost:3000
// Production: https://your-api-domain.com
const API_BASE = (window.location.protocol === 'file:' || window.location.origin === 'null')
  ? 'http://localhost:3000'
  : window.location.origin;

// DOM elements
const productGrid = document.getElementById('productGrid');
const selectedPrizeEl = document.getElementById('selectedPrize');
const ticketForm = document.getElementById('ticketForm');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

let selectedProduct = null;

// Render products
function renderProducts() {
  productGrid.innerHTML = products.map(p => `
    <article class="product-card" data-id="${p.id}">
      <img class="product-img" src="${p.image}" alt="${p.name}" loading="lazy"
           onerror="this.src='https://placehold.co/500x350/e2e8f0/64748b?text=${encodeURIComponent(p.name)}'">
      <div class="product-body">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="product-price">
          <span class="ticket-price">30 KSh</span>
          <button class="select-btn" type="button">Select</button>
        </div>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => selectProduct(card.dataset.id));
  });
}

function selectProduct(id) {
  selectedProduct = products.find(p => p.id === id);
  if (!selectedProduct) return;

  // Highlight card
  document.querySelectorAll('.product-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });

  // Update selected prize panel
  selectedPrizeEl.innerHTML = `
    <img src="${selectedProduct.image}" alt="${selectedProduct.name}"
         onerror="this.src='https://placehold.co/80x60/e2e8f0/64748b?text=Prize'">
    <strong>${selectedProduct.name}</strong>
    <span style="font-size:0.9rem;color:var(--muted)">Ticket: 30 KSh</span>
  `;

  ticketForm.style.display = 'block';
  document.getElementById('buy').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Modal helpers
function openModal(html) {
  modalBody.innerHTML = html;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// Form submit — real M-Pesa STK Push via backend
ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedProduct) return;

  let phone = phoneInput.value.replace(/\s+/g, '');
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (!/^[17]\d{8}$/.test(phone)) {
    openModal(`
      <div class="modal-body-icon">⚠️</div>
      <h3>Invalid Number</h3>
      <p>Please enter a valid Kenyan mobile number (e.g. 7XX XXX XXX).</p>
      <button class="btn-primary" onclick="document.getElementById('modalClose').click()">OK</button>
    `);
    return;
  }

  const fullPhone = '+254' + phone;
  const email = emailInput.value.trim();

  // 1. Show checkout initialization state
  openModal(`
    <div class="spinner"></div>
    <h3>Opening secure checkout…</h3>
    <p>Your payment for <strong>30 KSh</strong> is being prepared.</p>
  `);

  try {
    // 2. Initialize the Paystack hosted checkout
    const res = await fetch(`${API_BASE}/api/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,
        email: email,
        productId: selectedProduct.id,
        productName: selectedProduct.name
      })
    });

    const data = await res.json();

    if (!data.success) {
      openModal(`
        <div class="modal-body-icon">⚠️</div>
        <h3>Could not start payment</h3>
        <p>${data.message || 'Please try again.'}</p>
        <button class="btn-primary" onclick="document.getElementById('modalClose').click()">OK</button>
      `);
      return;
    }

    // 3. Paystack redirects back to the callback page after checkout.
    window.location.href = data.authorization_url;

  } catch (err) {
    console.error(err);
    openModal(`
      <div class="modal-body-icon">⚠️</div>
      <h3>Connection error</h3>
      <p>Could not reach the payment server. Make sure the backend is running.</p>
      <button class="btn-primary" onclick="document.getElementById('modalClose').click()">OK</button>
    `);
  }
});

// Poll backend until payment result arrives
function pollPaymentStatus(checkoutId, fullPhone) {
  let attempts = 0;
  const maxAttempts = 40; // ~2 minutes (every 3s)

  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`${API_BASE}/api/status/${checkoutId}`);
      const data = await res.json();

      if (data.status === 'pending') {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          openModal(`
            <div class="modal-body-icon">⌛</div>
            <h3>Still waiting…</h3>
            <p>We have not received confirmation yet. If you paid, please contact support with your M-Pesa message.</p>
            <button class="btn-primary" onclick="document.getElementById('modalClose').click()">OK</button>
          `);
        }
        return; // keep polling
      }

      // Final result received
      clearInterval(interval);
      phoneInput.value = '';

      if (data.status === 'success' && data.won) {
        openModal(`
          <div class="modal-body-icon">🎉</div>
          <h3 style="color:#059669">YOU WON!</h3>
          <p style="font-size:1.15rem;margin:12px 0">You have won the<br><strong>${data.productName}</strong>!</p>
          <p>We will contact you shortly on <strong>${fullPhone}</strong> to arrange delivery or collection.</p>
          <p style="font-size:0.85rem;color:var(--muted)">M-Pesa Receipt: ${data.receipt || '—'}</p>
          <button class="btn-primary" style="margin-top:16px" onclick="document.getElementById('modalClose').click()">Awesome!</button>
        `);
      } else if (data.status === 'success') {
        openModal(`
          <div class="modal-body-icon">😔</div>
          <h3 style="color:#b45309">You did not win this time</h3>
          <p>Payment of <strong>30 KSh</strong> received for<br><strong>${data.productName}</strong>.</p>
          <p>Your ticket was entered into the draw, but this was not a winning ticket.</p>
          <p style="font-size:0.95rem">Try again — every ticket is another chance!</p>
          <p style="font-size:0.85rem;color:var(--muted)">Receipt: ${data.receipt || '—'}</p>
          <button class="btn-primary" style="margin-top:16px" onclick="document.getElementById('modalClose').click()">Buy Another Ticket</button>
        `);
      } else {
        // failed / cancelled
        openModal(`
          <div class="modal-body-icon">❌</div>
          <h3>Payment not completed</h3>
          <p>${data.message || 'The payment was cancelled or timed out.'}</p>
          <button class="btn-primary" onclick="document.getElementById('modalClose').click()">Try Again</button>
        `);
      }
    } catch (err) {
      console.error('Poll error:', err);
      // keep trying until maxAttempts
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        openModal(`
          <div class="modal-body-icon">⚠️</div>
          <h3>Could not confirm payment</h3>
          <p>Please check your M-Pesa messages. If money left your account, contact support.</p>
          <button class="btn-primary" onclick="document.getElementById('modalClose').click()">OK</button>
        `);
      }
    }
  }, 3000);
}

// Init
renderProducts();
