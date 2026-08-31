const https = require('https');
const db = require('./database');

// Smart dynamic post templates across categories for instant offline generation
const TEMPLATES_BY_TOPIC = {
  'AI & Tech Trends': [
    {
      hook: "AI isn't going to replace developers, but developers using AI are replacing those who don't.",
      body: `Here are 4 shifts happening in tech right now that you cannot ignore:

1. Automation is moving from simple scripts to autonomous multi-step agents.
2. Code review and test generation are becoming AI-first workflows.
3. Domain expertise + prompt precision is the new competitive advantage.
4. Speed of execution now matters more than writing boilerplate from scratch.

The engineers winning in 2026 aren't just writing code—they are orchestrating systems.`,
      cta: "How are you incorporating AI into your daily engineering workflow?",
      tags: ['#ArtificialIntelligence', '#SoftwareEngineering', '#TechTrends', '#FutureOfTech', '#DeveloperTools'],
    },
    {
      hook: "90% of companies are building AI wrappers. The top 10% are building workflows.",
      body: `There's a massive difference between adding a chat interface and solving a real operational bottleneck.

What actually creates enterprise value with AI:
• Deep integration with existing company data pipelines
• Deterministic fallback safeguards
• Clean, low-latency UX
• Measurable reduction in manual human hours

Don't just plug in an LLM. Design the end-to-end outcome.`,
      cta: "What's the most impactful AI tool or workflow your team implemented this quarter?",
      tags: ['#AI', '#ProductManagement', '#TechLeadership', '#Innovation', '#B2BTech'],
    },
    {
      hook: "The biggest bottleneck in tech today isn't compute or algorithms—it's data quality.",
      body: `You can have the most sophisticated models, but if your data is dirty, unstandardized, or siloed, your results will fail.

3 things every engineering team should prioritize before investing in advanced AI:
1. Strict schema validation and cleanup pipelines
2. High-signal logging and telemetry
3. Clear data governance and versioning

Fix the foundations first; the magic comes after.`,
      cta: "Agree or disagree? Drop your thoughts below 👇",
      tags: ['#DataEngineering', '#AIInfrastructure', '#MachineLearning', '#TechStrategy'],
    },
  ],
  'Software Engineering Tips': [
    {
      hook: "Writing clean code is good. Writing deletable code is legendary.",
      body: `Over-engineering is the #1 silent killer of fast development.

Before you build that abstract factory or custom caching layer:
• Ask: Will this requirement still exist in 6 months?
• Keep modules loosely coupled so they can be ripped out easily.
• Write clear tests that document intent rather than implementation quirks.
• Prioritize readability over clever one-liners.

Simplicity is a feature, not a compromise.`,
      cta: "What is one architectural rule you swear by?",
      tags: ['#Coding', '#WebDev', '#SoftwareArchitecture', '#CleanCode', '#DevCommunity'],
    },
    {
      hook: "Junior Dev: 'It works on my machine!'\nSenior Dev: 'Then we'll ship your machine.'\nStaff Dev: 'Automate container builds and reproducible tests.'",
      body: `Here are 3 habits that accelerated my engineering career more than learning any new framework:

1. Learning to debug with system logs and profilers instead of console.log.
2. Writing clear documentation that saves the next developer 5 hours of confusion.
3. Reviewing PRs for architecture and edge cases, not just formatting.

The best engineers build tools and processes that make the entire team 10x faster.`,
      cta: "What advice would you give to someone starting their tech journey today?",
      tags: ['#SoftwareEngineering', '#CareerAdvice', '#Mentorship', '#DevLife'],
    },
    {
      hook: "Most APIs fail in production not because of traffic, but because of unhandled edge cases.",
      body: `Here is a 4-point checklist before marking your API endpoint 'production-ready':

✓ Rate limiting & request throttling configured
✓ Clear and structured error responses (never leak stack traces)
✓ Idempotency keys for payment and mutating requests
✓ Comprehensive timeouts on all downstream external services

Build with resilience in mind from Day 1.`,
      cta: "Save this checklist for your next backend deployment 📌",
      tags: ['#Backend', '#API', '#SystemDesign', '#CloudComputing', '#FullStack'],
    },
  ],
  'Career & Productivity Growth': [
    {
      hook: "You don't need an 80-hour work week. You need 4 hours of ruthless, uninterrupted focus.",
      body: `Here is how high-performers achieve disproportionate results in less time:

• Time-box deep work blocks in the morning before checking emails or Slack.
• Say 'No' to meetings without a clear agenda or decision goal.
• Automate repetitive tasks using scripts and AI tools.
• Work in 90-minute sprints with real screen breaks.

Consistency and focus beat chaotic hustle every single time.`,
      cta: "What is your #1 productivity hack during a busy week?",
      tags: ['#Productivity', '#CareerGrowth', '#WorkSmart', '#Focus', '#TimeManagement'],
    },
    {
      hook: "The most valuable career skill in 2026 isn't just technical knowledge. It's concise communication.",
      body: `You can build the best system in the world, but if you cannot explain its value to stakeholders, your impact remains invisible.

3 rules for communicating with clarity:
1. Bottom Line Up Front (BLUF): State the conclusion or ask in the first sentence.
2. Eliminate jargon when speaking to cross-functional partners.
3. Quantify impact: Use metrics (e.g. 'reduced latency by 35%') instead of adjectives.

Clarity builds trust. Trust builds careers.`,
      cta: "How do you prepare for critical stakeholder presentations?",
      tags: ['#Leadership', '#Communication', '#CareerAdvice', '#ExecutivePresence'],
    },
  ],
  'Future of Work': [
    {
      hook: "Remote work didn't fail. Lazy management failed.",
      body: `Forced return-to-office mandates often disguise a deeper problem: lack of asynchronous culture and outcome-based measurement.

What high-trust remote teams do differently:
• Document decisions in writing (RFCs) rather than holding endless syncs.
• Measure deliverables and business impact, not active hours or green status dots.
• Respect timezones and provide deep work quiet hours.
• Foster intentional, high-quality in-person offsites.

Empower people with autonomy and accountability, and watch productivity soar.`,
      cta: "What's your stance on remote vs hybrid work in 2026? Let's discuss.",
      tags: ['#FutureOfWork', '#RemoteWork', '#Leadership', '#CompanyCulture', '#Management'],
    },
  ],
};

