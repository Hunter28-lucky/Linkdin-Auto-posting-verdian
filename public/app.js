// ==========================================
// POSTPULSE DASHBOARD APPLICATION LOGIC
// ==========================================

let appState = {
  status: null,
  queue: [],
  history: [],
  currentTopic: 'AI & Tech Trends',
  activeTab: 'studio',
  editingPostId: null,
};

// DOM Elements
const elements = {
  // Tabs
  tabs: document.querySelectorAll('.nav-tab'),
  tabViews: document.querySelectorAll('.tab-view'),
  navQueueCount: document.getElementById('nav-queue-count'),

  // Status & Profile
  connPill: document.getElementById('connection-status-pill'),
  connLabel: document.getElementById('connection-label'),
  userHeader: document.getElementById('user-profile-header'),
  userAvatar: document.getElementById('user-avatar'),
  userName: document.getElementById('user-name'),
  tokenDaysLeft: document.getElementById('token-days-left'),
  btnConnect: document.getElementById('btn-connect-linkedin'),
  btnDisconnect: document.getElementById('btn-disconnect'),
  authBanner: document.getElementById('auth-alert-banner'),

  // Metrics
  metricTotalPublished: document.getElementById('metric-total-published'),
  metricQueueCount: document.getElementById('metric-queue-count'),
  metricScheduleTime: document.getElementById('metric-schedule-time'),
  metricScheduleDays: document.getElementById('metric-schedule-days'),
  toggleScheduler: document.getElementById('toggle-scheduler-active'),
  schedulerStatusText: document.getElementById('scheduler-status-text'),

  // Studio Elements
  topicChips: document.querySelectorAll('.chip'),
  inputCustomPrompt: document.getElementById('input-custom-prompt'),
  selectTone: document.getElementById('select-tone'),
  btnGenerateAi: document.getElementById('btn-generate-ai'),
  currentEngineBadge: document.getElementById('current-engine-badge'),
  postEditor: document.getElementById('post-editor'),
  charCounter: document.getElementById('char-counter'),
  btnCopyPost: document.getElementById('btn-copy-post'),
  btnPublishNow: document.getElementById('btn-publish-now'),
  btnAddToQueue: document.getElementById('btn-add-to-queue'),

  // Preview Elements
  previewAvatar: document.getElementById('preview-avatar'),
  previewName: document.getElementById('preview-name'),
  previewContent: document.getElementById('preview-content'),
  btnTriggerCron: document.getElementById('btn-trigger-cron-now'),

  // Queue Elements
  queueContainer: document.getElementById('queue-container'),
  btnOpenComposeModal: document.getElementById('btn-open-compose-modal'),
  formScheduleSettings: document.getElementById('form-schedule-settings'),
  inputScheduleTime: document.getElementById('input-schedule-time'),
  daysSelector: document.getElementById('days-selector'),

  // History Elements
  historyContainer: document.getElementById('history-container'),
  btnRefreshHistory: document.getElementById('btn-refresh-history'),

  // Settings Elements
  formAiSettings: document.getElementById('form-ai-settings'),
  inputGeminiKey: document.getElementById('input-gemini-key'),
  inputTopicsList: document.getElementById('input-topics-list'),

  // Modal Elements
  modalEditor: document.getElementById('modal-post-editor'),
  modalTitle: document.getElementById('modal-title'),
  modalClose: document.getElementById('modal-close'),
  modalBtnCancel: document.getElementById('modal-btn-cancel'),
  modalBtnSave: document.getElementById('modal-btn-save'),
  modalPostTopic: document.getElementById('modal-post-topic'),
  modalPostContent: document.getElementById('modal-post-content'),

  // Toasts
  toastContainer: document.getElementById('toast-container'),
};

// ==========================================
// 1. INITIALIZATION & DATA FETCHING
// ==========================================

async function init() {
  bindEventListeners();
  checkUrlParams();
  await refreshAll();
}

