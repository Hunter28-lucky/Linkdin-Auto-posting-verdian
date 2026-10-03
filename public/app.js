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
  selectedStyle: 'photorealistic',
  selectedAspectRatio: '16:9',
  currentImage: null,
  currentImagePrompt: '',
  activeTab: 'studio',
  activeImageModel: getStoredImageModel(),
  activeCopyModel: getStoredCopyModel(),
};

function getStoredImageModel() {
  try {
    return localStorage.getItem('postpulse_image_model') || 'flux-2-dev';
  } catch {
    return 'flux-2-dev';
  }
}

function setStoredImageModel(model) {
  try {
    if (model) localStorage.setItem('postpulse_image_model', model);
  } catch {}
}

function getStoredCopyModel() {
  try {
    return localStorage.getItem('postpulse_copy_model') || 'staff-engine';
  } catch {
    return 'staff-engine';
  }
}

function setStoredCopyModel(model) {
  try {
    if (model) localStorage.setItem('postpulse_copy_model', model);
  } catch {}
}

// ==========================================
// AUTH STORAGE & API CLIENT (SERVERLESS SAFE)
// ==========================================

function getStoredAuth() {
  try {
    const raw = localStorage.getItem('postpulse_auth');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function setStoredAuth(data) {
  try {
    localStorage.setItem('postpulse_auth', JSON.stringify(data));
  } catch (e) {}
}

function clearStoredAuth() {
  try {
    localStorage.removeItem('postpulse_auth');
  } catch (e) {}
}

/**
 * Checks URL query parameters for OAuth success redirect (e.g. ?connected=true&token=...)
 * Stores token & profile securely in localStorage and cleans the URL bar.
 */
function checkUrlAuth() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const connected = urlParams.get('connected');
    const name = urlParams.get('name');
    const urn = urlParams.get('urn');
    const avatar = urlParams.get('avatar');

    if (connected === 'true' && token) {
      const authData = {
        token: token.trim(),
        name: name ? decodeURIComponent(name) : 'LinkedIn User',
        urn: urn ? decodeURIComponent(urn) : 'urn:li:person:me',
        avatar: avatar ? decodeURIComponent(avatar) : '',
        savedAt: Date.now(),
      };
      setStoredAuth(authData);

      // Clean the URL so access token isn't exposed in browser address bar
      window.history.replaceState({}, document.title, window.location.pathname);
      return authData;
    }
  } catch (err) {
    console.warn('URL Auth check error:', err);
  }
  return null;
}

const GEMINI_KEY_STORAGE = 'postpulse_gemini_key';

function getStoredGeminiKey() {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function setStoredGeminiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  } catch (e) {
    console.warn('Storage write error:', e);
  }
}

/**
 * Authenticated API Fetch Wrapper
 * Automatically transmits LinkedIn tokens, profile headers, and Gemini key to backend
 * (Essential for Vercel Serverless where memory isn't shared across lambdas)
 */
function apiFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const auth = getStoredAuth();
  if (auth && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
    headers['x-linkedin-token'] = auth.token;
    headers['x-user-urn'] = encodeURIComponent(auth.urn || 'urn:li:person:me');
    headers['x-user-name'] = encodeURIComponent(auth.name || 'LinkedIn User');
    if (auth.avatar) {
      headers['x-user-avatar'] = encodeURIComponent(auth.avatar);
    }
  }

  const geminiKey = getStoredGeminiKey();
  if (geminiKey) {
    headers['x-gemini-api-key'] = geminiKey;
  }

  return fetch(url, { ...options, headers, credentials: 'include' });
}

/**
 * Robust JSON API Fetch Wrapper
 * Automatically handles JSON and shields against HTML gateway errors (e.g. Vercel 504 / 404)
 */
async function apiFetchJson(url, options = {}) {
  try {
    const res = await apiFetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }

    const rawText = await res.text();
    const cleanSnippet = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const errMsg = cleanSnippet || `HTTP ${res.status}: ${res.statusText || 'Server Error'}`;

    return {
      ok: false,
      status: res.status,
      data: {
        success: false,
        error: errMsg,
      },
    };
  } catch (netErr) {
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        error: netErr.message || 'Network connection failed',
      },
    };
  }
}

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

