const https = require('https');
const db = require('./database');

// Smart high-engagement personal thought-leadership templates across categories
const TEMPLATES_BY_TOPIC = {
  'AI & Automation Trends': [
    {
      hook: "AI isn't going to replace software engineers, but engineers orchestrating AI systems will replace those who don't.",
      body: `Here are 4 major shifts happening across engineering and product in 2026:

1. Automation is transitioning from fragile scripts to autonomous multi-agent systems.
2. Code review, synthetic testing, and telemetry analysis are becoming AI-first workflows.
3. Domain depth + prompt precision is now a bigger superpower than raw syntax memorization.
4. Speed of product iteration matters far more than writing boilerplate from scratch.

The engineers and founders winning today aren't just coding—they are building leverage.`,
      cta: "How are you incorporating AI tools or autonomous agents into your workflow this week?",
      tags: ['#ArtificialIntelligence', '#SoftwareEngineering', '#TechTrends', '#FutureOfTech', '#DeveloperTools'],
      visualPrompt: 'Futuristic glowing AI neural network connected to sleek modern computer terminal, holographic data visualization, cinematic lighting, 8k resolution, minimalist modern tech concept',
    },
    {
      hook: "90% of tech startups are building superficial AI wrappers. The top 10% are building workflows that create defensible value.",
      body: `There is a massive chasm between adding a chatbot and solving a genuine operational bottleneck.

What actually moves the needle with AI in production:
• Deep integration with domain data pipelines
• Deterministic fallback safeguards and evaluation loops
• Ultra low-latency UX that feels instantaneous
• Tangible reduction in manual engineering hours

Don't just plug in an LLM. Design the end-to-end outcome.`,
      cta: "What's the most impactful AI tool or workflow your team implemented recently?",
      tags: ['#AI', '#ProductManagement', '#TechLeadership', '#Innovation', '#B2BTech'],
      visualPrompt: 'Abstract 3D isometric representation of complex data pipelines and automated workflows glowing with cyan and purple neon light, clean glassmorphism, studio lighting',
    },
    {
      hook: "Autonomous agents are moving from research papers into production reality faster than most realize.",
      body: `A year ago, agentic workflows were mostly experimental demos with infinite loops. Today:

• Background subagents run isolated tasks in parallel.
• Self-healing pipelines detect anomalies and apply targeted patches.
• Context-aware memory layers persist state across complex multi-step jobs.

The bottleneck is no longer model intelligence—it's orchestration, reliability, and human-in-the-loop UX.`,
      cta: "Are you experimenting with autonomous agents in your projects yet? What's your biggest challenge so far?",
      tags: ['#AutonomousAgents', '#AIArchitecture', '#MachineLearning', '#TechInnovation', '#SoftwareEngineering'],
      visualPrompt: 'Modern futuristic digital control room with multiple glowing translucent glass screens showing agent workflows and metrics, cyberpunk corporate aesthetic, cinematic depth of field',
    },
  ],

  'Software Engineering & Architecture': [
    {
      hook: "Writing clean code is good. Writing deletable code is legendary.",
      body: `Over-engineering is the #1 silent killer of high-velocity engineering teams.

Before you build that abstract factory, distributed event queue, or custom cache layer:
• Ask: Will this business requirement still exist in 6 months?
• Keep modules loosely coupled so they can be completely ripped out in minutes.
• Write clear tests that document business intent rather than implementation quirks.
• Prioritize readability and simplicity over clever one-liners.

Simplicity is a hard-won architectural feature, not a compromise.`,
      cta: "What is one architectural rule or principle you never compromise on?",
      tags: ['#SoftwareEngineering', '#Coding', '#SystemArchitecture', '#CleanCode', '#DevCommunity'],
      visualPrompt: 'Minimalist clean isometric architectural diagram of modular software blocks connecting seamlessly, blue and silver lighting, sleek tech aesthetic, octane render',
    },
    {
      hook: "The best system architecture isn't the most complex one—it's the one that lets your team ship fearlessly on a Friday.",
      body: `After watching dozens of distributed systems collapse under their own weight, here is what actually matters:

1. Single source of truth for critical state.
2. Idempotent background jobs that can safely retry without side-effects.
3. Observability that tells you WHY an error happened in 3 clicks, not 3 hours.
4. Monoliths that evolve into microservices ONLY when organizational boundaries demand it.

Build boring infrastructure. Save your innovation tokens for the actual user experience.`,
      cta: "What's an architecture decision you made early on that you're still grateful for?",
      tags: ['#SystemDesign', '#BackendDevelopment', '#DevOps', '#EngineeringCulture', '#CloudComputing'],
      visualPrompt: 'High tech minimalist server rack glowing softly with cyan fiber optic cables, ultra clean futuristic datacenter, cinematic lighting, 8k',
    },
    {
      hook: "Junior devs write code for the compiler. Senior devs write code for the human who has to debug it at 2 AM.",
      body: `Technical depth isn't proven by how complex you can make a solution. It's proven by how effortless it is for another engineer to understand, maintain, and extend.

3 habits that separate exceptional engineers:
✓ Writing self-explanatory function and variable names over cryptic abbreviations.
✓ Explaining the 'Why' in comments, not just the obvious 'What'.
✓ Treating documentation as a first-class product feature.`,
      cta: "What was the single piece of advice that elevated your engineering career the most?",
      tags: ['#EngineeringMindset', '#SoftwareDevelopment', '#CareerAdvice', '#CleanCode', '#Mentorship'],
      visualPrompt: 'Cozy modern developer desk setup at night with dark mode code editor on curved ultrawide monitor, ambient warm LED backlighting, aesthetic workspace photography',
    },
  ],

  'Tech Leadership & Building': [
    {
      hook: "You don't need a 50-person team to build a high-leverage tech business in 2026.",
      body: `The leverage available to solo builders and micro-teams right now is unprecedented:

• Automated deployment and serverless pipelines eliminate Ops overhead.
• AI coding assistants and agents multiply individual developer output by 5x.
• Modern APIs handle payments, authentication, and communication out of the box.

The competitive moat is no longer sheer headcount. It is speed of insight, taste, and relentless execution.`,
      cta: "If you had 1 month of uninterrupted focus, what product or tool would you build?",
      tags: ['#Startups', '#TechLeadership', '#IndieHacker', '#ProductDevelopment', '#BuildingInPublic'],
      visualPrompt: 'Minimalist glass modern startup office overlooking a futuristic city skyline at twilight, sleek aesthetic, soft neon glow, cinematic depth',
    },
    {
      hook: "Most product roadmaps fail not because the team lacked talent, but because they solved problems nobody was willing to pay for.",
      body: `A checklist for tech leaders before committing 3 months of engineering time:

1. Have you spoken to 10 prospective users who have this exact headache today?
2. Are they currently paying money or wasting 5+ hours a week solving it manually?
3. Can you ship an unscalable, ugly prototype in 7 days to validate demand?

Validate before you architect. Feedback is the only currency that prevents wasted development cycles.`,
      cta: "How does your team validate new features before writing the first line of code?",
      tags: ['#ProductStrategy', '#StartupLessons', '#TechFounders', '#CustomerFeedback', '#Agile'],
      visualPrompt: 'Futuristic wireframe hologram of a mobile and web application interface floating above a sleek glass desk, cyan and violet lighting, photorealistic',
    },
  ],

  'Productivity & Deep Work': [
    {
      hook: "You don't need an 80-hour work week. You need 4 hours of ruthless, uninterrupted focus.",
      body: `Here is how high-performers achieve disproportionate results in less time:

• Time-box deep work blocks in the morning before opening emails or messaging apps.
• Say 'No' to meetings without a clear agenda or tangible decision goal.
• Ruthlessly automate recurring tasks using scripts and AI tools.
• Work in 90-minute high-intensity sprints followed by real screen breaks.

Consistency, focus, and system design beat chaotic hustle every single time.`,
      cta: "What is your #1 non-negotiable productivity habit during a busy week?",
      tags: ['#Productivity', '#CareerGrowth', '#DeepWork', '#Focus', '#TimeManagement'],
      visualPrompt: 'Calm minimalist workspace with sleek notebook, espresso cup, and ambient daylight through a floor-to-ceiling window, Scandinavian design aesthetic, high quality photograph',
    },
    {
      hook: "Context switching is the single most expensive tax you pay as a knowledge worker.",
      body: `Every time you check a notification mid-task, it takes an average of 23 minutes to regain deep focus.

3 rules to reclaim your brain:
1. Batch all asynchronous replies into two designated 30-minute windows per day.
2. Close all browser tabs that aren't directly related to the single task at hand.
3. Keep a physical notepad to dump random thoughts so they don't derail your current flow.`,
      cta: "How do you protect your focus during high-pressure work days?",
      tags: ['#Focus', '#ProductivityHacks', '#MentalClarity', '#FlowState', '#WorkSmart'],
      visualPrompt: 'Abstract artistic visualization of mental clarity and flow state, smooth glowing geometric glass shapes floating in harmony, calming cyan and slate blue tones',
    },
  ],

  'Future of Technology': [
    {
      hook: "The next decade won't just be about smarter software—it will be about the seamless convergence of AI, hardware, and autonomous systems.",
      body: `We are witnessing the early stages of a profound transformation:

• Edge AI running complex models locally on consumer devices with zero latency.
• Intelligent agents orchestrating multi-modal workflows across physical and digital tools.
• Natural language replacing rigid user interfaces as the primary computing paradigm.

The tools we build today are laying the foundation for how humanity creates, collaborates, and solves global challenges.`,
      cta: "What emerging technology trend are you most bullish on for the next 5 years?",
      tags: ['#FutureOfTech', '#Innovation', '#EdgeAI', '#EmergingTech', '#TechnologyTrends'],
      visualPrompt: 'Futuristic cybernetic interface showing human-machine synergy, glowing holographic lines, ultra modern laboratory background, cinematic lighting, 8k resolution',
    },
  ],
};

