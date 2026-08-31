const https = require('https');
const db = require('./database');

// Smart dynamic post templates across categories
const TEMPLATES_BY_TOPIC = {
  'Hiring Remote Sales': [
    {
      hook: "🚨 WE ARE HIRING: Remote Sales Executives (Students & Freshers Welcome! 🎓)",
      body: `Looking for a flexible way to earn from home without interfering with your studies or daily schedule?

At Veridian Digital, we are expanding our remote sales team! 🚀

Here is what makes this opportunity different:
💻 100% Remote (Work from anywhere)
⏰ Flexible Timing (Set your own hours)
📚 Leads, Training & Proven Call Scripts Provided
🎓 No prior sales experience needed
💰 High Commission (Earn ₹4,500 per ₹15,000 website deal closed)

👉 What you'll do:
1. Reach out to local businesses who need a modern website or redesign
2. Explain our digital services using our ready-made scripts
3. Connect interested clients with our tech team to close the deal

If you can talk to people and have a smartphone or laptop, you're ready to start.`,
      cta: `📩 Ready to join? 
Drop a comment "HIRING" below or send us a direct DM to get started today! 👇

#Hiring #RemoteWork #SalesJobs #WorkFromHome #StudentsJobs #VeridianDigital #CareerOpportunity #CommissionBased`,
      tags: ['#Hiring', '#RemoteWork', '#SalesJobs', '#StudentsJobs', '#VeridianDigital'],
      image: '/assets/veridian-hiring-poster.jpg',
    },
    {
      hook: "Want to earn ₹15,000 - ₹30,000/month from home just by making calls and closing website deals? 📈",
      body: `Most students and freshers think they need 5 years of experience to make good money. You don't.

Veridian Digital is hiring Remote Sales Associates:

• Commission: ₹4,500 per closed website deal (₹15,000 deal size)
• Hours: Fully flexible (1-3 hours a day)
• Support: We provide verified leads and exact pitch scripts
• Role: Call/message business owners & introduce our high-converting web solutions

No technical skills required. We build the websites, you bring the client.`,
      cta: `👉 Send a direct DM with "SALES" or comment below to apply now! 💬`,
      tags: ['#Jobs #SalesExecutive #RemoteJobs #Veridian #FreelanceSales #Students'],
      image: '/assets/veridian-hiring-poster.jpg',
    },
    {
      hook: "College students & Job seekers: How to monetize your free time in 2026 👇",
      body: `Instead of scrolling endlessly, learn high-income communication skills and earn commission on every project.

We are actively onboarding Remote Sales Representatives at Veridian Digital:

✓ Work from your phone/laptop
✓ No fixed shift or commute
✓ Complete pitch deck and guidance provided
✓ Direct payout upon project sign-off

Example: Close just 3 small business websites a week = ₹13,500/week in direct commission!`,
      cta: `📩 DM us "START" or leave a comment below to get your onboarding kit today! 🚀`,
      tags: ['#HiringNow #RemoteWork #PartTimeJob #Sales #VeridianDigital'],
      image: '/assets/veridian-hiring-poster.jpg',
    },
  ],
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
      image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1000&auto=format&fit=crop&q=80',
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
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
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
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
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
      image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1000&auto=format&fit=crop&q=80',
    },
  ],
};

/**
 * Generate AI post using Google Gemini API if key is available,
 * or fallback to smart dynamic post engine.
 */
async function generatePost({ topic = 'Hiring Remote Sales', tone = 'engaging', customPrompt = '' }) {
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
You are a viral LinkedIn copywriter for Veridian Digital.

Company: Veridian Digital (Growth. Digital. Done Right.)
Topic: ${topic}
Tone: ${tone} (viral, high energy, relatable for young audience/students)
${customPrompt ? `Custom Context: ${customPrompt}` : ''}

Goal:
If this is a Hiring / Sales post:
- Target young audience, college students, freshers, remote job seekers.
- Highlight: Work from home, flexible timing, leads & call scripts provided, no experience needed, high commission (₹4,500 on ₹15,000 website deal).
- Strong CTA: "DM to apply" or "Comment HIRING below".

Formatting Rules:
1. Start with a scroll-stopping 1-line hook with emoji.
2. Short 1-2 sentence paragraphs for mobile readability.
3. Clean bullet points.
4. Clear viral CTA at the bottom.
5. 4-6 relevant hashtags.
6. Return ONLY the ready-to-post text.
`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: promptInstructions }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: 800 },
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
              const defaultImage = topic === 'Hiring Remote Sales'
                ? '/assets/veridian-hiring-poster.jpg'
                : generateImageConcept(topic, text);

              resolve({
                content: text.trim(),
                topic,
                tone,
                engine: 'Gemini 1.5 Flash',
                imageUrl: defaultImage,
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
  const matchedTopic = categories.find((c) => c.toLowerCase() === topic.toLowerCase()) || 'Hiring Remote Sales';
  const list = TEMPLATES_BY_TOPIC[matchedTopic] || TEMPLATES_BY_TOPIC['Hiring Remote Sales'];
  const template = list[Math.floor(Math.random() * list.length)];

  let postText = `${template.hook}\n\n${template.body}\n\n${template.cta}`;

  if (customPrompt && !customPrompt.toLowerCase().includes('hiring')) {
    postText = `💡 Note from Veridian Digital:\n${customPrompt}\n\n` + postText;
  }

  return {
    content: postText,
    topic: matchedTopic,
    tone: tone || 'engaging',
    engine: 'Smart Dynamic Engine',
    imageUrl: template.image || '/assets/veridian-hiring-poster.jpg',
  };
}

function generateImageConcept(topic, postText) {
  if (topic === 'Hiring Remote Sales' || postText.includes('HIRING') || postText.includes('Veridian')) {
    return '/assets/veridian-hiring-poster.jpg';
  }

  const visualIdeas = {
    'AI & Tech Trends': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1000&auto=format&fit=crop&q=80',
    'Software Engineering Tips': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
    'Career & Productivity Growth': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1000&auto=format&fit=crop&q=80',
  };

  return visualIdeas[topic] || '/assets/veridian-hiring-poster.jpg';
}

module.exports = {
  generatePost,
  generateImageConcept,
  TEMPLATES_BY_TOPIC,
};
