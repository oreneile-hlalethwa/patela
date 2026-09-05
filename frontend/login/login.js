// ---------- Config ----------
const SERVICES = [
  "Spaza Shop",
  "Kota & Fast Food",
  "Sweets, Chips & Snacks",
  "Cooked Meals / Catering",
  "Fruit & Vegetables",
  "Meat & Braai (Chisa Nyama)",
  "Salon & Hair",
  "Nails & Beauty",
  "Barber",
  "Clothing & Shoes",
  "Airtime & Data",
  "Car Wash",
  "Mechanic & Panel Beating",
  "Electronics & Repairs",
  "Cellphone Repairs",
  "Building & Construction",
  "Plumbing",
  "Electrician",
  "Welding",
  "Furniture",
  "Cleaning Services",
  "Laundry",
  "Transport & Deliveries",
  "Tavern / Liquor",
  "Events & Décor",
  "Photography",
  "Tailoring & Alterations",
  "Firewood & Coal",
  "Cosmetics",
  "Stationery & Printing",
  "Other",
];

// ---------- State ----------
let state = {
  role: null,      // 'seller' | 'buyer'
  mode: "signin",  // 'signin' | 'signup'
  hasBusiness: null,
};

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const screens = { loading: $("loading"), roles: $("roles"), auth: $("auth") };

function show(name) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

// ---------- Loading -> Roles ----------
setTimeout(() => show("roles"), 2200);

// ---------- Role selection ----------
document.querySelectorAll(".block").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.role = btn.dataset.role;
    state.mode = "signin";        // auto-start at sign in
    state.hasBusiness = null;
    openAuth();
  });
});

$("backBtn").addEventListener("click", () => show("roles"));

// ---------- Render auth screen ----------
function openAuth() {
  show("auth");
  renderRoleTag();
  renderForm();
}

function renderRoleTag() {
  const isSeller = state.role === "seller";
  const icon = isSeller
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M3 7h18l-1.5 4.5a3 3 0 0 1-3 2.5H7.5a3 3 0 0 1-3-2.5L3 7z"/><path d="M6 14v6h12v-6"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6zM16 10a4 4 0 0 1-8 0"/></svg>`;
  $("roleTag").innerHTML = `${icon}<span>${isSeller ? "Seller" : "Buyer"}</span>`;
}

function renderForm() {
  $("authTitle").textContent = state.mode === "signin" ? "Sign in" : "Create account";

  let html = "";
  if (state.mode === "signin") html = signInForm();
  else if (state.role === "seller") html = sellerForm();
  else html = buyerForm();

  $("formHost").innerHTML = html;
  renderSwitchLine();
  wireForm();

  // seller sign-up starts with the business banner
  if (state.mode === "signup" && state.role === "seller" && state.hasBusiness === null) {
    $("banner").classList.remove("hidden");
  }
}

function renderSwitchLine() {
  const el = $("switchLine");
  if (state.mode === "signin") {
    el.innerHTML = `Don't have an account? <button class="link" id="toSignup">Sign up</button>`;
    $("toSignup").addEventListener("click", () => { state.mode = "signup"; state.hasBusiness = null; renderForm(); });
  } else {
    el.innerHTML = `Already have an account? <button class="link" id="toSignin">Sign in</button>`;
    $("toSignin").addEventListener("click", () => { state.mode = "signin"; renderForm(); });
  }
}

// ---------- Form templates ----------
function field(name, label, opts = {}) {
  const { type = "text", placeholder = "", hint = "" } = opts;
  return `
    <label class="field">
      <div class="label-row">
        <span class="field-label">${label}</span>
        <span class="hint" data-hint-for="${name}">${hint}</span>
      </div>
      <input class="input" name="${name}" type="${type}" placeholder="${placeholder}" autocomplete="off" />
    </label>`;
}

function signInForm() {
  return `
    <div class="form" id="form">
      ${field("email", "Email", { type: "email", placeholder: "you@example.com" })}
      ${field("password", "Password", { type: "password", placeholder: "••••••••" })}
      <button class="submit" id="submit">Sign in</button>
    </div>`;
}

function buyerForm() {
  return `
    <div class="form" id="form">
      <div class="row">
        ${field("name", "Name", { placeholder: "Your name" })}
        ${field("surname", "Surname", { placeholder: "Your surname" })}
      </div>
      ${field("phone", "Phone number", { placeholder: "10 digits", hint: "0/10" })}
      ${field("email", "Email", { type: "email", placeholder: "you@example.com" })}
      ${field("password", "Password", { type: "password", placeholder: "••••••••" })}
      ${field("confirm", "Confirm password", { type: "password", placeholder: "••••••••" })}
      <button class="submit" id="submit">Create account</button>
    </div>`;
}