const IMAGE_STYLES = {
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic Tech',
    icon: '📸',
    description: 'Hasselblad 8k studio shot, dramatic chiaroscuro lighting, obsidian tech hardware',
    suffix: ', cinematic 35mm photograph, dramatic chiaroscuro studio lighting, Hasselblad 80mm lens, obsidian hardware and architectural elements, depth of field, 8k, hyper-detailed, photorealistic, no text, no letters, no logos, no watermark, no faces',
  },
  'glass-3d': {
    id: 'glass-3d',
    name: '3D Glass & Titanium',
    icon: '💎',
    description: 'Octane render, frosted translucent glass, floating geometric modules, brushed metal',
    suffix: ', 3D isometric Octane render, frosted translucent glass cubes, brushed titanium framing, clean floating geometric structures, subtle iridescent refraction, minimalist luxury aesthetic, 8k, photorealistic rendering, no text, no letters, no logos',
  },
  cyber: {
    id: 'cyber',
    name: 'Cybernetic Matrix',
    icon: '⚡',
    description: 'Deep black background, glowing laser fiber optics, quantum neural node matrix',
    suffix: ', deep obsidian black background, glowing cybernetic neural network lattice, intricate fiber optic conduits, glowing cyan and violet laser threads, abstract quantum computing visualization, 8k, dark mode wallpaper aesthetic, ultra-sharp, no text, no letters, no watermark',
  },
  workspace: {
    id: 'workspace',
    name: 'Minimalist Sanctuary',
    icon: '🏛️',
    description: 'Architectural Digest developer desk sanctuary at blue hour, ambient warm LED strips',
    suffix: ', Architectural Digest interior photography, ultra-minimalist developer workspace sanctuary at blue hour twilight, ambient warm LED strip backlighting, matte black curved display, polished concrete desk, bonsai, cinematic wide angle, 8k, no text, no letters, no people',
  },
  abstract: {
    id: 'abstract',
    name: 'Contemporary Bauhaus',
    icon: '🎨',
    description: 'Swiss Bauhaus modern digital art, flowing dark gradient light ribbons, high contrast',
    suffix: ', sleek contemporary tech art, Swiss Bauhaus geometric abstraction, elegant dark gradient background, metallic flowing ribbons of light, high contrast, clean minimalist vector art, award winning design, 8k, no text, no typography, no watermark',
  },
};

