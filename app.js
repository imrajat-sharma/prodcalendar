const $ = (selector) => document.querySelector(selector);
const grid = $("#calendar-grid");
const today = new Date();
const localDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = localDay(today);
let entryType = "event";
let selectedColor = "coral";
let lastFocusedElement = null;
let currentDetailId = null;
let toastTimer;
let backgroundKind = localStorage.getItem("daymark-background-kind") || "gradient";
let backgroundImage = localStorage.getItem("daymark-background-image") || "";
const colors = {
  coral: "#e97863",
  violet: "#8e77bc",
  teal: "#53a9a2",
  gold: "#d8a12d",
};
const monthPalettes = [
  { accent: "#687957", tint: "#e7ebdf", header: "#f0f2ea" },
  { accent: "#a66448", tint: "#f3e7df", header: "#f7efe9" },
  { accent: "#5f806a", tint: "#e4eee5", header: "#eef4ee" },
  { accent: "#5c7773", tint: "#e5eeeb", header: "#f0f5f3" },
  { accent: "#a66c67", tint: "#f2e7e4", header: "#f8f0ee" },
  { accent: "#587e82", tint: "#e4eeed", header: "#eef5f4" },
  { accent: "#9a783f", tint: "#f2ecdd", header: "#f8f4e9" },
  { accent: "#63734e", tint: "#e9ecdf", header: "#f1f3e9" },
  { accent: "#8b7059", tint: "#eee8df", header: "#f5f1eb" },
  { accent: "#4f7565", tint: "#e3ece7", header: "#eef4f0" },
  { accent: "#9a644e", tint: "#f2e7df", header: "#f8f0ea" },
  { accent: "#687d79", tint: "#e6edeb", header: "#f0f4f2" },
];
let entries = JSON.parse(localStorage.getItem("daymark-entries") || "[]");
let festivals = JSON.parse(localStorage.getItem("daymark-festivals") || "[]");

function keyFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseKey(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sameDay(a, b) {
  return keyFor(a) === keyFor(b);
}
function save() {
  localStorage.setItem("daymark-entries", JSON.stringify(entries));
  localStorage.setItem("daymark-festivals", JSON.stringify(festivals));
}
function escapeHTML(value = "") {
  const el = document.createElement("div");
  el.textContent = value;
  return el.innerHTML;
}
function itemColor(item) {
  return item.color || colors[item.colorName] || "#d7a12e";
}
function itemAlias(item) {
  return item.kind === "festival" ? item.title : item.label || item.title;
}
function itemPreview(item) {
  return [
    item.time,
    item.title,
    item.kind !== "festival" && item.label,
    item.details,
  ]
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
}
function itemById(id) {
  return (
    entries.find((item) => item.id === id) ||
    festivals.find((item) => item.id === id)
  );
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function renderCalendar() {
  const year = viewDate.getFullYear(),
    month = viewDate.getMonth();
  const palette = monthPalettes[(year * 12 + month) % monthPalettes.length];
  const calendarPanel = document.querySelector(".calendar-panel");
  calendarPanel.style.setProperty("--month-accent", palette.accent);
  calendarPanel.style.setProperty("--month-light-tint", palette.tint);
  calendarPanel.style.setProperty("--month-light-header", palette.header);
  $("#month-title").textContent = viewDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  $("#month-kicker").textContent = "Month view";
  grid.innerHTML = "";
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysThisMonth = new Date(year, month + 1, 0).getDate();
  const daysBefore = new Date(year, month, 0).getDate();
  for (let slot = 0; slot < 42; slot++) {
    const date =
      slot < firstWeekday
        ? new Date(year, month - 1, daysBefore - firstWeekday + slot + 1)
        : slot >= firstWeekday + daysThisMonth
          ? new Date(year, month + 1, slot - firstWeekday - daysThisMonth + 1)
          : new Date(year, month, slot - firstWeekday + 1);
    const dateKey = keyFor(date);
    const cellEntries = entries.filter((item) => item.date === dateKey);
    const cellFestivals = festivals.filter((item) => item.date === dateKey);
    const displayItems = [...cellEntries, ...cellFestivals];
    const cell = document.createElement("div");
    cell.className = `day-cell ${slot % 7 === 0 ? "sunday" : ""} ${displayItems.length ? "has-items" : ""} ${date.getMonth() !== month ? "muted" : ""} ${sameDay(date, today) ? "today" : ""} ${sameDay(date, selectedDate) ? "selected" : ""}`;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute(
      "aria-label",
      `${date.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}${displayItems.length ? `, ${displayItems.length} item${displayItems.length > 1 ? "s" : ""}` : ""}`,
    );
    cell.setAttribute("aria-selected", String(sameDay(date, selectedDate)));
    cell.innerHTML = `<button type="button" class="day-selector" aria-label="Select ${date.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}"><span class="day-number">${date.getDate()}</span></button><span class="day-indicators">${displayItems
      .slice(0, 2)
      .map(
        (item) =>
          `<button type="button" class="calendar-entry ${item.kind === "festival" ? "festival" : item.type} ${item.important ? "important" : ""}" data-entry-id="${escapeHTML(item.id)}" data-preview="${escapeHTML(itemPreview(item))}" style="--entry-color:${itemColor(item)}" aria-label="Open ${escapeHTML(item.title)}">${item.important ? '<span class="important-star">★</span>' : ""}<span class="entry-emoji">${escapeHTML(item.icon || "✦")}</span><span class="entry-alias">${escapeHTML(itemAlias(item))}</span></button>`,
      )
      .join(
        "",
      )}${displayItems.length > 2 ? `<button type="button" class="calendar-entry more" data-select-date="${dateKey}" aria-label="Show all ${displayItems.length} items on this day">+${displayItems.length - 2} more</button>` : ""}</span>`;
    cell.querySelector(".day-selector").addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
      renderAgenda();
    });
    cell
      .querySelectorAll("[data-entry-id]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openDetail(button.dataset.entryId, button),
        ),
      );
    cell.querySelector("[data-select-date]")?.addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
      renderAgenda();
    });
    cell.addEventListener("click", (event) => {
      if (!event.target.closest("button")) {
        selectedDate = date;
        renderCalendar();
        renderAgenda();
      }
    });
    grid.appendChild(cell);
  }
}