function sellerForm() {
  const business = state.hasBusiness
    ? `
      ${field("businessName", "Business name", { placeholder: "Registered business name" })}
      ${field("regNumber", "Business registration number", { placeholder: "13-digit registration number", hint: "0/13" })}
    `
    : "";

  const rest = state.hasBusiness === null
    ? ""
    : `
      ${field("idNumber", "ID number", { placeholder: "13-digit ID number", hint: "0/13" })}
      ${serviceDropdown()}
      ${business}
      ${field("email", "Email", { type: "email", placeholder: "you@example.com" })}
      ${field("phone", "Phone number", { placeholder: "10 digits", hint: "0/10" })}
      ${field("password", "Password", { type: "password", placeholder: "••••••••" })}
      ${field("confirm", "Confirm password", { type: "password", placeholder: "••••••••" })}
      <button class="submit" id="submit">Create account</button>
    `;

  return `
    <div class="form" id="form">
      <div class="row">
        ${field("name", "Name", { placeholder: "Your name" })}
        ${field("surname", "Surname", { placeholder: "Your surname" })}
      </div>
      ${rest}
    </div>`;
}

// Custom scrollable dropdown (contained, not the OS picker)
function serviceDropdown() {
  return `
    <div class="field">
      <div class="label-row"><span class="field-label">Service</span></div>
      <div class="dropdown" id="serviceDropdown">
        <button type="button" class="input dd-toggle" id="ddToggle">
          <span class="dd-value placeholder" id="ddValue">Select a service</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#868b92" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="dd-menu hidden" id="ddMenu">
          ${SERVICES.map((s) => `<button type="button" class="dd-option" data-value="${s}">${s}</button>`).join("")}
        </div>
        <input type="hidden" name="service" id="serviceInput" value="" />
      </div>
    </div>`;
}

// ---------- Banner (business question) ----------
$("bizYes").addEventListener("click", () => answerBusiness(true));
$("bizNo").addEventListener("click", () => answerBusiness(false));
$("bannerClose").addEventListener("click", () => answerBusiness(false));

function answerBusiness(yes) {
  state.hasBusiness = yes;
  $("banner").classList.add("hidden");
  renderForm();
}

// ---------- Input rules + validation ----------
function wireForm() {
  const form = $("form");
  if (!form) return;

  const setHint = (name, text, error) => {
    const el = form.querySelector(`[data-hint-for="${name}"]`);
    if (el) { el.textContent = text; el.classList.toggle("error", !!error); }
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.classList.toggle("error", !!error);
  };

  // digit limits + live counters
  const limits = { phone: 10, idNumber: 13, regNumber: 13 };
  Object.keys(limits).forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, limits[name]);
      setHint(name, `${input.value.length}/${limits[name]}`, false);
    });
  });

  // confirm password match
  const pw = form.querySelector('[name="password"]');
  const cf = form.querySelector('[name="confirm"]');
  if (pw && cf) {
    const check = () => {
      const bad = cf.value.length > 0 && pw.value !== cf.value;
      setHint("confirm", bad ? "Passwords don't match" : "", bad);
    };
    pw.addEventListener("input", check);
    cf.addEventListener("input", check);
  }

  // custom service dropdown
  const dd = form.querySelector("#serviceDropdown");
  if (dd) {
    const toggle = dd.querySelector("#ddToggle");
    const menu = dd.querySelector("#ddMenu");
    const valueEl = dd.querySelector("#ddValue");
    const hidden = dd.querySelector("#serviceInput");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    menu.querySelectorAll(".dd-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.dataset.value;
        hidden.value = v;
        valueEl.textContent = v;
        valueEl.classList.remove("placeholder");
        menu.classList.add("hidden");
      });
    });

    // close when clicking outside
    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target)) menu.classList.add("hidden");
    });
  }

  // submit
  const submit = $("submit");
  if (submit) {
    submit.addEventListener("click", () => handleSubmit(form));
  }
}

function handleSubmit(form) {
  const data = {};
  form.querySelectorAll("input, select").forEach((el) => {
    if (el.name) data[el.name] = el.value;
  });
  data.role = state.role;
  data.mode = state.mode;
  if (state.role === "seller" && state.mode === "signup") {
    data.hasBusiness = state.hasBusiness;
  }

  // basic checks
  if (data.confirm !== undefined && data.password !== data.confirm) {
    alert("Passwords don't match.");
    return;
  }

  // TODO: POST to Django endpoint, e.g.
  // fetch('/api/auth/', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
  console.log("Submit payload:", data);
  alert(`${state.mode === "signin" ? "Signing in" : "Account created"} — ${state.role}`);
}