/**
 * Intelligent visual scene synthesizer:
 * Translates abstract software/tech topics into concrete, physical, cinematic visual descriptions.
 * Prevents diffusion models from drawing garbled text or creepy cartoon characters.
 */
function buildVisualSceneConcept(topic, postContent) {
  const t = (topic || '').toLowerCase();
  const c = (postContent || '').toLowerCase();

  if (t.includes('ai') || t.includes('agent') || c.includes('agent') || c.includes('llm') || c.includes('model')) {
    return 'Futuristic autonomous AI computing core pulsing with luminous sapphire and amber neural synapses, clean monolithic geometric architecture';
  }
  if (t.includes('software') || t.includes('architecture') || c.includes('microservice') || c.includes('database') || c.includes('system') || c.includes('code')) {
    return 'Precision-engineered modular architectural framework with interconnecting optical data conduits and polished crystalline modules';
  }
  if (t.includes('leadership') || t.includes('building') || c.includes('founder') || c.includes('startup') || c.includes('scale') || c.includes('product')) {
    return 'Spectacular panoramic high-floor modern innovation glass pavilion at dusk, overlooking a sleek glowing futuristic tech skyline';
  }
  if (t.includes('productivity') || t.includes('deep work') || c.includes('focus') || c.includes('routine') || c.includes('habit')) {
    return 'High-end brutalist architectural study sanctuary, ultra-clean floating desk, ambient warm illumination, peaceful twilight reflection';
  }
  if (t.includes('future') || c.includes('quantum') || c.includes('breakthrough') || c.includes('hardware')) {
    return 'Quantum computing crystalline processor hovering in a pristine dark laboratory, intricate superconducting golden wire chandeliers';
  }

  return 'Sleek luxury technological installation with floating geometric structures, subtle optical light refractions and dark minimalist aesthetics';
}

