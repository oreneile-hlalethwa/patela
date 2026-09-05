import { supabase } from "../shared/supabaseClient.js";

// ============ Auth Guard ============
let currentUser = null;
let ACCOUNT_CODE = "PTL-4827-9931";

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../login/login.html";
    return;
  }

  // Strict enforcement: Ensure logged-in user is a seller
  const role = session.user.user_metadata?.role;
  if (role !== "seller") {
    alert("Access restricted: You must log in with a Seller account.");
    window.location.href = "../buyer/buyer.html";
    return;
  }

  currentUser = session.user;
  ACCOUNT_CODE = `PTL-${currentUser.id.substring(0, 4).toUpperCase()}-${currentUser.id.substring(currentUser.id.length - 4).toUpperCase()}`;

  document.getElementById("logoutBtn")?.addEventListener("click", handleSignOut);

  render("wallet");
}

async function handleSignOut() {
  await supabase.auth.signOut();
  window.location.href = "../login/login.html";
}

// ============ Config & mock data ============
const SELLER_LOC = { lat: -25.7479, lng: 28.2293 };
const CUSTOMER_POINTS = [
  { lat: -25.7460, lng: 28.2270, weight: 5 },
  { lat: -25.7495, lng: 28.2310, weight: 4 },
  { lat: -25.7470, lng: 28.2325, weight: 3 },
  { lat: -25.7455, lng: 28.2255, weight: 5 },
  { lat: -25.7500, lng: 28.2280, weight: 2 },
  { lat: -25.7485, lng: 28.2260, weight: 4 },
  { lat: -25.7465, lng: 28.2300, weight: 3 },
];

let cards = [];

const TODAY_PAYMENTS = [
  { id: 1, name: "Thabo M.", amount: 45, time: "14:22" },
  { id: 2, name: "Nomsa K.", amount: 120, time: "13:05" },
  { id: 3, name: "Sipho D.", amount: 30, time: "12:47" },
  { id: 4, name: "Lerato P.", amount: 85, time: "11:30" },
  { id: 5, name: "Kagiso T.", amount: 15, time: "10:12" },
  { id: 6, name: "Ayanda Z.", amount: 200, time: "09:05" },
  { id: 7, name: "Bongani S.", amount: 60, time: "08:40" },
];

const HOURLY = [
  { hour: "6a", sales: 2 }, { hour: "8a", sales: 8 }, { hour: "10a", sales: 14 },
  { hour: "12p", sales: 22 }, { hour: "2p", sales: 18 }, { hour: "4p", sales: 12 },
  { hour: "6p", sales: 20 }, { hour: "8p", sales: 9 },
];
const WEEKLY = [
  { day: "Mon", total: 420 }, { day: "Tue", total: 380 }, { day: "Wed", total: 510 },
  { day: "Thu", total: 460 }, { day: "Fri", total: 720 }, { day: "Sat", total: 890 },
  { day: "Sun", total: 340 },
];
const TOP_CUSTOMERS = [
  { name: "Ayanda Z.", spent: 200 }, { name: "Nomsa K.", spent: 120 },
  { name: "Lerato P.", spent: 85 }, { name: "Bongani S.", spent: 60 },
];
let MESSAGES = [
  { id: 1, from: "buyer", text: "Do you have Simba chips in stock?", time: "14:10" },
  { id: 2, from: "me", text: "Yes, cheese & onion and salt & vinegar.", time: "14:12" },
  { id: 3, from: "buyer", text: "How much for 2?", time: "14:13" },
];

const GREEN = "#0f7c5f";
const screen = document.getElementById("screen");

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

// ============ 1. WALLET ============
let amount = "";

