// ===============================
// VUNA CALCULATOR - MAIN SCRIPT
// ===============================

let LAST_RESULT = 0;
var currentExpression = "";

// ------------------------------
// Tab Switcher
// ------------------------------
function switchTab(tab) {
  document.getElementById("panel-calc").style.display = tab === "calc" ? "block" : "none";
  document.getElementById("panel-cost").style.display = tab === "cost" ? "block" : "none";
  document.getElementById("tab-calc").classList.toggle("active", tab === "calc");
  document.getElementById("tab-cost").classList.toggle("active", tab === "cost");
}

// ------------------------------
// Theme Toggle Logic
// ------------------------------
function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById("theme-toggle");
  body.classList.toggle("dark-mode");
  if (body.classList.contains("dark-mode")) {
    btn.innerHTML = "☀️";
    btn.title = "Switch to light mode";
    localStorage.setItem("theme", "dark");
  } else {
    btn.innerHTML = "🌙";
    btn.title = "Switch to dark mode";
    localStorage.setItem("theme", "light");
  }
}

window.addEventListener("DOMContentLoaded", function () {
  const theme = localStorage.getItem("theme");
  const btn = document.getElementById("theme-toggle");
  if (btn && theme === "dark") {
    document.body.classList.add("dark-mode");
    btn.innerHTML = "☀️";
    btn.title = "Switch to light mode";
  }
  fetchRate();
  renderItems();
});

// ------------------------------
// Calculator State
// ------------------------------
let left = "";
let operator = "";
let right = "";
let steps = [];
const MAX_STEPS = 6;

// ------------------------------
// Basic Calculator Functions
// ------------------------------
function appendToResult(value) {
  currentExpression += value.toString();
  updateResult();
}

function bracketToResult(value) {
  currentExpression += value;
  updateResult();
}

function backspace() {
  currentExpression = currentExpression.slice(0, -1);
  updateResult();
}

function operatorToResult(value) {
  if (value === "^") {
    currentExpression += "**";
  } else {
    currentExpression += value;
  }
  updateResult();
}

function clearResult() {
  currentExpression = "";
  updateResult();
}

function normalizeExpression(expr) {
  return expr
    .replace(/\be\b/g, "Math.E")
    .replace(/\bpi\b/g, "Math.PI");
}

function percentToResult() {
  if (!currentExpression) return;
  const match = currentExpression.match(/(.+?)(\*\*|[+\-*/^])([0-9.]*)$/);
  if (!match) {
    const num = parseFloat(currentExpression);
    if (isNaN(num)) return;
    currentExpression = (num / 100).toString();
  } else {
    const leftPart = match[1];
    const rightPart = match[3];
    if (!rightPart) return;
    let leftVal;
    try { leftVal = eval(leftPart); } catch (e) { leftVal = parseFloat(leftPart); }
    const rightVal = parseFloat(rightPart);
    if (isNaN(leftVal) || isNaN(rightVal)) return;
    currentExpression = ((leftVal * rightVal) / 100).toString();
  }
  currentExpression += "*";
  updateResult();
}

function calculateResult() {
  if (!currentExpression) return;
  try {
    const display = document.getElementById("result");
    let normalizedExpression = normalizeExpression(currentExpression);
    normalizedExpression = normalizedExpression.replace(/\bans\b/gi, LAST_RESULT);
    let result = eval(normalizedExpression);
    LAST_RESULT = result;
    display.value = result;
    if (isNaN(result) || !isFinite(result)) throw new Error();
    currentExpression = result.toString();
    updateResult();
  } catch (e) {
    currentExpression = "Error";
    updateResult();
  }
}

function updateResult() {
  document.getElementById("result").value = currentExpression || "0";
}

// ===============================
// LAGOS COST ESTIMATOR FEATURE
// ===============================

let costItems = [];
let usdNgnRate = null;

// Approximate fallback rate (updated periodically by developer)
const FALLBACK_RATE = 1610;
const FALLBACK_DATE = "May 2026";

