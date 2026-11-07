(function () {
  'use strict';

  var STORAGE_KEY = 'todo-app:todos';
  var THEME_KEY = 'todo-app:theme';
  var MAX_LEN = 200;

  // ---------- Storage ----------
  function loadTodos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (t) {
        return t && typeof t.id === 'string' && typeof t.text === 'string';
      }).map(function (t) {
        return { id: t.id, text: t.text, completed: !!t.completed, createdAt: t.createdAt || Date.now() };
      });
    } catch (e) {
      console.warn('Failed to load todos, starting fresh.', e);
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      showError('Could not save tasks (storage may be full or disabled).');
    }
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // ---------- State ----------
  var todos = loadTodos();
  var filter = 'all';
  var query = '';
  var editingId = null;

  // ---------- DOM ----------
  var form = document.getElementById('todo-form');
  var input = document.getElementById('todo-input');
  var formError = document.getElementById('form-error');
  var list = document.getElementById('todo-list');
  var searchInput = document.getElementById('search-input');
  var filterBtns = document.querySelectorAll('.filter-btn');
  var countEl = document.getElementById('todo-count');
  var clearBtn = document.getElementById('clear-completed');
  var emptyState = document.getElementById('empty-state');
  var themeToggle = document.getElementById('theme-toggle');

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
    clearTimeout(showError._t);
    showError._t = setTimeout(function () { formError.hidden = true; }, 3000);
  }

  function normalize(text) {
    return String(text).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  // ---------- Actions ----------
  function addTodo(text) {
    var clean = normalize(text);
    if (!clean) { showError('Task cannot be empty.'); return false; }
    todos.unshift({ id: uid(), text: clean, completed: false, createdAt: Date.now() });
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

  function updateTodo(id, text) {
    var t = find(id);
    if (!t) return;
    var clean = normalize(text);
    if (!clean) {
      // Empty edit removes the task, matching common todo app behavior.
      deleteTodo(id);
      return;
    }
    t.text = clean;
    editingId = null;
    saveTodos();
    render();
  }

  function clearCompleted() {
    todos = todos.filter(function (t) { return !t.completed; });
    saveTodos();
    render();
  }

  function find(id) {
    for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
    return null;
  }

  // ---------- Render ----------
  function visibleTodos() {
    var q = query.toLowerCase();
    return todos.filter(function (t) {
      if (filter === 'active' && t.completed) return false;
      if (filter === 'completed' && !t.completed) return false;
      if (q && t.text.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function render() {
    var items = visibleTodos();
    list.textContent = '';
    var frag = document.createDocumentFragment();

    items.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'todo-item' + (t.completed ? ' completed' : '');
      li.dataset.id = t.id;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = t.completed;
      cb.className = 'toggle';
      cb.setAttribute('aria-label', 'Mark "' + t.text + '" as ' + (t.completed ? 'active' : 'completed'));
      li.appendChild(cb);

      var actions = document.createElement('div');
      actions.className = 'todo-actions';

      if (editingId === t.id) {
        var edit = document.createElement('input');
        edit.type = 'text';
        edit.className = 'todo-edit';
        edit.value = t.text;
        edit.maxLength = MAX_LEN;
        edit.setAttribute('aria-label', 'Edit task');
        li.appendChild(edit);
        actions.appendChild(makeBtn('Save', 'save'));
        actions.appendChild(makeBtn('Cancel', 'cancel'));
      } else {
        var span = document.createElement('span');
        span.className = 'todo-text';
        span.textContent = t.text; // textContent prevents XSS
        span.title = 'Double-click to edit';
        li.appendChild(span);
        actions.appendChild(makeBtn('Edit', 'edit'));
        actions.appendChild(makeBtn('Delete', 'delete'));
      }

      li.appendChild(actions);
      frag.appendChild(li);
    });

    list.appendChild(frag);

    // Empty state
    if (items.length === 0) {
      emptyState.hidden = false;
      if (todos.length === 0) emptyState.textContent = 'No tasks yet. Add one above! 🎉';
      else if (query) emptyState.textContent = 'No tasks match "' + query + '".';
      else emptyState.textContent = filter === 'completed' ? 'No completed tasks.' : 'All tasks done! 🎉';
    } else {
      emptyState.hidden = true;
    }

    // Footer
    var left = todos.filter(function (t) { return !t.completed; }).length;
    countEl.textContent = left + (left === 1 ? ' task left' : ' tasks left');
    clearBtn.disabled = !todos.some(function (t) { return t.completed; });

    // Focus edit field
    if (editingId) {
      var field = list.querySelector('.todo-edit');
      if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
    }
  }

  function makeBtn(label, action) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'action-btn ' + action;
    b.dataset.action = action;
    b.textContent = label;
    return b;
  }

  // ---------- Events ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (addTodo(input.value)) {
      input.value = '';
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
      case 'save': updateTodo(id, li.querySelector('.todo-edit').value); break;
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
    if (!e.target.classList.contains('todo-edit')) return;
    var id = e.target.closest('.todo-item').dataset.id;
    if (e.key === 'Enter') { e.preventDefault(); updateTodo(id, e.target.value); }
    else if (e.key === 'Escape') { editingId = null; render(); }
  });

  // Save on blur unless focus moved to the Save/Cancel buttons of the same item.
  list.addEventListener('focusout', function (e) {
    if (!e.target.classList.contains('todo-edit')) return;
    var li = e.target.closest('.todo-item');
    var next = e.relatedTarget;
    if (next && li.contains(next)) return;
    if (editingId === li.dataset.id) updateTodo(li.dataset.id, e.target.value);
  });

  searchInput.addEventListener('input', function () {
    query = searchInput.value.trim();
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

  // Sync across tabs
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) { todos = loadTodos(); render(); }
  });

  // ---------- Theme ----------
  themeToggle.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  render();

  // Enable theme transitions only after first paint. rAF is throttled in background
  // tabs/offscreen frames, so a timer acts as a fallback.
  function enableTransitions() { document.documentElement.classList.add('theme-ready'); }
  requestAnimationFrame(function () { requestAnimationFrame(enableTransitions); });
  setTimeout(enableTransitions, 150);
})();
