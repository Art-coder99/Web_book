// admin.js
const STORAGE_KEY = 'bookstore_books';
const ADMIN_PASS = 'admin123';

function loadBooks(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveBooks(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

function elt(tag, attrs={}, inner=''){ const e=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); e.innerHTML=inner; return e; }

function showLogin(){ document.getElementById('loginSection').style.display='block'; document.getElementById('adminArea').style.display='none'; }
function showAdmin(){ document.getElementById('loginSection').style.display='none'; document.getElementById('adminArea').style.display='block'; renderList(); }

document.getElementById('loginBtn').addEventListener('click', ()=>{
  const p = document.getElementById('adminPass').value;
  if(p===ADMIN_PASS) showAdmin(); else alert('Неверный пароль');
});

document.getElementById('newBtn').addEventListener('click', ()=>{
  document.getElementById('bookId').value='';
  ['title','author','category','year','price'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('available').checked=true;
  document.getElementById('status').value='available';
});

document.getElementById('saveBtn').addEventListener('click', ()=>{
  const id = document.getElementById('bookId').value || `b${Date.now()}`;
  const book = {
    id,
    title: document.getElementById('title').value || 'Без названия',
    author: document.getElementById('author').value || 'Неизвестен',
    category: document.getElementById('category').value || 'Прочее',
    year: Number(document.getElementById('year').value) || new Date().getFullYear(),
    price: Number(document.getElementById('price').value) || 0,
    status: document.getElementById('status').value,
    available: document.getElementById('available').checked,
    cover: '',
    rents: []
  };
  let books = loadBooks();
  const idx = books.findIndex(b=>b.id===id);
  if(idx===-1) books.push(book); else books[idx]=book;
  saveBooks(books);
  renderList();
  alert('Сохранено');
});

function renderList(){
  const list = document.getElementById('bookList'); list.innerHTML='';
  const books = loadBooks();
  books.forEach(b=>{
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h3>${escapeHtml(b.title)}</h3>
      <div class="meta">${escapeHtml(b.author)} • ${b.category} • ${b.year}</div>
      <div class="meta">Цена: ${b.price} ₽ • Статус: <span class="status-dot ${statusClass(b.status)}"></span>${b.status}</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-primary" data-id="${b.id}" data-action="edit">Редактировать</button>
        <button class="btn btn-ghost" data-id="${b.id}" data-action="delete">Удалить</button>
        <button class="btn small" data-id="${b.id}" data-action="remind">Напомнить арендаторам</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function statusClass(st){
  if(st==='available') return 'status-available';
  if(st==='rented') return 'status-rented';
  return 'status-unavailable';
}
function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

document.getElementById('bookList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = btn.dataset.id, action = btn.dataset.action;
  if(action==='edit') editBook(id);
  if(action==='delete') deleteBook(id);
  if(action==='remind') manualRemind(id);
});

function editBook(id){
  const books = loadBooks();
  const b = books.find(x=>x.id===id);
  if(!b) return alert('Не найдено');
  document.getElementById('bookId').value = b.id;
  document.getElementById('title').value = b.title;
  document.getElementById('author').value = b.author;
  document.getElementById('category').value = b.category;
  document.getElementById('year').value = b.year;
  document.getElementById('price').value = b.price;
  document.getElementById('available').checked = b.available;
  document.getElementById('status').value = b.status;
}

function deleteBook(id){
  if(!confirm('Удалить книгу?')) return;
  let books = loadBooks();
  books = books.filter(b=>b.id!==id);
  saveBooks(books);
  renderList();
}

function manualRemind(id){
  const books = loadBooks();
  const b = books.find(x=>x.id===id);
  if(!b) return alert('Не найдено');
  const alerts = checkRentsForBook(b);
  showAlerts(alerts);
}

function checkRentsForBook(b){
  const now = Date.now();
  const alerts = [];
  if(b.rents && b.rents.length){
    b.rents.forEach(r=>{
      const remain = r.expiresAt - now;
      if(remain <= 0) alerts.push(`${b.title}: аренда просрочена (закончилась ${new Date(r.expiresAt).toLocaleString()})`);
      else if(remain <= 3*24*3600*1000) alerts.push(`${b.title}: аренда заканчивается скоро (${new Date(r.expiresAt).toLocaleString()})`);
    });
  }
  return alerts;
}

function showAlerts(list){
  const el = document.getElementById('alerts');
  if(!list || list.length===0){ el.innerHTML = '<div class="card">Уведомлений нет</div>'; return; }
  el.innerHTML = '';
  list.forEach(t=>{
    const c = document.createElement('div'); c.className='card'; c.textContent = t; el.appendChild(c);
  });
}

// Автоматическая проверка аренды каждые 10 секунд
function autoCheck(){
  const books = loadBooks();
  const now = Date.now();
  const allAlerts = [];
  let changed = false;
  books.forEach(b=>{
    if(b.rents && b.rents.length){
      b.rents.forEach(r=>{
        const remain = r.expiresAt - now;
        if(remain <= 0){
          allAlerts.push(`${b.title}: аренда просрочена.`);
        } else if(remain <= 3*24*3600*1000){
          allAlerts.push(`${b.title}: аренда заканчивается в ${(Math.ceil(remain/24/3600/1000))} дн.`);
        }
      });
      // убрать просроченные и восстановить доступность
      const before = b.rents.length;
      b.rents = b.rents.filter(r=>r.expiresAt > now);
      if(b.rents.length===0 && before>0){
        b.status = 'available';
        b.available = true;
        changed = true;
      } else if(b.rents.length>0){
        b.status = 'rented';
        b.available = false;
      }
    }
  });
  if(changed) saveBooks(books);
  showAlerts(allAlerts);
}

setInterval(()=>{ if(document.getElementById('adminArea').style.display!=='none') autoCheck(); }, 10_000);

// при старте попробуем инициализировать seed, если нет
(async function initSeed(){
  if(!localStorage.getItem(STORAGE_KEY)){
    try{
      const resp = await fetch('data/books_sample.json');
      const json = await resp.json();
      saveBooks(json);
    }catch(e){
      saveBooks([]);
    }
  }
})();