function renderWallet() {
  const sellerTitle = currentUser?.user_metadata?.business_name || currentUser?.user_metadata?.name || "Seller";
  screen.innerHTML = `
    <div class="pad">
      <div class="header-row">
        <div>
          <h1 class="h1">Wallet</h1>
          <p style="font-size:12px; color:#868b92; margin:0;">${sellerTitle}</p>
        </div>
        <button class="plus-btn" id="addCardBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
      <div class="code-pill">Account code: <strong>${ACCOUNT_CODE}</strong></div>
      <div class="card-stack" id="cardStack"></div>
      <div class="qr-block">
        <div id="qrMain"></div>
        <p class="qr-hint">Buyers scan to pay</p>
        <div class="amount-row">
          <span class="rand">R</span>
          <input class="amount-input" id="amountInput" inputmode="numeric" placeholder="0.00" value="${amount}" />
        </div>
        <button class="primary-btn" id="receiveBtn" ${amount ? "" : "disabled"}>Receive</button>
      </div>
    </div>`;

  renderCards();
  loadCards();
  makeQR("qrMain", ACCOUNT_CODE, 150);

  document.getElementById("addCardBtn").addEventListener("click", openAddCard);

  const amtEl = document.getElementById("amountInput");
  amtEl.addEventListener("input", () => {
    amount = amtEl.value.replace(/[^\d.]/g, "");
    amtEl.value = amount;
    document.getElementById("receiveBtn").disabled = !amount;
  });

  document.getElementById("receiveBtn").addEventListener("click", () => {
    if (amount) renderReceive();
  });
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

let paymentChannel = null;

async function renderReceive() {
  // Seller's display name: business name if present, else personal name
  const sellerName =
    currentUser?.user_metadata?.business_name ||
    currentUser?.user_metadata?.name ||
    "Seller";

  screen.innerHTML = `
    <div class="receive-wrap">
      <button class="back-top" id="backBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back
      </button>
      <div class="receive-amount">R ${parseFloat(amount).toFixed(2)}</div>
      <p class="receive-label">Show this to the buyer</p>
      <div class="qr-big"><div id="qrBig"></div></div>
      <div class="waiting" id="waitBox"><span class="dot"></span> Waiting for payment…</div>
    </div>`;

  document.getElementById("backBtn").addEventListener("click", () => {
    cleanupPayment();
    amount = "";
    renderWallet();
  });

  // 1. Create a pending transaction in Supabase
  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      seller_id: currentUser.id,
      seller_code: ACCOUNT_CODE,
      seller_name: sellerName,
      amount: parseFloat(amount),
      status: "pending",
    })
    .select()
    .single();

  if (error || !tx) {
    document.getElementById("waitBox").innerHTML = "Could not start payment. Try again.";
    console.error(error);
    return;
  }

  // 2. QR now encodes the transaction id (buyer scans this)
  makeQR("qrBig", String(tx.id), 260);

  // 3. Listen live — when buyer marks it paid, show the tick
  paymentChannel = supabase
    .channel("tx-" + tx.id)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${tx.id}` },
      (payload) => {
        if (payload.new.status === "paid") {
          showSellerPaid(payload.new);
        }
      }
    )
    .subscribe();
}

function showSellerPaid(tx) {
  cleanupPayment();
  screen.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="40" height="40"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <div class="success-amount">+R ${parseFloat(tx.amount).toFixed(2)}</div>
      <div class="success-to">Paid by ${tx.buyer_name || "buyer"}</div>
      <button class="scan-btn" id="doneBtn" style="max-width:260px">Done</button>
    </div>`;
  document.getElementById("doneBtn").addEventListener("click", () => {
    amount = "";
    renderWallet();
  });
}

function cleanupPayment() {
  if (paymentChannel) {
    supabase.removeChannel(paymentChannel);
    paymentChannel = null;
  }
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

  // expiry: type 2 digits in MM, auto-jump to YY
  mmEl.addEventListener("input", () => {
    mmEl.value = mmEl.value.replace(/\D/g, "").slice(0, 2);
    if (mmEl.value.length === 2) yyEl.focus();
  });
  yyEl.addEventListener("input", () => {
    yyEl.value = yyEl.value.replace(/\D/g, "").slice(0, 2);
  });
  // backspace on empty YY jumps back to MM
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
  const todayLabel = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });

  screen.innerHTML = `
    <div class="pad">
      <h1 class="h1">Activity</h1>
      <div id="activityBody"><p style="color:#868b92">Loading…</p></div>
    </div>`;

  // fetch all this seller's transactions (paid in, and withdrawals out)
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("seller_id", currentUser.id)
    .in("status", ["paid", "withdrawal"])
    .order("created_at", { ascending: false });

  const body = document.getElementById("activityBody");

  if (error) {
    body.innerHTML = `<p style="color:#868b92">Couldn't load activity.</p>`;
    console.error(error);
    return;
  }

  const all = rows || [];
  const payments = all.filter((r) => r.status === "paid");
  const withdrawals = all.filter((r) => r.status === "withdrawal");

  // received today only
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const receivedToday = payments
    .filter((p) => new Date(p.created_at) >= startOfDay)
    .reduce((a, p) => a + Number(p.amount), 0);

  // current balance = all received - all withdrawn
  const totalIn = payments.reduce((a, p) => a + Number(p.amount), 0);
  const totalOut = withdrawals.reduce((a, w) => a + Number(w.amount), 0);
  const balance = totalIn - totalOut;

  body.innerHTML = `
    <div class="summary-card">
      <div>
        <div class="summary-label">Received today</div>
        <div class="summary-value">R ${receivedToday.toFixed(2)}</div>
        <div class="balance-line">Current balance: <strong>R ${balance.toFixed(2)}</strong></div>
      </div>
      <div class="summary-count">${payments.length} payments</div>
    </div>

    <button class="primary-btn" id="withdrawBtn" style="margin-bottom:22px">Withdraw</button>

    <div class="date-label">${todayLabel}</div>
    <div class="tx-list">
      ${payments.length === 0 ? `<p style="color:#868b92">No payments yet.</p>` : payments.map((p) => {
        const name = p.buyer_name || "Buyer";
        const time = new Date(p.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
        return `
          <div class="tx">
            <div class="tx-avatar">${name[0]}</div>
            <div style="flex:1">
              <div class="tx-name">${name}</div>
              <div class="tx-time">${time}</div>
            </div>
            <div class="tx-amount">+R ${Number(p.amount).toFixed(2)}</div>
          </div>`;
      }).join("")}
    </div>`;

  document.getElementById("withdrawBtn").addEventListener("click", () => openWithdraw(balance));
}

