/* ==========================================================
   待辦清單 ＆ 番茄鐘 — 主程式（生產力小工具 Productivity Widget）
   功能：新增／編輯／刪除／完成任務、截止日期、優先級、
        搜尋、篩選、排序、統計儀表板、番茄鐘（25分工作／5分休息）、
        深色模式、PWA 離線快取
   ========================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'todo-app:todos';
  var THEME_KEY = 'todo-app:theme';
  var POMO_KEY = 'todo-app:pomodoros';
  var MAX_LEN = 200;
  var PRIORITIES = ['high', 'medium', 'low'];
  var PRIORITY_LABEL = { high: '高', medium: '中', low: '低' };
  var PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var POMO_DURATIONS = { work: 25 * 60, break: 5 * 60 };
  var RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 -> ~326.73

  // ---------- 日期工具 ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 取得本地時區今天的 YYYY-MM-DD 字串 */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** 兩個 YYYY-MM-DD 之間相差的天數（b - a） */
  function dayDiff(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    var ta = Date.UTC(+pa[0], pa[1] - 1, +pa[2]);
    var tb = Date.UTC(+pb[0], pb[1] - 1, +pb[2]);
    return Math.round((tb - ta) / 86400000);
  }

  function formatDate(s) { return s.replace(/-/g, '/'); }

  /** 回傳截止日期狀態：overdue（已逾期）、today（今天到期）、upcoming、none */
  function dueStatus(t) {
    if (!t.dueDate) return 'none';
    var diff = dayDiff(todayStr(), t.dueDate);
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    return 'upcoming';
  }

  function dueLabel(t) {
    var diff = dayDiff(todayStr(), t.dueDate);
    var base = '📅 截止：' + formatDate(t.dueDate);
    if (t.completed) return base;
    if (diff < 0) return base + '（已逾期 ' + (-diff) + ' 天）';
    if (diff === 0) return base + '（今天到期）';
    if (diff === 1) return base + '（明天到期）';
    return base + '（剩 ' + diff + ' 天）';
  }

  // ---------- 資料儲存 ----------
  function sanitize(t) {
    return {
      id: t.id,
      text: t.text,
      completed: !!t.completed,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      dueDate: typeof t.dueDate === 'string' && DATE_RE.test(t.dueDate) ? t.dueDate : '',
      priority: PRIORITIES.indexOf(t.priority) !== -1 ? t.priority : 'medium'
    };
  }

  function loadTodos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (t) {
        return t && typeof t.id === 'string' && typeof t.text === 'string';
      }).map(sanitize); // 舊版資料自動補上優先級與截止日期欄位
    } catch (e) {
      console.warn('讀取任務失敗，已重新開始。', e);
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      toast('無法儲存任務（儲存空間可能已滿或被停用）。', true);
    }
  }

  function loadPomoSessions() {
    try {
      var n = parseInt(localStorage.getItem(POMO_KEY) || '0', 10);
      return isNaN(n) || n < 0 ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function savePomoSessions(n) {
    try { localStorage.setItem(POMO_KEY, String(n)); } catch (e) {}
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // ---------- 狀態 ----------
  var todos = loadTodos();
  var filter = 'all';
  var sortBy = 'created';
  var query = '';
  var editingId = null;
  var justAddedId = null;
  var lastStats = null;

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var form = $('todo-form');
  var input = $('todo-input');
  var dueInput = $('due-input');
  var priorityInput = $('priority-input');
  var list = $('todo-list');
  var searchInput = $('search-input');
  var sortSelect = $('sort-select');
  var filterBtns = document.querySelectorAll('.filter-btn');
  var countEl = $('todo-count');
  var clearBtn = $('clear-completed');
  var emptyState = $('empty-state');
  var themeToggle = $('theme-toggle');
  var toastEl = $('toast');
  var installBtn = $('install-btn');
  var stat = { total: $('stat-total'), completed: $('stat-completed'), active: $('stat-active'), rate: $('stat-rate') };
  var progressBar = $('progress-bar');

  // 番茄鐘 DOM
  var pomoWidget = $('pomodoro-widget');
  var pomoDisplay = $('pomo-display');
  var pomoStatusLabel = $('pomo-status-label');
  var pomoRing = $('pomo-ring-progress');
  var pomoToggleBtn = $('pomo-toggle');
  var pomoResetBtn = $('pomo-reset');
  var pomoSessionsEl = $('pomo-sessions');
  var pomoModeBtns = document.querySelectorAll('.pomo-mode-btn');

  // ---------- 提示訊息 ----------
  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isError ? ' error' : '');
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.hidden = true; }, 3000);
  }

  function normalize(text) {
    return String(text).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  // ---------- 操作 ----------
  function addTodo(text, dueDate, priority) {
    var clean = normalize(text);
    if (!clean) { toast('任務內容不可為空白。', true); return false; }
    var t = sanitize({ id: uid(), text: clean, completed: false, createdAt: Date.now(), dueDate: dueDate, priority: priority });
    todos.unshift(t);
    justAddedId = t.id;
    saveTodos();
    render();
    return true;
  }

  function toggleTodo(id) {
    var t = find(id);
    if (!t) return;
    t.completed = !t.completed;
    saveTodos();
    render();
  }

  function deleteTodo(id) {
    todos = todos.filter(function (t) { return t.id !== id; });
    if (editingId === id) editingId = null;
    saveTodos();
    render();
  }

  function updateTodo(id, fields) {
    var t = find(id);
    if (!t) return;
    var clean = normalize(fields.text);
    if (!clean) { deleteTodo(id); return; } // 清空內容即刪除任務
    t.text = clean;
    t.dueDate = DATE_RE.test(fields.dueDate || '') ? fields.dueDate : '';
    t.priority = PRIORITIES.indexOf(fields.priority) !== -1 ? fields.priority : t.priority;
    editingId = null;
    saveTodos();
    render();
  }

  function clearCompleted() {
    var n = todos.filter(function (t) { return t.completed; }).length;
    todos = todos.filter(function (t) { return !t.completed; });
    saveTodos();
    render();
    if (n) toast('已清除 ' + n + ' 項已完成任務。');
  }

  function find(id) {
    for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
    return null;
  }

  // ---------- 篩選與排序 ----------
  function visibleTodos() {
    var q = query.toLowerCase();
    var items = todos.filter(function (t) {
      if (filter === 'active' && t.completed) return false;
      if (filter === 'completed' && !t.completed) return false;
      if (q && t.text.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var byCreated = function (a, b) { return b.createdAt - a.createdAt; };
    if (sortBy === 'priority') {
      items.sort(function (a, b) { return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || byCreated(a, b); });
    } else if (sortBy === 'due') {
      items.sort(function (a, b) {
        if (a.dueDate && !b.dueDate) return -1; // 無截止日期者排在最後
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byCreated(a, b);
      });
    } else {
      items.sort(byCreated);
    }
    return items;
  }

  // ---------- 畫面渲染 ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // 使用 textContent 防止 XSS
    return e;
  }

  function makeBtn(label, action) {
    var b = el('button', 'action-btn ' + action, label);
    b.type = 'button';
    b.dataset.action = action;
    return b;
  }

  function priorityOptions(selected) {
    var s = el('select', 'field edit-priority');
    s.setAttribute('aria-label', '優先級');
    PRIORITIES.forEach(function (p) {
      var o = el('option', null, PRIORITY_LABEL[p] + '優先級');
      o.value = p;
      if (p === selected) o.selected = true;
      s.appendChild(o);
    });
    return s;
  }

  function renderItem(t) {
    var li = el('li', 'todo-item priority-' + t.priority + (t.completed ? ' completed' : ''));
    if (t.id === justAddedId) li.classList.add('enter');
    li.dataset.id = t.id;

    var cb = el('input', 'toggle');
    cb.type = 'checkbox';
    cb.checked = t.completed;
    cb.setAttribute('aria-label', '將「' + t.text + '」標記為' + (t.completed ? '未完成' : '已完成'));
    li.appendChild(cb);

    var body = el('div', 'todo-body');
    var actions = el('div', 'todo-actions');

    if (editingId === t.id) {
      var fields = el('div', 'todo-edit-fields');
      var edit = el('input', 'field todo-edit');
      edit.type = 'text';
      edit.value = t.text;
      edit.maxLength = MAX_LEN;
      edit.setAttribute('aria-label', '編輯任務內容');
      fields.appendChild(edit);
      var row = el('div', 'todo-edit-row');
      var date = el('input', 'field edit-due');
      date.type = 'date';
      date.value = t.dueDate;
      date.setAttribute('aria-label', '截止日期');
      row.appendChild(date);
      row.appendChild(priorityOptions(t.priority));
      fields.appendChild(row);
      body.appendChild(fields);
      actions.appendChild(makeBtn('儲存', 'save'));
      actions.appendChild(makeBtn('取消', 'cancel'));
    } else {
      var span = el('span', 'todo-text', t.text);
      span.title = '按兩下即可編輯';
      body.appendChild(span);

      var meta = el('div', 'todo-meta');
      meta.appendChild(el('span', 'badge priority-badge ' + t.priority, PRIORITY_LABEL[t.priority] + '優先級'));
      if (t.dueDate) {
        var status = t.completed ? 'none' : dueStatus(t);
        meta.appendChild(el('span', 'badge due-badge' + (status === 'overdue' || status === 'today' ? ' ' + status : ''), dueLabel(t)));
      }
      body.appendChild(meta);
      actions.appendChild(makeBtn('編輯', 'edit'));
      actions.appendChild(makeBtn('刪除', 'delete'));
    }

    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function setStat(node, value) {
    if (node.textContent !== String(value)) {
      node.textContent = value;
      if (lastStats) { // 首次渲染不播放動畫
        node.classList.remove('bump');
        void node.offsetWidth;
        node.classList.add('bump');
      }
    }
  }

  function renderStats() {
    var total = todos.length;
    var done = todos.filter(function (t) { return t.completed; }).length;
    var rate = total ? Math.round((done / total) * 100) : 0;
    setStat(stat.total, total);
    setStat(stat.completed, done);
    setStat(stat.active, total - done);
    setStat(stat.rate, rate + '%');
    progressBar.style.width = rate + '%';
    progressBar.parentNode.setAttribute('aria-valuenow', String(rate));
    lastStats = { total: total, done: done };

    var left = total - done;
    countEl.textContent = '剩餘 ' + left + ' 項任務';
    clearBtn.disabled = done === 0;
  }

  function render() {
    var items = visibleTodos();
    list.textContent = '';
    var frag = document.createDocumentFragment();
    items.forEach(function (t) { frag.appendChild(renderItem(t)); });
    list.appendChild(frag);
    justAddedId = null;

    if (items.length === 0) {
      emptyState.hidden = false;
      if (todos.length === 0) emptyState.textContent = '目前沒有任務，從上方新增一項吧！🎉';
      else if (query) emptyState.textContent = '找不到符合「' + query + '」的任務。';
      else if (filter === 'completed') emptyState.textContent = '尚無已完成的任務。';
      else emptyState.textContent = '所有任務都完成了！🎉';
    } else {
      emptyState.hidden = true;
    }

    renderStats();

    if (editingId) {
      var field = list.querySelector('.todo-edit');
      if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
    }
  }

  function editValues(li) {
    return {
      text: li.querySelector('.todo-edit').value,
      dueDate: li.querySelector('.edit-due').value,
      priority: li.querySelector('.edit-priority').value
    };
  }

  // ---------- 番茄鐘 (Pomodoro Timer) ----------
  var pomo = {
    mode: 'work',
    remaining: POMO_DURATIONS.work,
    running: false,
    timerId: null,
    sessions: loadPomoSessions()
  };

  function formatClock(sec) {
    var s = Math.max(0, Math.floor(sec));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function playChime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }

  function renderPomo() {
    if (!pomoWidget) return;
    pomoWidget.setAttribute('data-mode', pomo.mode);
    pomoDisplay.textContent = formatClock(pomo.remaining);
    pomoStatusLabel.textContent = pomo.mode === 'work' ? '專注工作中' : '休息放鬆中';
    pomoToggleBtn.textContent = pomo.running ? '暫停' : '開始';
    pomoSessionsEl.textContent = '已完成 ' + pomo.sessions + ' 顆🍅';

    var total = POMO_DURATIONS[pomo.mode];
    var ratio = total ? Math.max(0, Math.min(1, pomo.remaining / total)) : 1;
    var offset = RING_CIRCUMFERENCE * (1 - ratio);
    pomoRing.style.strokeDashoffset = offset.toFixed(2);

    pomoModeBtns.forEach(function (b) {
      var on = b.dataset.mode === pomo.mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function stopPomoLoop() {
    if (pomo.timerId) {
      clearInterval(pomo.timerId);
      pomo.timerId = null;
    }
    pomo.running = false;
  }

  function setPomoMode(mode) {
    if (mode !== 'work' && mode !== 'break') return;
    stopPomoLoop();
    pomo.mode = mode;
    pomo.remaining = POMO_DURATIONS[mode];
    renderPomo();
  }

  function stepPomo(seconds) {
    var delta = typeof seconds === 'number' ? seconds : 1;
    pomo.remaining = Math.max(0, pomo.remaining - delta);
    if (pomo.remaining <= 0) {
      stopPomoLoop();
      playChime();
      if (pomo.mode === 'work') {
        pomo.sessions += 1;
        savePomoSessions(pomo.sessions);
        pomo.mode = 'break';
        pomo.remaining = POMO_DURATIONS.break;
        toast('🎉 25分鐘工作完成！開始 5分鐘休息吧。');
      } else {
        pomo.mode = 'work';
        pomo.remaining = POMO_DURATIONS.work;
        toast('⏰ 5分鐘休息結束！準備開始新的番茄鐘。');
      }
    }
    renderPomo();
  }

  function togglePomo() {
    if (pomo.running) {
      stopPomoLoop();
    } else {
      pomo.running = true;
      pomo.timerId = setInterval(function () { stepPomo(1); }, 1000);
    }
    renderPomo();
  }

  function resetPomo() {
    stopPomoLoop();
    pomo.remaining = POMO_DURATIONS[pomo.mode];
    renderPomo();
  }

  if (pomoWidget) {
    pomoToggleBtn.addEventListener('click', togglePomo);
    pomoResetBtn.addEventListener('click', resetPomo);
    pomoModeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setPomoMode(btn.dataset.mode);
      });
    });
    renderPomo();
  }

  // 提供自動化測試控制番茄鐘的輔助介面
  window.__pomoTest = {
    tick: stepPomo,
    setMode: setPomoMode,
    reset: resetPomo,
    getState: function () { return { mode: pomo.mode, remaining: pomo.remaining, running: pomo.running, sessions: pomo.sessions }; }
  };

  // ---------- 事件 ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (addTodo(input.value, dueInput.value, priorityInput.value)) {
      input.value = '';
      dueInput.value = '';
      input.focus();
    }
  });

  list.addEventListener('change', function (e) {
    if (e.target.classList.contains('toggle')) {
      toggleTodo(e.target.closest('.todo-item').dataset.id);
    }
  });

  list.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var li = btn.closest('.todo-item');
    var id = li.dataset.id;
    switch (btn.dataset.action) {
      case 'edit': editingId = id; render(); break;
      case 'delete': deleteTodo(id); break;
      case 'save': updateTodo(id, editValues(li)); break;
      case 'cancel': editingId = null; render(); break;
    }
  });

  list.addEventListener('dblclick', function (e) {
    if (e.target.classList.contains('todo-text')) {
      editingId = e.target.closest('.todo-item').dataset.id;
      render();
    }
  });

  list.addEventListener('keydown', function (e) {
    var li = e.target.closest('.todo-item');
    if (!li || !e.target.closest('.todo-edit-fields')) return;
    if (e.key === 'Enter') { e.preventDefault(); updateTodo(li.dataset.id, editValues(li)); }
    else if (e.key === 'Escape') { editingId = null; render(); }
  });

  // 焦點離開編輯區時自動儲存（若焦點移到同一任務內的其他欄位或按鈕則不儲存）
  list.addEventListener('focusout', function (e) {
    var li = e.target.closest('.todo-item');
    if (!li || !e.target.closest('.todo-edit-fields')) return;
    var next = e.relatedTarget;
    if (next && li.contains(next)) return;
    if (editingId === li.dataset.id) updateTodo(li.dataset.id, editValues(li));
  });

  searchInput.addEventListener('input', function () {
    query = searchInput.value.trim();
    render();
  });

  sortSelect.addEventListener('change', function () {
    sortBy = sortSelect.value;
    render();
  });

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.dataset.filter;
      filterBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      render();
    });
  });

  clearBtn.addEventListener('click', clearCompleted);

  // 多個分頁之間同步資料
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) { todos = loadTodos(); render(); }
    if (e.key === POMO_KEY) { pomo.sessions = loadPomoSessions(); renderPomo(); }
  });

  // ---------- 主題 ----------
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function syncThemeMeta() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#0b0d1a' : '#6366f1');
  }
  themeToggle.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    syncThemeMeta();
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });
  syncThemeMeta();

  // ---------- 今日日期 ----------
  var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  var now = new Date();
  $('today-label').textContent = '今天是 ' + now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日（星期' + weekdays[now.getDay()] + '）';

  // ---------- PWA：Service Worker 與安裝 ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function (err) {
        console.warn('Service Worker 註冊失敗：', err);
      });
    });
  }

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  });
  window.addEventListener('appinstalled', function () {
    installBtn.hidden = true;
    toast('已成功安裝到主畫面！');
  });

  window.addEventListener('offline', function () { toast('目前為離線模式，資料仍會儲存在本機。'); });
  window.addEventListener('online', function () { toast('已恢復網路連線。'); });

  render();

  // 首次繪製後才啟用主題過場；rAF 在背景分頁會被節流，因此以計時器作為備援。
  function enableTransitions() { document.documentElement.classList.add('theme-ready'); }
  requestAnimationFrame(function () { requestAnimationFrame(enableTransitions); });
  setTimeout(enableTransitions, 150);
})();
