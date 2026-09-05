// ============ Config & mock data ============
const GREEN = "#0f7c5f";
const screen = document.getElementById("screen");

let cards = [{ id: 1, last4: "4417", brand: "Visa" }];

// Buyer's own location + nearby sellers
const BUYER_LOC = { lat: -25.7479, lng: 28.2293 };
const SELLERS = [
  { id: 1, name: "Thabo's Spaza", lat: -25.7460, lng: 28.2270, service: "Spaza Shop", rating: 4.7, dist: "220 m", sells: ["Bread", "Milk", "Airtime", "Cold drinks", "Snacks"] },
  { id: 2, name: "Mama Nomsa Kota", lat: -25.7495, lng: 28.2310, service: "Kota & Fast Food", rating: 4.9, dist: "480 m", sells: ["Kota", "Chips", "Russians", "Vetkoek"] },
  { id: 3, name: "Sipho Cuts", lat: -25.7470, lng: 28.2325, service: "Barber", rating: 4.5, dist: "610 m", sells: ["Haircut", "Fade", "Beard trim", "Line-up"] },
  { id: 4, name: "Lerato Salon", lat: -25.7455, lng: 28.2255, service: "Salon & Hair", rating: 4.8, dist: "300 m", sells: ["Braids", "Weave", "Nails", "Wash & blow"] },
  { id: 5, name: "Kagiso Car Wash", lat: -25.7500, lng: 28.2280, service: "Car Wash", rating: 4.3, dist: "540 m", sells: ["Full wash", "Wax", "Interior valet"] },
];

const PURCHASES = [
  { id: 1, seller: "Thabo's Spaza", where: "Block C, Soshanguve", amount: 45, time: "14:22", cat: "Spaza" },
  { id: 2, seller: "Mama Nomsa Kota", where: "Main Rd", amount: 35, time: "13:05", cat: "Food" },
  { id: 3, seller: "Sipho Cuts", where: "Ext 4", amount: 60, time: "Yesterday", cat: "Grooming" },
  { id: 4, seller: "Lerato Salon", where: "Block H", amount: 150, time: "Yesterday", cat: "Grooming" },
  { id: 5, seller: "Thabo's Spaza", where: "Block C, Soshanguve", amount: 22, time: "2 days ago", cat: "Spaza" },
  { id: 6, seller: "Kagiso Car Wash", where: "Station St", amount: 80, time: "3 days ago", cat: "Services" },
];

const SPEND_WEEK = [
  { day: "Mon", total: 65 }, { day: "Tue", total: 45 }, { day: "Wed", total: 120 },
  { day: "Thu", total: 30 }, { day: "Fri", total: 210 }, { day: "Sat", total: 175 },
  { day: "Sun", total: 40 },
];
const CATEGORIES = [
  { name: "Food", pct: 40, amount: 320 },
  { name: "Spaza", pct: 28, amount: 224 },
  { name: "Grooming", pct: 20, amount: 160 },
  { name: "Services", pct: 12, amount: 96 },
];
const FAV_SELLERS = [
  { name: "Thabo's Spaza", visits: 12 },
  { name: "Mama Nomsa Kota", visits: 8 },
  { name: "Lerato Salon", visits: 3 },
];

let CHAT = {}; // per-seller message threads

// ============ Nav ============
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.tab);
  });
});

function render(tab) {
  if (tab === "wallet") renderWallet();
  else if (tab === "activity") renderActivity();
  else if (tab === "analytics") renderAnalytics();
  else if (tab === "map") renderMap();
}

// ============ 1. WALLET + SCAN ============
function renderWallet() {
  screen.innerHTML = `
    <div class="pad">
      <div class="header-row">
        <h1 class="h1">Wallet</h1>
        <button class="plus-btn" id="addCardBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
      <div class="card-stack" id="cardStack"></div>
      <button class="scan-btn" id="scanBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="22" height="22"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M3 12h18"/></svg>
        Scan to pay
      </button>
    </div>`;

  renderCards();
  document.getElementById("addCardBtn").addEventListener("click", openAddCard);
  document.getElementById("scanBtn").addEventListener("click", renderScan);
}

function renderCards() {
  const host = document.getElementById("cardStack");
  host.innerHTML = cards.map((c) => `
    <div class="credit-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" width="22" height="22"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      <div class="cc-num">•••• •••• •••• ${c.last4}</div>
      <div class="cc-brand">${c.brand}</div>
    </div>`).join("");
}

function renderScan() {
  screen.innerHTML = `
    <div class="scan-wrap">
      <button class="scan-cancel" id="scanCancel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 6 6 18M6 6l12 12"/></svg> Cancel
      </button>
      <div class="scan-frame scan-corners"><span></span><div class="scan-line"></div></div>
      <p class="scan-status" id="scanStatus">Point at the seller's QR code…</p>
    </div>`;

  document.getElementById("scanCancel").addEventListener("click", renderWallet);

  // simulate detecting + scanning a QR
  const status = document.getElementById("scanStatus");
  setTimeout(() => { status.textContent = "QR detected — reading…"; }, 1400);
  setTimeout(() => { status.textContent = "Verifying payment…"; }, 2600);
  setTimeout(() => { renderSuccess("Mama Nomsa Kota", 35); }, 3600);
}