function openWithdraw(balance) {
  const div = document.createElement("div");
  div.className = "overlay";
  div.innerHTML = `
    <div class="sheet">
      <div class="handle"></div>
      <button class="sheet-close" id="wClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <h2 class="sheet-title">Withdraw</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 16px">Available: <strong>R ${balance.toFixed(2)}</strong></p>
      <label class="field-label">Amount</label>
      <input class="input" id="wAmount" inputmode="decimal" placeholder="0.00" />
      <p class="hint error" id="wError" style="min-height:16px;margin-top:6px"></p>
      <button class="primary-btn" id="wConfirm" style="margin-top:8px">Withdraw</button>
    </div>`;
  document.getElementById("app").appendChild(div);

  const amtEl = div.querySelector("#wAmount");
  const errEl = div.querySelector("#wError");
  const confirmBtn = div.querySelector("#wConfirm");

  amtEl.addEventListener("input", () => {
    amtEl.value = amtEl.value.replace(/[^\d.]/g, "");
    errEl.textContent = "";
  });

  confirmBtn.addEventListener("click", async () => {
    const amt = parseFloat(amtEl.value);
    if (!amt || amt <= 0) { errEl.textContent = "Enter a valid amount."; return; }
    if (amt > balance) { errEl.textContent = "Amount is more than your balance."; return; }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing…";

    // save the withdrawal to the database
    const { error } = await supabase.from("transactions").insert({
      seller_id: currentUser.id,
      seller_code: ACCOUNT_CODE,
      seller_name: currentUser?.user_metadata?.business_name || currentUser?.user_metadata?.name || "Seller",
      amount: amt,
      status: "withdrawal",
    });

    if (error) {
      errEl.textContent = "Withdrawal failed. Try again.";
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Withdraw";
      console.error(error);
      return;
    }

    div.remove();
    showAbsaSms(amt);
    renderActivity(); // refresh so balance drops
  });

  div.querySelector("#wClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

function showAbsaSms(amount) {
  const ref = "PTL" + Math.floor(100000 + Math.random() * 900000);
  const time = new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  const sms = document.createElement("div");
  sms.className = "sms-banner";
  sms.innerHTML = `
    <div class="sms-head">
      <div class="sms-sender">ABSA</div>
      <div class="sms-time">${time}</div>
    </div>
    <div class="sms-body">+R ${amount.toFixed(2)} withdrawn from Patela. Ref ${ref}. Available today.</div>`;
  document.getElementById("app").appendChild(sms);
  setTimeout(() => {
    sms.classList.add("sms-out");
    setTimeout(() => sms.remove(), 400);
  }, 4000);
}

// ============ 3. ANALYTICS ============
function renderAnalytics() {
  const peak = HOURLY.reduce((a, b) => (b.sales > a.sales ? b : a));
  const bestDay = WEEKLY.reduce((a, b) => (b.total > a.total ? b : a));
  screen.innerHTML = `
    <div class="pad">
      <h1 class="h1">Analytics</h1>
      <div class="stat-row">
        <div class="stat"><div class="stat-label">Peak hour</div><div class="stat-value">${peak.hour}</div><div class="stat-sub">${peak.sales} sales</div></div>
        <div class="stat"><div class="stat-label">Best day</div><div class="stat-value">${bestDay.day}</div><div class="stat-sub">R${bestDay.total}</div></div>
      </div>
      <div class="chart-card"><div class="chart-title">Sales by hour</div><canvas id="hourChart"></canvas></div>
      <div class="chart-card"><div class="chart-title">Weekly earnings</div><canvas id="weekChart"></canvas></div>
      <div class="chart-card">
        <div class="chart-title">Top customers</div>
        <div class="top-list">
          ${TOP_CUSTOMERS.map((c, i) => `
            <div class="top-row"><span class="top-rank">${i + 1}</span><span style="flex:1">${c.name}</span><span class="top-spend">R ${c.spent}</span></div>`).join("")}
        </div>
      </div>
    </div>`;

  const gridColor = "#eef0f2";
  new Chart(document.getElementById("hourChart"), {
    type: "bar",
    data: {
      labels: HOURLY.map((h) => h.hour),
      datasets: [{
        data: HOURLY.map((h) => h.sales),
        backgroundColor: HOURLY.map((h) => (h.hour === peak.hour ? GREEN : "#cfe7de")),
        borderRadius: 4,
      }],
    },
    options: barOpts(gridColor),
  });

  new Chart(document.getElementById("weekChart"), {
    type: "line",
    data: {
      labels: WEEKLY.map((w) => w.day),
      datasets: [{
        data: WEEKLY.map((w) => w.total),
        borderColor: GREEN, backgroundColor: GREEN, borderWidth: 2.5,
        pointRadius: 3, tension: 0.35, fill: false,
      }],
    },
    options: barOpts(gridColor),
  });
}

function barOpts(grid) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11 } } },
      y: { grid: { color: grid }, ticks: { color: "#6b7280", font: { size: 11 } }, beginAtZero: true },
    },
  };
}