function renderAgenda() {
  $("#selected-date-title").textContent = sameDay(selectedDate, today)
    ? "Today"
    : selectedDate.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const dayItems = [...entries, ...festivals]
    .filter((item) => item.date === keyFor(selectedDate))
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  $("#selected-day-label").textContent = dayItems.length
    ? `${dayItems.length} item${dayItems.length === 1 ? "" : "s"} planned`
    : "Selected day";
  const list = $("#agenda-list");
  if (!dayItems.length) {
    list.innerHTML = `<p class="agenda-empty">Nothing here yet. Make some space for what matters.</p>`;
    return;
  }
  list.innerHTML = dayItems
    .map(
      (item) =>
        `<article class="agenda-item" style="--entry-color:${item.color || colors[item.colorName] || "#d7a12e"}"><span class="agenda-item-icon">${item.icon || "✦"}</span><div class="agenda-content"><div class="agenda-name">${escapeHTML(item.title)}</div><div class="agenda-meta"><span>${item.time || (item.kind === "festival" ? "Festival" : item.type === "note" ? "Note" : "All day")}</span>${item.label ? `<span>• ${escapeHTML(item.label)}</span>` : ""}</div></div>${item.kind !== "festival" ? `<button class="delete-entry" data-delete="${item.id}" aria-label="Delete ${escapeHTML(item.title)}"><i data-lucide="trash-2"></i></button>` : ""}</article>`,
    )
    .join("");
  list.querySelectorAll("[data-delete]").forEach((button) =>
    button.addEventListener("click", () => {
      entries = entries.filter((item) => item.id !== button.dataset.delete);
      save();
      renderCalendar();
      renderAgenda();
      lucide.createIcons();
      showToast("Event removed");
    }),
  );
  lucide.createIcons();
}

function openDetail(id, origin) {
  const item = itemById(id);
  if (!item) return;
  currentDetailId = id;
  lastFocusedElement = origin || document.activeElement;
  const kind =
    item.kind === "festival"
      ? "Holiday"
      : item.type === "note"
        ? "Note"
        : "Event";
  $("#detail-modal").style.setProperty("--detail-color", itemColor(item));
  $("#detail-icon").textContent = item.icon || "✦";
  $("#detail-type-icon").setAttribute(
    "data-lucide",
    item.kind === "festival"
      ? "party-popper"
      : item.type === "note"
        ? "sticky-note"
        : "calendar-days",
  );
  $("#detail-kind").textContent = kind;
  $("#detail-date").textContent = parseKey(item.date).toLocaleDateString(
    "en-IN",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );
  $("#detail-title").textContent = item.title;
  $("#detail-meta").innerHTML =
    `<span><i data-lucide="clock-3"></i>${item.time || "All day"}</span>${item.label && item.kind !== "festival" ? `<span><i data-lucide="tag"></i>${escapeHTML(item.label)}</span>` : ""}`;
  $("#detail-body").innerHTML = item.details
    ? `<p>${escapeHTML(item.details).replace(/\n/g, "<br>")}</p>`
    : `<p class="detail-empty">No additional notes for this ${kind.toLowerCase()}.</p>`;
  const importantButton = $("#mark-important");
  importantButton.classList.toggle("is-important", Boolean(item.important));
  importantButton.setAttribute("aria-pressed", String(Boolean(item.important)));
  importantButton.innerHTML = `<i data-lucide="star"></i><span>${item.important ? "Marked as important" : "Mark as important"}</span>`;
  $("#detail-backdrop").hidden = false;
  lucide.createIcons();
  requestAnimationFrame(() => $("#detail-close").focus());
}

