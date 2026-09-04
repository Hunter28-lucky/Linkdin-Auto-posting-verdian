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

  try {
    let postToPublish = null;

    // 1. Check if there is an item in the queue first
    const nextQueued = db.popNextQueuedPost();
    if (nextQueued) {
      postToPublish = nextQueued;
      console.log(`[Scheduler] Publishing post from queue: ${postToPublish.id}`);
      // Ensure image is attached if missing
      if (!postToPublish.imageUrl) {
        console.log('[Scheduler] Queued post missing image, generating AI visual...');
        const imagePrompt = aiGenerator.createImagePrompt(postToPublish.topic, postToPublish.content);
        postToPublish.imageUrl = await aiGenerator.generateAiImage(imagePrompt, settings.geminiApiKey);
      }
    } else if (settings.autopilotMode === 'autopilot' || settings.autopilotMode === 'auto-generate') {
      // Auto-generate fresh post with AI visual
      const topics = settings.topics || ['AI & Automation Trends', 'Software Engineering & Architecture', 'Productivity & Deep Work'];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      console.log(`[Scheduler] Autopilot mode: Generating fresh post and AI visual on topic "${randomTopic}"...`);
      const generated = await aiGenerator.generatePost({
        topic: randomTopic,
        tone: settings.defaultTone || 'engaging',
      });
      postToPublish = {
        content: generated.content,
        topic: generated.topic,
        tone: generated.tone,
        imageUrl: generated.imageUrl,
      };
    } else {
      console.log('[Scheduler] Queue is empty and autopilot mode is set to "Queue Review Only". Skipping.');
      return { success: false, reason: 'Queue empty in review mode' };
    }

    // Publish to LinkedIn personal profile with image
    const result = await linkedin.publishPost(postToPublish.content, {
      imageUrl: postToPublish.imageUrl,
      targetType: 'person',
    });

    // Save to history
    db.addToHistory({
      content: postToPublish.content,
      topic: postToPublish.topic,
      status: 'success',
      linkedinPostUrn: result.postUrn,
      authorUrn: result.authorUrn,
      imageUrl: postToPublish.imageUrl,
    });

    console.log(`[Scheduler] ✅ Successfully published daily post to LinkedIn! Post URN: ${result.postUrn}`);
    return { success: true, postUrn: result.postUrn };
  } catch (err) {
    console.error('[Scheduler] ❌ Error executing scheduled post:', err.message);
    db.addToHistory({
      content: 'Scheduled post execution failed',
      topic: 'Automated Job',
      status: 'failed',
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
};