async function fetchRate() {
  const rateText = document.getElementById("rate-text");
  const banner = document.getElementById("rate-banner");
  rateText.textContent = "⏳ Fetching live USD/NGN rate...";
  banner.classList.remove("rate-live", "rate-fallback");

  // Try Frankfurter v2 (free, no key, supports NGN via 10 central bank providers)
  try {
    const res = await fetch("https://api.frankfurter.dev/v2/rate/USD/NGN");
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (data && data.rate) {
      usdNgnRate = data.rate;
      rateText.textContent = `💱 Live Rate: 1 USD = ₦${usdNgnRate.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      banner.classList.add("rate-live");
      updateSummary();
      return;
    }
  } catch (e) { /* fall through */ }

  // Fallback: try ExchangeRate-API
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (data && data.rates && data.rates.NGN) {
      usdNgnRate = data.rates.NGN;
      rateText.textContent = `💱 Live Rate: 1 USD = ₦${usdNgnRate.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      banner.classList.add("rate-live");
      updateSummary();
      return;
    }
  } catch (e) { /* fall through */ }

  // Fallback: use hardcoded approximate rate
  usdNgnRate = FALLBACK_RATE;
  rateText.textContent = `⚠️ Live rate unavailable. Using approx. rate: 1 USD ≈ ₦${FALLBACK_RATE.toLocaleString()} (${FALLBACK_DATE})`;
  banner.classList.add("rate-fallback");
  updateSummary();
}

function addItem() {
  const name = document.getElementById("item-name").value.trim();
  const price = parseFloat(document.getElementById("item-price").value);
  const qty = parseInt(document.getElementById("item-qty").value) || 1;

  if (!name) { alert("Please enter an item name."); return; }
  if (isNaN(price) || price < 0) { alert("Please enter a valid price."); return; }

  costItems.push({ id: Date.now(), name, price, qty });
  document.getElementById("item-name").value = "";
  document.getElementById("item-price").value = "";
  document.getElementById("item-qty").value = "1";
  renderItems();
  updateSummary();
}

// Allow pressing Enter on the qty field to add item
document.addEventListener("DOMContentLoaded", function () {
  const qtyInput = document.getElementById("item-qty");
  if (qtyInput) {
    qtyInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") addItem();
    });
  }
  const nameInput = document.getElementById("item-name");
  if (nameInput) {
    nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("item-price").focus();
    });
  }
});

function removeItem(id) {
  costItems = costItems.filter(i => i.id !== id);
  renderItems();
  updateSummary();
}

function renderItems() {
  const list = document.getElementById("items-list");
  if (!list) return;

  const header = `
    <div class="items-header">
      <span>Item</span>
      <span>Unit Price (₦)</span>
      <span>Qty</span>
      <span>Total</span>
      <span></span>
    </div>`;

  if (costItems.length === 0) {
    list.innerHTML = header + `<div class="no-items">No items yet. Add one above.</div>`;
    return;
  }

  const rows = costItems.map(item => {
    const total = item.price * item.qty;
    return `
      <div class="item-row">
        <span class="item-name-cell">${item.name}</span>
        <span>₦${item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
        <span>${item.qty}</span>
        <span>₦${total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
        <button class="btn-remove" onclick="removeItem(${item.id})">✕</button>
      </div>`;
  }).join("");

  list.innerHTML = header + rows;
}

function updateSummary() {
  const total = costItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById("total-ngn").textContent =
    `₦${total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  const usdEl = document.getElementById("total-usd");
  if (usdNgnRate && total > 0) {
    const usd = total / usdNgnRate;
    usdEl.textContent = `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    usdEl.textContent = total === 0 ? "$0.00" : "$—";
  }
}

function useTotal() {
  const total = costItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (total === 0) { alert("Nothing to send — your list is empty."); return; }
  currentExpression = total.toFixed(2);
  switchTab("calc");
  updateResult();
}

function clearItems() {
  if (costItems.length === 0) return;
  if (confirm("Clear all items?")) {
    costItems = [];
    renderItems();
    updateSummary();
  }
}