async function refreshAll() {
  await fetchStatus();
  await fetchQueue();
  await fetchHistory();
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    appState.status = data;
    renderStatus(data);
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

async function fetchQueue() {
  try {
    const res = await fetch('/api/queue');
    const data = await res.json();
    appState.queue = data;
    renderQueue(data);
  } catch (err) {
    console.error('Failed to fetch queue:', err);
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    appState.history = data;
    renderHistory(data);
  } catch (err) {
    console.error('Failed to fetch history:', err);
  }
}

// ==========================================
// 2. UI RENDERING
// ==========================================

function renderStatus(status) {
  if (!status) return;

  // Connection Pill & Header
  if (status.isConnected && status.profile) {
    elements.connPill.className = 'status-pill connected';
    elements.connLabel.textContent = 'Connected';
    elements.authBanner.classList.add('hidden');
    elements.btnConnect.classList.add('hidden');
    elements.userHeader.classList.remove('hidden');

    elements.userName.textContent = status.profile.name || 'LinkedIn User';
    elements.previewName.textContent = status.profile.name || 'Your Name';

    if (status.profile.picture) {
      elements.userAvatar.src = status.profile.picture;
      elements.previewAvatar.src = status.profile.picture;
    } else {
      elements.userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(status.profile.name || 'User')}&background=0a66c2&color=fff`;
      elements.previewAvatar.src = elements.userAvatar.src;
    }

    if (status.tokenExpiresAt) {
      const days = Math.max(0, Math.ceil((new Date(status.tokenExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
      elements.tokenDaysLeft.textContent = `${days} days token active`;
    }
  } else {
    elements.connPill.className = 'status-pill disconnected';
    elements.connLabel.textContent = 'Disconnected';
    elements.authBanner.classList.remove('hidden');
    elements.btnConnect.classList.remove('hidden');
    elements.userHeader.classList.add('hidden');
    elements.previewName.textContent = 'Your Name';
  }

  // Metrics
  elements.metricTotalPublished.textContent = status.totalPublished || 0;
  elements.metricQueueCount.textContent = status.queuedCount || 0;
  elements.navQueueCount.textContent = status.queuedCount || 0;

  // Schedule config
  if (status.scheduleTime) {
    elements.metricScheduleTime.textContent = formatTime12(status.scheduleTime);
    elements.inputScheduleTime.value = status.scheduleTime;
  }

  const dayMap = { '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '0': 'Sun' };
  if (status.scheduleDays && status.scheduleDays.length) {
    if (status.scheduleDays.length === 7) {
      elements.metricScheduleDays.textContent = 'Every Day';
    } else if (status.scheduleDays.join(',') === '1,2,3,4,5') {
      elements.metricScheduleDays.textContent = 'Mon - Fri';
    } else {
      elements.metricScheduleDays.textContent = status.scheduleDays.map((d) => dayMap[d] || d).join(', ');
    }

    // Check checkboxes
    document.querySelectorAll('input[name="days"]').forEach((cb) => {
      cb.checked = status.scheduleDays.includes(cb.value);
    });
  }

  // Switch
  elements.toggleScheduler.checked = !!status.schedulerActive;
  elements.schedulerStatusText.textContent = status.schedulerActive
    ? status.autopilotMode === 'autopilot'
      ? 'Active (Auto-Generates & Posts Daily)'
      : 'Active (Posts from Queue)'
    : 'Paused (Automation Inactive)';

  // Radio mode
  const modeRadio = document.querySelector(`input[name="autopilotMode"][value="${status.autopilotMode || 'autopilot'}"]`);
  if (modeRadio) modeRadio.checked = true;

  // Settings
  if (status.settings) {
    if (status.settings.geminiApiKey) {
      elements.inputGeminiKey.value = status.settings.geminiApiKey;
      elements.currentEngineBadge.textContent = '⚡ Google Gemini 1.5 Flash';
    } else {
      elements.currentEngineBadge.textContent = '⚡ Smart Dynamic Engine';
    }

    if (status.settings.topics) {
      elements.inputTopicsList.value = status.settings.topics.join(', ');
    }
  }
}

function renderQueue(queue) {
  if (!queue || queue.length === 0) {
    elements.queueContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h4>No posts in queue</h4>
        <p>Your queue is currently empty. In <strong>Auto-Pilot mode</strong>, the system will automatically generate a fresh AI post each morning!</p>
        <button class="btn btn-outline btn-sm mt-3" onclick="document.getElementById('tab-studio').click()">Go to AI Studio</button>
      </div>
    `;
    return;
  }

  elements.queueContainer.innerHTML = queue
    .map(
      (item, idx) => `
    <div class="queue-item-card" data-id="${item.id}">
      <div class="queue-item-header">
        <span class="topic-badge">${escapeHtml(item.topic || 'General')}</span>
        <span class="queue-time">#${idx + 1} in queue • Added ${formatDateAgo(item.createdAt)}</span>
      </div>
      <div class="queue-item-content">${escapeHtml(item.content)}</div>
      <div class="queue-item-footer">
        <button class="btn btn-outline btn-sm" onclick="editQueuePost('${item.id}')">✏️ Edit</button>
        <button class="btn btn-outline btn-sm" onclick="deleteQueuePost('${item.id}')">🗑️ Delete</button>
        <button class="btn btn-primary btn-sm" onclick="publishQueuePostNow('${item.id}')">🚀 Post Now</button>
      </div>
    </div>
  `
    )
    .join('');
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    elements.historyContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <h4>No posts published yet</h4>
        <p>Posts published manually or through the daily automated scheduler will appear here.</p>
      </div>
    `;
    return;
  }

  elements.historyContainer.innerHTML = history
    .map(
      (item) => `
    <div class="history-item-card">
      <div class="history-content-col">
        <div class="history-meta">
          <span class="status-tag ${item.status}">${item.status.toUpperCase()}</span>
          <span class="topic-badge">${escapeHtml(item.topic || 'Post')}</span>
          <span class="queue-time">${new Date(item.publishedAt).toLocaleString()}</span>
        </div>
        <div class="history-text">${escapeHtml(item.content)}</div>
        ${item.error ? `<div class="mt-2 text-danger" style="color:#f43f5e;font-size:0.78rem;">⚠️ ${escapeHtml(item.error)}</div>` : ''}
      </div>
      ${
        item.linkedinPostUrn
          ? `<div class="history-actions">
              <a href="https://www.linkedin.com/feed/" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                View on LinkedIn ↗
              </a>
            </div>`
          : ''
      }
    </div>
  `
    )
    .join('');
}

// ==========================================
// 3. EVENT LISTENERS
// ==========================================

function bindEventListeners() {
  // Tabs Navigation
  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      elements.tabs.forEach((t) => t.classList.remove('active'));
      elements.tabViews.forEach((v) => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(`view-${tab.dataset.tab}`);
      if (targetView) targetView.classList.add('active');
      appState.activeTab = tab.dataset.tab;
    });
  });

  // Topic Chips
  elements.topicChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elements.topicChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      appState.currentTopic = chip.dataset.topic;
    });
  });

  // Generate AI Post
  elements.btnGenerateAi.addEventListener('click', handleGenerateAiPost);

  // Live Text Editor Synchronizer
  elements.postEditor.addEventListener('input', () => {
    const text = elements.postEditor.value;
    elements.charCounter.textContent = `${text.length} characters`;
    elements.previewContent.textContent = text || 'Your generated post will appear here...';
  });

  // Copy Post
  elements.btnCopyPost.addEventListener('click', () => {
    const text = elements.postEditor.value;
    if (!text) return showToast('No content to copy', 'error');
    navigator.clipboard.writeText(text);
    showToast('Post copied to clipboard! 📋', 'success');
  });

  // Publish Post Now
  elements.btnPublishNow.addEventListener('click', handlePublishNow);

  // Add to Schedule Queue
  elements.btnAddToQueue.addEventListener('click', handleAddToQueue);

  // Instant Cron Trigger Test
  elements.btnTriggerCron.addEventListener('click', handleTriggerCronNow);

  // Scheduler Active Switch Toggle
  elements.toggleScheduler.addEventListener('change', async () => {
    const active = elements.toggleScheduler.checked;
    await updateSettingsOnServer({ schedulerActive: active });
    showToast(active ? 'Daily scheduler activated! ⏰' : 'Daily scheduler paused ⏸️', 'success');
    await fetchStatus();
  });

  // Schedule Settings Form
  elements.formScheduleSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const time = elements.inputScheduleTime.value || '09:00';
    const checkedDays = Array.from(document.querySelectorAll('input[name="days"]:checked')).map((cb) => cb.value);
    const mode = document.querySelector('input[name="autopilotMode"]:checked')?.value || 'autopilot';

    await updateSettingsOnServer({
      scheduleTime: time,
      scheduleDays: checkedDays,
      autopilotMode: mode,
    });

    showToast('Schedule settings saved! 🚀', 'success');
    await fetchStatus();
  });

  // AI Settings Form
  elements.formAiSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = elements.inputGeminiKey.value.trim();
    const topicsStr = elements.inputTopicsList.value.trim();
    const topics = topicsStr ? topicsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

    await updateSettingsOnServer({
      geminiApiKey: key,
      topics: topics.length > 0 ? topics : undefined,
    });

    showToast('AI Settings updated successfully! 🤖', 'success');
    await fetchStatus();
  });

  // Disconnect LinkedIn Button
  elements.btnDisconnect.addEventListener('click', async () => {
    if (confirm('Are you sure you want to disconnect your LinkedIn account?')) {
      await fetch('/api/auth/disconnect', { method: 'POST' });
      showToast('LinkedIn account disconnected.', 'success');
      await refreshAll();
    }
  });

  // Refresh History
  elements.btnRefreshHistory.addEventListener('click', async () => {
    await fetchHistory();
    showToast('History refreshed', 'success');
  });

  // Modal actions
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalBtnCancel.addEventListener('click', closeModal);
  elements.modalBtnSave.addEventListener('click', handleSaveModalPost);
  elements.btnOpenComposeModal.addEventListener('click', () => openModalForCreate());
}

// ==========================================
// 4. ACTION HANDLERS
// ==========================================

async function handleGenerateAiPost() {
  elements.btnGenerateAi.disabled = true;
  elements.btnGenerateAi.innerHTML = `<span class="btn-icon">⏳</span> Generating engaging post...`;

  try {
    const res = await fetch('/api/posts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: appState.currentTopic,
        tone: elements.selectTone.value,
        customPrompt: elements.inputCustomPrompt.value.trim(),
      }),
    });

    const data = await res.json();
    if (data.success && data.content) {
      elements.postEditor.value = data.content;
      elements.previewContent.textContent = data.content;
      elements.charCounter.textContent = `${data.content.length} characters`;
      showToast('Post generated successfully! ✨', 'success');
    } else {
      showToast(data.error || 'Failed to generate post', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    elements.btnGenerateAi.disabled = false;
    elements.btnGenerateAi.innerHTML = `<span class="btn-icon">✨</span> Generate Post with AI`;
  }
}

async function handlePublishNow() {
  const content = elements.postEditor.value.trim();
  if (!content) {
    return showToast('Please write or generate a post first!', 'error');
  }

  if (!appState.status?.isConnected) {
    return showToast('Please connect your LinkedIn account first (top right).', 'error');
  }

  elements.btnPublishNow.disabled = true;
  elements.btnPublishNow.innerHTML = `⏳ Publishing to LinkedIn...`;

  try {
    const res = await fetch('/api/posts/publish-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        topic: appState.currentTopic,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('🎉 Successfully posted to your LinkedIn feed!', 'success');
      await refreshAll();
    } else {
      showToast(`Posting failed: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    elements.btnPublishNow.disabled = false;
    elements.btnPublishNow.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      Post to LinkedIn Now
    `;
  }
}

async function handleAddToQueue() {
  const content = elements.postEditor.value.trim();
  if (!content) {
    return showToast('Please write or generate a post first!', 'error');
  }

  try {
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        topic: appState.currentTopic,
        tone: elements.selectTone.value,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('Post added to scheduled queue! 📋', 'success');
      await fetchQueue();
      await fetchStatus();
    } else {
      showToast(data.error || 'Failed to add to queue', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleTriggerCronNow() {
  elements.btnTriggerCron.disabled = true;
  elements.btnTriggerCron.textContent = 'Running Job...';

  try {
    const res = await fetch('/api/scheduler/trigger-now', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast('Daily automated posting job executed successfully! 🚀', 'success');
      await refreshAll();
    } else {
      showToast(`Execution finished: ${data.reason || data.error}`, data.error ? 'error' : 'success');
    }
  } catch (err) {
    showToast(`Job failed: ${err.message}`, 'error');
  } finally {
    elements.btnTriggerCron.disabled = false;
    elements.btnTriggerCron.textContent = 'Trigger Job Now';
  }
}

// Queue item operations
window.editQueuePost = function (id) {
  const item = appState.queue.find((q) => q.id === id);
  if (!item) return;

  appState.editingPostId = id;
  elements.modalTitle.textContent = 'Edit Queued Post';
  elements.modalPostTopic.value = item.topic || '';
  elements.modalPostContent.value = item.content || '';
  elements.modalEditor.classList.remove('hidden');
};

window.deleteQueuePost = async function (id) {
  if (!confirm('Are you sure you want to remove this post from queue?')) return;
  try {
    await fetch(`/api/queue/${id}`, { method: 'DELETE' });
    showToast('Post removed from queue', 'success');
    await fetchQueue();
    await fetchStatus();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.publishQueuePostNow = async function (id) {
  const item = appState.queue.find((q) => q.id === id);
  if (!item) return;

  try {
    const res = await fetch('/api/posts/publish-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: item.content,
        topic: item.topic,
      }),
    });

    const data = await res.json();
    if (data.success) {
      await fetch(`/api/queue/${id}`, { method: 'DELETE' });
      showToast('Queued post published to LinkedIn! 🎉', 'success');
      await refreshAll();
    } else {
      showToast(`Posting failed: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function openModalForCreate() {
  appState.editingPostId = null;
  elements.modalTitle.textContent = 'Add Post to Queue';
  elements.modalPostTopic.value = 'General';
  elements.modalPostContent.value = '';
  elements.modalEditor.classList.remove('hidden');
}

function closeModal() {
  elements.modalEditor.classList.add('hidden');
  appState.editingPostId = null;
}

async function handleSaveModalPost() {
  const topic = elements.modalPostTopic.value.trim() || 'General';
  const content = elements.modalPostContent.value.trim();

  if (!content) {
    return showToast('Content cannot be empty', 'error');
  }

  try {
    if (appState.editingPostId) {
      // Edit existing
      await fetch(`/api/queue/${appState.editingPostId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, content }),
      });
      showToast('Queued post updated! ✏️', 'success');
    } else {
      // Create new
      await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, content }),
      });
      showToast('Post added to queue! 📋', 'success');
    }

    closeModal();
    await fetchQueue();
    await fetchStatus();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function updateSettingsOnServer(newSettings) {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to update settings:', err);
  }
}

// ==========================================
// 5. TOAST & HELPER FUNCTIONS
// ==========================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('connected') === 'true') {
    showToast('LinkedIn account successfully connected! 🚀', 'success');
    window.history.replaceState({}, document.title, '/');
  } else if (urlParams.get('auth_error')) {
    showToast(`LinkedIn Auth Error: ${urlParams.get('auth_error')}`, 'error');
    window.history.replaceState({}, document.title, '/');
  }
}

function formatTime12(time24) {
  if (!time24) return '09:00 AM';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const padMin = String(m).padStart(2, '0');
  return `${hour12}:${padMin} ${period}`;
}

function formatDateAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application
document.addEventListener('DOMContentLoaded', init);
