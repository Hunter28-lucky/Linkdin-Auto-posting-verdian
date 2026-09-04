// ==========================================
// POSTPULSE STUDIO 2.0 — FRONTEND CLIENT
// Targeting: Personal LinkedIn Profile
// ==========================================

const state = {
  status: null,
  queue: [],
  history: [],
  currentTopic: 'AI & Automation Trends',
  currentTone: 'thought-leadership',
  selectedStyle: 'cinematic',
  selectedAspectRatio: '16:9',
  currentImage: null,
  currentImagePrompt: '',
  activeTab: 'studio',
};

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚡'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSparks();
  initTopicChips();
  initToneSelector();
  initStyleSelector();
  initAspectRatioSelector();
  initPostEditor();
  initFormattingHelpers();
  initImageStudio();
  initActionButtons();
  initLightbox();
  initScheduleForm();
  initManualTokenForm();
  initSettingsKey();

  // Load initial system data
  fetchStatus();
  fetchQueue();
  fetchHistory();
});

// ==========================================
// 1. TABS & NAVIGATION
// ==========================================
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const views = document.querySelectorAll('.tab-view');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      views.forEach((v) => v.classList.remove('active'));

      tab.classList.add('active');
      const tabKey = tab.dataset.tab;
      state.activeTab = tabKey;

      const targetView = document.getElementById(`view-${tabKey}`);
      if (targetView) targetView.classList.add('active');

      if (tabKey === 'queue') fetchQueue();
      if (tabKey === 'history') fetchHistory();
    });
  });
}

// ==========================================
// 2. SPARKS & CUSTOM PROMPT
// ==========================================
function initSparks() {
  const promptInput = document.getElementById('input-custom-prompt');
  const promptCounter = document.getElementById('prompt-char-count');
  const clearBtn = document.getElementById('btn-clear-prompt');

  if (promptInput && promptCounter) {
    promptInput.addEventListener('input', () => {
      promptCounter.textContent = `${promptInput.value.length}/300`;
    });
  }

  if (clearBtn && promptInput) {
    clearBtn.addEventListener('click', () => {
      promptInput.value = '';
      if (promptCounter) promptCounter.textContent = '0/300';
      promptInput.focus();
    });
  }

  document.querySelectorAll('.spark-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.starter;
      if (promptInput) {
        promptInput.value = text;
        if (promptCounter) promptCounter.textContent = `${text.length}/300`;
        promptInput.focus();
        showToast('Idea spark applied to prompt!', 'info');
      }
    });
  });
}

// ==========================================
// 3. TOPICS & TONE
// ==========================================
function initTopicChips() {
  const chips = document.querySelectorAll('#topic-chips-container .chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentTopic = chip.dataset.topic;
    });
  });
}

function initToneSelector() {
  const select = document.getElementById('select-tone');
  if (select) {
    select.addEventListener('change', (e) => {
      state.currentTone = e.target.value;
    });
  }
}

// ==========================================
// 4. VISUAL STYLES & ASPECT RATIO
// ==========================================
function initStyleSelector() {
  const styleCards = document.querySelectorAll('.visual-styles-grid .style-card');
  styleCards.forEach((card) => {
    card.addEventListener('click', () => {
      styleCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedStyle = card.dataset.style;
      showToast(`Style set to: ${card.querySelector('.style-name').textContent}`, 'info');
    });
  });
}

function initAspectRatioSelector() {
  const pills = document.querySelectorAll('#aspect-ratio-selector .aspect-pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      pills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedAspectRatio = pill.dataset.aspect;
      showToast(`Aspect ratio set to ${state.selectedAspectRatio}`, 'info');
    });
  });
}

