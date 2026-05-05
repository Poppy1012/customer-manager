const CLIENT_ID = "95788600787-f8uq7eg5rs5vb7i9r1i7m88npkdb0upd.apps.googleusercontent.com";
const STORAGE_PREFIX = "customer_passbook:";
const GUEST_KEY = `${STORAGE_PREFIX}guest`;
const USER_KEY = `${STORAGE_PREFIX}activeUser`;
const THEME_KEY = `${STORAGE_PREFIX}theme`;
const COST_PREFIX = `${STORAGE_PREFIX}monthlyCost:`;

const screens = [...document.querySelectorAll(".screen")];
const startButton = document.querySelector("#startButton");
const customerList = document.querySelector("#customerList");
const customerAnalyticsList = document.querySelector("#customerAnalyticsList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const searchBox = document.querySelector("#searchBox");
const form = document.querySelector("#customerForm");
const formTitle = document.querySelector("#formTitle");
const submitButton = document.querySelector("#submitButton");
const deleteFormButton = document.querySelector("#deleteFormButton");
const saveTopButton = document.querySelector("#saveTopButton");
const importInput = document.querySelector("#importInput");
const monthInput = document.querySelector("#monthInput");
const monthCost = document.querySelector("#monthCost");
const userChip = document.querySelector("#userChip");
const userAvatar = document.querySelector("#userAvatar");
const userName = document.querySelector("#userName");
const storageLabel = document.querySelector("#storageLabel");
const googleButton = document.querySelector("#googleButton");
const signOutButton = document.querySelector("#signOutButton");
const themeButton = document.querySelector("#themeButton");

const fields = ["name", "phone", "address", "items", "payment", "debt", "total", "nextDelivery", "notes"];
const avatarColors = ["", "green", "orange", "purple", "yellow"];

let customers = [];
let activeUser = null;
let currentScreen = "splash";
let previousScreen = "home";
let currentFilter = "all";
let editingId = null;
let selectedId = null;

function showScreen(name) {
  previousScreen = currentScreen === name ? previousScreen : currentScreen;
  currentScreen = name;
  screens.forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  if (name === "customers") renderCustomerAnalytics();
  if (name === "stats") renderMonthly();
}

function goBack() {
  showScreen(previousScreen === "splash" || previousScreen === "form" ? "home" : previousScreen);
}

function storageKey() {
  return activeUser ? `${STORAGE_PREFIX}google:${activeUser.sub}` : GUEST_KEY;
}

function costKey(month) {
  return `${COST_PREFIX}${activeUser ? activeUser.sub : "guest"}:${month}`;
}

function loadCustomers() {
  customers = JSON.parse(localStorage.getItem(storageKey()) || "[]");
  render();
}

function saveCustomers() {
  localStorage.setItem(storageKey(), JSON.stringify(customers));
  render();
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function getTotal(customer) {
  return Number(customer.total || 0) || Number(customer.payment || 0) + Number(customer.debt || 0);
}

function recordDate(customer) {
  return customer.updatedAt || customer.createdAt || new Date().toISOString();
}

function monthStamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function calendarUrl(customer) {
  const date = customer.nextDelivery ? new Date(customer.nextDelivery) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const end = new Date(date.getTime() + 60 * 60 * 1000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `送貨：${customer.name || "客戶"}`,
    dates: `${stamp(date)}/${stamp(end)}`,
    location: customer.address || "",
    details: [`電話：${customer.phone}`, `商品：${customer.items}`, `備註：${customer.notes}`].filter(Boolean).join("\n")
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function filteredCustomers() {
  const term = searchInput.value.trim().toLowerCase();
  return customers.filter((customer) => {
    const matchesSearch = !term || fields.some((field) => String(customer[field] || "").toLowerCase().includes(term));
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "debt" && Number(customer.debt || 0) > 0) ||
      (currentFilter === "delivery" && customer.nextDelivery);
    return matchesSearch && matchesFilter;
  });
}

function customersInMonth(month) {
  return customers.filter((customer) => monthStamp(recordDate(customer)) === month);
}

function render() {
  renderStats();
  renderList();
  renderCustomerAnalytics();
  renderMonthly();
  if (selectedId) renderDetail(selectedId);
}

function renderStats() {
  const received = customers.reduce((sum, item) => sum + Number(item.payment || 0), 0);
  const debt = customers.reduce((sum, item) => sum + Number(item.debt || 0), 0);
  document.querySelector("#totalCount").textContent = customers.length;
  document.querySelector("#totalPayment").textContent = money(received);
  document.querySelector("#totalDebt").textContent = money(debt);
}

function renderList() {
  const list = filteredCustomers();
  customerList.replaceChildren();
  emptyState.style.display = list.length ? "none" : "block";

  list.forEach((customer, index) => {
    const card = document.createElement("button");
    card.className = "customer-card";
    card.type = "button";
    card.innerHTML = `
      <div class="avatar ${avatarColors[index % avatarColors.length]}">${escapeHtml((customer.name || "客").slice(0, 1))}</div>
      <div class="customer-main">
        <strong>${escapeHtml(customer.name || "未命名客戶")}</strong>
        <span>${escapeHtml(customer.phone || "未填電話")}</span>
      </div>
      <div class="customer-money">
        <span>總金額</span>
        <strong>${money(getTotal(customer))}</strong>
        ${Number(customer.debt || 0) > 0 ? `<b>未收 ${money(customer.debt)}</b>` : `<i>已收清</i>`}
      </div>
    `;
    card.addEventListener("click", () => openDetail(customer.id));
    customerList.appendChild(card);
  });
}

function renderCustomerAnalytics() {
  const totalRevenue = customers.reduce((sum, customer) => sum + Number(customer.payment || 0), 0);
  const totalOrders = customers.reduce((sum, customer) => sum + getTotal(customer), 0);
  document.querySelector("#customerRevenueTotal").textContent = money(totalRevenue);
  document.querySelector("#orderAmountTotal").textContent = money(totalOrders);
  customerAnalyticsList.replaceChildren();

  if (!customers.length) {
    customerAnalyticsList.innerHTML = `<div class="empty-card" style="display:block"><strong>沒有客戶可分析</strong><span>新增客戶後會出現累計叫貨資料。</span></div>`;
    return;
  }

  customers.forEach((customer) => {
    const products = productRows(customer);
    const card = document.createElement("article");
    card.className = "analytics-card";
    card.innerHTML = `
      <h2>${escapeHtml(customer.name || "未命名客戶")}</h2>
      <small>${escapeHtml(customer.phone || "未填電話")}</small>
      <div class="analytics-metrics">
        <div><small>產品項目</small><strong>${products.length}</strong></div>
        <div><small>累計金額</small><strong>${money(getTotal(customer))}</strong></div>
        <div><small>實際營業額</small><strong>${money(customer.payment)}</strong></div>
      </div>
      <div class="product-list">
        ${products.map((product) => `
          <div class="product-row">
            <span>${escapeHtml(product.name)}</span>
            <strong>${money(product.amount)}</strong>
          </div>
        `).join("")}
      </div>
    `;
    customerAnalyticsList.appendChild(card);
  });
}

function renderMonthly() {
  const month = monthInput.value || monthStamp();
  monthInput.value = month;
  const cost = Number(localStorage.getItem(costKey(month)) || 0);
  monthCost.value = cost || "";
  const rows = customersInMonth(month);
  const receivable = rows.reduce((sum, item) => sum + getTotal(item), 0);
  const received = rows.reduce((sum, item) => sum + Number(item.payment || 0), 0);
  const debt = rows.reduce((sum, item) => sum + Number(item.debt || 0), 0);
  const profit = received - cost;

  document.querySelector("#monthReceivable").textContent = money(receivable);
  document.querySelector("#monthReceived").textContent = money(received);
  document.querySelector("#monthDebt").textContent = money(debt);
  document.querySelector("#monthProfit").textContent = money(profit);
  document.querySelector("#homeMonthProfit").textContent = money(profit);

  const monthRows = document.querySelector("#monthRows");
  monthRows.innerHTML = rows.length ? rows.map((customer) => `
    <div class="record-row">
      <span>${escapeHtml(customer.name || "未命名")}</span>
      <span>實收 ${money(customer.payment)}</span>
      <strong>${money(getTotal(customer))}</strong>
    </div>
  `).join("") : `<div class="record-row"><span>本月尚無資料</span><span></span><strong>$0</strong></div>`;
}

function productRows(customer) {
  const lines = String(customer.items || "")
    .split(/[\n,，、]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const total = getTotal(customer);

  if (!lines.length) return [{ name: "未填商品", amount: total }];

  const parsed = lines.map((line) => {
    const amountMatch = line.match(/(.+?)[\s:：xX*]*([0-9][0-9,]*)$/);
    if (!amountMatch) return { name: line, amount: 0, explicit: false };
    return {
      name: amountMatch[1].trim() || line,
      amount: Number(amountMatch[2].replace(/,/g, "")),
      explicit: true
    };
  });

  const explicitTotal = parsed.reduce((sum, item) => sum + (item.explicit ? item.amount : 0), 0);
  const missing = parsed.filter((item) => !item.explicit);
  const shared = missing.length ? Math.max(total - explicitTotal, 0) / missing.length : 0;
  const merged = new Map();
  parsed.forEach((item) => {
    const name = item.name || "未填商品";
    const amount = item.explicit ? item.amount : shared;
    merged.set(name, (merged.get(name) || 0) + amount);
  });
  return [...merged.entries()].map(([name, amount]) => ({ name, amount }));
}

function openDetail(id) {
  selectedId = id;
  renderDetail(id);
  showScreen("detail");
}

function renderDetail(id) {
  const customer = customers.find((item) => item.id === id);
  if (!customer) return;

  document.querySelector("#detailAvatar").textContent = (customer.name || "客").slice(0, 1);
  document.querySelector("#detailName").textContent = customer.name || "未命名客戶";
  document.querySelector("#detailPhone").textContent = customer.phone || "未填電話";
  document.querySelector("#detailTotal").textContent = money(getTotal(customer));
  document.querySelector("#detailDebt").textContent = money(customer.debt);
  document.querySelector("#detailPayment").textContent = money(customer.payment);
  document.querySelector("#detailNotes").textContent = customer.notes || "無";

  const address = document.querySelector("#detailAddress");
  address.textContent = customer.address || "未填寫";
  customer.address ? (address.href = mapsUrl(customer.address)) : address.removeAttribute("href");

  const calendar = document.querySelector("#detailCalendar");
  const calUrl = calendarUrl(customer);
  calendar.textContent = customer.nextDelivery ? `${formatDate(customer.nextDelivery)}　加入 Google 行事曆` : "未設定";
  calUrl ? (calendar.href = calUrl) : calendar.removeAttribute("href");

  document.querySelector("#detailProducts").innerHTML = productRows(customer).map((product) => `
    <div class="product-row">
      <span>${escapeHtml(product.name)}</span>
      <strong>${money(product.amount)}</strong>
    </div>
  `).join("");

  const records = buildRecords(customer);
  document.querySelector("#recordRows").innerHTML = records.map((record) => `
    <div class="record-row">
      <span>${record.date}</span>
      <span>${record.type}</span>
      <strong>${record.amount}</strong>
    </div>
  `).join("");
}

function buildRecords(customer) {
  const updated = formatDate(recordDate(customer));
  return [
    { date: updated, type: "應收", amount: money(getTotal(customer)) },
    { date: updated, type: "實收", amount: money(customer.payment) },
    { date: updated, type: "未收", amount: money(customer.debt) }
  ];
}

function openForm(id = null) {
  editingId = id;
  form.reset();
  deleteFormButton.hidden = !id;
  formTitle.textContent = id ? "編輯客戶" : "新增客戶";
  submitButton.textContent = id ? "更新客戶" : "儲存客戶";

  if (id) {
    const customer = customers.find((item) => item.id === id);
    if (customer) fields.forEach((field) => form.elements[field].value = customer[field] || "");
  }
  showScreen("form");
}

function getFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.payment = Number(data.payment || 0);
  data.debt = Number(data.debt || 0);
  data.total = Number(data.total || 0) || data.payment + data.debt;
  return data;
}

function saveForm() {
  if (!form.reportValidity()) return;
  const data = getFormData();
  if (editingId) {
    customers = customers.map((customer) => customer.id === editingId ? { ...customer, ...data, updatedAt: new Date().toISOString() } : customer);
    selectedId = editingId;
    saveCustomers();
    openDetail(editingId);
    return;
  }

  const id = crypto.randomUUID();
  customers.unshift({ id, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  selectedId = id;
  saveCustomers();
  openDetail(id);
}

function deleteCurrentCustomer() {
  if (!editingId) return;
  const customer = customers.find((item) => item.id === editingId);
  if (!customer || !confirm(`刪除「${customer.name || "未命名客戶"}」？`)) return;
  customers = customers.filter((item) => item.id !== editingId);
  editingId = null;
  selectedId = null;
  saveCustomers();
  showScreen("home");
}

function exportExcel() {
  const data = customers.map((customer) => ({
    姓名: customer.name,
    電話: customer.phone,
    地址: customer.address,
    本次商品細項: customer.items,
    實收金額: customer.payment,
    應收未收: customer.debt,
    總金額: getTotal(customer),
    預計下次送貨時間: customer.nextDelivery,
    備註: customer.notes
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "客戶資料");
  XLSX.writeFile(book, `客戶資料_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function importExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const imported = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(normalizeImportRow);
  if (!imported.length) return;
  const append = customers.length ? confirm("按確定追加匯入資料，按取消覆蓋目前資料。") : false;
  customers = append ? [...customers, ...imported] : imported;
  saveCustomers();
  showScreen("home");
}

function normalizeImportRow(row) {
  const payment = Number(row["實收金額"] || row["本次收款"] || row["收款金額"] || row.payment || 0);
  const debt = Number(row["應收未收"] || row["欠款金額"] || row["積欠金額"] || row.debt || 0);
  const total = Number(row["總金額"] || row.total || 0) || payment + debt;
  return {
    id: crypto.randomUUID(),
    name: row["姓名"] || row.name || "",
    phone: row["電話"] || row.phone || "",
    address: row["地址"] || row.address || "",
    items: row["本次商品細項"] || row["商品細項"] || row.items || "",
    payment,
    debt,
    total,
    nextDelivery: normalizeDateTime(row["預計下次送貨時間"] || row["下次送貨日期"] || row.nextDelivery || ""),
    notes: row["備註"] || row.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeDateTime(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateTimeLocal(value);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? toDateTimeLocal(new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M)) : "";
  }
  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? String(value).trim() : toDateTimeLocal(parsed);
}

function toDateTimeLocal(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseJwt(token) {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function handleCredentialResponse(response) {
  activeUser = parseJwt(response.credential);
  localStorage.setItem(USER_KEY, JSON.stringify(activeUser));
  updateUserUi();
  loadCustomers();
}

function updateUserUi() {
  const signedIn = Boolean(activeUser);
  storageLabel.textContent = signedIn ? "已登入，資料與 Google 帳號綁定" : "訪客模式，本機儲存";
  userChip.hidden = !signedIn;
  signOutButton.hidden = !signedIn;
  googleButton.hidden = signedIn;
  if (signedIn) {
    userAvatar.src = activeUser.picture || "";
    userName.textContent = activeUser.name || activeUser.email || "Google 使用者";
  }
}

function initGoogleLogin() {
  const saved = localStorage.getItem(USER_KEY);
  if (saved) activeUser = JSON.parse(saved);
  updateUserUi();
  loadCustomers();

  if (!window.google) return;
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredentialResponse });
  google.accounts.id.renderButton(googleButton, {
    theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline",
    size: "large",
    shape: "rectangular",
    text: "signin_with"
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

startButton.addEventListener("click", () => showScreen("home"));
document.querySelectorAll("[data-action='new']").forEach((button) => button.addEventListener("click", () => openForm()));
document.querySelectorAll("[data-action='back']").forEach((button) => button.addEventListener("click", goBack));
document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => showScreen(button.dataset.tab)));
document.querySelector("#editDetailButton").addEventListener("click", () => selectedId && openForm(selectedId));
document.querySelector("#searchToggle").addEventListener("click", () => searchBox.hidden = !searchBox.hidden);
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderList();
  });
});
searchInput.addEventListener("input", renderList);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveForm();
});
saveTopButton.addEventListener("click", saveForm);
deleteFormButton.addEventListener("click", deleteCurrentCustomer);
document.querySelector("#exportButton").addEventListener("click", exportExcel);
document.querySelector("#importButton").addEventListener("click", () => importInput.click());
importInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importExcel(file);
  event.target.value = "";
});
monthInput.addEventListener("change", renderMonthly);
monthCost.addEventListener("input", () => {
  const month = monthInput.value || monthStamp();
  localStorage.setItem(costKey(month), String(Number(monthCost.value || 0)));
  renderMonthly();
});
signOutButton.addEventListener("click", () => {
  activeUser = null;
  localStorage.removeItem(USER_KEY);
  updateUserUi();
  loadCustomers();
});
themeButton.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

monthInput.value = monthStamp();
setTheme(localStorage.getItem(THEME_KEY) || "dark");
loadCustomers();
window.addEventListener("load", initGoogleLogin);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
