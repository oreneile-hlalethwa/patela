import { supabase } from "../shared/supabaseClient.js";

// ============ Auth Guard & Global State ============
let currentUser = null;
let ACCOUNT_CODE = "PTL-4827-9931";
let cards = [];
let paymentChannel = null;

const GREEN = "#0f7c5f";
const screen = document.getElementById("screen");

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../login/login.html";
    return;
  }

  const role = session.user.user_metadata?.role;
  if (role !== "seller") {
    alert("Access restricted: You must log in with a Seller account.");
    window.location.href = "../buyer/buyer.html";
    return;
  }

  currentUser = session.user;
  ACCOUNT_CODE = `PTL-${currentUser.id.substring(0, 4).toUpperCase()}-${currentUser.id.substring(currentUser.id.length - 4).toUpperCase()}`;

  // Resolve Business Name or Initials + Surname
  const meta = currentUser.user_metadata || {};
  let displayName = meta.business_name;

  if (!displayName) {
    const firstName = meta.name ? meta.name.trim() : "";
    const surname = meta.surname ? meta.surname.trim() : "";
    if (firstName && surname) {
      displayName = `${firstName[0].toUpperCase()}. ${surname}`;
    } else if (firstName) {
      displayName = firstName;
    } else {
      displayName = "Merchant";
    }
  }

  // Hydrate desktop sidebar info
  const nameEl = document.getElementById("sidebarUserName");
  const avatarEl = document.getElementById("sidebarAvatar");
  const codeEl = document.getElementById("sidebarAccountCode");
  const pillEl = document.getElementById("sidebarPill");

  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) avatarEl.textContent = displayName[0].toUpperCase();
  if (codeEl) codeEl.textContent = ACCOUNT_CODE;
  if (pillEl) pillEl.textContent = displayName;

  // Bind sign out handlers to both sidebar and mobile headers
  document.getElementById("logoutBtn")?.addEventListener("click", handleSignOut);
  document.getElementById("mobileLogoutBtn")?.addEventListener("click", handleSignOut);

  setupNavigation();
  render("wallet");
}

async function handleSignOut() {
  cleanupPayment();
  await supabase.auth.signOut();
  window.location.href = "../login/login.html";
}

// ============ Audio Soundbox (Web Speech API) ============
function speakPaymentReceived(buyerName, amount) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = `Payment received. ${amount} Rand from ${buyerName || "Customer"}`;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === "en-ZA" || v.lang === "en-GB") || voices[0];
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

// ============ Config & Mock Data ============
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

let MESSAGES = [
  { id: 1, from: "buyer", text: "Do you have Simba chips in stock?", time: "14:10" },
  { id: 2, from: "me", text: "Yes, cheese & onion and salt & vinegar.", time: "14:12" },
  { id: 3, from: "buyer", text: "How much for 2?", time: "14:13" },
];

// ============ Navigation Handler (Desktop + Mobile Sync) ============
function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".nav-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === tab);
      });
      render(tab);
    });
  });
}

function render(tab) {
  if (tab === "wallet") renderWallet();
  else if (tab === "activity") renderActivity();
  else if (tab === "analytics") renderAnalytics();
  else if (tab === "map") renderMap();
}

// ============ 1. WALLET ============
let amount = "";

function renderWallet() {
  const meta = currentUser?.user_metadata || {};
  const sellerTitle = meta.business_name || (meta.name ? `${meta.name[0]}. ${meta.surname || ""}` : "Seller");

  screen.innerHTML = `
    <div class="pad">
      <div class="header-row">
        <div>
          <h1 class="h1">Terminal</h1>
          <p style="font-size:13px; color:var(--muted); margin:0;">${sellerTitle}</p>
        </div>
        <button class="plus-btn" id="addCardBtn" title="Add Card">
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
  if (cards.length === 0) {
    host.innerHTML = `
      <div class="credit-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" width="20" height="20"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        <div class="cc-num">•••• •••• •••• 4417</div>
        <div class="cc-brand">Visa</div>
      </div>`;
    return;
  }
  host.innerHTML = cards.map((c) => `
    <div class="credit-card">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" width="20" height="20"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
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
  if (data && data.length > 0) {
    cards = data;
    renderCards();
  }
}

