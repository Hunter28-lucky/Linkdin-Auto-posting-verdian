const cron = require('node-cron');
const db = require('./database');
const linkedin = require('./linkedin');
const aiGenerator = require('./aiGenerator');

let activeCronTask = null;

/**
 * Convert HH:MM (e.g. "09:30") and days array to cron expression
 * Days: ['1','2','3','4','5'] -> "30 9 * * 1,2,3,4,5"
 */
function buildCronExpression(timeStr, daysArray) {
  const [hour, minute] = (timeStr || '09:00').split(':').map((v) => parseInt(v, 10));
  const validMinute = isNaN(minute) ? 0 : minute;
  const validHour = isNaN(hour) ? 9 : hour;
  const daysStr = daysArray && daysArray.length > 0 ? daysArray.join(',') : '*';

  // Format: "minute hour day-of-month month day-of-week"
  return `${validMinute} ${validHour} * * ${daysStr}`;
}

/**
 * Proactively prepare images for queued posts before publication time
 */
async function ensureQueueImagesReady() {
  const settings = db.getSettings();
  if (settings.imageGenerationEnabled === false || settings.autoGenerateImages === false) {
    return;
  }

  const queue = db.getQueue();
  for (const post of queue) {
    if (!post.imageUrl && post.status !== 'needs_attention') {
      try {
        console.log(`[Scheduler] 🎨 Pre-generating FLUX.2 Dev visual for queued post: ${post.id}...`);
        const imgStyle = settings.imageStyle || 'photorealistic';
        const prompt = aiGenerator.createImagePrompt(post.topic, post.content, imgStyle, settings.customImageInstructions);
        const imageResult = await aiGenerator.generateAiImage(prompt, null, {
          topic: post.topic,
          postContent: post.content,
          style: imgStyle,
          aspectRatio: settings.aspectRatio || '16:9',
        });
        if (imageResult && imageResult.imageUrl) {
          await db.updateQueueItemAsync(post.id, {
            imageUrl: imageResult.imageUrl,
            imagePrompt: imageResult.imagePrompt,
            imageEngine: imageResult.engine,
            imageStatus: 'ready',
          });
          console.log(`[Scheduler] ✅ Image ready and attached to queued post: ${post.id}`);
        }
      } catch (err) {
        console.warn(`[Scheduler] Pre-generation notice for queued post ${post.id}: ${err.message}`);
      }
    }
  }
}

/**
 * Execute the daily posting logic
 */
