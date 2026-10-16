const $ = (selector) => document.querySelector(selector);
const grid = $('#calendar-grid');
const today = new Date();
const localDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = localDay(today);
let entryType = 'event';
let selectedColor = 'coral';
const colors = { coral: '#e97863', violet: '#8e77bc', teal: '#53a9a2', gold: '#d8a12d' };
const quotes = [
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Little by little, a little becomes a lot.', 'Tanzanian proverb'],
  ['What you do today can improve all your tomorrows.', 'Ralph Marston'],
  ['Focus on being productive instead of busy.', 'Tim Ferriss']
];
let entries = JSON.parse(localStorage.getItem('daymark-entries') || '[]');
let festivals = JSON.parse(localStorage.getItem('daymark-festivals') || '[]');

function keyFor(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function parseKey(value) { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d); }
function sameDay(a,b) { return keyFor(a) === keyFor(b); }
function save() { localStorage.setItem('daymark-entries', JSON.stringify(entries)); localStorage.setItem('daymark-festivals', JSON.stringify(festivals)); }
function escapeHTML(value = '') { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; }

function renderCalendar() {
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  $('#month-title').textContent = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  $('#month-kicker').textContent = `${viewDate.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase()} AT A GLANCE`;
  grid.innerHTML = '';
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysThisMonth = new Date(year, month + 1, 0).getDate();
  const daysBefore = new Date(year, month, 0).getDate();
  for (let slot = 0; slot < 42; slot++) {
    const date = slot < firstWeekday ? new Date(year, month - 1, daysBefore - firstWeekday + slot + 1) : slot >= firstWeekday + daysThisMonth ? new Date(year, month + 1, slot - firstWeekday - daysThisMonth + 1) : new Date(year, month, slot - firstWeekday + 1);
    const dateKey = keyFor(date);
    const cellEntries = entries.filter(item => item.date === dateKey);
    const cellFestivals = festivals.filter(item => item.date === dateKey);
    const displayItems = [...cellEntries, ...cellFestivals];
    const cell = document.createElement('button');
    cell.type = 'button'; cell.className = `day-cell ${date.getMonth() !== month ? 'muted' : ''} ${sameDay(date,today) ? 'today' : ''} ${sameDay(date,selectedDate) ? 'selected' : ''}`;
    cell.setAttribute('aria-label', date.toLocaleDateString('en-IN', { weekday:'long', month:'long', day:'numeric' }));
    cell.innerHTML = `<span class="day-number">${date.getDate()}</span><span class="day-indicators">${displayItems.slice(0,2).map(item => `<i class="calendar-entry ${item.kind === 'festival' ? 'festival' : item.type}" style="--entry-color:${item.color || colors[item.colorName] || '#d7a12e'}"></i>`).join('')}${displayItems.length > 2 ? `<i class="calendar-entry more">+${displayItems.length - 2}</i>` : ''}</span>`;
    cell.addEventListener('click', () => { selectedDate = date; renderCalendar(); renderAgenda(); });
    grid.appendChild(cell);
  }
}

function renderAgenda() {
  $('#selected-date-title').textContent = sameDay(selectedDate, today) ? 'Today' : selectedDate.toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' });
  const dayItems = [...entries, ...festivals].filter(item => item.date === keyFor(selectedDate)).sort((a,b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const list = $('#agenda-list');
  if (!dayItems.length) { list.innerHTML = `<p class="agenda-empty">Nothing here yet. Make some space for what matters.</p>`; return; }
  list.innerHTML = dayItems.map(item => `<article class="agenda-item" style="--entry-color:${item.color || colors[item.colorName] || '#d7a12e'}"><span class="agenda-item-icon">${item.icon || '✦'}</span><div class="agenda-content"><div class="agenda-name">${escapeHTML(item.title)}</div><div class="agenda-meta"><span>${item.time || (item.kind === 'festival' ? 'Festival' : item.type === 'note' ? 'Note' : 'All day')}</span>${item.label ? `<span>• ${escapeHTML(item.label)}</span>` : ''}</div></div>${item.kind !== 'festival' ? `<button class="delete-entry" data-delete="${item.id}" aria-label="Delete ${escapeHTML(item.title)}"><i data-lucide="trash-2"></i></button>` : ''}</article>`).join('');
  list.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => { entries = entries.filter(item => item.id !== button.dataset.delete); save(); renderCalendar(); renderAgenda(); lucide.createIcons(); }));
  lucide.createIcons();
}

function openModal(date = selectedDate) { $('#entry-date').value = keyFor(date); $('#modal-backdrop').hidden = false; $('#entry-title').focus(); }
function closeModal() { $('#modal-backdrop').hidden = true; $('#entry-form').reset(); }
function changeMonth(amount) { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + amount, 1); renderCalendar(); }

function updateClock() {
  const now = new Date();
  $('#live-time').textContent = new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(now);
  $('#live-date').textContent = new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', weekday:'short', day:'numeric', month:'short' }).format(now);
}

