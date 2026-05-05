const CLIENT_ID = "95788600787-f8uq7eg5rs5vb7i9r1i7m88npkdb0upd.apps.googleusercontent.com";
const STORAGE_PREFIX = "customer_passbook:";
const GUEST_KEY = `${STORAGE_PREFIX}guest`;
const USER_KEY = `${STORAGE_PREFIX}activeUser`;
const THEME_KEY = `${STORAGE_PREFIX}theme`;

const screens = [...document.querySelectorAll(".screen")];
const startButton = document.querySelector("#startButton");
const customerList = document.querySelector("#customerList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const searchBox = document.querySelector("#searchBox");
const form = document.querySelector("#customerForm");
const formTitle = document.querySelector("#formTitle");
const submitButton = document.querySelector("#submitButton");
const deleteFormButton = document.querySelector("#deleteFormButton");
const saveTopButton = document.querySelector("#saveTopButton");
const importInput = document.querySelector("#importInput");
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
}

function goBack() {
  showScreen(previousScreen === "splash" || previousScreen === "form" ? "home" : previousScreen);
}

function storageKey() {
  return activeUser ? `${STORAGE_PREFIX}google:${activeUser.sub}` : GUEST_KEY;
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

function render() {
  renderStats();
  renderList();
  if (selectedId) renderDetail(selectedId);
}

function renderStats() {
  document.querySelector("#totalCount").textContent = customers.length;
  document.querySelector("#totalPayment").textContent = money(customers.reduce((sum, item) => sum + Number(item.payment || 0), 0));
  document.querySelector("#totalDebt").textContent = money(customers.reduce((sum, item) => sum + Number(item.debt || 0), 0));
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
      <div class="avatar ${avatarColors[index % avatarColors.length]}">${(customer.name || "客").slice(0, 1)}</div>
      <div class="customer-main">
        <strong>${escapeHtml(customer.name || "未命名客戶")}</strong>
        <span>${escapeHtml(customer.phone || "未填電話")}</span>
      </div>
      <div class="customer-money">
        <span>總金額</span>
        <strong>${money(getTotal(customer))}</strong>
        ${Number(customer.debt || 0) > 0 ? `<b>積欠 ${money(customer.debt)}</b>` : `<i>積欠 $0</i>`}
      </div>
    `;
    card.addEventListener("click", () => openDetail(customer.id));
    customerList.appendChild(card);
  });
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
  document.querySelector("#detailItems").textContent = customer.items || "未填寫";
  document.querySelector("#detailNotes").textContent = customer.notes || "無";

  const address = document.querySelector("#detailAddress");
  address.textContent = customer.address || "未填寫";
  customer.address ? (address.href = mapsUrl(customer.address)) : address.removeAttribute("href");

  const calendar = document.querySelector("#detailCalendar");
  const calUrl = calendarUrl(customer);
  calendar.textContent = customer.nextDelivery ? `${formatDate(customer.nextDelivery)}　加入 Google 行事曆` : "未設定";
  calUrl ? (calendar.href = calUrl) : calendar.removeAttribute("href");

  const recordRows = document.querySelector("#recordRows");
  const records = buildRecords(customer);
  recordRows.innerHTML = records.map((record) => `
    <div class="record-row">
      <span>${record.date}</span>
      <span>${record.type}</span>
      <strong>${record.amount}</strong>
    </div>
  `).join("");
}

function buildRecords(customer) {
  const updated = formatDate(customer.updatedAt || new Date().toISOString());
  const created = formatDate(customer.createdAt || new Date().toISOString());
  const records = [];
  if (Number(customer.payment || 0) > 0) records.push({ date: updated, type: "收款", amount: money(customer.payment) });
  if (Number(customer.debt || 0) > 0) records.push({ date: updated, type: "積欠", amount: money(customer.debt) });
  if (!records.length) records.push({ date: created, type: "建立資料", amount: money(getTotal(customer)) });
  return records;
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
    本次收款: customer.payment,
    欠款金額: customer.debt,
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
  const payment = Number(row["本次收款"] || row["收款金額"] || row.payment || 0);
  const debt = Number(row["欠款金額"] || row["積欠金額"] || row.debt || 0);
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
document.querySelector("#editDetailButton").addEventListener("click", () => selectedId && openForm(selectedId));
document.querySelector("#searchToggle").addEventListener("click", () => searchBox.hidden = !searchBox.hidden);
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderList();
  });
});
document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.tab === "settings") showScreen("settings");
    else showScreen("home");
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
signOutButton.addEventListener("click", () => {
  activeUser = null;
  localStorage.removeItem(USER_KEY);
  updateUserUi();
  loadCustomers();
});
themeButton.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

setTheme(localStorage.getItem(THEME_KEY) || "dark");
loadCustomers();
window.addEventListener("load", initGoogleLogin);