async function executeScheduledRun() {
  console.log(`[Scheduler] [${new Date().toISOString()}] Automated daily check triggered...`);

  const settings = db.getSettings();
  if (!settings.schedulerActive) {
    console.log('[Scheduler] Automation is currently disabled in settings.');
    return { success: false, reason: 'Scheduler disabled' };
  }

  const tokens = db.getTokens();
  if (!tokens.accessToken || !tokens.profile?.urn) {
    console.warn('[Scheduler] Cannot publish: LinkedIn account is not connected.');
    return { success: false, reason: 'LinkedIn not connected' };
  }

  let postToPublish = null;
  let fromQueue = false;

  try {
    // 1. Check if there is an item in the queue first
    const nextQueued = db.popNextQueuedPost();
    if (nextQueued) {
      postToPublish = nextQueued;
      fromQueue = true;
      console.log(`[Scheduler] Publishing post from queue: ${postToPublish.id}`);

      // Ensure image is attached if enabled and missing
      if (!postToPublish.imageUrl && settings.imageGenerationEnabled !== false) {
        console.log('[Scheduler] Queued post missing image, generating FLUX.2 Dev visual...');
        const imgStyle = settings.imageStyle || 'photorealistic';
        const imagePrompt = aiGenerator.createImagePrompt(postToPublish.topic, postToPublish.content, imgStyle, settings.customImageInstructions);

        try {
          const imageObj = await aiGenerator.generateAiImage(imagePrompt, null, {
            topic: postToPublish.topic,
            postContent: postToPublish.content,
            style: imgStyle,
            aspectRatio: settings.aspectRatio || '16:9',
            maxRetries: settings.maxImageRetries || 2,
          });

          if (imageObj && imageObj.imageUrl) {
            postToPublish.imageUrl = imageObj.imageUrl;
            postToPublish.imageEngine = imageObj.engine;
            postToPublish.imagePrompt = imageObj.imagePrompt;
          }
        } catch (imgErr) {
          console.error(`[Scheduler] ⚠️ Image generation error: ${imgErr.message}`);

          // Configurable failure behavior:
          const failureBehavior = settings.imageFailureBehavior || 'publish-text';
          if (failureBehavior === 'keep-in-queue') {
            console.log('[Scheduler] Policy "Keep in queue" active. Keeping post in queue and requiring attention.');
            await db.addToQueueAsync({
              ...postToPublish,
              status: 'needs_attention',
              error: `Image generation failed: ${imgErr.message}`,
            });
            db.addToHistory({
              content: postToPublish.content,
              topic: postToPublish.topic,
              status: 'held_in_queue',
              error: `Image generation failed: ${imgErr.message}`,
            });
            return { success: false, reason: 'Image generation failed, held in queue' };
          } else if (failureBehavior === 'publish-text') {
            console.log('[Scheduler] Policy "Publish text-only" active. Proceeding with text-only post.');
            postToPublish.imageUrl = null;
            postToPublish.imageWarning = `Published text-only: ${imgErr.message}`;
          }
        }
      }
    } else if (settings.autopilotMode === 'autopilot' || settings.autopilotMode === 'auto-generate') {
      // Auto-generate fresh post with AI visual
      const topics = settings.topics || ['AI & Automation Trends', 'Software Engineering & Architecture', 'Productivity & Deep Work'];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      console.log(`[Scheduler] Autopilot mode: Generating fresh post and AI visual on topic "${randomTopic}"...`);
      const generated = await aiGenerator.generatePost({
        topic: randomTopic,
        tone: settings.defaultTone || 'engaging',
        style: settings.imageStyle || 'photorealistic',
        aspectRatio: settings.aspectRatio || '16:9',
      });
      postToPublish = {
        content: generated.content,
        topic: generated.topic,
        tone: generated.tone,
        imageUrl: generated.imageUrl,
        imageData: generated.imageData,
        imageEngine: generated.imageEngine,
        imagePrompt: generated.imagePrompt,
      };
    } else {
      console.log('[Scheduler] Queue is empty and autopilot mode is set to "Queue Review Only". Skipping.');
      return { success: false, reason: 'Queue empty in review mode' };
    }

    // Publish to LinkedIn personal profile
    const result = await linkedin.publishPost(postToPublish.content, {
      imageUrl: postToPublish.imageUrl,
      imageData: postToPublish.imageData,
      targetType: 'person',
    });

    // Save to history with accurate image tracking
    const historyRecord = await db.addToHistoryAsync({
      content: postToPublish.content,
      topic: postToPublish.topic,
      status: 'success',
      linkedinPostUrn: result.postUrn,
      authorUrn: result.authorUrn,
      imageUrl: postToPublish.imageUrl || null,
      imageEngine: postToPublish.imageEngine || (postToPublish.imageUrl ? 'FLUX.2 Dev' : null),
      imageStatus: postToPublish.imageUrl ? 'attached' : 'none',
      fallbackNote: postToPublish.imageWarning || null,
      api: result.api,
    });

    console.log(`[Scheduler] ✅ Successfully published daily post to LinkedIn! Post URN: ${result.postUrn} (API: ${result.api})`);

    // Prepare next queue images in background
    ensureQueueImagesReady().catch(() => {});

    return { success: true, postUrn: result.postUrn, historyItem: historyRecord };
  } catch (err) {
    console.error('[Scheduler] ❌ Error executing scheduled post:', err.message);
    const failureTopic = postToPublish ? postToPublish.topic : 'Automated Job';
    const failureContent = postToPublish ? postToPublish.content : 'Scheduled post execution failed';
    const failureImage = postToPublish ? (postToPublish.imageUrl || null) : null;
    const failureEngine = postToPublish ? (postToPublish.imageEngine || null) : null;

    if (fromQueue && postToPublish && settings.imageFailureBehavior === 'keep-in-queue') {
      await db.addToQueueAsync({
        ...postToPublish,
        status: 'needs_attention',
        error: err.message,
      });
    }

    await db.addToHistoryAsync({
      content: failureContent,
      topic: failureTopic,
      status: 'failed',
      imageUrl: failureImage,
      imageEngine: failureEngine,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Initialize / Reload Cron Job
 */
function reloadScheduler() {
  if (activeCronTask) {
    activeCronTask.stop();
    activeCronTask = null;
  }

  const settings = db.getSettings();
  if (!settings.schedulerActive) {
    console.log('[Scheduler] Daily automated posting is currently paused.');
    return;
  }

  const expression = buildCronExpression(settings.scheduleTime, settings.scheduleDays);
  console.log(`[Scheduler] Scheduling daily LinkedIn job with cron expression: "${expression}" (Time: ${settings.scheduleTime}, Mode: ${settings.autopilotMode})`);

  try {
    activeCronTask = cron.schedule(expression, () => {
      executeScheduledRun();
    });
  } catch (err) {
    console.error('[Scheduler] Failed to initialize cron task:', err.message);
  }
}

function initScheduler() {
  reloadScheduler();
}

module.exports = {
  initScheduler,
  reloadScheduler,
  executeScheduledRun,
  ensureQueueImagesReady,
};
