// ==========================================
// POSTPULSE DASHBOARD APPLICATION LOGIC (VERDIAN EDITION)
// ==========================================

let appState = {
  status: null,
  queue: [],
  history: [],
  currentTopic: 'Hiring Remote Sales',
  activeTab: 'studio',
  editingPostId: null,
  currentTarget: 'organization', // 'organization' | 'person'
  currentImage: '/assets/veridian-hiring-poster.jpg',
  organizations: [],
};

// DOM Elements
const elements = {
  // Tabs
  tabs: document.querySelectorAll('.nav-tab'),
  tabViews: document.querySelectorAll('.tab-view'),
  navQueueCount: document.getElementById('nav-queue-count'),

  // Target Destination Badge
  navTargetBadge: document.getElementById('nav-target-badge'),
  navTargetIcon: document.getElementById('nav-target-icon'),
  navTargetName: document.getElementById('nav-target-name'),

  // Studio Target Radio Options
  optTargetOrg: document.getElementById('opt-target-org'),
  optTargetPerson: document.getElementById('opt-target-person'),

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

  // Image Attachment Elements
  inputFileImage: document.getElementById('input-file-image'),
  inputImageUrl: document.getElementById('input-image-url'),
  btnGenAiImage: document.getElementById('btn-gen-ai-image'),
  btnRemoveImage: document.getElementById('btn-remove-image'),

  // Preview Elements
  previewAvatar: document.getElementById('preview-avatar'),
  previewName: document.getElementById('preview-name'),
  previewDegree: document.getElementById('preview-degree'),
  previewHeadline: document.getElementById('preview-headline'),
  previewContent: document.getElementById('preview-content'),
  previewImageContainer: document.getElementById('preview-image-container'),
  previewPostImage: document.getElementById('preview-post-image'),
  previewTargetTag: document.getElementById('preview-target-tag'),
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
  formTargetSettings: document.getElementById('form-target-settings'),
  selectTargetType: document.getElementById('select-target-type'),
  inputOrgName: document.getElementById('input-org-name'),
  inputOrgUrn: document.getElementById('input-org-urn'),
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
  modalPostImage: document.getElementById('modal-post-image'),

  // Toasts
  toastContainer: document.getElementById('toast-container'),
};

/**
 * Universal authenticated API fetch helper
 */
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('postpulse_token');
  const userUrn = localStorage.getItem('postpulse_urn');
  const userName = localStorage.getItem('postpulse_name');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    if (userUrn) headers['x-user-urn'] = encodeURIComponent(userUrn);
    if (userName) headers['x-user-name'] = encodeURIComponent(userName);
  }

  return fetch(url, { ...options, headers });
}

// ==========================================
// 1. INITIALIZATION & DATA FETCHING
// ==========================================

async function init() {
  bindEventListeners();
  checkUrlParams();
  await refreshAll();

  // Initial poster preview setup
  setImageAttachment('/assets/veridian-hiring-poster.jpg');
}

async function refreshAll() {
  await fetchStatus();
  await fetchQueue();
  await fetchHistory();
}

async function fetchStatus() {
  try {
    const res = await apiFetch('/api/status');
    const data = await res.json();

    const localToken = localStorage.getItem('postpulse_token');
    if (localToken && !data.isConnected) {
      data.isConnected = true;
      data.profile = {
        name: localStorage.getItem('postpulse_name') || 'LinkedIn User',
        urn: localStorage.getItem('postpulse_urn') || 'urn:li:person:me',
        picture: localStorage.getItem('postpulse_avatar') || null,
      };
      // Resync in background
      apiFetch('/api/auth/manual-token', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: localToken,
          personUrn: data.profile.urn,
          name: data.profile.name,
        }),
      }).catch(() => {});
    }

    appState.status = data;
    renderStatus(data);
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

async function fetchQueue() {
  try {
    const res = await apiFetch('/api/queue');
    const data = await res.json();
    appState.queue = data;
    renderQueue(data);
  } catch (err) {
    console.error('Failed to fetch queue:', err);
  }
}