// ==========================================
// 5. POST EDITOR & FORMATTING HELPERS
// ==========================================
function initPostEditor() {
  const editor = document.getElementById('post-editor');
  const preview = document.getElementById('preview-content');
  const counter = document.getElementById('char-counter');
  const progressBar = document.getElementById('length-progress-bar');
  const qualityText = document.getElementById('length-quality-text');

  if (!editor) return;

  function updateMetrics() {
    const len = editor.value.length;
    if (counter) counter.textContent = `${len} characters`;

    if (preview) {
      if (editor.value.trim()) {
        // Format hashtags into styled spans
        const formatted = editor.value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/(#\w+)/g, '<span style="color: #70b5f9; font-weight:600;">$1</span>')
          .replace(/\n/g, '<br>');
        preview.innerHTML = formatted;
      } else {
        preview.innerHTML = 'Write or generate your post to preview here...';
      }
    }

    if (progressBar) {
      const pct = Math.min(100, (len / 2000) * 100);
      progressBar.style.width = `${pct}%`;

      if (len >= 800 && len <= 1400) {
        progressBar.style.backgroundColor = 'var(--accent-emerald)';
        if (qualityText) {
          qualityText.textContent = '🌟 Sweet spot for LinkedIn algorithm (900-1,300 chars)';
          qualityText.style.color = 'var(--accent-emerald)';
        }
      } else if (len > 2200) {
        progressBar.style.backgroundColor = 'var(--accent-rose)';
        if (qualityText) {
          qualityText.textContent = '⚠️ Long post (may be truncated on mobile)';
          qualityText.style.color = 'var(--accent-rose)';
        }
      } else {
        progressBar.style.backgroundColor = 'var(--accent-indigo)';
        if (qualityText) {
          qualityText.textContent = 'Optimal length: 900 - 1,300 chars';
          qualityText.style.color = 'var(--text-muted)';
        }
      }
    }
  }

  editor.addEventListener('input', updateMetrics);

  const copyBtn = document.getElementById('btn-copy-post');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!editor.value.trim()) return;
      navigator.clipboard.writeText(editor.value).then(() => {
        showToast('Post copied to clipboard! 📋', 'success');
      });
    });
  }
}

function initFormattingHelpers() {
  const editor = document.getElementById('post-editor');
  if (!editor) return;

  // Add Hook
  document.getElementById('fmt-hook')?.addEventListener('click', () => {
    const hook = '⚡ Most tech leaders are looking at this backwards:\n\n';
    editor.value = hook + editor.value;
    editor.dispatchEvent(new Event('input'));
    editor.focus();
    showToast('Hook added to top of post', 'info');
  });

  // Bulletize
  document.getElementById('fmt-bullets')?.addEventListener('click', () => {
    const lines = editor.value.split('\n');
    const bulleted = lines
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('•') && !trimmed.startsWith('#') && !trimmed.startsWith('⚡')) {
          return `• ${trimmed}`;
        }
        return line;
      })
      .join('\n');
    editor.value = bulleted;
    editor.dispatchEvent(new Event('input'));
    showToast('Converted lines to clean bullet points', 'info');
  });

  // Add CTA
  document.getElementById('fmt-cta')?.addEventListener('click', () => {
    const cta = '\n\nWhat has been your experience with this in your architecture or team? Drop your thoughts below 👇';
    editor.value = editor.value.trim() + cta;
    editor.dispatchEvent(new Event('input'));
    showToast('Added discussion CTA question', 'info');
  });

  // Add Hashtags
  document.getElementById('fmt-tags')?.addEventListener('click', () => {
    const tagMap = {
      'AI & Automation Trends': '#ArtificialIntelligence #MachineLearning #AIAgents #TechInnovation',
      'Software Engineering & Architecture': '#SoftwareEngineering #SystemDesign #CleanCode #CloudArchitecture',
      'Tech Leadership & Building': '#TechLeadership #EngineeringManagement #BuildingInPublic #Startups',
      'Productivity & Deep Work': '#Productivity #DeepWork #SoftwareDeveloper #WorkSmart',
      'Future of Technology': '#FutureOfTech #QuantumComputing #EmergingTech #Innovation',
    };
    const tags = tagMap[state.currentTopic] || '#Technology #Engineering #AI #Innovation';
    if (!editor.value.includes('#')) {
      editor.value = editor.value.trim() + '\n\n' + tags;
      editor.dispatchEvent(new Event('input'));
      showToast('Appended relevant hashtags', 'info');
    }
  });
}

// ==========================================
// 6. AI IMAGE STUDIO & PREVIEW
// ==========================================
function initImageStudio() {
  const promptInput = document.getElementById('input-image-prompt');
  const regenBtn = document.getElementById('btn-regen-ai-image');
  const fileInput = document.getElementById('input-file-image');
  const urlInput = document.getElementById('input-image-url');
  const removeBtn = document.getElementById('btn-remove-image');

  if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
      const prompt = promptInput?.value || '';
      const editor = document.getElementById('post-editor');
      const postContent = editor?.value || '';

      regenBtn.disabled = true;
      regenBtn.innerHTML = '<span class="regen-icon">⏳</span> Generating...';

      try {
        const res = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            topic: state.currentTopic,
            postContent,
            style: state.selectedStyle,
            aspectRatio: state.selectedAspectRatio,
          }),
        });
        const data = await res.json();
        if (data.success && data.imageUrl) {
          updateImagePreview(data.imageUrl, data.imagePrompt);
          showToast(`New ${data.style || ''} visual generated via ${data.engine}! ✨`, 'success');
        } else {
          showToast(data.error || 'Failed to regenerate visual', 'error');
        }
      } catch (err) {
        showToast(`Image error: ${err.message}`, 'error');
      } finally {
        regenBtn.disabled = false;
        regenBtn.innerHTML = '<span class="regen-icon">🔄</span> Regenerate';
      }
    });
  }

  // File upload
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        updateImagePreview(event.target.result, file.name);
        showToast('Custom visual uploaded!', 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  // URL input
  if (urlInput) {
    urlInput.addEventListener('change', () => {
      const url = urlInput.value.trim();
      if (url.startsWith('http')) {
        updateImagePreview(url, 'Custom image link');
        showToast('Custom visual URL applied!', 'success');
      }
    });
  }

  // Remove button
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      updateImagePreview(null, '');
      showToast('Visual removed from post', 'info');
    });
  }
}