/**
 * Create high-signal AI image prompt paired with negative prompt guards
 */
function createImagePrompt(topic, postContent, styleKey = 'cinematic') {
  const scene = buildVisualSceneConcept(topic, postContent);
  const style = IMAGE_STYLES[styleKey] || IMAGE_STYLES.cinematic;
  return `${scene}${style.suffix}`;
}

/**
 * Generate AI image:
 * 1. Attempts Google Gemini / Imagen 3 API if apiKey is available
 * 2. Uses Pollinations Flux AI with model=flux, enhance=true, aspect ratios, and negative constraints
 */
async function generateAiImage(imagePrompt, apiKey, options = {}) {
  const styleKey = options.style || 'cinematic';
  const aspectRatio = options.aspectRatio || '16:9';
  const width = aspectRatio === '1:1' ? 1080 : 1200;
  const height = aspectRatio === '1:1' ? 1080 : 675;

  let cleanPrompt = (imagePrompt || '').trim();
  if (!cleanPrompt) {
    cleanPrompt = createImagePrompt('AI & Automation Trends', '', styleKey);
  }

  // 1. If Gemini API key is provided, attempt Imagen 3 endpoint
  if (apiKey) {
    try {
      console.log('[AI Image] Attempting Google Imagen 3 API with provided key...');
      const imagenResult = await generateWithGoogleImagen(cleanPrompt, apiKey, aspectRatio);
      if (imagenResult) {
        console.log('[AI Image] ✅ Successfully generated image with Google Imagen 3');
        return {
          imageUrl: imagenResult,
          imagePrompt: cleanPrompt,
          engine: 'Google Imagen 3',
          style: styleKey,
          aspectRatio,
        };
      }
    } catch (err) {
      console.warn('[AI Image] Google Imagen 3 notice (using Flux fallback):', err.message);
    }
  }

  // 2. High-Definition Flux AI Engine
  console.log(`[AI Image] Generating tailored Flux AI visual (Style: ${styleKey}, Aspect: ${aspectRatio})...`);
  const encodedPrompt = encodeURIComponent(cleanPrompt.slice(0, 500));
  const seed = Math.floor(Math.random() * 1000000);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&enhance=true&nologo=true&seed=${seed}`;

  return {
    imageUrl: pollinationsUrl,
    imagePrompt: cleanPrompt,
    engine: 'Flux AI',
    style: styleKey,
    aspectRatio,
  };
}

/**
 * Call Google Imagen 3 REST API
 */
function generateWithGoogleImagen(promptText, apiKey, aspectRatio = '16:9') {
  return new Promise((resolve, reject) => {
    const imagenAspect = aspectRatio === '1:1' ? '1:1' : '16:9';
    const requestBody = JSON.stringify({
      instances: [{ prompt: promptText }],
      parameters: {
        sampleCount: 1,
        aspectRatio: imagenAspect,
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.predictions?.[0]?.bytesBase64Encoded) {
            const base64 = parsed.predictions[0].bytesBase64Encoded;
            const mimeType = parsed.predictions[0].mimeType || 'image/jpeg';
            resolve(`data:${mimeType};base64,${base64}`);
            return;
          }
          reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${data.slice(0, 150)}`));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Google Imagen 3 request timed out'));
    });
    req.write(requestBody);
    req.end();
  });
}

