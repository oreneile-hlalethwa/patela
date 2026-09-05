import { supabase } from "../shared/supabaseClient.js";

// ============ Auth Guard (Option 1: Strict Role Separation) ============
let currentUser = null;

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../login/login.html";
    return;
  }

  const role = session.user.user_metadata?.role;
  if (role !== "buyer") {
    alert("Access restricted: You must log in with a Buyer account.");
    window.location.href = "../seller/seller.html";
    return;
  }

  currentUser = session.user;
  document.getElementById("logoutBtn")?.addEventListener("click", handleSignOut);

  render("wallet");
}

async function handleSignOut() {
  stopScanner();
  await supabase.auth.signOut();
  window.location.href = "../login/login.html";
}

// ============ Config & Mock Data ============
const GREEN = "#0f7c5f";
const screen = document.getElementById("screen");

let cards = [];

const BUYER_LOC = { lat: -25.7479, lng: 28.2293 };
const SELLERS = [
  { id: 1, name: "Thabo's Spaza", lat: -25.7460, lng: 28.2270, service: "Spaza Shop", rating: 4.7, dist: "220 m", sells: ["Bread", "Milk", "Airtime", "Cold drinks", "Snacks"] },
  { id: 2, name: "Mama Nomsa Kota", lat: -25.7495, lng: 28.2310, service: "Kota & Fast Food", rating: 4.9, dist: "480 m", sells: ["Kota", "Chips", "Russians", "Vetkoek"] },
  { id: 3, name: "Sipho Cuts", lat: -25.7470, lng: 28.2325, service: "Barber", rating: 4.5, dist: "610 m", sells: ["Haircut", "Fade", "Beard trim", "Line-up"] },
  { id: 4, name: "Lerato Salon", lat: -25.7455, lng: 28.2255, service: "Salon & Hair", rating: 4.8, dist: "300 m", sells: ["Braids", "Weave", "Nails", "Wash & blow"] },
  { id: 5, name: "Kagiso Car Wash", lat: -25.7500, lng: 28.2280, service: "Car Wash", rating: 4.3, dist: "540 m", sells: ["Full wash", "Wax", "Interior valet"] },
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

let CHAT = {};

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
  const buyerName = currentUser?.user_metadata?.name || "Buyer";
  screen.innerHTML = `
    <div class="pad">
      <div class="header-row">
        <div>
          <h1 class="h1">Wallet</h1>
          <p style="font-size:12px; color:#868b92; margin:0;">Hi, ${buyerName}</p>
        </div>
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
  loadCards();
  document.getElementById("addCardBtn").addEventListener("click", openAddCard);
  document.getElementById("scanBtn").addEventListener("click", renderScan);
}

function renderCards() {
  const host = document.getElementById("cardStack");
  if (!host) return;
  host.innerHTML = cards.map((c) => `
    <div class="credit-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" width="22" height="22"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      <div class="cc-num">•••• •••• •••• ${c.last4}</div>
      <div class="cc-brand">${c.brand}</div>
    </div>`).join("");
}

async function loadCards() {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  cards = data || [];
  renderCards();
}

let qrScanner = null;

function playPaymentSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch (e) { /* silent */ }
}

function renderScan() {
  screen.innerHTML = `
    <div class="scan-wrap">
      <button class="scan-cancel" id="scanCancel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 6 6 18M6 6l12 12"/></svg> Cancel
      </button>
      <div class="scan-frame scan-corners">
        <span></span>
        <div id="reader" style="width:100%;height:100%;"></div>
        <div class="scan-line"></div>
      </div>
      <p class="scan-status" id="scanStatus">Point at the seller's QR code…</p>
    </div>`;

  document.getElementById("scanCancel").addEventListener("click", () => {
    stopScanner();
    renderWallet();
  });

  startScanner();
}

function startScanner() {
  if (typeof Html5Qrcode === "undefined") {
    document.getElementById("scanStatus").textContent = "Scanner not loaded. Refresh the page.";
    return;
  }
  qrScanner = new Html5Qrcode("reader");
  qrScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 200, height: 200 } },
      (decodedText) => {
        stopScanner();
        handleScannedCode(decodedText.trim());
      },
      () => { /* frame scan listener */ }
    )
    .catch((err) => {
      document.getElementById("scanStatus").textContent = "Cannot open camera. Allow camera access.";
      console.error(err);
    });
}

function stopScanner() {
  if (qrScanner) {
    qrScanner.stop().then(() => qrScanner.clear()).catch(() => {});
    qrScanner = null;
  }
}

async function handleScannedCode(code) {
  const status = document.getElementById("scanStatus");
  if (status) status.textContent = "Reading payment…";

  // Validate transaction UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(code)) {
    alert("That QR code isn't a valid Patela payment transaction.");
    renderWallet();
    return;
  }

  const { data: tx, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", code)
    .single();

  if (error || !tx) {
    alert("Payment not found. Ask the seller to show the QR again.");
    renderWallet();
    return;
  }

  if (tx.status === "paid") {
    alert("This payment was already completed.");
    renderWallet();
    return;
  }

  playPaymentSound();
  renderConfirm(tx);
}

function renderConfirm(tx) {
  screen.innerHTML = `
    <div class="success-wrap">
      <div class="success-to" style="margin-bottom:6px">Paying</div>
      <div class="seller-name" style="font-size:22px;font-weight:800">${tx.seller_name || "Seller"}</div>
      <div class="success-amount" style="margin-top:18px">R ${parseFloat(tx.amount).toFixed(2)}</div>
      <div style="display:flex;gap:12px;margin-top:30px;width:100%;max-width:300px">
        <button class="btn-directions" id="cancelPay" style="flex:1;padding:14px;border-radius:12px;border:1px solid #ededf0;background:#f6f6f7;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>
        <button class="scan-btn" id="confirmPay" style="flex:1">Confirm</button>
      </div>
    </div>`;

  document.getElementById("cancelPay").addEventListener("click", renderWallet);
  document.getElementById("confirmPay").addEventListener("click", () => payNow(tx));
}

async function payNow(tx) {
  const btn = document.getElementById("confirmPay");
  btn.disabled = true;
  btn.textContent = "Paying…";

  const buyerName = currentUser?.user_metadata?.name || "Buyer";

  // Atomically mark the transaction as paid with buyer credentials
  const { error } = await supabase
    .from("transactions")
    .update({ status: "paid", buyer_name: buyerName, buyer_id: currentUser.id })
    .eq("id", tx.id);

  if (error) {
    alert("Payment failed. Try again.");
    console.error(error);
    renderWallet();
    return;
  }

  renderApproved(tx);
}

function renderApproved(tx) {
  screen.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="40" height="40"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <div class="success-amount">R ${parseFloat(tx.amount).toFixed(2)}</div>
      <div class="success-to">Payment approved · ${tx.seller_name || "Seller"}</div>
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
        <div style="flex:1">
          <label class="field-label">Expiry</label>
          <div class="expiry-row">
            <input class="input expiry-mm" id="expMM" inputmode="numeric" maxlength="2" placeholder="MM" />
            <span class="expiry-slash">/</span>
            <input class="input expiry-yy" id="expYY" inputmode="numeric" maxlength="2" placeholder="YY" />
          </div>
        </div>
        <div style="flex:1"><label class="field-label">CVV</label><input class="input" id="cvv" inputmode="numeric" maxlength="3" placeholder="123" /></div>
      </div>
      <button class="primary-btn" id="saveCard" style="margin-top:18px" disabled>Add card</button>
    </div>`;
  document.getElementById("app").appendChild(div);

  const numEl = div.querySelector("#cardNum");
  const mmEl = div.querySelector("#expMM");
  const yyEl = div.querySelector("#expYY");
  const saveBtn = div.querySelector("#saveCard");

  numEl.addEventListener("input", () => {
    const digits = numEl.value.replace(/\D/g, "").slice(0, 16);
    numEl.value = digits.replace(/(.{4})/g, "$1 ").trim();
    saveBtn.disabled = digits.length < 4;
  });

  mmEl.addEventListener("input", () => {
    mmEl.value = mmEl.value.replace(/\D/g, "").slice(0, 2);
    if (mmEl.value.length === 2) yyEl.focus();
  });
  yyEl.addEventListener("input", () => {
    yyEl.value = yyEl.value.replace(/\D/g, "").slice(0, 2);
  });
  yyEl.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && yyEl.value === "") mmEl.focus();
  });

  saveBtn.addEventListener("click", async () => {
    const last4 = numEl.value.replace(/\s/g, "").slice(-4);
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const { data, error } = await supabase
      .from("cards")
      .insert({ user_id: currentUser.id, last4, brand: "Visa" })
      .select()
      .single();

    if (error) {
      saveBtn.textContent = "Failed — try again";
      saveBtn.disabled = false;
      console.error(error);
      return;
    }

    cards.push(data);
    div.remove();
    renderCards();
  });

  div.querySelector("#sheetClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

// ============ 2. ACTIVITY ============
async function renderActivity() {
  screen.innerHTML = `
    <div class="pad">
      <h1 class="h1">Activity</h1>
      <div id="activityBody"><p style="color:#868b92">Loading…</p></div>
    </div>`;

  const { data: purchases, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("buyer_id", currentUser.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  const body = document.getElementById("activityBody");

  if (error) {
    body.innerHTML = `<p style="color:#868b92">Couldn't load activity.</p>`;
    console.error(error);
    return;
  }

  const list = purchases || [];
  const total = list.reduce((a, p) => a + Number(p.amount), 0);

  body.innerHTML = `
    <div class="summary-card">
      <div>
        <div class="summary-label">Spent recently</div>
        <div class="summary-value">R ${total.toFixed(2)}</div>
      </div>
      <div class="summary-count">${list.length} purchases</div>
    </div>
    <div class="tx-list">
      ${list.length === 0 ? `<p style="color:#868b92">No purchases yet.</p>` : list.map((p) => {
        const seller = p.seller_name || "Seller";
        const time = new Date(p.created_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        return `
          <div class="tx">
            <div class="tx-avatar">${seller[0]}</div>
            <div style="flex:1">
              <div class="tx-name">${seller}</div>
              <div class="tx-time">${time}</div>
            </div>
            <div class="tx-amount">-R ${Number(p.amount).toFixed(2)}</div>
          </div>`;
      }).join("")}
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

  new google.maps.Marker({
    position: BUYER_LOC, map, title: "You",
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
  });

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

// Start session check
checkSession();