function renderSuccess(sellerName, amt) {
  screen.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="40" height="40"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <div class="success-amount">R ${amt.toFixed(2)}</div>
      <div class="success-to">Paid to ${sellerName}</div>
      <button class="scan-btn" id="doneBtn" style="max-width:260px">Done</button>
    </div>`;
  document.getElementById("doneBtn").addEventListener("click", renderWallet);
}

function openAddCard() {
  const div = document.createElement("div");
  div.className = "overlay";
  div.innerHTML = `
    <div class="sheet">
      <div class="handle"></div>
      <button class="sheet-close" id="sheetClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <h2 class="sheet-title">Add card</h2>
      <label class="field-label">Card number</label>
      <input class="input" id="cardNum" inputmode="numeric" placeholder="1234 5678 9012 3456" />
      <div class="row">
        <div style="flex:1"><label class="field-label">Expiry</label><input class="input" placeholder="MM/YY" /></div>
        <div style="flex:1"><label class="field-label">CVV</label><input class="input" inputmode="numeric" maxlength="3" placeholder="123" /></div>
      </div>
      <button class="primary-btn" id="saveCard" style="margin-top:18px" disabled>Add card</button>
    </div>`;
  document.getElementById("app").appendChild(div);

  const numEl = div.querySelector("#cardNum");
  const saveBtn = div.querySelector("#saveCard");
  numEl.addEventListener("input", () => {
    const digits = numEl.value.replace(/\D/g, "").slice(0, 16);
    numEl.value = digits.replace(/(.{4})/g, "$1 ").trim();
    saveBtn.disabled = digits.length < 4;
  });
  saveBtn.addEventListener("click", () => {
    const last4 = numEl.value.replace(/\s/g, "").slice(-4);
    cards.push({ id: Date.now(), last4, brand: "Card" });
    div.remove();
    renderCards();
  });
  div.querySelector("#sheetClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

// ============ 2. ACTIVITY ============
function renderActivity() {
  const total = PURCHASES.reduce((a, p) => a + p.amount, 0);
  screen.innerHTML = `
    <div class="pad">
      <h1 class="h1">Activity</h1>
      <div class="summary-card">
        <div>
          <div class="summary-label">Spent recently</div>
          <div class="summary-value">R ${total.toFixed(2)}</div>
        </div>
        <div class="summary-count">${PURCHASES.length} purchases</div>
      </div>
      <div class="tx-list">
        ${PURCHASES.map((p) => `
          <div class="tx">
            <div class="tx-avatar">${p.seller[0]}</div>
            <div style="flex:1">
              <div class="tx-name">${p.seller}</div>
              <div class="tx-time">${p.where} · ${p.time}</div>
            </div>
            <div class="tx-amount">-R ${p.amount.toFixed(2)}</div>
          </div>`).join("")}
      </div>
    </div>`;
}

// ============ 3. ANALYTICS ============
function renderAnalytics() {
  const total = CATEGORIES.reduce((a, c) => a + c.amount, 0);
  const topCat = CATEGORIES[0];
  const busiest = SPEND_WEEK.reduce((a, b) => (b.total > a.total ? b : a));
  screen.innerHTML = `
    <div class="pad">
      <h1 class="h1">Analytics</h1>
      <div class="stat-row">
        <div class="stat"><div class="stat-label">Top category</div><div class="stat-value">${topCat.name}</div><div class="stat-sub">R${topCat.amount}</div></div>
        <div class="stat"><div class="stat-label">Busiest day</div><div class="stat-value">${busiest.day}</div><div class="stat-sub">R${busiest.total}</div></div>
      </div>

      <div class="chart-card"><div class="chart-title">Spending this week</div><canvas id="spendChart"></canvas></div>

      <div class="chart-card">
        <div class="chart-title">Where your money goes</div>
        ${CATEGORIES.map((c) => `
          <div class="cat-row">
            <span class="cat-name">${c.name}</span>
            <span class="cat-track"><span class="cat-fill" style="width:${c.pct}%"></span></span>
            <span class="cat-val">R${c.amount}</span>
          </div>`).join("")}
      </div>

      <div class="chart-card">
        <div class="chart-title">Favourite sellers</div>
        <div class="top-list">
          ${FAV_SELLERS.map((s, i) => `
            <div class="top-row"><span class="top-rank">${i + 1}</span><span style="flex:1">${s.name}</span><span class="top-spend">${s.visits} visits</span></div>`).join("")}
        </div>
      </div>
    </div>`;

  new Chart(document.getElementById("spendChart"), {
    type: "line",
    data: {
      labels: SPEND_WEEK.map((w) => w.day),
      datasets: [{
        data: SPEND_WEEK.map((w) => w.total),
        borderColor: GREEN, backgroundColor: "rgba(15,124,95,0.1)", borderWidth: 2.5,
        pointRadius: 3, tension: 0.35, fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11 } } },
        y: { grid: { color: "#eef0f2" }, ticks: { color: "#6b7280", font: { size: 11 } }, beginAtZero: true },
      },
    },
  });
}

// ============ 4. SELLERS MAP ============
function renderMap() {
  screen.innerHTML = `
    <div class="map-wrap">
      <div id="map"></div>
      <div class="map-overlay-top">
        <div class="map-title">Sellers near you</div>
        <div class="map-sub">Tap a stall to see what they sell</div>
      </div>
    </div>`;
  initGoogleMap();
}

function initGoogleMap() {
  const el = document.getElementById("map");
  if (!(window.google && window.google.maps)) {
    el.parentElement.insertAdjacentHTML("beforeend",
      `<div class="map-error">Map couldn't load. Check that the Maps JavaScript API is enabled, billing is on, and this domain is allowed for your API key.</div>`);
    return;
  }
  const map = new google.maps.Map(el, {
    center: BUYER_LOC, zoom: 16, mapTypeId: "satellite",
    disableDefaultUI: true, gestureHandling: "greedy",
  });

  // buyer location (blue dot)
  new google.maps.Marker({
    position: BUYER_LOC, map, title: "You",
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
  });

  // Stall icon (green pin with a shop/stall glyph)
  const stallIcon = {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
        <defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
        </filter></defs>
        <path filter="url(#sh)" d="M22 2C12 2 4 9.6 4 19c0 11.5 14 26 17 29a1.4 1.4 0 0 0 2 0c3-3 17-17.5 17-29C40 9.6 32 2 22 2z" fill="#0f7c5f" stroke="#ffffff" stroke-width="2.5"/>
        <g transform="translate(11,10)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
          <path d="M1 6 L3 1 H19 L21 6 Z"/>
          <path d="M2 6 v10 h18 V6"/>
          <path d="M1 6 a2.5 2.5 0 0 0 5 0 a2.5 2.5 0 0 0 5 0 a2.5 2.5 0 0 0 5 0 a2.5 2.5 0 0 0 5 0"/>
        </g>
      </svg>`),
    scaledSize: new google.maps.Size(44, 54),
    anchor: new google.maps.Point(22, 52),
  };

  // clickable seller stalls
  SELLERS.forEach((s) => {
    const marker = new google.maps.Marker({
      position: { lat: s.lat, lng: s.lng }, map, title: s.name, icon: stallIcon,
    });
    marker.addListener("click", () => showSellerCard(s));
  });
}

function showSellerCard(s) {
  document.querySelector(".seller-card")?.remove();
  const wrap = document.querySelector(".map-wrap");
  const card = document.createElement("div");
  card.className = "seller-card";
  card.innerHTML = `
    <button class="seller-card-close" id="scClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="seller-name">${s.name}</div>
    <div class="seller-meta">${s.service} · ★ ${s.rating} · ${s.dist} away</div>
    <div class="seller-tags">${s.sells.map((x) => `<span class="seller-tag">${x}</span>`).join("")}</div>
    <div class="seller-actions">
      <button class="btn-chat" id="scChat">Ask about stock</button>
      <button class="btn-directions" id="scDir">Directions</button>
    </div>`;
  wrap.appendChild(card);
  card.querySelector("#scClose").addEventListener("click", () => card.remove());
  card.querySelector("#scChat").addEventListener("click", () => openChat(s));
  card.querySelector("#scDir").addEventListener("click", () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, "_blank");
  });
}

function openChat(seller) {
  if (!CHAT[seller.id]) {
    CHAT[seller.id] = [
      { from: "them", text: `Hi! This is ${seller.name}. How can I help?`, time: "now" },
    ];
  }
  const div = document.createElement("div");
  div.className = "overlay";
  div.innerHTML = `
    <div class="sheet" style="height:70%;display:flex;flex-direction:column">
      <div class="handle"></div>
      <button class="sheet-close" id="chatClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <h2 class="sheet-title">${seller.name}</h2>
      <div class="chat-list" id="chatList"></div>
      <div class="chat-input-row">
        <input class="chat-input" id="chatInput" placeholder="Ask if they have stock…" />
        <button class="send-btn" id="sendBtn"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="18" height="18"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>
      </div>
    </div>`;
  document.getElementById("app").appendChild(div);

  const list = div.querySelector("#chatList");
  const input = div.querySelector("#chatInput");
  const paint = () => {
    list.innerHTML = CHAT[seller.id].map((m) => `
      <div class="bubble ${m.from === "me" ? "bubble-me" : "bubble-them"}">${m.text}<span class="bubble-time">${m.time}</span></div>`).join("");
    list.scrollTop = list.scrollHeight;
  };
  paint();

  const send = () => {
    const t = input.value.trim();
    if (!t) return;
    CHAT[seller.id].push({ id: Date.now(), from: "me", text: t, time: "now" });
    input.value = "";
    paint();
    // mock seller auto-reply
    setTimeout(() => {
      CHAT[seller.id].push({ from: "them", text: "Yes, we have that in stock 👍", time: "now" });
      paint();
    }, 1200);
  };
  div.querySelector("#sendBtn").addEventListener("click", send);
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());
  div.querySelector("#chatClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

// ============ Start ============
render("wallet");