async function fetchFestivals() {
  const year = viewDate.getFullYear(); const status = $('#festival-status'); const button = $('#fetch-festivals');
  status.textContent = 'Fetching'; button.disabled = true;
  try {
    const endpoint = `https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Could not reach calendar');
    const ics = await response.text();
    const blocks = ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const parsed = blocks.map(block => {
      const date = (block.match(/DTSTART(?:;VALUE=DATE)?:([0-9]{8})/) || [])[1];
      const title = (block.match(/SUMMARY:(.*)/) || [])[1];
      if (!date || !title) return null;
      const parsedDate = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
      return { id:`festival-${parsedDate}-${title}`, date:parsedDate, title:title.replace(/\\,/g, ',').replace(/\\n/g, ' '), kind:'festival', type:'festival', icon:'✦', color:'#d7a12e', label:'India' };
    }).filter(Boolean).filter(item => item.date.startsWith(`${year}-`));
    festivals = [...festivals.filter(item => !item.date.startsWith(`${year}-`)), ...parsed]; save();
    status.textContent = `${parsed.length} added`; renderCalendar(); renderAgenda();
  } catch (error) {
    // Some browsers block the public Google Calendar ICS file. Nager's open
    // India holiday feed makes the feature still useful in that case.
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`);
      if (!response.ok) throw new Error('Holiday feed unavailable');
      const holidays = await response.json();
      const parsed = holidays.map(item => ({
        id: `holiday-${item.date}-${item.name}`,
        date: item.date,
        title: item.localName || item.name,
        kind: 'festival', type: 'festival', icon: '✦', color: '#d7a12e', label: 'India'
      }));
      festivals = [...festivals.filter(item => !item.date.startsWith(`${year}-`)), ...parsed]; save();
      status.textContent = `${parsed.length} added`; renderCalendar(); renderAgenda();
    } catch (fallbackError) {
      status.textContent = 'Try again';
    }
  } finally { button.disabled = false; }
}

$('#quick-add').addEventListener('click', () => openModal()); $('#add-for-day').addEventListener('click', () => openModal());
$('#modal-close').addEventListener('click', closeModal); $('#modal-backdrop').addEventListener('click', event => { if(event.target === $('#modal-backdrop')) closeModal(); });
$('#prev-month').addEventListener('click', () => changeMonth(-1)); $('#next-month').addEventListener('click', () => changeMonth(1));
$('#today-button').addEventListener('click', () => { viewDate = new Date(today.getFullYear(),today.getMonth(),1); selectedDate = localDay(today); renderCalendar(); renderAgenda(); });
$('#fetch-festivals').addEventListener('click', fetchFestivals);
$('.type-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-type]'); if (!tab) return; entryType = tab.dataset.type; document.querySelectorAll('.type-tab').forEach(item => item.classList.toggle('active', item === tab)); });
$('#color-picker').addEventListener('click', event => { const choice = event.target.closest('[data-color]'); if(!choice) return; selectedColor = choice.dataset.color; document.querySelectorAll('.color-choice').forEach(item => item.classList.toggle('active', item === choice)); });
document.querySelectorAll('[data-wallpaper]').forEach(button => button.addEventListener('click', () => { document.body.dataset.wallpaper = button.dataset.wallpaper; document.querySelectorAll('.wallpaper').forEach(item => item.classList.toggle('active', item === button)); localStorage.setItem('daymark-wallpaper', button.dataset.wallpaper); }));
$('#theme-toggle').addEventListener('click', () => { const dark = document.body.dataset.theme !== 'dark'; document.body.dataset.theme = dark ? 'dark' : 'light'; $('#theme-toggle').innerHTML = `<i data-lucide="${dark ? 'sun' : 'moon'}"></i>`; lucide.createIcons(); localStorage.setItem('daymark-theme', document.body.dataset.theme); });
$('#entry-form').addEventListener('submit', event => { event.preventDefault(); const title = $('#entry-title').value.trim(); if(!title) return; entries.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, date:$('#entry-date').value, time:$('#entry-time').value, label:$('#entry-label').value.trim(), icon:$('#entry-icon').value, colorName:selectedColor, type:entryType, details:$('#entry-details').value.trim() }); selectedDate = parseKey($('#entry-date').value); viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1); save(); closeModal(); renderCalendar(); renderAgenda(); });

const savedWallpaper = localStorage.getItem('daymark-wallpaper'); if (savedWallpaper) { document.body.dataset.wallpaper = savedWallpaper; document.querySelector(`.wallpaper[data-wallpaper="${savedWallpaper}"]`)?.classList.add('active'); document.querySelectorAll('.wallpaper:not([data-wallpaper="'+savedWallpaper+'"])').forEach(x=>x.classList.remove('active')); }
const savedTheme = localStorage.getItem('daymark-theme'); if (savedTheme === 'dark') { document.body.dataset.theme = 'dark'; $('#theme-toggle').innerHTML = '<i data-lucide="sun"></i>'; }
const quote = quotes[new Date().getDate() % quotes.length]; $('#daily-quote').textContent = quote[0]; $('#daily-quote').nextElementSibling.textContent = `— ${quote[1]}`;
updateClock(); setInterval(updateClock, 1000); renderCalendar(); renderAgenda(); lucide.createIcons();