function updateImagePreview(imageUrl, promptText) {
  state.currentImage = imageUrl;
  state.currentImagePrompt = promptText || '';

  const container = document.getElementById('preview-image-container');
  const img = document.getElementById('preview-post-image');
  const promptInput = document.getElementById('input-image-prompt');
  const removeBtn = document.getElementById('btn-remove-image');

  if (promptInput && promptText) {
    promptInput.value = promptText;
  }

  if (imageUrl) {
    if (img) img.src = imageUrl;
    if (container) container.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  } else {
    if (img) img.src = '';
    if (container) container.classList.add('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
  }
}

// ==========================================
// 7. LIGHTBOX MODAL FOR 8K VISUALS
// ==========================================
function initLightbox() {
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const downloadLink = document.getElementById('lightbox-download-link');
  const closeBtn = document.getElementById('btn-close-lightbox');
  const backdrop = document.getElementById('lightbox-backdrop');
  const visualWrapper = document.getElementById('visual-img-wrapper');

  function openLightbox() {
    if (!state.currentImage) return;
    if (lightboxImg) lightboxImg.src = state.currentImage;
    if (downloadLink) downloadLink.href = state.currentImage;
    if (lightbox) lightbox.classList.remove('hidden');
  }

  function closeLightbox() {
    if (lightbox) lightbox.classList.add('hidden');
  }

  if (visualWrapper) visualWrapper.addEventListener('click', openLightbox);
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (backdrop) backdrop.addEventListener('click', closeLightbox);
}

// ==========================================
// 8. PRIMARY ACTIONS (GENERATE & PUBLISH)
// ==========================================
function initActionButtons() {
  const generateBtn = document.getElementById('btn-generate-ai');
  const publishBtn = document.getElementById('btn-publish-now');
  const queueBtn = document.getElementById('btn-add-to-queue');
  const triggerCronBtn = document.getElementById('btn-trigger-cron-now');

  // GENERATE POST & VISUAL
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const customPrompt = document.getElementById('input-custom-prompt')?.value || '';
      const customImagePrompt = document.getElementById('input-image-prompt')?.value || '';

      generateBtn.disabled = true;
      generateBtn.innerHTML = '<span class="btn-icon">⏳</span> Synthesizing Post & Flux AI Visual...';

      try {
        const res = await fetch('/api/posts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: state.currentTopic,
            tone: state.currentTone,
            customPrompt,
            customImagePrompt,
            style: state.selectedStyle,
            aspectRatio: state.selectedAspectRatio,
          }),
        });

        const data = await res.json();
        if (data.success) {
          const editor = document.getElementById('post-editor');
          if (editor) {
            editor.value = data.content;
            editor.dispatchEvent(new Event('input'));
          }

          if (data.imageUrl) {
            updateImagePreview(data.imageUrl, data.imagePrompt);
          }

          showToast(`Post & high-def visual generated using ${data.engine}! ✨`, 'success');
        } else {
          showToast(data.error || 'Generation failed', 'error');
        }
      } catch (err) {
        showToast(`Generation error: ${err.message}`, 'error');
      } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="btn-icon">✨</span> Generate Post & AI Visual';
      }
    });
  }

  // PUBLISH TO PERSONAL PROFILE NOW
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const editor = document.getElementById('post-editor');
      const content = editor?.value?.trim();

      if (!content) {
        showToast('Please enter or generate post content before publishing', 'error');
        return;
      }

      publishBtn.disabled = true;
      publishBtn.innerHTML = 'Publishing to Personal Profile... ⏳';

      try {
        const res = await fetch('/api/posts/publish-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            imageUrl: state.currentImage,
            topic: state.currentTopic,
            targetType: 'person',
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast('🚀 Successfully published to your Personal LinkedIn Profile!', 'success');
          fetchHistory();
          fetchStatus();
        } else {
          showToast(`Publishing failed: ${data.error}`, 'error');
        }
      } catch (err) {
        showToast(`Publish error: ${err.message}`, 'error');
      } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> Post to Personal Profile Now';
      }
    });
  }

  // ADD TO QUEUE
  if (queueBtn) {
    queueBtn.addEventListener('click', async () => {
      const editor = document.getElementById('post-editor');
      const content = editor?.value?.trim();

      if (!content) {
        showToast('Post content is empty', 'error');
        return;
      }

      try {
        const res = await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            topic: state.currentTopic,
            tone: state.currentTone,
            imageUrl: state.currentImage,
            targetType: 'person',
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast('Added post and visual to schedule queue! 📋', 'success');
          fetchQueue();
          fetchStatus();
        } else {
          showToast(data.error || 'Failed to queue post', 'error');
        }
      } catch (err) {
        showToast(`Queue error: ${err.message}`, 'error');
      }
    });
  }

  // INSTANT AUTOPILOT TEST
  if (triggerCronBtn) {
    triggerCronBtn.addEventListener('click', async () => {
      triggerCronBtn.disabled = true;
      triggerCronBtn.textContent = 'Running Autopilot Job...';

      try {
        const res = await fetch('/api/scheduler/trigger-now', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Daily autopilot run completed & published! 🚀', 'success');
          fetchHistory();
          fetchStatus();
        } else {
          showToast(`Autopilot run note: ${data.result?.reason || data.error}`, 'info');
        }
      } catch (err) {
        showToast(`Autopilot error: ${err.message}`, 'error');
      } finally {
        triggerCronBtn.disabled = false;
        triggerCronBtn.textContent = 'Trigger Job Now';
      }
    });
  }
}