async function renderReceive() {
  const sellerName = currentUser?.user_metadata?.business_name || currentUser?.user_metadata?.name || "Seller";

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

  try {
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
      console.error("Transaction creation failed:", error);
      document.getElementById("waitBox").innerHTML = `<span style="color:var(--error);">Error: ${error?.message || "Failed to create transaction"}</span>`;
      return;
    }

    makeQR("qrBig", String(tx.id), 260);

    paymentChannel = supabase
      .channel("tx-" + tx.id)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${tx.id}` },
        (payload) => {
          if (payload.new.status === "paid") {
            speakPaymentReceived(payload.new.buyer_name, payload.new.amount);
            showSellerPaid(payload.new);
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.error("renderReceive execution error:", err);
    document.getElementById("waitBox").innerHTML = `<span style="color:var(--error);">Could not generate payment QR.</span>`;
  }
}

function showSellerPaid(tx) {
  cleanupPayment();
  screen.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="40" height="40"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <div class="success-amount">+R ${parseFloat(tx.amount).toFixed(2)}</div>
      <div class="success-to">Paid by ${tx.buyer_name || "Customer"}</div>
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
  const todayLabel = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });

  screen.innerHTML = `
    <div class="pad">
      <h1 class="h1">Activity</h1>
      <div id="activityBody"><p style="color:var(--muted)">Loading…</p></div>
    </div>`;

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("seller_id", currentUser.id)
    .in("status", ["paid", "withdrawal"])
    .order("created_at", { ascending: false });

  const body = document.getElementById("activityBody");

  if (error) {
    body.innerHTML = `<p style="color:var(--muted)">Couldn't load activity.</p>`;
    console.error(error);
    return;
  }

  const all = rows || [];
  const payments = all.filter((r) => r.status === "paid");
  const withdrawals = all.filter((r) => r.status === "withdrawal");

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const receivedToday = payments
    .filter((p) => new Date(p.created_at) >= startOfDay)
    .reduce((a, p) => a + Number(p.amount), 0);

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
      <div class="summary-counts">
        <div class="summary-count">${payments.length} payments</div>
        <div class="summary-count">${withdrawals.length} withdrawals</div>
      </div>
    </div>

    <button class="primary-btn" id="withdrawBtn" style="margin-bottom:22px">Withdraw</button>

    <div class="date-label">${todayLabel}</div>
    <div class="tx-list">
      ${all.length === 0 ? `<p style="color:var(--muted); padding: 24px; text-align: center;">No activity yet.</p>` : all.map((r) => {
        const time = new Date(r.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
        if (r.status === "withdrawal") {
          return `
          <div class="tx">
            <div class="tx-avatar tx-out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
            </div>
            <div style="flex:1">
              <div class="tx-name">Withdrawal</div>
              <div class="tx-time">${time}</div>
            </div>
            <div class="tx-amount tx-amount-out">-R ${Number(r.amount).toFixed(2)}</div>
          </div>`;
        }
        const name = r.buyer_name || "Buyer";
        return `
          <div class="tx">
            <div class="tx-avatar">${name[0]}</div>
            <div style="flex:1">
              <div class="tx-name">${name}</div>
              <div class="tx-time">${time}</div>
            </div>
            <div class="tx-amount">+R ${Number(r.amount).toFixed(2)}</div>
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
      <p style="font-size:13px;color:var(--muted);margin:0 0 16px">Available: <strong>R ${balance.toFixed(2)}</strong></p>
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
    renderActivity();
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

// ============ 3. ANALYTICS / SMART BOOKS ============
function formatMoney(value) {
  return `R ${Number(value || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function renderAnalytics() {
  screen.innerHTML = `
    <div class="pad">
      <div class="analytics-heading">
        <h1 class="h1">Analytics</h1>
        <p class="analytics-subtitle">Understand how your business is performing</p>
      </div>

      <div class="analytics-tabs">
        <button class="analytics-tab active" id="overviewTab" type="button">Overview</button>
        <button class="analytics-tab" id="smartBooksTab" type="button">Smart Books</button>
      </div>

      <div id="analyticsContent"></div>
    </div>`;

  const overviewTab = document.getElementById("overviewTab");
  const smartBooksTab = document.getElementById("smartBooksTab");
  const host = document.getElementById("analyticsContent");

  async function activateTab(tab) {
    overviewTab.classList.remove("active");
    smartBooksTab.classList.remove("active");

    if (tab === "overview") {
      overviewTab.classList.add("active");
      await renderAnalyticsOverview(host);
    } else {
      smartBooksTab.classList.add("active");
      await renderSmartBooks(host);
    }
  }

  overviewTab.addEventListener("click", () => activateTab("overview"));
  smartBooksTab.addEventListener("click", () => activateTab("smartbooks"));

  await activateTab("overview");
}

async function renderAnalyticsOverview(host) {
  host.innerHTML = `<div class="analytics-loading">Loading business analytics...</div>`;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("seller_id", currentUser.id)
    .eq("status", "paid")
    .gte("created_at", monthStart.toISOString())
    .lt("created_at", nextMonth.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Analytics error:", error);
    host.innerHTML = `<p class="analytics-loading">Could not load analytics.</p>`;
    return;
  }

  const payments = rows || [];
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, value: 0 }));

  payments.forEach((p) => {
    const hour = new Date(p.created_at).getHours();
    hourly[hour].count += 1;
    hourly[hour].value += Number(p.amount);
  });

  const peakHour = hourly.reduce((best, current) => (current.count > best.count ? current : best));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekly = dayNames.map((day, index) => ({ day, index, total: 0, count: 0 }));

  payments.forEach((p) => {
    const day = new Date(p.created_at).getDay();
    weekly[day].total += Number(p.amount);
    weekly[day].count += 1;
  });

  const bestDay = weekly.reduce((best, current) => (current.total > best.total ? current : best));

  const customerMap = {};
  payments.forEach((p) => {
    const name = p.buyer_name || "Buyer";
    if (!customerMap[name]) customerMap[name] = { name, spent: 0, transactions: 0 };
    customerMap[name].spent += Number(p.amount);
    customerMap[name].transactions += 1;
  });

  const topCustomers = Object.values(customerMap).sort((a, b) => b.spent - a.spent).slice(0, 5);
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  host.innerHTML = `
    <div class="overview-banner">
      <div>
        <div class="overview-label">Revenue this month</div>
        <div class="overview-value">${formatMoney(totalRevenue)}</div>
        <div class="overview-note">${payments.length} verified Patela payment${payments.length === 1 ? "" : "s"}</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat">
        <div class="stat-label">Peak hour</div>
        <div class="stat-value">${peakHour.count > 0 ? `${String(peakHour.hour).padStart(2, "0")}:00` : "--"}</div>
        <div class="stat-sub">${peakHour.count} sale${peakHour.count === 1 ? "" : "s"}</div>
      </div>

      <div class="stat">
        <div class="stat-label">Best day</div>
        <div class="stat-value">${bestDay.total > 0 ? bestDay.day : "--"}</div>
        <div class="stat-sub">${formatMoney(bestDay.total)}</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">Sales by hour</div>
      <canvas id="hourChart"></canvas>
    </div>

    <div class="chart-card">
      <div class="chart-title">Earnings by day</div>
      <canvas id="weekChart"></canvas>
    </div>

    <div class="chart-card">
      <div class="chart-title">Top customers</div>
      <div class="top-list">
        ${
          topCustomers.length === 0
            ? `<div class="empty-books">No customer activity yet.</div>`
            : topCustomers
                .map(
                  (c, i) => `
              <div class="top-row">
                <span class="top-rank">${i + 1}</span>
                <div style="flex:1">
                  <div>${c.name}</div>
                  <div class="customer-transactions">${c.transactions} transaction${c.transactions === 1 ? "" : "s"}</div>
                </div>
                <span class="top-spend">${formatMoney(c.spent)}</span>
              </div>`
                )
                .join("")
        }
      </div>
    </div>`;

  const gridColor = "#eef0f2";

  new Chart(document.getElementById("hourChart"), {
    type: "bar",
    data: {
      labels: hourly.map((h) => `${String(h.hour).padStart(2, "0")}:00`),
      datasets: [
        {
          data: hourly.map((h) => h.count),
          backgroundColor: hourly.map((h) => (h.hour === peakHour.hour && peakHour.count > 0 ? GREEN : "#cfe7de")),
          borderRadius: 4,
        },
      ],
    },
    options: barOpts(gridColor),
  });

  new Chart(document.getElementById("weekChart"), {
    type: "line",
    data: {
      labels: weekly.map((w) => w.day),
      datasets: [
        {
          data: weekly.map((w) => w.total),
          borderColor: GREEN,
          backgroundColor: GREEN,
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.35,
          fill: false,
        },
      ],
    },
    options: barOpts(gridColor),
  });
}

async function renderSmartBooks(host) {
  host.innerHTML = `<div class="analytics-loading">Preparing Smart Books...</div>`;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthName = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  const [transactionsResult, expensesResult, cashSalesResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("seller_id", currentUser.id)
      .eq("status", "paid")
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", nextMonth.toISOString())
      .order("created_at", { ascending: true }),

    supabase
      .from("expenses")
      .select("*")
      .eq("seller_id", currentUser.id)
      .gte("expense_date", dateOnly(monthStart))
      .lt("expense_date", dateOnly(nextMonth))
      .order("expense_date", { ascending: false }),

    supabase
      .from("cash_sales")
      .select("*")
      .eq("seller_id", currentUser.id)
      .gte("sale_date", dateOnly(monthStart))
      .lt("sale_date", dateOnly(nextMonth))
      .order("sale_date", { ascending: false }),
  ]);

  if (transactionsResult.error || expensesResult.error || cashSalesResult.error) {
    console.error("Smart Books error:", transactionsResult.error || expensesResult.error || cashSalesResult.error);
    host.innerHTML = `<div class="empty-books">Could not load Smart Books.</div>`;
    return;
  }

  const digitalSales = transactionsResult.data || [];
  const expenses = expensesResult.data || [];
  const cashSales = cashSalesResult.data || [];

  const digitalRevenue = digitalSales.reduce((total, s) => total + Number(s.amount), 0);
  const cashRevenue = cashSales.reduce((total, s) => total + Number(s.amount), 0);
  const revenue = digitalRevenue + cashRevenue;

  const costOfSales = expenses
    .filter((e) => e.category === "stock")
    .reduce((total, e) => total + Number(e.amount), 0);

  const operatingExpenses = expenses
    .filter((e) => e.category !== "stock")
    .reduce((total, e) => total + Number(e.amount), 0);

  const totalExpenses = costOfSales + operatingExpenses;
  const grossProfit = revenue - costOfSales;
  const netProfit = grossProfit - operatingExpenses;
  const netCashFlow = revenue - totalExpenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const categoryLabels = {
    stock: "Stock / Inventory",
    transport: "Transport",
    rent: "Rent",
    utilities: "Utilities",
    wages: "Wages",
    equipment: "Equipment",
    other: "Other",
  };

  const expenseGroups = {};
  expenses.forEach((e) => {
    const cat = e.category || "other";
    if (!expenseGroups[cat]) expenseGroups[cat] = 0;
    expenseGroups[cat] += Number(e.amount);
  });

  host.innerHTML = `
    <div class="smartbooks-header">
      <div>
        <div class="smartbooks-brand">Smart Books</div>
        <div class="smartbooks-month">${monthName}</div>
        <div class="smartbooks-description">
          Financial insights automatically prepared from your Patela transactions, cash sales and recorded business expenses.
        </div>
      </div>

      <div class="smartbooks-actions">
        <button class="download-report-btn" id="downloadReportBtn">↓ Report</button>
        <button class="cash-sale-btn" id="addCashSaleBtn">+ Cash Sale</button>
        <button class="add-expense-btn" id="addExpenseBtn">+ Expense</button>
      </div>
    </div>

    <!-- SUMMARY GRID -->
    <div class="books-summary-grid">
      <div class="books-summary-card">
        <div class="books-summary-label">Revenue</div>
        <div class="books-summary-value positive">${formatMoney(revenue)}</div>
        <div class="books-summary-sub">${digitalSales.length} digital · ${cashSales.length} cash</div>
      </div>

      <div class="books-summary-card">
        <div class="books-summary-label">Expenses</div>
        <div class="books-summary-value negative">${formatMoney(totalExpenses)}</div>
        <div class="books-summary-sub">${expenses.length} recorded expense${expenses.length === 1 ? "" : "s"}</div>
      </div>

      <div class="books-summary-card">
        <div class="books-summary-label">Net profit</div>
        <div class="books-summary-value ${netProfit >= 0 ? "positive" : "negative"}">${formatMoney(netProfit)}</div>
        <div class="books-summary-sub">${profitMargin.toFixed(1)}% margin</div>
      </div>

      <div class="books-summary-card">
        <div class="books-summary-label">Net cash flow</div>
        <div class="books-summary-value ${netCashFlow >= 0 ? "positive" : "negative"}">${formatMoney(netCashFlow)}</div>
        <div class="books-summary-sub">Operating cash movement</div>
      </div>
    </div>

    <!-- INCOME STATEMENT -->
    <div class="books-card">
      <div class="books-card-head">
        <div>
          <div class="books-card-title">Income Statement</div>
          <div class="books-card-period">For the month of ${monthName}</div>
        </div>
      </div>

      <div class="statement-table">
        <div class="statement-section">Revenue</div>
        <div class="statement-row"><span>Patela digital sales</span><strong>${formatMoney(digitalRevenue)}</strong></div>
        <div class="statement-row"><span>Cash sales</span><strong>${formatMoney(cashRevenue)}</strong></div>
        <div class="statement-row statement-total"><span>Total Revenue</span><strong>${formatMoney(revenue)}</strong></div>

        <div class="statement-section">Cost of Sales</div>
        <div class="statement-row"><span>Stock / Inventory</span><span>(${formatMoney(costOfSales)})</span></div>
        <div class="statement-row statement-total"><span>Gross Profit</span><strong>${formatMoney(grossProfit)}</strong></div>

        <div class="statement-section">Operating Expenses</div>
        ${
          Object.entries(expenseGroups)
            .filter(([cat]) => cat !== "stock")
            .map(([cat, val]) => `<div class="statement-row"><span>${categoryLabels[cat] || cat}</span><span>(${formatMoney(val)})</span></div>`)
            .join("") || `<div class="statement-row muted-row"><span>No operating expenses recorded</span><span>${formatMoney(0)}</span></div>`
        }

        <div class="statement-row statement-final">
          <span>NET PROFIT</span>
          <strong class="${netProfit >= 0 ? "positive-text" : "negative-text"}">${formatMoney(netProfit)}</strong>
        </div>
      </div>
    </div>

    <!-- CASH FLOW STATEMENT -->
    <div class="books-card">
      <div class="books-card-head">
        <div>
          <div class="books-card-title">Cash Flow Statement</div>
          <div class="books-card-period">For the month of ${monthName}</div>
        </div>
      </div>

      <div class="statement-table">
        <div class="statement-section">Cash Inflows</div>
        <div class="statement-row"><span>Patela payments received</span><strong class="positive-text">+${formatMoney(digitalRevenue)}</strong></div>
        <div class="statement-row"><span>Cash sales received</span><strong class="positive-text">+${formatMoney(cashRevenue)}</strong></div>
        <div class="statement-row statement-total"><span>Total Cash In</span><strong>${formatMoney(revenue)}</strong></div>

        <div class="statement-section">Cash Outflows</div>
        ${
          Object.entries(expenseGroups)
            .map(([cat, val]) => `<div class="statement-row"><span>${categoryLabels[cat] || cat}</span><span class="negative-text">-${formatMoney(val)}</span></div>`)
            .join("") || `<div class="statement-row muted-row"><span>No expenses recorded</span><span>${formatMoney(0)}</span></div>`
        }

        <div class="statement-row statement-total"><span>Total Cash Out</span><strong>${formatMoney(totalExpenses)}</strong></div>
        <div class="statement-row statement-final">
          <span>NET CASH FLOW</span>
          <strong class="${netCashFlow >= 0 ? "positive-text" : "negative-text"}">${formatMoney(netCashFlow)}</strong>
        </div>
      </div>
    </div>

    <!-- RECENT EXPENSES -->
    <div class="books-card">
      <div class="books-card-title">Recent Expenses</div>
      <div class="expense-list">
        ${
          expenses.length === 0
            ? `<div class="empty-books">No expenses recorded yet.<br><br>Add your first business expense to start building your financial statements.</div>`
            : expenses
                .slice(0, 8)
                .map(
                  (e) => `
              <div class="expense-row">
                <div class="expense-icon">↓</div>
                <div class="expense-details">
                  <div class="expense-name">${e.description || categoryLabels[e.category] || "Expense"}</div>
                  <div class="expense-meta">${categoryLabels[e.category] || e.category} · ${new Date(e.expense_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</div>
                </div>
                <div class="expense-amount">-${formatMoney(e.amount)}</div>
              </div>`
                )
                .join("")
        }
      </div>
    </div>

    <!-- RECENT CASH SALES -->
    <div class="books-card">
      <div class="books-card-title">Recent Cash Sales</div>
      <div class="expense-list">
        ${
          cashSales.length === 0
            ? `<div class="empty-books">No cash sales recorded yet.</div>`
            : cashSales
                .slice(0, 8)
                .map(
                  (s) => `
              <div class="expense-row">
                <div class="expense-icon" style="background:#e8f7f1; color:#0f7c5f;">↑</div>
                <div class="expense-details">
                  <div class="expense-name">${s.description || "Cash sale"}</div>
                  <div class="expense-meta">${s.customer_name ? s.customer_name + " · " : ""}${new Date(s.sale_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</div>
                </div>
                <div class="expense-amount" style="color:#0f7c5f;">+${formatMoney(s.amount)}</div>
              </div>`
                )
                .join("")
        }
      </div>
    </div>

    <div class="books-disclaimer">
      Smart Books provides management information based on transactions, cash sales and expenses recorded in Patela. It is not an audited financial statement.
    </div>`;

  document.getElementById("addExpenseBtn").addEventListener("click", () => openAddExpense(() => renderSmartBooks(host)));
  document.getElementById("addCashSaleBtn").addEventListener("click", () => openAddCashSale(() => renderSmartBooks(host)));
  document.getElementById("downloadReportBtn").addEventListener("click", () => {
    generateSmartBooksPDF({
      monthName,
      digitalRevenue,
      cashRevenue,
      revenue,
      costOfSales,
      grossProfit,
      operatingExpenses,
      totalExpenses,
      netProfit,
      netCashFlow,
      profitMargin,
      expenseGroups,
      categoryLabels,
      digitalSales,
      cashSales,
      expenses,
    });
  });
}

function openAddExpense(onSaved) {
  const div = document.createElement("div");
  div.className = "overlay";
  const today = dateOnly(new Date());

  div.innerHTML = `
    <div class="sheet">
      <div class="handle"></div>
      <button class="sheet-close" id="expenseClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <h2 class="sheet-title">Add business expense</h2>
      <label class="field-label">Amount</label>
      <input class="input" id="expenseAmount" inputmode="decimal" placeholder="0.00" />
      <label class="field-label">Category</label>
      <select class="input" id="expenseCategory">
        <option value="stock">Stock / Inventory</option>
        <option value="transport">Transport</option>
        <option value="rent">Rent</option>
        <option value="utilities">Utilities</option>
        <option value="wages">Wages</option>
        <option value="equipment">Equipment</option>
        <option value="other">Other</option>
      </select>
      <label class="field-label">Description</label>
      <input class="input" id="expenseDescription" placeholder="e.g. Bought stock for the shop" />
      <label class="field-label">Date</label>
      <input class="input" id="expenseDate" type="date" value="${today}" />
      <label class="field-label">Payment method</label>
      <select class="input" id="expenseMethod">
        <option value="cash">Cash</option>
        <option value="bank">Bank</option>
        <option value="patela">Patela</option>
      </select>
      <p class="hint error" id="expenseError" style="min-height:18px"></p>
      <button class="primary-btn" id="saveExpenseBtn">Save expense</button>
    </div>`;

  document.getElementById("app").appendChild(div);

  const saveBtn = div.querySelector("#saveExpenseBtn");
  const errorEl = div.querySelector("#expenseError");

  saveBtn.addEventListener("click", async () => {
    const expenseAmount = parseFloat(div.querySelector("#expenseAmount").value);
    const category = div.querySelector("#expenseCategory").value;
    const description = div.querySelector("#expenseDescription").value.trim();
    const expenseDate = div.querySelector("#expenseDate").value;
    const paymentMethod = div.querySelector("#expenseMethod").value;

    if (!expenseAmount || expenseAmount <= 0) {
      errorEl.textContent = "Enter a valid expense amount.";
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const { error } = await supabase.from("expenses").insert({
      seller_id: currentUser.id,
      amount: expenseAmount,
      category,
      description,
      expense_date: expenseDate,
      payment_method: paymentMethod,
    });

    if (error) {
      console.error("Expense error:", error);
      errorEl.textContent = "Could not save expense.";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save expense";
      return;
    }

    div.remove();
    if (onSaved) await onSaved();
  });

  div.querySelector("#expenseClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

function openAddCashSale(onSaved) {
  const div = document.createElement("div");
  div.className = "overlay";
  const today = dateOnly(new Date());

  div.innerHTML = `
    <div class="sheet">
      <div class="handle"></div>
      <button class="sheet-close" id="cashSaleClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <h2 class="sheet-title">Record cash sale</h2>
      <p style="margin-top:-8px; margin-bottom:18px; font-size:12px; color:var(--muted);">
        Record a sale that was paid for in cash.
      </p>
      <label class="field-label">Amount</label>
      <input class="input" id="cashSaleAmount" inputmode="decimal" placeholder="0.00" />
      <label class="field-label">Description</label>
      <input class="input" id="cashSaleDescription" placeholder="e.g. 2 Kotas and a cold drink" />
      <label class="field-label">Customer name</label>
      <input class="input" id="cashSaleCustomer" placeholder="Optional" />
      <label class="field-label">Date</label>
      <input class="input" id="cashSaleDate" type="date" value="${today}" />
      <p class="hint error" id="cashSaleError" style="min-height:18px"></p>
      <button class="primary-btn" id="saveCashSaleBtn">Record cash sale</button>
    </div>`;

  document.getElementById("app").appendChild(div);

  const saveBtn = div.querySelector("#saveCashSaleBtn");
  const errorEl = div.querySelector("#cashSaleError");

  saveBtn.addEventListener("click", async () => {
    const cashAmount = parseFloat(div.querySelector("#cashSaleAmount").value);
    const description = div.querySelector("#cashSaleDescription").value.trim();
    const customerName = div.querySelector("#cashSaleCustomer").value.trim();
    const saleDate = div.querySelector("#cashSaleDate").value;

    if (!cashAmount || cashAmount <= 0) {
      errorEl.textContent = "Enter a valid sale amount.";
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const { error } = await supabase.from("cash_sales").insert({
      seller_id: currentUser.id,
      amount: cashAmount,
      description,
      customer_name: customerName || null,
      sale_date: saleDate,
    });

    if (error) {
      console.error("Cash sale error:", error);
      errorEl.textContent = "Could not record cash sale.";
      saveBtn.disabled = false;
      saveBtn.textContent = "Record cash sale";
      return;
    }

    div.remove();
    if (onSaved) await onSaved();
  });

  div.querySelector("#cashSaleClose").addEventListener("click", () => div.remove());
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
}

function generateSmartBooksPDF(data) {
  const {
    monthName,
    digitalRevenue,
    cashRevenue,
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    totalExpenses,
    netProfit,
    netCashFlow,
    profitMargin,
    expenseGroups,
    categoryLabels,
    digitalSales,
    cashSales,
    expenses,
  } = data;

  if (!window.jspdf) {
    alert("PDF library could not be loaded.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 18;

  const meta = currentUser?.user_metadata || {};
  const businessName = meta.business_name || (meta.name ? `${meta.name[0]}. ${meta.surname || ""}` : "Patela Seller");
  const sellerName = meta.name ? `${meta.name} ${meta.surname || ""}`.trim() : businessName;
  const generatedDate = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(15, 124, 95);
  doc.text("Patela", margin, y);

  doc.setFontSize(9);
  doc.text("SMART BOOKS", margin, y + 7);

  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.text("Financial Management Report", pageWidth - margin, y, { align: "right" });

  doc.setTextColor(110, 110, 110);
  doc.text(monthName, pageWidth - margin, y + 6, { align: "right" });

  y += 20;
  doc.setDrawColor(15, 124, 95);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(businessName, margin, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Seller: ${sellerName}`, margin, y);
  y += 5;
  doc.text(`Patela account: ${ACCOUNT_CODE}`, margin, y);
  y += 5;
  doc.text(`Reporting period: ${monthName}`, margin, y);
  y += 5;
  doc.text(`Generated: ${generatedDate}`, margin, y);

  y += 13;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Financial Summary", margin, y);

  y += 5;
  doc.autoTable({
    startY: y,
    theme: "grid",
    head: [["Revenue", "Expenses", "Net Profit", "Margin"]],
    body: [[formatMoney(revenue), formatMoney(totalExpenses), formatMoney(netProfit), `${profitMargin.toFixed(1)}%`]],
    headStyles: { fillColor: [15, 124, 95], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 4, halign: "center" },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 13;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Income Statement", margin, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(`For the month of ${monthName}`, margin, y);

  y += 5;
  const incomeRows = [
    ["REVENUE", ""],
    ["Patela digital sales", formatMoney(digitalRevenue)],
    ["Cash sales", formatMoney(cashRevenue)],
    ["Total Revenue", formatMoney(revenue)],
    ["", ""],
    ["COST OF SALES", ""],
    ["Stock / Inventory", `(${formatMoney(costOfSales)})`],
    ["Gross Profit", formatMoney(grossProfit)],
    ["", ""],
    ["OPERATING EXPENSES", ""],
  ];

  Object.entries(expenseGroups)
    .filter(([category]) => category !== "stock")
    .forEach(([category, value]) => {
      incomeRows.push([categoryLabels[category] || category, `(${formatMoney(value)})`]);
    });

  if (Object.entries(expenseGroups).filter(([category]) => category !== "stock").length === 0) {
    incomeRows.push(["No operating expenses recorded", formatMoney(0)]);
  }

  incomeRows.push(["Total Operating Expenses", formatMoney(operatingExpenses)], ["NET PROFIT", formatMoney(netProfit)]);

  doc.autoTable({
    startY: y,
    theme: "plain",
    body: incomeRows,
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
    styles: { fontSize: 9, cellPadding: 2.5 },
    didParseCell(hookData) {
      const label = hookData.row.raw?.[0];
      if (["REVENUE", "COST OF SALES", "OPERATING EXPENSES"].includes(label)) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.textColor = [15, 124, 95];
      }
      if (["Total Revenue", "Gross Profit", "Total Operating Expenses", "NET PROFIT"].includes(label)) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 14;
  if (y > 215) {
    doc.addPage();
    y = 18;
  }

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Cash Flow Statement", margin, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(`For the month of ${monthName}`, margin, y);

  y += 5;
  const cashFlowRows = [
    ["CASH INFLOWS", ""],
    ["Patela payments received", formatMoney(digitalRevenue)],
    ["Cash sales received", formatMoney(cashRevenue)],
    ["Total Cash In", formatMoney(revenue)],
    ["", ""],
    ["CASH OUTFLOWS", ""],
  ];

  Object.entries(expenseGroups).forEach(([category, value]) => {
    cashFlowRows.push([categoryLabels[category] || category, `(${formatMoney(value)})`]);
  });

  if (expenses.length === 0) {
    cashFlowRows.push(["No expenses recorded", formatMoney(0)]);
  }

  cashFlowRows.push(["Total Cash Out", formatMoney(totalExpenses)], ["NET CASH FLOW", formatMoney(netCashFlow)]);

  doc.autoTable({
    startY: y,
    theme: "plain",
    body: cashFlowRows,
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
    styles: { fontSize: 9, cellPadding: 2.5 },
    didParseCell(hookData) {
      const label = hookData.row.raw?.[0];
      if (["CASH INFLOWS", "CASH OUTFLOWS"].includes(label)) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.textColor = [15, 124, 95];
      }
      if (["Total Cash In", "Total Cash Out", "NET CASH FLOW"].includes(label)) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 14;
  if (y > 220) {
    doc.addPage();
    y = 18;
  }

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Business Activity", margin, y);

  y += 5;
  doc.autoTable({
    startY: y,
    theme: "grid",
    head: [["Activity", "Count", "Value"]],
    body: [
      ["Digital sales", digitalSales.length, formatMoney(digitalRevenue)],
      ["Cash sales", cashSales.length, formatMoney(cashRevenue)],
      ["Business expenses", expenses.length, formatMoney(totalExpenses)],
    ],
    headStyles: { fillColor: [15, 124, 95], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 13;
  if (y > 250) {
    doc.addPage();
    y = 18;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  const disclaimer =
    "This report was automatically generated by Patela Smart Books using transactions, cash sales and business expenses recorded by the merchant. It is intended for business management and informational purposes and does not constitute audited financial statements.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(disclaimerLines, margin, y);

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, 284, pageWidth - margin, 284);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text("Generated by Patela Smart Books", margin, 290);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 290, { align: "right" });
  }

  const safeBusinessName = businessName.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase();
  const safeMonth = monthName.replace(/\s+/g, "-").toLowerCase();
  const fileName = `patela-${safeBusinessName}-${safeMonth}-financial-report.pdf`;

  doc.save(fileName);
}

function barOpts(grid) {
  return {
    responsive: true,
    maintainAspectRatio: false,
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
    el.parentElement.insertAdjacentHTML(
      "beforeend",
      `<div class="map-error" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:#2f3a2c;">
        Map couldn't load. Check that the Maps JavaScript API is enabled.
      </div>`
    );
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
    position: SELLER_LOC,
    map,
    title: "Your shop",
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

// ============ QR Helper ============
function makeQR(hostId, value, size) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = "";
  new QRCode(host, { text: value, width: size, height: size, colorDark: "#0a0a0a", colorLight: "#ffffff" });
}

// Start session check
checkSession();