/**
 * Generate AI post using Google Gemini API if key is available,
 * or fallback to smart dynamic post engine.
 */
async function generatePost({ topic = 'AI & Tech Trends', tone = 'engaging', customPrompt = '' }) {
  const settings = db.getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      return await generateWithGemini(apiKey, topic, tone, customPrompt);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to smart dynamic generator:', err.message);
      return generateDynamicTemplate(topic, tone, customPrompt);
    }
  }

  return generateDynamicTemplate(topic, tone, customPrompt);
}

/**
 * Call Google Gemini Flash API via HTTPS
 */
function generateWithGemini(apiKey, topic, tone, customPrompt) {
  return new Promise((resolve, reject) => {
    const promptInstructions = `
You are an expert LinkedIn creator and ghostwriter who writes high-engagement, authentic, thought-provoking posts.

Topic: ${topic}
Tone: ${tone} (e.g. engaging, thought-provoking, educational, storytelling)
${customPrompt ? `Custom Instructions / Focus: ${customPrompt}` : ''}

Rules:
1. Start with a scroll-stopping, crisp 1-2 sentence hook.
2. Use clean whitespace and line breaks (short paragraphs, 1-2 lines each) for maximum mobile readability.
3. Provide actionable insights, structured bullet points, or a memorable perspective.
4. End with a thoughtful question or Call-to-Action to invite comments.
5. Include 3-5 relevant hashtags at the bottom.
6. Do NOT use cliché buzzwords like "delve", "testament", "tapestry", "game changer" or generic robotic AI intros.
7. Return ONLY the final ready-to-publish post text.
`;

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [{ text: promptInstructions }],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 800,
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              resolve({
                content: text.trim(),
                topic,
                tone,
                engine: 'Gemini 1.5 Flash',
              });
              return;
            }
          }
          reject(new Error(parsed.error?.message || `Gemini API Error (HTTP ${res.statusCode})`));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(requestBody);
    req.end();
  });
}

/**
 * Smart template post builder with variety & dynamic customization
 */
function generateDynamicTemplate(topic, tone, customPrompt) {
  const categories = Object.keys(TEMPLATES_BY_TOPIC);
  const matchedTopic = categories.find((c) => c.toLowerCase() === topic.toLowerCase()) || categories[0];
  const list = TEMPLATES_BY_TOPIC[matchedTopic] || TEMPLATES_BY_TOPIC['AI & Tech Trends'];
  const template = list[Math.floor(Math.random() * list.length)];

  let postText = `${template.hook}\n\n${template.body}\n\n${template.cta}\n\n${template.tags.join(' ')}`;

  if (customPrompt) {
    postText = `💡 Quick Insight on ${customPrompt}:\n\n` + postText;
  }

  return {
    content: postText,
    topic: matchedTopic,
    tone: tone || 'engaging',
    engine: 'Smart Dynamic Engine',
  };
}

/**
 * Generate matching visual / image concept for a post
 */
function generateImageConcept(topic, postText) {
  const visualIdeas = {
    'AI & Tech Trends': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1000&auto=format&fit=crop&q=80',
    'Software Engineering Tips': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
    'Career & Productivity Growth': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1000&auto=format&fit=crop&q=80',
    'Future of Work': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80',
  };

  return visualIdeas[topic] || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80';
}

module.exports = {
  generatePost,
  generateImageConcept,
  TEMPLATES_BY_TOPIC,
};