async function fetchHistory() {
  try {
    const res = await apiFetch('/api/history');
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

  const bannerCode = document.querySelector('#auth-alert-banner code');
  if (bannerCode) {
    bannerCode.textContent = `${window.location.origin}/auth/callback`;
  }

  // Connection Pill & Header
  if (status.isConnected && status.profile) {
    elements.connPill.className = 'status-pill connected';
    elements.connLabel.textContent = 'Connected';
    elements.authBanner.classList.add('hidden');
    elements.btnConnect.classList.add('hidden');
    elements.userHeader.classList.remove('hidden');

    elements.userName.textContent = status.profile.name || 'LinkedIn User';

    if (status.profile.picture) {
      elements.userAvatar.src = status.profile.picture;
    } else {
      elements.userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(status.profile.name || 'User')}&background=0a66c2&color=fff`;
    }

    if (status.tokenExpiresAt) {
      const days = Math.max(0, Math.ceil((new Date(status.tokenExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
      elements.tokenDaysLeft.textContent = `${days} days token active`;
    } else {
      elements.tokenDaysLeft.textContent = `Token active`;
    }
  } else {
    elements.connPill.className = 'status-pill disconnected';
    elements.connLabel.textContent = 'Disconnected';
    elements.authBanner.classList.remove('hidden');
    elements.btnConnect.classList.remove('hidden');
    elements.userHeader.classList.add('hidden');
  }

  // Target Settings
  if (status.settings) {
    appState.currentTarget = status.settings.targetType || 'organization';
    const orgName = status.settings.organizationName || 'Verdian';

    if (elements.selectTargetType) elements.selectTargetType.value = appState.currentTarget;
    if (elements.inputOrgName) elements.inputOrgName.value = orgName;
    if (elements.inputOrgUrn) elements.inputOrgUrn.value = status.settings.organizationUrn || '';

    updateTargetUI(appState.currentTarget, orgName);
  }

  // Metrics
  elements.metricTotalPublished.textContent = status.totalPublished || 0;
  elements.metricQueueCount.textContent = status.queuedCount || 0;
  elements.navQueueCount.textContent = status.queuedCount || 0;

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

    document.querySelectorAll('input[name="days"]').forEach((cb) => {
      cb.checked = status.scheduleDays.includes(cb.value);
    });
  }

  elements.toggleScheduler.checked = !!status.schedulerActive;
  elements.schedulerStatusText.textContent = status.schedulerActive
    ? status.autopilotMode === 'autopilot'
      ? `Active (Auto-Posting to ${appState.currentTarget === 'organization' ? 'Verdian' : 'Profile'} Daily)`
      : 'Active (Posts from Queue)'
    : 'Paused (Automation Inactive)';

  const modeRadio = document.querySelector(`input[name="autopilotMode"][value="${status.autopilotMode || 'autopilot'}"]`);
  if (modeRadio) modeRadio.checked = true;

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

function updateTargetUI(targetType, orgName = 'Verdian') {
  if (targetType === 'organization') {
    elements.navTargetIcon.textContent = '🏢';
    elements.navTargetName.textContent = `${orgName} (Company Page)`;
    elements.optTargetOrg.classList.add('active');
    elements.optTargetPerson.classList.remove('active');
    document.querySelector('input[name="studioTarget"][value="organization"]').checked = true;

    // Feed Preview as Company
    elements.previewName.textContent = orgName;
    elements.previewDegree.textContent = '• Company';
    elements.previewHeadline.textContent = 'Growth. Digital. Done Right. 🚀';
    elements.previewAvatar.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80';
    elements.previewTargetTag.textContent = `Posting as ${orgName}`;
  } else {
    elements.navTargetIcon.textContent = '👤';
    elements.navTargetName.textContent = 'Personal Profile';
    elements.optTargetPerson.classList.add('active');
    elements.optTargetOrg.classList.remove('active');
    document.querySelector('input[name="studioTarget"][value="person"]').checked = true;

    // Feed Preview as Person
    const userName = appState.status?.profile?.name || localStorage.getItem('postpulse_name') || 'Your Name';
    elements.previewName.textContent = userName;
    elements.previewDegree.textContent = '• 1st';
    elements.previewHeadline.textContent = 'Building Autonomous Automation & AI Systems 🚀';
    elements.previewAvatar.src = appState.status?.profile?.picture || localStorage.getItem('postpulse_avatar') || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0a66c2&color=fff`;
    elements.previewTargetTag.textContent = `Posting as Personal Profile`;
  }
}

function renderQueue(queue) {
  if (!queue || queue.length === 0) {
    elements.queueContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h4>No posts in queue</h4>
        <p>Your queue is currently empty. In <strong>Auto-Pilot mode</strong>, the system will automatically generate a fresh AI post for Verdian each morning!</p>
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
      ${item.imageUrl ? `<div class="mb-2"><img src="${escapeHtml(item.imageUrl)}" alt="Media" style="height:70px; border-radius:6px; object-fit:cover;"></div>` : ''}
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
        <p>Posts published manually or through the daily automated scheduler to Verdian will appear here.</p>
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
        ${item.imageUrl && item.imageUrl !== 'Attached Image' ? `<div class="mt-2"><img src="${escapeHtml(item.imageUrl)}" alt="Media" style="height:70px; border-radius:6px; object-fit:cover;"></div>` : ''}
        ${item.error ? `<div class="mt-2 text-danger" style="font-size:0.78rem;">⚠️ ${escapeHtml(item.error)}</div>` : ''}
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

  // Target Destination Toggle in Studio
  document.querySelectorAll('input[name="studioTarget"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      appState.currentTarget = e.target.value;
      const orgName = elements.inputOrgName?.value || 'Verdian';
      updateTargetUI(appState.currentTarget, orgName);
      updateSettingsOnServer({ targetType: appState.currentTarget });
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

  // 1-Click Quick Hiring Campaign Generator
  const btnQuickHiring = document.getElementById('btn-quick-hiring');
  if (btnQuickHiring) {
    btnQuickHiring.addEventListener('click', () => {
      appState.currentTopic = 'Hiring Remote Sales';
      elements.topicChips.forEach((c) => {
        c.classList.toggle('active', c.dataset.topic === 'Hiring Remote Sales');
      });
      handleGenerateAiPost();
    });
  }

  // Live Text Editor Synchronizer
  elements.postEditor.addEventListener('input', () => {
    const text = elements.postEditor.value;
    elements.charCounter.textContent = `${text.length} characters`;
    elements.previewContent.textContent = text || 'Your generated post will appear here...';
  });

  // Image Upload File Input
  elements.inputFileImage.addEventListener('change', handleImageUploadFile);

  // Image URL Input
  elements.inputImageUrl.addEventListener('input', () => {
    const url = elements.inputImageUrl.value.trim();
    if (url) {
      setImageAttachment(url);
    } else {
      removeImageAttachment();
    }
  });

  // AI Visual Idea Button
  elements.btnGenAiImage.addEventListener('click', () => {
    const visualUrl = `/assets/veridian-hiring-poster.jpg`;
    elements.inputImageUrl.value = visualUrl;
    setImageAttachment(visualUrl);
    showToast('Veridian poster attached! 🎨', 'success');
  });

  // Remove Image Button
  elements.btnRemoveImage.addEventListener('click', removeImageAttachment);

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

  // Target Settings Form
  elements.formTargetSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetType = elements.selectTargetType.value;
    const orgName = elements.inputOrgName.value.trim() || 'Verdian';
    const orgUrn = elements.inputOrgUrn.value.trim();

    await updateSettingsOnServer({
      targetType,
      organizationName: orgName,
      organizationUrn: orgUrn || undefined,
    });

    appState.currentTarget = targetType;
    updateTargetUI(targetType, orgName);
    showToast('Destination settings saved! 🏢', 'success');
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
      localStorage.removeItem('postpulse_token');
      localStorage.removeItem('postpulse_urn');
      localStorage.removeItem('postpulse_name');
      localStorage.removeItem('postpulse_avatar');

      await apiFetch('/api/auth/disconnect', { method: 'POST' });
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

function handleImageUploadFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    setImageAttachment(dataUrl);
    showToast('Image attached from computer! 📷', 'success');
  };
  reader.readAsDataURL(file);
}

function setImageAttachment(src) {
  appState.currentImage = src;
  elements.previewPostImage.src = src;
  elements.previewImageContainer.classList.remove('hidden');
  elements.btnRemoveImage.classList.remove('hidden');
}

function removeImageAttachment() {
  appState.currentImage = null;
  elements.previewPostImage.src = '';
  elements.inputImageUrl.value = '';
  elements.inputFileImage.value = '';
  elements.previewImageContainer.classList.add('hidden');
  elements.btnRemoveImage.classList.add('hidden');
  showToast('Image removed', 'info');
}

async function handleGenerateAiPost() {
  elements.btnGenerateAi.disabled = true;
  elements.btnGenerateAi.innerHTML = `<span class="btn-icon">⏳</span> Generating engaging post & visual...`;

  try {
    const res = await apiFetch('/api/posts/generate', {
      method: 'POST',
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

      if (data.imageUrl) {
        elements.inputImageUrl.value = data.imageUrl;
        setImageAttachment(data.imageUrl);
      }

      showToast('Post & visual generated! ✨', 'success');
    } else {
      showToast(data.error || 'Failed to generate post', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    elements.btnGenerateAi.disabled = false;
    elements.btnGenerateAi.innerHTML = `<span class="btn-icon">✨</span> Generate Post & Visual with AI`;
  }
}

async function handlePublishNow() {
  const content = elements.postEditor.value.trim();
  if (!content) {
    return showToast('Please write or generate a post first!', 'error');
  }

  const token = localStorage.getItem('postpulse_token') || appState.status?.profile;
  if (!appState.status?.isConnected && !token) {
    return showToast('Please connect your LinkedIn account first (top right).', 'error');
  }

  const targetName = appState.currentTarget === 'organization' ? 'Verdian' : 'Personal Profile';
  elements.btnPublishNow.disabled = true;
  elements.btnPublishNow.innerHTML = `⏳ Publishing to ${targetName}...`;

  try {
    const res = await apiFetch('/api/posts/publish-now', {
      method: 'POST',
      body: JSON.stringify({
        content,
        topic: appState.currentTopic,
        imageUrl: appState.currentImage && appState.currentImage.startsWith('http') ? appState.currentImage : undefined,
        imageData: appState.currentImage && appState.currentImage.startsWith('data:') ? appState.currentImage : undefined,
        targetType: appState.currentTarget,
        organizationUrn: elements.inputOrgUrn?.value.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🎉 Successfully posted to ${targetName}!`, 'success');
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
    const res = await apiFetch('/api/queue', {
      method: 'POST',
      body: JSON.stringify({
        content,
        topic: appState.currentTopic,
        tone: elements.selectTone.value,
        imageUrl: appState.currentImage || undefined,
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
    const res = await apiFetch('/api/scheduler/trigger-now', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast('Daily automated job executed for Verdian! 🚀', 'success');
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
  elements.modalPostImage.value = item.imageUrl || '';
  elements.modalEditor.classList.remove('hidden');
};

window.deleteQueuePost = async function (id) {
  if (!confirm('Are you sure you want to remove this post from queue?')) return;
  try {
    await apiFetch(`/api/queue/${id}`, { method: 'DELETE' });
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
    const res = await apiFetch('/api/posts/publish-now', {
      method: 'POST',
      body: JSON.stringify({
        content: item.content,
        topic: item.topic,
        imageUrl: item.imageUrl,
        targetType: appState.currentTarget,
      }),
    });

    const data = await res.json();
    if (data.success) {
      await apiFetch(`/api/queue/${id}`, { method: 'DELETE' });
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
  elements.modalPostTopic.value = 'Hiring Remote Sales';
  elements.modalPostContent.value = '';
  elements.modalPostImage.value = '/assets/veridian-hiring-poster.jpg';
  elements.modalEditor.classList.remove('hidden');
}

function closeModal() {
  elements.modalEditor.classList.add('hidden');
  appState.editingPostId = null;
}

async function handleSaveModalPost() {
  const topic = elements.modalPostTopic.value.trim() || 'General';
  const content = elements.modalPostContent.value.trim();
  const imageUrl = elements.modalPostImage.value.trim() || undefined;

  if (!content) {
    return showToast('Content cannot be empty', 'error');
  }

  try {
    if (appState.editingPostId) {
      await apiFetch(`/api/queue/${appState.editingPostId}`, {
        method: 'PUT',
        body: JSON.stringify({ topic, content, imageUrl }),
      });
      showToast('Queued post updated! ✏️', 'success');
    } else {
      await apiFetch('/api/queue', {
        method: 'POST',
        body: JSON.stringify({ topic, content, imageUrl }),
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
    const res = await apiFetch('/api/settings', {
      method: 'POST',
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
    const token = urlParams.get('token');
    const name = urlParams.get('name');
    const urn = urlParams.get('urn');
    const avatar = urlParams.get('avatar');

    if (token) {
      localStorage.setItem('postpulse_token', token);
      if (name) localStorage.setItem('postpulse_name', name);
      if (urn) localStorage.setItem('postpulse_urn', urn);
      if (avatar) localStorage.setItem('postpulse_avatar', avatar);
    }

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

document.addEventListener('DOMContentLoaded', init);