/**
 * Generate Post using Google Gemini Flash API if key available,
 * or smart dynamic template engine, accompanied by tailored AI image.
 */
async function generatePost({ topic = 'AI & Automation Trends', tone = 'engaging', customPrompt = '', customImagePrompt = '', style = 'cinematic', aspectRatio = '16:9' }) {
  const settings = db.getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  let postData = null;

  if (apiKey) {
    try {
      postData = await generateWithGemini(apiKey, topic, tone, customPrompt);
    } catch (err) {
      console.warn('[AI Generator] Gemini API call failed, falling back to smart dynamic generator:', err.message);
      postData = generateDynamicTemplate(topic, tone, customPrompt);
    }
  } else {
    postData = generateDynamicTemplate(topic, tone, customPrompt);
  }

  // Construct image prompt with style and generate AI image
  const visualPrompt = customImagePrompt || postData.suggestedImagePrompt || createImagePrompt(postData.topic, postData.content, style);
  const imageObj = await generateAiImage(visualPrompt, apiKey, { style, aspectRatio });

  return {
    ...postData,
    imageUrl: imageObj.imageUrl,
    imagePrompt: imageObj.imagePrompt,
    imageEngine: imageObj.engine,
    imageStyle: imageObj.style,
    imageAspectRatio: imageObj.aspectRatio,
  };
}

/**
 * Call Google Gemini Flash API via HTTPS
 */
function generateWithGemini(apiKey, topic, tone, customPrompt) {
  return new Promise((resolve, reject) => {
    const promptInstructions = `
You are an expert LinkedIn creator, engineer, and tech thought leader posting directly to your personal LinkedIn profile.

Topic: ${topic}
Tone: ${tone} (thought-provoking, high-signal, engaging, authentic)
${customPrompt ? `Custom Topic / Directive: ${customPrompt}` : ''}

Strict Rules:
1. Do NOT write about hiring, recruitment, job openings, sales representative jobs, or commissions.
2. Craft high-value insights, actionable frameworks, engineering lessons, or future-focused tech analysis.
3. Formatting Rules:
   - Start with a compelling, scroll-stopping 1-line hook with 1 relevant emoji.
   - Use short 1-2 sentence paragraphs for mobile scannability.
   - Use clean, punchy bullet points (• or numbers).
   - End with a genuine, thought-provoking question or discussion starter for the audience.
   - Include 4-6 relevant hashtags at the bottom.
4. Also output a 1-sentence description of the ideal AI visual concept to accompany this post.

Format your response EXACTLY as:
---POST---
[Your complete LinkedIn post text here]
---VISUAL---
[1-sentence visual description for AI image generation: 3D render, futuristic tech, minimalist aesthetic, no text]
`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: promptInstructions }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: 1000 },
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
            const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              let postContent = rawText;
              let visualPrompt = '';

              if (rawText.includes('---POST---') && rawText.includes('---VISUAL---')) {
                const parts = rawText.split('---VISUAL---');
                postContent = parts[0].replace('---POST---', '').trim();
                visualPrompt = (parts[1] || '').trim();
              }

              resolve({
                content: postContent.trim(),
                topic,
                tone,
                engine: 'Gemini 1.5 Flash',
                suggestedImagePrompt: visualPrompt || createImagePrompt(topic, postContent),
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
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('Gemini API request timed out'));
    });
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
  const list = TEMPLATES_BY_TOPIC[matchedTopic] || TEMPLATES_BY_TOPIC['AI & Automation Trends'];
  const template = list[Math.floor(Math.random() * list.length)];

  let postText = `${template.hook}\n\n${template.body}\n\n${template.cta}\n\n${(template.tags || []).join(' ')}`;

  if (customPrompt) {
    postText = `💡 Thought on ${customPrompt}:\n\n` + postText;
  }

  return {
    content: postText.trim(),
    topic: matchedTopic,
    tone: tone || 'engaging',
    engine: 'Smart Dynamic Engine',
    suggestedImagePrompt: template.visualPrompt || createImagePrompt(matchedTopic, postText),
  };
}

module.exports = {
  generatePost,
  generateAiImage,
  createImagePrompt,
  IMAGE_STYLES,
  TEMPLATES_BY_TOPIC,
};