// ============ 4. MAP ============
function renderMap() {
  screen.innerHTML = `
    <div class="map-wrap">
      <div id="map"></div>
      <div class="map-overlay-top">
        <div class="map-title">Customer hotspots</div>
        <div class="map-sub">Where people buy near you</div>
      </div>
      <button class="chat-fab" id="chatFab">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" width="22" height="22"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <span class="chat-badge">2</span>
      </button>
    </div>`;

  document.getElementById("chatFab").addEventListener("click", openChat);
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
    center: SELLER_LOC,
    zoom: 16,
    mapTypeId: "satellite",
    disableDefaultUI: true,
    gestureHandling: "greedy",
  });

  CUSTOMER_POINTS.forEach((p) => {
    new google.maps.Circle({
      map,
      center: { lat: p.lat, lng: p.lng },
      radius: 30 + p.weight * 12,
      strokeColor: "#ff3b00",
      strokeOpacity: 0.6,
      strokeWeight: 1,
      fillColor: "#ff5a1f",
      fillOpacity: 0.35,
    });
  });

  if (google.maps.visualization && google.maps.visualization.HeatmapLayer) {
    new google.maps.visualization.HeatmapLayer({
      data: CUSTOMER_POINTS.map((p) => ({ location: new google.maps.LatLng(p.lat, p.lng), weight: p.weight })),
      radius: 90,
      opacity: 0.9,
      maxIntensity: 6,
      dissipating: true,
      gradient: [
        "rgba(0, 255, 128, 0)",
        "rgba(0, 200, 120, 0.7)",
        "rgba(120, 220, 0, 0.8)",
        "rgba(255, 200, 0, 0.9)",
        "rgba(255, 120, 0, 0.95)",
        "rgba(255, 40, 0, 1)",
      ],
      map,
    });
  }
  new google.maps.Marker({
    position: SELLER_LOC, map, title: "Your shop",
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: GREEN, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
  });
}

function openChat() {
  const div = document.createElement("div");
  div.className = "overlay";
  div.innerHTML = `
    <div class="sheet" style="height:70%;display:flex;flex-direction:column">
      <div class="handle"></div>
      <button class="sheet-close" id="chatClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <h2 class="sheet-title">Stock enquiries</h2>
      <div class="chat-list" id="chatList"></div>
      <div class="chat-input-row">
        <input class="chat-input" id="chatInput" placeholder="Reply…" />
        <button class="send-btn" id="sendBtn"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="18" height="18"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>
      </div>
    </div>`;
  document.getElementById("app").appendChild(div);

  const list = div.querySelector("#chatList");
  const input = div.querySelector("#chatInput");
  const paint = () => {
    list.innerHTML = MESSAGES.map((m) => `
      <div class="bubble ${m.from === "me" ? "bubble-me" : "bubble-them"}">${m.text}<span class="bubble-time">${m.time}</span></div>`).join("");
    list.scrollTop = list.scrollHeight;
  };
  paint();

  const send = () => {
    const t = input.value.trim();
    if (!t) return;
    MESSAGES.push({ id: Date.now(), from: "me", text: t, time: "now" });
    input.value = "";
    paint();
  };
  div.querySelector("#sendBtn").addEventListener("click", send);
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());
  div.querySelector("#chatClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

// ============ QR helper ============
function makeQR(hostId, value, size) {
  const host = document.getElementById(hostId);
  host.innerHTML = "";
  new QRCode(host, { text: value, width: size, height: size, colorDark: "#0a0a0a", colorLight: "#ffffff" });
}

// Start session check
checkSession();