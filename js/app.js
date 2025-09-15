// app.js — пользовательский интерфейс
const STORAGE_KEY = 'bookstore_books';

async function fetchSeedIfEmpty(){
  if(!localStorage.getItem(STORAGE_KEY)){
    try{
      const resp = await fetch('data/books_sample.json');
      const json = await resp.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
    }catch(e){
      console.error('Не удалось загрузить seed:', e);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  }
}

function loadBooks(){
  const raw = localStorage.getItem(STORAGE_KEY) || '[]';
  return JSON.parse(raw);
}

function saveBooks(arr){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function unique(values){ return [...new Set(values)].sort(); }

function buildFilters(books){
  const cat = document.getElementById('filterCategory');
  const auth = document.getElementById('filterAuthor');
  const year = document.getElementById('filterYear');
  // reset
  cat.innerHTML = '<option value="">Все категории</option>';
  auth.innerHTML = '<option value="">Все авторы</option>';
  year.innerHTML = '<option value="">Все годы</option>';

  unique(books.map(b=>b.category)).forEach(c=>{
    const o = document.createElement('option'); o.value = c; o.textContent = c; cat.appendChild(o);
  });
  unique(books.map(b=>b.author)).forEach(c=>{
    const o = document.createElement('option'); o.value = c; o.textContent = c; auth.appendChild(o);
  });
  unique(books.map(b=>b.year)).forEach(c=>{
    const o = document.createElement('option'); o.value = c; o.textContent = c; year.appendChild(o);
  });
}

function render(){
  let books = loadBooks();
  buildFilters(books);
  const catalog = document.getElementById('catalog');
  catalog.innerHTML = '';

  // apply filters
  const fc = document.getElementById('filterCategory').value;
  const fa = document.getElementById('filterAuthor').value;
  const fy = document.getElementById('filterYear').value;
  const sort = document.getElementById('sortBy').value;

  if(fc) books = books.filter(b=>b.category===fc);
  if(fa) books = books.filter(b=>b.author===fa);
  if(fy) books = books.filter(b=>String(b.year)===String(fy));

  if(sort){
    if(sort==='price-asc') books.sort((a,b)=>a.price-b.price);
    if(sort==='price-desc') books.sort((a,b)=>b.price-a.price);
    if(sort==='year-asc') books.sort((a,b)=>a.year-b.year);
    if(sort==='year-desc') books.sort((a,b)=>b.year-a.year);
  }

  books.forEach(b=>{
    const el = document.createElement('div'); el.className='card';
    el.innerHTML = `
      <h3>${escapeHtml(b.title)}</h3>
      <div class="meta">${escapeHtml(b.author)} • ${b.category} • ${b.year}</div>
      <div class="meta">Цена: ${b.price} ₽ • Статус: <span class="status-dot ${statusClass(b.status)}"></span>${b.status}</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-primary" ${!b.available ? 'disabled' : ''} data-id="${b.id}" data-action="buy">Купить</button>
        <button class="btn btn-ghost small" ${!b.available ? 'disabled' : ''} data-id="${b.id}" data-action="rent">Арендовать</button>
      </div>
    `;
    catalog.appendChild(el);
  });
}

function statusClass(st){
  if(st==='available') return 'status-available';
  if(st==='rented') return 'status-rented';
  return 'status-unavailable';
}

function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function attachHandlers(){
  document.getElementById('catalog').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if(action==='buy') handleBuy(id);
    if(action==='rent') handleRent(id);
  });

  ['filterCategory','filterAuthor','filterYear','sortBy'].forEach(id=>{
    document.getElementById(id).addEventListener('change', render);
  });
}

function handleBuy(id){
  if(!confirm('Купить книгу?')) return;
  const books = loadBooks();
  const idx = books.findIndex(b=>b.id===id);
  if(idx===-1) return alert('Книга не найдена');
  books[idx].available = false;
  books[idx].status = 'unavailable';
  saveBooks(books);
  alert(`Книга "${books[idx].title}" куплена за ${books[idx].price} ₽`);
  render();
}

function handleRent(id){
  const dur = prompt('Выберите срок аренды: 1) 2 недели  2) 1 месяц  3) 3 месяца\nВведите 1,2 или 3');
  if(!['1','2','3'].includes(dur)) return alert('Отмена аренды');
  const days = dur==='1' ? 14 : (dur==='2' ? 30 : 90);
  const books = loadBooks();
  const idx = books.findIndex(b=>b.id===id);
  if(idx===-1) return alert('Книга не найдена');
  const now = Date.now();
  const expiry = now + days * 24 * 3600 * 1000;
  // добавить запись аренды
  books[idx].rents = books[idx].rents || [];
  books[idx].rents.push({ rentedAt: now, expiresAt: expiry, id: `rent-${Date.now()}` });
  books[idx].status = 'rented';
  books[idx].available = false;
  saveBooks(books);
  alert(`Книга "${books[idx].title}" арендована до ${new Date(expiry).toLocaleString()}`);
  render();
}

// При загрузке
(async function init(){
  await fetchSeedIfEmpty();
  attachHandlers();
  render();
  // также периодически проверяем просрочки и показываем (пользовательская сторона — только консоль)
  setInterval(()=>{
    const books = loadBooks();
    const now = Date.now();
    books.forEach(b=>{
      if(b.rents && b.rents.length){
        // удаляем просроченные аренды и обновляем доступность
        const before = b.rents.length;
        b.rents = b.rents.filter(r=>r.expiresAt > now);
        if(b.rents.length===0 && before>0){
          b.status = 'available';
          b.available = true;
        }
      }
    });
    saveBooks(books);
  }, 30_000);
})();