// Centralized UI Connection State Renderer
function updateAuthUI(isConnected, user) {
  const connPill = document.getElementById('connection-status-pill');
  const connLabel = document.getElementById('connection-label');
  const userHeader = document.getElementById('user-profile-header');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const btnConnect = document.getElementById('btn-connect-linkedin');
  const authBanner = document.getElementById('auth-alert-banner');
  const previewAvatar = document.getElementById('preview-avatar');
  const previewName = document.getElementById('preview-name');
  const settingsName = document.getElementById('settings-user-name');
  const settingsAvatar = document.getElementById('settings-user-avatar');

  if (isConnected && user) {
    if (connPill) {
      connPill.className = 'status-pill connected';
      if (connLabel) connLabel.textContent = 'Active Profile';
    }
    const avatarUrl = user.picture || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'LinkedIn User')}&background=0a66c2&color=fff`;

    if (userHeader) userHeader.classList.remove('hidden');
    if (userAvatar) userAvatar.src = avatarUrl;
    if (userName) userName.textContent = user.name || 'LinkedIn User';
    if (previewAvatar) previewAvatar.src = avatarUrl;
    if (previewName) previewName.textContent = user.name || 'LinkedIn User';
    if (btnConnect) btnConnect.classList.add('hidden');
    if (authBanner) authBanner.classList.add('hidden');
    if (settingsName) settingsName.textContent = `${user.name || 'LinkedIn User'} (Personal Account)`;
    if (settingsAvatar) settingsAvatar.src = avatarUrl;
  } else {
    if (connPill) {
      connPill.className = 'status-pill disconnected';
      if (connLabel) connLabel.textContent = 'Disconnected';
    }
    if (userHeader) userHeader.classList.add('hidden');
    if (btnConnect) btnConnect.classList.remove('hidden');
    if (authBanner) authBanner.classList.remove('hidden');
    if (settingsName) settingsName.textContent = 'Not Connected';
  }
}

// ==========================================
// DOM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Check for OAuth callback parameters from URL
  const urlAuth = checkUrlAuth();

  // 2. Immediate Client-Side Auth Render (instant feedback, zero delay)
  const storedAuth = urlAuth || getStoredAuth();
  if (storedAuth && storedAuth.token) {
    updateAuthUI(true, storedAuth);
    if (urlAuth) {
      showToast(`Welcome ${storedAuth.name}! Personal LinkedIn Profile connected. 🚀`, 'success');
    }
  }

  // 3. Initialize UI controls
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
  initImageAutomationSettings();
  initGeminiModal();
  updateEngineBadgeUI();

  // 4. Fetch server state and sync
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
        const { ok, data } = await apiFetchJson('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            topic: state.currentTopic,
            postContent,
            style: state.selectedStyle,
            aspectRatio: state.selectedAspectRatio,
            model: state.activeImageModel || getStoredImageModel(),
          }),
        });

        if (ok && data?.success && data?.imageUrl) {
          updateImagePreview(data.imageUrl, data.imagePrompt);

          const imgEngineEl = document.getElementById('provenance-image-engine');
          if (imgEngineEl) imgEngineEl.textContent = data.engine || 'FLUX.2 Dev';
          const overlayPill = document.querySelector('.overlay-pill');
          if (overlayPill) overlayPill.textContent = `✨ ${data.engine || 'FLUX.2 Dev'}`;

          showToast(`New ${data.style || ''} visual generated via ${data.engine}! ✨`, 'success');
        } else {
          showToast(data?.error || 'Failed to regenerate visual', 'error');
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
      const geminiKey = getStoredGeminiKey();

      generateBtn.disabled = true;
      generateBtn.innerHTML = '<span class="btn-icon">⏳</span> Synthesizing Post & Visual...';

      try {
        const { ok, data } = await apiFetchJson('/api/posts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: state.currentTopic,
            tone: state.currentTone,
            customPrompt,
            customImagePrompt,
            style: state.selectedStyle,
            aspectRatio: state.selectedAspectRatio,
            geminiApiKey: geminiKey,
            imageModel: state.activeImageModel || getStoredImageModel(),
            copyModel: state.activeCopyModel || getStoredCopyModel(),
          }),
        });

        if (ok && data && data.success) {
          const editor = document.getElementById('post-editor');
          if (editor) {
            editor.value = data.content;
            editor.dispatchEvent(new Event('input'));
          }

          if (data.imageUrl) {
            updateImagePreview(data.imageUrl, data.imagePrompt);
          }

          // Update AI Provenance tags so the user knows exactly which AI generated this
          const textEngineEl = document.getElementById('provenance-text-engine');
          if (textEngineEl) textEngineEl.textContent = data.copyEngine || data.engine || 'Staff Case Study Engine';
          const imgEngineEl = document.getElementById('provenance-image-engine');
          if (imgEngineEl) imgEngineEl.textContent = data.imageEngine || 'FLUX.2 Dev';
          const overlayPill = document.querySelector('.overlay-pill');
          if (overlayPill) overlayPill.textContent = `✨ ${data.imageEngine || 'FLUX.2 Dev'}`;

          showToast(`Post & visual generated using ${data.copyEngine || data.engine || 'Staff Case Study Engine'}! ✨`, 'success');
        } else {
          showToast(data?.error || 'Generation failed', 'error');
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

      const hasVisual = !!state.currentImage;
      publishBtn.disabled = true;
      publishBtn.innerHTML = hasVisual
        ? '<span class="btn-icon">⏳</span> Uploading visual & posting to LinkedIn...'
        : '<span class="btn-icon">⏳</span> Publishing to Personal Profile...';

      try {
        const res = await apiFetch('/api/posts/publish-now', {
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
          showToast(hasVisual
            ? '🚀 Successfully published to your Personal LinkedIn Profile with attached visual!'
            : '🚀 Successfully published to your Personal LinkedIn Profile!', 'success');
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
        const res = await apiFetch('/api/queue', {
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
        const res = await apiFetch('/api/scheduler/trigger-now', { method: 'POST' });
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
      const res = await apiFetch('/api/settings', {
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
      const res = await apiFetch('/api/auth/manual-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (data.success) {
        setStoredAuth({
          token,
          name: data.profile?.name || 'LinkedIn User',
          urn: data.profile?.urn || 'urn:li:person:me',
          avatar: data.profile?.picture || '',
          savedAt: Date.now(),
        });
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
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        setStoredGeminiKey(key);
        updateEngineBadgeUI();
        showToast('Gemini API key updated!', 'success');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

function initImageAutomationSettings() {
  const form = document.getElementById('form-image-automation-settings');
  const aspectSelect = document.getElementById('setting-aspect-ratio');
  const widthInput = document.getElementById('setting-image-width');
  const heightInput = document.getElementById('setting-image-height');
  const testCfBtn = document.getElementById('btn-test-cloudflare');
  const cfResult = document.getElementById('cf-test-result');

  // Auto-fill width/height when aspect ratio changes
  if (aspectSelect && widthInput && heightInput) {
    aspectSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === '16:9') {
        widthInput.value = 1200;
        heightInput.value = 675;
      } else if (val === '1:1') {
        widthInput.value = 1080;
        heightInput.value = 1080;
      } else if (val === '4:5') {
        widthInput.value = 1080;
        heightInput.value = 1350;
      }
    });
  }

  // Test Cloudflare Connection
  if (testCfBtn) {
    testCfBtn.addEventListener('click', async () => {
      const accountId = document.getElementById('setting-cf-account-id')?.value?.trim();
      const apiToken = document.getElementById('setting-cf-api-token')?.value?.trim();

      if (!accountId || !apiToken) {
        showToast('Please provide both Cloudflare Account ID and API Token', 'error');
        return;
      }

      testCfBtn.disabled = true;
      testCfBtn.textContent = '⏳ Testing Edge GPU...';
      if (cfResult) cfResult.classList.add('hidden');

      try {
        const res = await apiFetch('/api/ai/verify-cloudflare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, apiToken }),
        });
        const data = await res.json();
        if (data.success) {
          if (cfResult) {
            cfResult.className = 'test-result-label success';
            cfResult.textContent = `✅ Connected to ${data.accountName}! FLUX.2 Dev active.`;
            cfResult.classList.remove('hidden');
          }
          showToast(`Cloudflare Workers AI connected successfully! ⚡`, 'success');
        } else {
          if (cfResult) {
            cfResult.className = 'test-result-label error';
            cfResult.textContent = `❌ ${data.error || 'Connection failed'}`;
            cfResult.classList.remove('hidden');
          }
          showToast(data.error || 'Connection test failed', 'error');
        }
      } catch (err) {
        if (cfResult) {
          cfResult.className = 'test-result-label error';
          cfResult.textContent = `❌ Network error: ${err.message}`;
          cfResult.classList.remove('hidden');
        }
        showToast(`Test error: ${err.message}`, 'error');
      } finally {
        testCfBtn.disabled = false;
        testCfBtn.textContent = '⚡ Test Cloudflare Connection';
      }
    });
  }

  // Save Settings
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-image-settings');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      const payload = {
        imageGenerationEnabled: document.getElementById('setting-image-gen-enabled')?.checked ?? true,
        autoGenerateImages: document.getElementById('setting-auto-gen-images')?.checked ?? true,
        imageModel: document.getElementById('setting-image-model')?.value || 'flux-2-dev',
        imageStyle: document.getElementById('setting-image-style')?.value || 'photorealistic',
        aspectRatio: document.getElementById('setting-aspect-ratio')?.value || '16:9',
        imageWidth: parseInt(document.getElementById('setting-image-width')?.value, 10) || 1200,
        imageHeight: parseInt(document.getElementById('setting-image-height')?.value, 10) || 675,
        customImageInstructions: document.getElementById('setting-custom-image-instructions')?.value || '',
        imageFailureBehavior: document.getElementById('setting-failure-behavior')?.value || 'publish-text',
        cloudflareAccountId: document.getElementById('setting-cf-account-id')?.value?.trim() || '',
        cloudflareApiToken: document.getElementById('setting-cf-api-token')?.value?.trim() || '',
      };

      try {
        const res = await apiFetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast('Image automation settings saved successfully! 🎨', 'success');
          state.selectedStyle = payload.imageStyle;
          state.selectedAspectRatio = payload.aspectRatio;
        } else {
          showToast(data.error || 'Failed to save settings', 'error');
        }
      } catch (err) {
        showToast(`Save error: ${err.message}`, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Image Automation Settings';
        }
      }
    });
  }
}

const IMAGE_MODEL_LABELS = {
  'flux-2-dev': 'FLUX.2 Dev',
  'flux-1-schnell': 'FLUX.1 Schnell',
  'imagen-3': 'Google Imagen 3',
  'pollinations-flux': 'Flux AI 4K',
};

const COPY_MODEL_LABELS = {
  'staff-engine': 'Staff Engine',
  'gemini-2.0': 'Gemini 2.0 Flash',
};

function updateEngineBadgeUI() {
  const badgeBtn = document.getElementById('btn-open-gemini-modal');
  const label = document.getElementById('engine-status-text');
  const disconnectBtn = document.getElementById('btn-disconnect-gemini');
  const modalInput = document.getElementById('modal-gemini-key-input');
  const settingsInput = document.getElementById('setting-gemini-key');

  const currentImgModel = state.activeImageModel || getStoredImageModel() || 'flux-2-dev';
  const currentCopyModel = state.activeCopyModel || getStoredCopyModel() || 'staff-engine';
  const geminiKey = getStoredGeminiKey();

  const imgLabel = IMAGE_MODEL_LABELS[currentImgModel] || 'FLUX.2 Dev';
  const copyLabel = COPY_MODEL_LABELS[currentCopyModel] || 'Staff Engine';

  if (badgeBtn) {
    badgeBtn.classList.add('active-gemini');
    badgeBtn.title = `Active Models: Visual = ${imgLabel}, Copy = ${copyLabel}. Click to switch models.`;
  }

  if (label) {
    label.textContent = `🟢 ${imgLabel} & ${copyLabel} Active`;
  }

  // Update Studio Live Preview provenance bars
  const provImg = document.getElementById('provenance-image-engine');
  if (provImg) provImg.textContent = imgLabel;

  const provText = document.getElementById('provenance-text-engine');
  if (provText) {
    provText.textContent = currentCopyModel === 'gemini-2.0' ? 'Google Gemini 2.0 Flash' : 'Staff Case Study Engine';
  }

  // Update Image Studio header badge
  const imgEngineBadge = document.getElementById('image-engine-badge');
  if (imgEngineBadge) {
    imgEngineBadge.textContent = imgLabel;
  }

  // Update Settings Image Model selector if present
  const settingImgModel = document.getElementById('setting-image-model');
  if (settingImgModel && settingImgModel.value !== currentImgModel) {
    settingImgModel.value = currentImgModel;
  }

  if (geminiKey) {
    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
    if (modalInput && !modalInput.value) modalInput.value = geminiKey;
    if (settingsInput && !settingsInput.value) settingsInput.value = geminiKey;
  } else {
    if (disconnectBtn) disconnectBtn.classList.add('hidden');
  }
}

function initGeminiModal() {
  const openBtn = document.getElementById('btn-open-gemini-modal');
  const closeBtn = document.getElementById('btn-close-gemini-modal');
  const cancelBtn = document.getElementById('btn-cancel-gemini-modal');
  const modal = document.getElementById('modal-gemini');
  const saveBtn = document.getElementById('btn-save-gemini-modal');
  const disconnectBtn = document.getElementById('btn-disconnect-gemini');
  const keyInput = document.getElementById('modal-gemini-key-input');
  const toggleVisibilityBtn = document.getElementById('btn-toggle-key-visibility');
  const feedback = document.getElementById('gemini-validation-feedback');

  function syncModalCardsWithState() {
    const currentImgModel = state.activeImageModel || getStoredImageModel() || 'flux-2-dev';
    const currentCopyModel = state.activeCopyModel || getStoredCopyModel() || 'staff-engine';

    document.querySelectorAll('.model-option-card').forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      const isSelected = radio && radio.value === currentImgModel;
      if (radio) radio.checked = isSelected;
      card.classList.toggle('active', isSelected);
    });

    document.querySelectorAll('.copy-option-card').forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      const isSelected = radio && radio.value === currentCopyModel;
      if (radio) radio.checked = isSelected;
      card.classList.toggle('active', isSelected);
    });
  }

  // Click handlers for visual model cards
  document.querySelectorAll('.model-option-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.model-option-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Click handlers for copy model cards
  document.querySelectorAll('.copy-option-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.copy-option-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  function openModal() {
    if (!modal) return;
    const currentKey = getStoredGeminiKey();
    if (keyInput) keyInput.value = currentKey;
    if (feedback) {
      feedback.classList.add('hidden');
      feedback.textContent = '';
      feedback.className = 'validation-feedback hidden';
    }
    syncModalCardsWithState();
    modal.classList.remove('hidden');
    updateEngineBadgeUI();
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (toggleVisibilityBtn && keyInput) {
    toggleVisibilityBtn.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleVisibilityBtn.textContent = '🙈';
      } else {
        keyInput.type = 'password';
        toggleVisibilityBtn.textContent = '👁️';
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const selectedImgRadio = document.querySelector('input[name="modal-image-model"]:checked');
      const selectedCopyRadio = document.querySelector('input[name="modal-copy-model"]:checked');
      const chosenImageModel = selectedImgRadio ? selectedImgRadio.value : 'flux-2-dev';
      const chosenCopyModel = selectedCopyRadio ? selectedCopyRadio.value : 'staff-engine';
      const apiKey = keyInput?.value?.trim() || '';

      const requiresGeminiKey = chosenCopyModel === 'gemini-2.0' || chosenImageModel === 'imagen-3';
      const currentStoredKey = getStoredGeminiKey();

      if (requiresGeminiKey && !apiKey && !currentStoredKey) {
        if (feedback) {
          feedback.className = 'validation-feedback error';
          feedback.textContent = 'Selected model requires a Google Gemini API Key. Please paste your key below or choose FLUX / Staff Engine.';
          feedback.classList.remove('hidden');
        }
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>Saving & Verifying... ⏳</span>';
      if (feedback) feedback.classList.add('hidden');

      try {
        let verifiedKey = apiKey || currentStoredKey;
        if (apiKey && apiKey !== currentStoredKey) {
          const verifyRes = await apiFetchJson('/api/ai/verify-gemini-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey }),
          });

          if (!verifyRes.ok || !verifyRes.data?.success) {
            if (feedback) {
              feedback.className = 'validation-feedback error';
              feedback.textContent = `❌ Gemini key invalid: ${verifyRes.data?.error || 'Verification failed'}`;
              feedback.classList.remove('hidden');
            }
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span>💾 Apply & Save Engine Selection</span>';
            return;
          }
          verifiedKey = apiKey;
          setStoredGeminiKey(apiKey);
        }

        // Apply state and persist in local storage
        state.activeImageModel = chosenImageModel;
        state.activeCopyModel = chosenCopyModel;
        setStoredImageModel(chosenImageModel);
        setStoredCopyModel(chosenCopyModel);

        // Sync permanently to backend settings
        await apiFetchJson('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageModel: chosenImageModel,
            copyModel: chosenCopyModel,
            ...(verifiedKey ? { geminiApiKey: verifiedKey } : {}),
          }),
        });

        updateEngineBadgeUI();

        const imgLabel = IMAGE_MODEL_LABELS[chosenImageModel] || chosenImageModel;
        const copyLabel = COPY_MODEL_LABELS[chosenCopyModel] || chosenCopyModel;

        if (feedback) {
          feedback.className = 'validation-feedback success';
          feedback.textContent = `✅ Saved! Active models: ${imgLabel} (Visual) + ${copyLabel} (Copy).`;
          feedback.classList.remove('hidden');
        }
        showToast(`Active models updated: ${imgLabel} & ${copyLabel}`, 'success');

        setTimeout(() => {
          closeModal();
        }, 1000);
      } catch (err) {
        if (feedback) {
          feedback.className = 'validation-feedback error';
          feedback.textContent = `❌ Error saving models: ${err.message}`;
          feedback.classList.remove('hidden');
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾 Apply & Save Engine Selection</span>';
      }
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      setStoredGeminiKey('');
      if (keyInput) keyInput.value = '';
      state.activeImageModel = 'flux-2-dev';
      state.activeCopyModel = 'staff-engine';
      setStoredImageModel('flux-2-dev');
      setStoredCopyModel('staff-engine');
      syncModalCardsWithState();

      try {
        await apiFetchJson('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey: '',
            copyModel: 'staff-engine',
            imageModel: 'flux-2-dev',
          }),
        });
      } catch (e) {
        console.warn('Disconnect backend sync error:', e);
      }

      updateEngineBadgeUI();
      showToast('Gemini key cleared. Switched to FLUX.2 Dev & Staff Engine.', 'info');
      closeModal();
    });
  }
}

// ==========================================
// 10. FETCH DATA & RENDER
// ==========================================
async function fetchStatus() {
  try {
    const { ok, data } = await apiFetchJson('/api/status');
    if (!ok || !data) return;
    state.status = data;

    const storedAuth = getStoredAuth();
    const isConnected = data.connected || data.isConnected || (storedAuth && !!storedAuth.token);
    const user = data.user || data.profile || storedAuth;

    updateAuthUI(isConnected, user);

    // Sync settings if present on backend
    if (data.settings) {
      const s = data.settings;
      if (s.imageModel) {
        state.activeImageModel = s.imageModel;
        setStoredImageModel(s.imageModel);
      }
      if (s.copyModel) {
        state.activeCopyModel = s.copyModel;
        setStoredCopyModel(s.copyModel);
      }
      if (s.geminiApiKey && !getStoredGeminiKey()) {
        setStoredGeminiKey(s.geminiApiKey);
      }
      updateEngineBadgeUI();

      // Populate image automation settings
      const genEnabled = document.getElementById('setting-image-gen-enabled');
      if (genEnabled) genEnabled.checked = s.imageGenerationEnabled !== false;

      const autoGen = document.getElementById('setting-auto-gen-images');
      if (autoGen) autoGen.checked = s.autoGenerateImages !== false;

      const modelSelect = document.getElementById('setting-image-model');
      if (modelSelect && s.imageModel) modelSelect.value = s.imageModel;

      const styleSelect = document.getElementById('setting-image-style');
      if (styleSelect && s.imageStyle) styleSelect.value = s.imageStyle;

      const aspectSelect = document.getElementById('setting-aspect-ratio');
      if (aspectSelect && s.aspectRatio) aspectSelect.value = s.aspectRatio;

      const widthInput = document.getElementById('setting-image-width');
      if (widthInput && s.imageWidth) widthInput.value = s.imageWidth;

      const heightInput = document.getElementById('setting-image-height');
      if (heightInput && s.imageHeight) heightInput.value = s.imageHeight;

      const customInstr = document.getElementById('setting-custom-image-instructions');
      if (customInstr && s.customImageInstructions !== undefined) customInstr.value = s.customImageInstructions;

      const failBehavior = document.getElementById('setting-failure-behavior');
      if (failBehavior && s.imageFailureBehavior) failBehavior.value = s.imageFailureBehavior;

      const cfAccount = document.getElementById('setting-cf-account-id');
      if (cfAccount && s.cloudflareAccountId) cfAccount.value = s.cloudflareAccountId;

      const cfToken = document.getElementById('setting-cf-api-token');
      if (cfToken && s.cloudflareApiToken) cfToken.value = s.cloudflareApiToken;
    }

    // Update disconnect button
    document.getElementById('btn-disconnect')?.addEventListener('click', async () => {
      if (confirm('Disconnect LinkedIn account?')) {
        clearStoredAuth();
        updateAuthUI(false, null);
        await apiFetch('/api/auth/disconnect', { method: 'POST' });
        showToast('LinkedIn account disconnected', 'info');
      }
    });

  } catch (err) {
    console.error('Failed to fetch status:', err);
    const storedAuth = getStoredAuth();
    if (storedAuth && storedAuth.token) {
      updateAuthUI(true, storedAuth);
    }
  }
}

async function fetchQueue() {
  try {
    const { ok, data } = await apiFetchJson('/api/queue');
    if (!ok || !data) return;
    state.queue = Array.isArray(data) ? data : (data.queue || []);

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
        ${item.imageUrl ? `<img src="${item.imageUrl}" class="queue-thumb" alt="Visual" onerror="this.style.display='none'">` : '<div class="queue-thumb" style="background:#131d33; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:0.7rem; text-align:center;">No Image</div>'}
        <div class="queue-info">
          <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.25rem;">
            <span class="queue-topic-badge">${item.topic || 'General'}</span>
            ${item.imageUrl ? `<span style="font-size:0.72rem; color:#6ee7b7; background:rgba(16,185,129,0.12); padding:2px 6px; border-radius:4px;">✨ ${item.imageEngine || 'FLUX.2 Dev'}</span>` : ''}
            ${item.status === 'needs_attention' ? `<span style="font-size:0.72rem; color:#fca5a5; background:rgba(244,63,94,0.15); padding:2px 6px; border-radius:4px;">⚠️ Requires Attention</span>` : ''}
          </div>
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
    const { ok, data } = await apiFetchJson(`/api/queue/${id}/publish-now`, { method: 'POST' });
    if (ok && data?.success) {
      showToast('Post published to Personal Profile! 🚀', 'success');
      fetchQueue();
      fetchHistory();
    } else {
      showToast(`Publishing failed: ${data?.error || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function deleteQueueItem(id) {
  try {
    const { ok, data } = await apiFetchJson(`/api/queue/${id}`, { method: 'DELETE' });
    if (ok && data?.success) {
      showToast('Item deleted from queue', 'info');
      fetchQueue();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function fetchHistory() {
  try {
    const { ok, data } = await apiFetchJson('/api/history');
    if (!ok || !data) return;
    state.history = Array.isArray(data) ? data : (data.history || []);

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

// Global functions for inline onclick handlers
window.publishQueueItem = publishQueueItem;
window.deleteQueueItem = deleteQueueItem;