function closeDetail() {
  $("#detail-backdrop").hidden = true;
  currentDetailId = null;
  lastFocusedElement?.focus?.();
}

function toggleImportance() {
  const item = itemById(currentDetailId);
  if (!item) return;
  item.important = !item.important;
  save();
  renderCalendar();
  renderAgenda();
  openDetail(item.id, $("#mark-important"));
  showToast(item.important ? "Marked as important" : "Removed from important");
}

function openModal(date = selectedDate) {
  lastFocusedElement = document.activeElement;
  $("#entry-date").value = keyFor(date);
  $("#modal-backdrop").hidden = false;
  requestAnimationFrame(() => $("#entry-title").focus());
}
function closeModal() {
  $("#modal-backdrop").hidden = true;
  $("#entry-form").reset();
  entryType = "event";
  document
    .querySelectorAll(".type-tab")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.type === entryType),
    );
  selectedColor = "coral";
  document
    .querySelectorAll(".color-choice")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.color === selectedColor),
    );
  lastFocusedElement?.focus?.();
}

function applyBackground() {
  document.body.dataset.background = backgroundKind;
  document.body.style.setProperty(
    "--wallpaper-image",
    backgroundKind === "image" && backgroundImage ? `url("${backgroundImage.replace(/"/g, "\\\"")}")` : "none",
  );
  try {
    localStorage.setItem("daymark-background-kind", backgroundKind);
    if (backgroundImage) localStorage.setItem("daymark-background-image", backgroundImage);
    else localStorage.removeItem("daymark-background-image");
    return true;
  } catch (error) {
    console.warn("Could not save wallpaper preference:", error);
    showToast("Wallpaper applied for now, but the image is too large to save");
    return false;
  }
}
function setBackgroundOption(kind) {
  backgroundKind = kind;
  document.querySelectorAll("[data-background]").forEach((button) => {
    const active = button.dataset.background === kind;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
}
function openCustomize() {
  lastFocusedElement = document.activeElement;
  setBackgroundOption(backgroundKind);
  $("#wallpaper-url").value = backgroundImage.startsWith("data:") ? "" : backgroundImage;
  $("#customize-backdrop").hidden = false;
  requestAnimationFrame(() => $("#wallpaper-file").focus());
}
function closeCustomize() {
  $("#customize-backdrop").hidden = true;
  $("#wallpaper-file").value = "";
  lastFocusedElement?.focus?.();
}
function changeMonth(amount) {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + amount, 1);
  renderCalendar();
}

function updateClock() {
  const now = new Date();
  $("#live-time").textContent = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
    .format(now)
    .replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
  $("#live-date").textContent = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
}

async function fetchFestivals() {
  const year = viewDate.getFullYear();
  const status = $("#festival-status");
  const button = $("#fetch-festivals");
  status.textContent = "Fetching";
  button.disabled = true;
  try {
    const response = await fetch(
      `https://api.api-ninjas.com/v1/publicholidays?country=IND&year=${year}`,
      { headers: { "X-Api-Key": "C7VCFKlSDpL5UZ3OmdSXT3kseYu7Nkxd0Y4HJXRO" } },
    );
    if (!response.ok)
      throw new Error(`Holiday API returned HTTP ${response.status}`);
    const holidays = await response.json();
    if (!Array.isArray(holidays) || !holidays.length) {
      throw new Error("Holiday API returned no holidays");
    }
    const parsed = holidays.map((item) => ({
      id: `holiday-${item.date}-${item.name}`,
      date: item.date,
      title: item.name,
      kind: "festival",
      type: "festival",
      icon: "✦",
      color: "#d7a12e",
      label: "IND",
    }));
    festivals = [
      ...festivals.filter((item) => !item.date.startsWith(`${year}-`)),
      ...parsed,
    ];
    save();
    status.textContent = `${parsed.length} added`;
    renderCalendar();
    renderAgenda();
    showToast(`${parsed.length} holidays added`);
  } catch (error) {
    console.error("Could not load holidays:", error);
    status.textContent = "Try again";
    showToast("Could not load holidays. Check the API key and try again.");
  } finally {
    button.disabled = false;
  }
}

$("#quick-add").addEventListener("click", () => openModal());
$("#customize-button").addEventListener("click", openCustomize);
$("#customize-close").addEventListener("click", closeCustomize);
$("#customize-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#customize-backdrop")) closeCustomize();
});
document.querySelectorAll("[data-background]").forEach((button) =>
  button.addEventListener("click", () => setBackgroundOption(button.dataset.background)),
);
$("#wallpaper-file").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Please select an image file");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    backgroundImage = reader.result;
    setBackgroundOption("image");
    showToast("Wallpaper ready to apply");
  });
  reader.readAsDataURL(file);
});
$("#apply-wallpaper").addEventListener("click", () => {
  const url = $("#wallpaper-url").value.trim();
  if (url) {
    try {
      backgroundImage = new URL(url).href;
    } catch {
      showToast("Enter a valid image URL");
      return;
    }
    setBackgroundOption("image");
  }
  if (backgroundKind === "image" && !backgroundImage) {
    showToast("Choose an image or enter an image URL");
    return;
  }
  applyBackground();
  closeCustomize();
  showToast(backgroundKind === "image" ? "Wallpaper applied" : "Soft gradient restored");
});
$("#clear-wallpaper").addEventListener("click", () => {
  backgroundImage = "";
  setBackgroundOption("gradient");
  $("#wallpaper-url").value = "";
  $("#wallpaper-file").value = "";
  applyBackground();
  showToast("Background reset");
});
$("#add-for-day").addEventListener("click", () => openModal());
$("#modal-close").addEventListener("click", closeModal);
$("#modal-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#modal-backdrop")) closeModal();
});
$("#detail-close").addEventListener("click", closeDetail);
$("#detail-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#detail-backdrop")) closeDetail();
});
$("#mark-important").addEventListener("click", toggleImportance);
$("#prev-month").addEventListener("click", () => changeMonth(-1));
$("#next-month").addEventListener("click", () => changeMonth(1));
$("#today-button").addEventListener("click", () => {
  viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = localDay(today);
  renderCalendar();
  renderAgenda();
});
$("#fetch-festivals").addEventListener("click", fetchFestivals);
$(".type-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-type]");
  if (!tab) return;
  entryType = tab.dataset.type;
  document
    .querySelectorAll(".type-tab")
    .forEach((item) => item.classList.toggle("active", item === tab));
});
$("#color-picker").addEventListener("click", (event) => {
  const choice = event.target.closest("[data-color]");
  if (!choice) return;
  selectedColor = choice.dataset.color;
  document
    .querySelectorAll(".color-choice")
    .forEach((item) => item.classList.toggle("active", item === choice));
});
$("#theme-toggle").addEventListener("click", () => {
  const dark = document.body.dataset.theme !== "dark";
  document.body.dataset.theme = dark ? "dark" : "light";
  $("#theme-toggle").innerHTML =
    `<i data-lucide="${dark ? "sun" : "moon"}"></i>`;
  lucide.createIcons();
  localStorage.setItem("daymark-theme", document.body.dataset.theme);
});
$("#entry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("#entry-title").value.trim();
  if (!title) return;
  const isNote = entryType === "note";
  entries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title,
    date: $("#entry-date").value,
    time: $("#entry-time").value,
    label: $("#entry-label").value.trim(),
    icon: $("#entry-icon").value,
    colorName: selectedColor,
    type: entryType,
    details: $("#entry-details").value.trim(),
  });
  selectedDate = parseKey($("#entry-date").value);
  viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  save();
  closeModal();
  renderCalendar();
  renderAgenda();
  showToast(isNote ? "Note added" : "Event added");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#customize-backdrop").hidden) {
    closeCustomize();
    return;
  }
  if (event.key === "Escape" && !$("#detail-backdrop").hidden) {
    closeDetail();
    return;
  }
  if (event.key === "Escape" && !$("#modal-backdrop").hidden) {
    closeModal();
    return;
  }
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(
    document.activeElement?.tagName,
  );
  if (
    event.key.toLowerCase() === "n" &&
    !typing &&
    $("#modal-backdrop").hidden &&
    $("#detail-backdrop").hidden
  ) {
    event.preventDefault();
    openModal();
  }
});

const savedTheme = localStorage.getItem("daymark-theme");
if (savedTheme === "dark") {
  document.body.dataset.theme = "dark";
  $("#theme-toggle").innerHTML = '<i data-lucide="sun"></i>';
}
applyBackground();
updateClock();
setInterval(updateClock, 1000);
renderCalendar();
renderAgenda();
lucide.createIcons();