// ==========================================
// 9. SCHEDULE & SETTINGS FORMS
// ==========================================
function initScheduleForm() {
  const form = document.getElementById('form-schedule-settings');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const time = document.getElementById('setting-schedule-time')?.value || '09:00';
    const autopilotMode = document.getElementById('setting-autopilot-mode')?.value || 'autopilot';
    const days = Array.from(document.querySelectorAll('.days-selector input:checked')).map((cb) => cb.value);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleTime: time, scheduleDays: days, autopilotMode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Schedule settings saved successfully! ⏰', 'success');
        fetchStatus();
      }
    } catch (err) {
      showToast(`Error saving settings: ${err.message}`, 'error');
    }
  });
}

function initManualTokenForm() {
  const form = document.getElementById('form-manual-token');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('manual-access-token')?.value?.trim();
    if (!token) return;

    try {
      const res = await fetch('/api/auth/manual-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('LinkedIn personal profile token saved! ✅', 'success');
        fetchStatus();
      } else {
        showToast(data.error || 'Invalid token', 'error');
      }
    } catch (err) {
      showToast(`Token error: ${err.message}`, 'error');
    }
  });
}

function initSettingsKey() {
  const saveKeyBtn = document.getElementById('btn-save-gemini-key');
  if (!saveKeyBtn) return;

  saveKeyBtn.addEventListener('click', async () => {
    const key = document.getElementById('setting-gemini-key')?.value?.trim();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Gemini API key updated!', 'success');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

// ==========================================
// 10. FETCH DATA & RENDER
// ==========================================
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.status = data;

    // Update Connection Status
    const connPill = document.getElementById('connection-status-pill');
    const connLabel = document.getElementById('connection-label');
    const userHeader = document.getElementById('user-profile-header');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const btnConnect = document.getElementById('btn-connect-linkedin');
    const authBanner = document.getElementById('auth-alert-banner');
    const previewAvatar = document.getElementById('preview-avatar');
    const previewName = document.getElementById('preview-name');

    if (data.connected && data.user) {
      if (connPill) {
        connPill.className = 'status-pill connected';
        if (connLabel) connLabel.textContent = 'Active Profile';
      }
      if (userHeader) userHeader.classList.remove('hidden');
      if (userAvatar) userAvatar.src = data.user.picture || 'https://ui-avatars.com/api/?name=LinkedIn+User';
      if (userName) userName.textContent = data.user.name || 'LinkedIn User';
      if (previewAvatar && data.user.picture) previewAvatar.src = data.user.picture;
      if (previewName) previewName.textContent = data.user.name || 'LinkedIn User';
      if (btnConnect) btnConnect.classList.add('hidden');
      if (authBanner) authBanner.classList.add('hidden');
    } else {
      if (connPill) {
        connPill.className = 'status-pill disconnected';
        if (connLabel) connLabel.textContent = 'Disconnected';
      }
      if (userHeader) userHeader.classList.add('hidden');
      if (btnConnect) btnConnect.classList.remove('hidden');
      if (authBanner) authBanner.classList.remove('hidden');
    }

    // Update settings tab view
    const settingsName = document.getElementById('settings-user-name');
    const settingsAvatar = document.getElementById('settings-user-avatar');
    if (data.connected && data.user) {
      if (settingsName) settingsName.textContent = `${data.user.name} (Personal Account)`;
      if (settingsAvatar) settingsAvatar.src = data.user.picture || 'https://ui-avatars.com/api/?name=LinkedIn+User';
    }

    // Update disconnect button
    document.getElementById('btn-disconnect')?.addEventListener('click', async () => {
      if (confirm('Disconnect LinkedIn account?')) {
        await fetch('/api/auth/disconnect', { method: 'POST' });
        showToast('LinkedIn account disconnected', 'info');
        fetchStatus();
      }
    });

  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

async function fetchQueue() {
  try {
    const res = await fetch('/api/queue');
    const data = await res.json();
    state.queue = data.queue || [];

    const counter = document.getElementById('nav-queue-count');
    if (counter) counter.textContent = state.queue.length;

    const listContainer = document.getElementById('queue-container');
    if (!listContainer) return;

    if (state.queue.length === 0) {
      listContainer.innerHTML = `
        <div class="studio-card" style="text-align:center; padding: 2.5rem 1rem;">
          <p style="color: var(--text-secondary); font-size:0.92rem;">Your publishing queue is currently empty.</p>
          <p style="color: var(--text-muted); font-size:0.8rem; margin-top:0.35rem;">Generate a post in the AI Studio and click "Add to Schedule Queue" to queue it.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = state.queue
      .map(
        (item) => `
      <div class="queue-item-card">
        ${item.imageUrl ? `<img src="${item.imageUrl}" class="queue-thumb" alt="Visual" onerror="this.style.display='none'">` : '<div class="queue-thumb" style="background:#131d33; display:flex; align-items:center; justify-content:center; color:#64748b;">No Image</div>'}
        <div class="queue-info">
          <span class="queue-topic-badge">${item.topic || 'General'}</span>
          <p class="queue-snippet">${item.content}</p>
        </div>
        <div class="queue-actions">
          <button class="btn btn-primary btn-sm" onclick="publishQueueItem('${item.id}')">Publish Now</button>
          <button class="btn btn-outline btn-sm text-danger" onclick="deleteQueueItem('${item.id}')">Delete</button>
        </div>
      </div>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to fetch queue:', err);
  }
}

async function publishQueueItem(id) {
  try {
    const res = await fetch(`/api/queue/${id}/publish-now`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Post published to Personal Profile! 🚀', 'success');
      fetchQueue();
      fetchHistory();
    } else {
      showToast(`Publishing failed: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function deleteQueueItem(id) {
  try {
    const res = await fetch(`/api/queue/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Item deleted from queue', 'info');
      fetchQueue();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    state.history = data.history || [];

    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    if (state.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 2rem;">No published posts yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.history
      .map(
        (item) => `
      <tr>
        <td>
          ${item.imageUrl ? `<img src="${item.imageUrl}" class="history-thumb" alt="Visual" onerror="this.style.display='none'">` : '<span style="color:#64748b;">—</span>'}
        </td>
        <td style="max-width: 300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${item.content || 'Automated post'}
        </td>
        <td><span class="queue-topic-badge">${item.topic || 'General'}</span></td>
        <td><span style="font-size:0.75rem; color:#6ee7b7;">👤 Personal Profile</span></td>
        <td style="font-size:0.78rem; color:var(--text-muted);">${item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() + ' ' + new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td>
          <span class="${item.status === 'success' ? 'status-badge-success' : 'status-badge-failed'}">
            ${item.status === 'success' ? 'Published' : 'Failed'}
          </span>
        </td>
        <td>
          ${item.linkedinPostUrn ? `<a href="https://www.linkedin.com/feed/update/${item.linkedinPostUrn}" target="_blank" class="btn btn-outline btn-xs">View on LinkedIn ↗</a>` : '—'}
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to fetch history:', err);
  }
}

// Make functions accessible globally for inline onclick
window.publishQueueItem = publishQueueItem;
window.deleteQueueItem = deleteQueueItem;
