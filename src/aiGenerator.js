const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./database');

// Battle-tested, high-signal thought-leadership templates & case studies
const TEMPLATES_BY_TOPIC = {
  'AI & Automation Trends': [
    {
      hook: "Autonomous agents fail in production for one simple reason: treating LLMs as deterministic compute rather than probabilistic reasoners.",
      body: `A year ago, agentic workflows were mostly experimental demos stuck in infinite loops. Today, the battle lines are clear:

• Monolithic prompts crumble after 3 reasoning steps. Decompose into isolated single-responsibility subagents.
• Always inject self-healing validation loops—validate schema, detect anomalies, and retry with constrained context.
• Never trust agent state to fleeting memory; persist checkpoints with idempotent recovery.

The real engineering bottleneck is no longer model IQ—it's orchestration, state hygiene, and human-in-the-loop controls.`,
      cta: "What is the single biggest reliability hurdle you have faced when deploying autonomous agents?",
      tags: ['#AutonomousAgents', '#AIArchitecture', '#MachineLearning', '#SoftwareEngineering', '#TechInnovation'],
      visualPrompt: 'Futuristic autonomous AI computing core pulsing with luminous sapphire and amber neural conduits, clean monolithic geometric architecture, cinematic 35mm photograph, chiaroscuro studio lighting, 8k, no text',
    },
    {
      hook: "90% of tech startups are building fragile AI wrappers. The top 10% are building proprietary workflows that create defensible data flywheels.",
      body: `There is a massive chasm between adding a chatbot and solving a genuine operational bottleneck.

What actually creates enterprise leverage with generative AI:
• Deep bidirectional integration with messy domain data pipelines
• Deterministic fallback safeguards that kick in when latency spikes
• Sub-200ms user interaction loops that feel completely instantaneous
• Measurable reduction in manual engineering toil

Don't just plug in an LLM API. Architect the end-to-end outcome.`,
      cta: "What is the most impactful AI workflow your engineering team has implemented this quarter?",
      tags: ['#AI', '#ProductStrategy', '#TechLeadership', '#SystemDesign', '#B2BTech'],
      visualPrompt: 'Abstract 3D isometric representation of complex data pipelines and automated workflows glowing with cyan and purple neon light, clean glassmorphism, studio lighting, 8k, no text',
    },
    {
      hook: "AI isn't replacing software engineers. But engineers orchestrating agentic systems are out-shipping entire 20-person departments.",
      body: `The leverage curve for technical builders in 2026 has gone completely vertical:

1. Boilerplate code generation is table stakes; the superpower is system modeling and prompt precision.
2. Code review, synthetic load testing, and telemetry triage are becoming AI-native workflows.
3. Solo developers can now maintain multi-service architectures that previously required dedicated DevOps teams.

Velocity without architectural discipline is just accelerated technical debt. Build leverage, but protect simplicity.`,
      cta: "How has your daily development workflow changed with AI coding agents over the past 6 months?",
      tags: ['#ArtificialIntelligence', '#SoftwareEngineering', '#DeveloperTools', '#FutureOfTech', '#Productivity'],
      visualPrompt: 'Minimalist clean developer workstation with multiple dark mode code monitors reflecting soft ambient warm amber light, high end Scandinavian design, cinematic depth of field, 8k, no text',
    },
    {
      hook: "We replaced our complex multi-model RAG pipeline with clean prompt caching and slashed inference costs by 74%.",
      body: `Engineering case study on premature optimization in LLM systems:

• The Mistake: We initially chained 3 separate vector databases, custom rerankers, and an embeddings pipeline for a 50k-token context problem.
• The Reality: 80% of our latency and 65% of user failure reports came from chunking misalignments.
• The Pivot: Switched to long-context models with structured prompt caching and deterministic regex guards.
• The Result: 74% lower compute bill, 400ms faster p99 latency, and near-zero chunking hallucinations.

Sometimes the best architecture is the one that deletes half your moving parts.`,
      cta: "What is an architectural shortcut or simplification that drastically improved your system's reliability?",
      tags: ['#SystemArchitecture', '#LLMOps', '#CaseStudy', '#CleanCode', '#TechStrategy'],
      visualPrompt: 'Minimalist crystalline cube hovering inside an obsidian vacuum chamber with subtle laser refractions, octane render, clean lines, photorealistic, 8k, no text',
    },
  ],

  'Software Engineering & Architecture': [
    {
      hook: "Writing clean code is good. Writing easily deletable code is world-class.",
      body: `Over-engineering is the silent killer of engineering momentum.

Before designing that distributed event queue, dynamic factory, or custom cache layer:
• Ask: Will this business requirement still exist in 6 months?
• Keep modules loosely coupled so an entire service can be deleted in 1 pull request.
• Write tests that verify customer-facing contracts rather than internal class implementations.
• Prioritize simplicity over clever one-liners every single time.

Simplicity is not a beginner shortcut. It is the ultimate engineering achievement.`,
      cta: "What is one architectural rule or principle you never compromise on?",
      tags: ['#SoftwareEngineering', '#SystemDesign', '#CleanCode', '#SystemArchitecture', '#DevCommunity'],
      visualPrompt: 'Minimalist clean isometric architectural diagram of modular geometric software blocks connecting seamlessly, blue and titanium lighting, sleek tech aesthetic, 8k, no text',
    },
    {
      hook: "Our database CPU hit 100% on a Tuesday night. It wasn't a DDoS attack—it was a single unindexed foreign key in PostgreSQL.",
      body: `Production war story on high-scale database reliability:

• Context: Traffic surged 4x during a product launch event. Everything seemed healthy until API response times spiked to 12 seconds.
• Root Cause: An innocent ORM query executed an unindexed nested sequential scan across 18 million audit log rows on every checkout.
• The Fix: Added a concurrent composite index and implemented strict connection pooling limits with pgbouncer.
• Key Takeaway: Never rely on ORM magic in production paths. Always inspect ` + '`EXPLAIN ANALYZE`' + ` on critical endpoints before shipping.`,
      cta: "What was the most subtle or memorable database bug you have ever debugged in production?",
      tags: ['#PostgreSQL', '#BackendDevelopment', '#DatabaseDesign', '#DevOps', '#ProductionOutage'],
      visualPrompt: 'High tech minimalist server rack glowing softly with cyan and amber fiber optic cables, ultra clean futuristic datacenter, cinematic lighting, 8k, no text',
    },
    {
      hook: "The best system architecture isn't the most clever one—it's the one that lets your team ship fearlessly on a Friday afternoon.",
      body: `After watching dozens of distributed systems collapse under operational weight, here is what actually moves the needle:

1. Single source of truth for all transactional state.
2. Idempotent background workers that can safely retry without triggering duplicate side-effects.
3. Structured observability that tells you WHY an error happened in 2 clicks, not 2 hours of grep logs.
4. Monoliths that evolve into microservices ONLY when organizational boundaries demand it.

Build boring, rock-solid infrastructure. Save your innovation budget for the customer experience.`,
      cta: "What architectural decision did you make years ago that you still thank yourself for today?",
      tags: ['#SystemDesign', '#Backend', '#Microservices', '#DevOps', '#EngineeringCulture'],
      visualPrompt: 'Sleek luxury architectural structure with floating geometric titanium and glass modules, subtle optical light refractions and dark minimalist aesthetics, 8k, no text',
    },
    {
      hook: "Junior devs write code for the compiler. Senior devs write code for the tired engineer debugging an incident at 3 AM.",
      body: `Technical depth is never proven by how complicated you can make a solution. It is proven by how effortless it is for another human to understand, maintain, and extend.

3 habits that separate extraordinary engineers:
✓ Choosing self-explanatory function and variable names over cryptic abbreviations.
✓ Documenting the 'Why' and the rejected alternatives, not just the obvious 'What'.
✓ Treating documentation and developer tooling as tier-1 product deliverables.`,
      cta: "What was the single piece of advice that elevated your engineering career the most?",
      tags: ['#EngineeringMindset', '#CareerAdvice', '#Mentorship', '#CleanCode', '#SoftwareDevelopment'],
      visualPrompt: 'Cozy modern developer studio at twilight with warm backlighting, ultra-wide curved screen showing sleek dark-mode editor, minimalist aesthetics, 8k, no text',
    },
  ],

  'Tech Leadership & Building': [
    {
      hook: "You don't need a 50-person department to build a high-leverage SaaS product in 2026.",
      body: `The leverage available to micro-teams and solo technical builders today is staggering:

• Serverless edge pipelines and automated CI/CD eliminate dedicated Ops overhead.
• AI coding agents multiply individual engineering throughput by 4x to 6x.
• Modular payment, auth, and analytics APIs handle plumbing out of the box.

The primary competitive moat is no longer raw headcount. It is speed of insight, taste, and relentless customer iteration.`,
      cta: "If you had 30 days of uninterrupted builder flow, what product would you ship?",
      tags: ['#Startups', '#TechFounders', '#IndieHacker', '#ProductDevelopment', '#BuildingInPublic'],
      visualPrompt: 'Minimalist glass modern innovation pavilion overlooking a futuristic tech skyline at twilight, sleek aesthetic, soft neon glow, cinematic depth, 8k, no text',
    },
    {
      hook: "Most product roadmaps fail not because the engineering team lacked talent, but because they solved problems nobody was willing to pay for.",
      body: `A checklist for tech leaders before committing 6 weeks of engineering sprint cycles:

1. Have you spoken directly with 10 prospective customers who actively suffer from this headache today?
2. Are they currently losing money or wasting 5+ hours a week solving it with manual spreadsheets?
3. Can you ship an unscalable, scrappy prototype in 5 days to validate genuine willingness to buy?

Validate before you architect. Feedback is the only currency that prevents wasted development cycles.`,
      cta: "How does your team validate demand before writing the first line of code?",
      tags: ['#ProductStrategy', '#StartupLessons', '#TechLeadership', '#CustomerDiscovery', '#Agile'],
      visualPrompt: 'Futuristic wireframe hologram of an architectural dashboard interface floating above a sleek glass desk, cyan and violet lighting, photorealistic, 8k, no text',
    },
    {
      hook: "The best engineering managers don't manage code. They manage cognitive load and build shields against context switching.",
      body: `High-performing engineering teams don't burn out from hard technical problems. They burn out from:
• Ambiguous requirements that shift mid-sprint
• Endless status meetings that could have been a 3-line asynchronous update
• Flaky test suites that normalize false alarms
• Disconnected leadership that measures output by pull request count instead of business value

Protect your team's focus, set clear decision boundaries, and get out of the way.`,
      cta: "What is the single most effective cultural practice in your engineering organization?",
      tags: ['#EngineeringLeadership', '#Management', '#TeamCulture', '#Productivity', '#DevOps'],
      visualPrompt: 'Dramatic architectural glass sanctuary overlooking an expansive tranquil landscape at sunrise, warm cinematic sunlight, minimalist luxury, 8k, no text',
    },
  ],

  'Productivity & Deep Work': [
    {
      hook: "You don't need an 80-hour work week. You need 4 hours of ruthless, uninterrupted focus.",
      body: `How high-impact technical builders achieve disproportionate results in less time:

• Time-box dedicated deep work blocks in the morning before opening Slack or email.
• Say 'No' to any meeting without a written agenda and a tangible decision owner.
• Ruthlessly automate repetitive tasks using custom scripts and AI agents.
• Work in 90-minute high-intensity cognitive sprints followed by genuine physical screen breaks.

Consistency, focus, and deliberate system design beat chaotic hustle every single time.`,
      cta: "What is your #1 non-negotiable productivity rule during a demanding work week?",
      tags: ['#Productivity', '#DeepWork', '#Focus', '#CareerGrowth', '#TimeManagement'],
      visualPrompt: 'Calm minimalist workspace with sleek notebook, espresso cup, and ambient daylight through a floor-to-ceiling window, Scandinavian design aesthetic, 8k, no text',
    },
    {
      hook: "Context switching is the single most expensive tax an engineer pays every single day.",
      body: `Research shows that every unexpected notification or Slack ping takes up to 23 minutes to fully recover deep flow state.

3 pragmatic rules to reclaim your brain:
1. Batch all asynchronous communications into two designated 30-minute daily windows.
2. Close all browser tabs and editor workspaces that aren't strictly relevant to the current task.
3. Keep an offline scratchpad to capture fleeting ideas without breaking your active focus.`,
      cta: "How do you protect your focus during high-pressure shipping cycles?",
      tags: ['#Focus', '#MentalClarity', '#FlowState', '#DeepWork', '#WorkSmart'],
      visualPrompt: 'Abstract artistic visualization of mental clarity and flow state, smooth glowing geometric glass shapes floating in harmony, calming cyan and slate blue tones, 8k, no text',
    },
  ],

  'Future of Technology': [
    {
      hook: "The next wave of computing won't just be about larger models—it will be about edge intelligence, local inference, and multi-agent coordination.",
      body: `We are standing at the threshold of a fundamental architectural shift:

• Local on-device models running sub-50ms inference with zero cloud dependency.
• Agentic networks negotiating data handoffs using structured protocols rather than human-curated APIs.
• Intent-driven interfaces replacing static dashboards as the primary interaction model.

The systems we design today are laying the infrastructure for how humanity creates, collaborates, and solves grand challenges.`,
      cta: "What emerging tech capability are you most excited to build with over the next 24 months?",
      tags: ['#FutureOfTech', '#EdgeAI', '#EmergingTech', '#Innovation', '#TechnologyTrends'],
      visualPrompt: 'Futuristic quantum computing crystalline processor hovering in a pristine dark laboratory, intricate superconducting golden wire chandeliers, cinematic lighting, 8k, no text',
    },
  ],
};

const IMAGE_STYLES = {
  auto: {
    id: 'auto',
    name: 'Auto (Contextual)',
    icon: '✨',
    description: 'Intelligently tailored to the post topic (Tech, Business, or Architecture)',
    suffix: ', editorial tech visualization, clean balanced lighting, 8k, hyper-detailed, photorealistic, no text, no watermark, no logos',
  },
  photorealistic: {
    id: 'photorealistic',
    name: 'Photorealistic',
    icon: '📸',
    description: 'Cinematic 35mm photograph, dramatic natural studio lighting, ultra-sharp focus',
    suffix: ', cinematic 35mm photograph, dramatic natural chiaroscuro studio lighting, Hasselblad 80mm lens, depth of field, 8k, hyper-detailed, photorealistic, no text, no letters, no logos, no watermark, no faces',
  },
  editorial: {
    id: 'editorial',
    name: 'Professional Editorial',
    icon: '📰',
    description: 'Bloomberg Businessweek and Wired magazine editorial feature photography',
    suffix: ', high-end editorial magazine photography, Wired and Bloomberg Businessweek aesthetic, sophisticated composition, dramatic studio lighting, rich contrast, 8k, award-winning photography, no text, no logos',
  },
  technology: {
    id: 'technology',
    name: 'Technology',
    icon: '⚡',
    description: 'Futuristic high-tech system, obsidian hardware, glowing fiber optic conduits',
    suffix: ', deep obsidian hardware, glowing cybernetic fiber optic conduits, intricate microelectronics, quantum circuits, crisp cyan and violet accents, clean tech aesthetic, 8k, dark mode wallpaper aesthetic, ultra-sharp, no text, no letters, no watermark',
  },
  business: {
    id: 'business',
    name: 'Business',
    icon: '💼',
    description: 'Modern executive innovation pavilion, sleek glass architectural sanctuary',
    suffix: ', modern architectural innovation glass pavilion, executive architectural design, subtle warm ambient lighting, panoramic high-floor twilight perspective, premium corporate aesthetic, 8k, no text, no logos',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    icon: '🎨',
    description: 'Swiss Bauhaus minimalist digital art, clean geometric harmony',
    suffix: ', Swiss Bauhaus minimalist digital art, clean geometric harmony, elegant muted gradient background, subtle metallic textures, uncluttered negative space, award-winning design, 8k, no text, no typography, no watermark',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    icon: '✏️',
    description: 'User-specified prompt guidelines and aesthetic constraints',
    suffix: ', 8k, ultra-sharp, professional composition, no text, no watermark, no logos',
  },
  // Legacy aliases for backward compatibility with existing saved settings
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
    description: 'Scandinavian architectural studio, warm amber LED lighting, ultrawide curved monitor',
    suffix: ', Scandinavian modern architectural developer study, warm ambient amber LED glow, curved ultrawide display on solid walnut floating desk, floor to ceiling glass windows with mountain dusk view, architectural digest photography, 8k, no text, no blur',
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
 * Enforces strict post-image relevance:
 * - Enterprise AI workflows -> realistic connected decision nodes & pipelines (NOT robot holding laptop)
 * - Cybersecurity / Zero Trust -> cryptographic verification network topology (NOT hacker in hoodie)
 * - Startups / Building -> founder reviewing telemetry & system blueprints (NOT generic handshake)
 */
function buildVisualSceneConcept(topic, postContent, customInstructions = '') {
  const t = (topic || '').toLowerCase();
  const c = (postContent || '').toLowerCase();

  let concept = '';

  // 1. Cybersecurity & Zero Trust (explicitly required)
  if (t.includes('cyber') || t.includes('security') || c.includes('security') || c.includes('zero-trust') || c.includes('zero trust') || c.includes('encryption') || c.includes('vulnerability')) {
    concept = 'Professional enterprise cybersecurity and zero-trust network topology visual, cryptographic verification nodes glowing softly, secure data enclave conduits with deep indigo and amber accents, high-precision technical visualization';
  }
  // 2. Enterprise AI & Autonomous Workflows (explicitly required: NOT a robot with a laptop)
  else if (c.includes('enterprise workflow') || c.includes('agentic') || c.includes('workflow') || c.includes('autonomous agent') || (t.includes('ai') && c.includes('pipeline'))) {
    concept = 'Enterprise AI automation and multi-agent reasoning flow visualizing interconnected decision nodes, stream data pipelines, sleek modern glass interface telemetry, sophisticated studio lighting';
  }
  // 3. AI, LLMs & Automation
  else if (t.includes('ai') || t.includes('agent') || c.includes('llm') || c.includes('model') || c.includes('machine learning')) {
    concept = 'Futuristic autonomous computing core pulsing with luminous sapphire and amber neural conduits, clean monolithic geometric architecture, precise data synthesis';
  }
  // 4. Databases & Backend Optimization (Postgres, indexes, caching, latency)
  else if (c.includes('database') || c.includes('postgresql') || c.includes('query') || c.includes('index') || c.includes('sql') || c.includes('redis') || c.includes('cache')) {
    concept = 'High-performance distributed database architecture, indexed query flow conduits, crystalline cache tiers, sleek titanium server racks with cool cyan illumination';
  }
  // 5. Software Architecture & Clean Code
  else if (t.includes('software') || t.includes('architecture') || c.includes('microservice') || c.includes('system') || c.includes('code') || c.includes('postgresql') || c.includes('api')) {
    concept = 'Precision-engineered modular architectural framework with interconnecting optical data conduits and polished crystalline modules, clean modular tech design';
  }
  // 6. Startups & Founders & Building in Public (explicitly required: NOT a random stock office photo)
  else if (t.includes('leadership') || t.includes('building') || c.includes('founder') || c.includes('startup') || c.includes('scale') || c.includes('product') || c.includes('business')) {
    concept = 'Focused tech founder reviewing dynamic product telemetry and architecture blueprints in a high-floor modern innovation glass studio overlooking dusk city skyline, cinematic depth of field';
  }
  // 7. Productivity & Deep Work (explicitly required)
  else if (t.includes('productivity') || t.includes('deep work') || c.includes('focus') || c.includes('routine') || c.includes('habit') || c.includes('distraction')) {
    concept = 'Calm minimalist architectural workspace sanctuary, floating natural walnut desk, ambient daylight, clutter-free focus environment, peaceful twilight reflection';
  }
  // 8. Future of Technology & Quantum Computing
  else if (t.includes('future') || c.includes('quantum') || c.includes('breakthrough') || c.includes('hardware')) {
    concept = 'Quantum computing crystalline processor hovering in a pristine dark laboratory, intricate superconducting golden wire chandeliers';
  } else {
    concept = 'Sleek luxury technological installation with floating geometric structures, subtle optical light refractions and dark minimalist aesthetics';
  }

  if (customInstructions && customInstructions.trim()) {
    concept += `, ${customInstructions.trim()}`;
  }

  return concept;
}

/**
 * Create high-signal AI image prompt paired with negative prompt guards
 */
function createImagePrompt(topic, postContent, styleKey = 'photorealistic', customInstructions = '') {
  let selectedKey = styleKey || 'photorealistic';
  if (selectedKey === 'auto') {
    const t = (topic || '').toLowerCase();
    if (t.includes('leadership') || t.includes('startup')) selectedKey = 'editorial';
    else if (t.includes('productivity') || t.includes('deep work')) selectedKey = 'minimal';
    else selectedKey = 'technology';
  }

  const style = IMAGE_STYLES[selectedKey] || IMAGE_STYLES.photorealistic;
  const scene = buildVisualSceneConcept(topic, postContent, customInstructions);
  return `${scene}${style.suffix}`;
}

/**
 * Save generated image buffer to public/assets/generated/
 */
function saveGeneratedImageBuffer(buffer, extension = 'jpg') {
  try {
    const genDir = path.join(__dirname, '..', 'public', 'assets', 'generated');
    if (!fs.existsSync(genDir)) {
      fs.mkdirSync(genDir, { recursive: true });
    }
    const filename = `flux_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
    const filePath = path.join(genDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/assets/generated/${filename}`;
  } catch (err) {
    console.warn('[AI Image] Could not save buffer to disk:', err.message);
    return null;
  }
}

/**
 * Generate image using Cloudflare Workers AI (FLUX.2 Dev as primary, FLUX.1 Schnell as fast fallback)
 */
async function generateWithCloudflareWorkersAi(promptText, options = {}) {
  const settings = db.getSettings();
  const accountId = options.cloudflareAccountId || settings.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const apiToken = options.cloudflareApiToken || settings.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || '';
  const model = options.model || settings.imageModel || 'flux-2-dev';

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID or API Token is missing');
  }

  const cleanPrompt = (promptText || '').trim();

  // Try FLUX.2 Dev first
  if (model === 'flux-2-dev' || model.includes('flux-2')) {
    try {
      console.log(`[AI Image] 🎨 Calling Cloudflare Workers AI FLUX.2 Dev (@cf/black-forest-labs/flux-2-dev)...`);
      const form = new FormData();
      form.append('prompt', cleanPrompt);
      form.append('steps', '20');

      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-2-dev`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`FLUX.2 Dev failed HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      if (data.success && data.result?.image) {
        const base64Data = data.result.image;
        const imgBuffer = Buffer.from(base64Data, 'base64');
        const savedUrl = saveGeneratedImageBuffer(imgBuffer, 'jpg');
        const dataUri = `data:image/jpeg;base64,${base64Data}`;

        console.log(`[AI Image] ✅ FLUX.2 Dev generation succeeded (${imgBuffer.length} bytes)`);
        return {
          imageUrl: savedUrl || dataUri,
          dataUri,
          engine: 'FLUX.2 Dev (Cloudflare Workers AI)',
          model: '@cf/black-forest-labs/flux-2-dev',
        };
      }
      throw new Error(data.errors?.[0]?.message || 'No image in FLUX.2 Dev response');
    } catch (flux2Err) {
      console.warn(`[AI Image] FLUX.2 Dev notice (${flux2Err.message}). Falling back to FLUX.1 Schnell...`);
    }
  }

  // Fallback: Cloudflare FLUX.1 Schnell
  console.log(`[AI Image] ⚡ Calling Cloudflare Workers AI FLUX.1 Schnell (@cf/black-forest-labs/flux-1-schnell)...`);
  const schnellUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const schnellRes = await fetch(schnellUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: cleanPrompt }),
  });

  if (!schnellRes.ok) {
    const errText = await schnellRes.text();
    throw new Error(`FLUX.1 Schnell failed HTTP ${schnellRes.status}: ${errText.slice(0, 150)}`);
  }

  const schnellData = await schnellRes.json();
  if (schnellData.success && schnellData.result?.image) {
    const base64Data = schnellData.result.image;
    const imgBuffer = Buffer.from(base64Data, 'base64');
    const savedUrl = saveGeneratedImageBuffer(imgBuffer, 'jpg');
    const dataUri = `data:image/jpeg;base64,${base64Data}`;

    console.log(`[AI Image] ✅ FLUX.1 Schnell generation succeeded (${imgBuffer.length} bytes)`);
    return {
      imageUrl: savedUrl || dataUri,
      dataUri,
      engine: 'FLUX.1 Schnell (Cloudflare Workers AI)',
      model: '@cf/black-forest-labs/flux-1-schnell',
    };
  }

  throw new Error(schnellData.errors?.[0]?.message || 'No image returned by Cloudflare Workers AI');
}

/**
 * Validate image result
 */
function validateGeneratedImage(imageResult) {
  if (!imageResult) return false;
  if (!imageResult.imageUrl && !imageResult.dataUri) return false;
  if (imageResult.dataUri && imageResult.dataUri.length < 500) return false;
  return true;
}

/**
 * Verify Cloudflare Account ID and API Token
 */
async function verifyCloudflareCredentials(accountId, apiToken) {
  const settings = db.getSettings();
  const accId = (accountId || settings.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = (apiToken || settings.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();

  if (!accId || !token) {
    return { valid: false, error: 'Both Account ID and API Token are required.' };
  }
  try {
    // Check Workers AI endpoint directly since AI-scoped tokens have permissions for /ai/* rather than full account admin
    const aiRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}/ai/models/search?search=flux`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const aiData = await aiRes.json();
    if (aiRes.ok && aiData.success) {
      const modelsFound = Array.isArray(aiData.result) ? aiData.result.map(m => m.name) : [];
      const hasFlux2 = modelsFound.some(name => name.includes('flux-2-dev'));
      return {
        valid: true,
        accountName: `Cloudflare Workers AI (${accId.slice(0, 6)}...)`,
        accountId: accId,
        modelsCount: modelsFound.length,
        hasFlux2Dev: hasFlux2,
      };
    }

    // Secondary fallback check for broader account tokens
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (res.ok && data.success && data.result) {
      return {
        valid: true,
        accountName: data.result.name || 'Cloudflare Account',
        accountId: data.result.id,
      };
    }
    const errMsg = aiData.errors?.[0]?.message || data.errors?.[0]?.message || `HTTP ${aiRes.status}: Verification failed`;
    return { valid: false, error: errMsg };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Main AI Image Generation Pipeline:
 * Priority 1: Cloudflare Workers AI FLUX.2 Dev (@cf/black-forest-labs/flux-2-dev)
 * Priority 2: Cloudflare Workers AI FLUX.1 Schnell
 * Priority 3: Google Imagen 3 (if Gemini API key provided)
 * Priority 4: Pollinations Flux AI 4K
 */
async function generateAiImage(imagePrompt, apiKey, options = {}) {
  const settings = db.getSettings();
  const styleKey = options.style || settings.imageStyle || 'photorealistic';
  const aspectRatio = options.aspectRatio || settings.aspectRatio || '16:9';
  const customInstructions = options.customInstructions || settings.customImageInstructions || '';

  let width = options.width || settings.imageWidth || (aspectRatio === '1:1' ? 1080 : aspectRatio === '4:5' ? 1080 : 1200);
  let height = options.height || settings.imageHeight || (aspectRatio === '1:1' ? 1080 : aspectRatio === '4:5' ? 1350 : 675);

  let cleanPrompt = (imagePrompt || '').trim();
  if (!cleanPrompt) {
    cleanPrompt = createImagePrompt(options.topic || 'AI & Automation Trends', options.postContent || '', styleKey, customInstructions);
  }

  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : (settings.maxImageRetries || 2);
  let attempts = 0;
  let lastError = null;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      // 1. Primary: Cloudflare Workers AI (FLUX.2 Dev & FLUX.1 Schnell)
      const cfResult = await generateWithCloudflareWorkersAi(cleanPrompt, options);
      if (validateGeneratedImage(cfResult)) {
        return {
          ...cfResult,
          imagePrompt: cleanPrompt,
          style: styleKey,
          aspectRatio,
          width,
          height,
        };
      }
    } catch (cfErr) {
      lastError = cfErr;
      console.warn(`[AI Image] Cloudflare Workers AI attempt ${attempts} warning: ${cfErr.message}`);
    }

    // 2. Secondary: Google Imagen 3 if Gemini key is available
    const geminiKey = apiKey || settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log('[AI Image] Attempting Google Imagen 3 fallback...');
        const imagenResult = await generateWithGoogleImagen(cleanPrompt, geminiKey, aspectRatio);
        if (imagenResult) {
          console.log('[AI Image] ✅ Successfully generated image with Google Imagen 3');
          return {
            imageUrl: imagenResult,
            dataUri: imagenResult,
            imagePrompt: cleanPrompt,
            engine: 'Google Imagen 3',
            style: styleKey,
            aspectRatio,
            width,
            height,
          };
        }
      } catch (imagenErr) {
        console.warn('[AI Image] Google Imagen 3 notice:', imagenErr.message);
      }
    }

    // 3. Tertiary: Pollinations Flux AI 4K
    try {
      console.log(`[AI Image] Attempting Pollinations Flux AI fallback...`);
      const encodedPrompt = encodeURIComponent(cleanPrompt.slice(0, 500));
      const seed = Math.floor(Math.random() * 1000000);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&enhance=true&nologo=true&seed=${seed}`;

      return {
        imageUrl: pollinationsUrl,
        dataUri: null,
        imagePrompt: cleanPrompt,
        engine: 'Flux AI 4K (Pollinations)',
        style: styleKey,
        aspectRatio,
        width,
        height,
      };
    } catch (pollErr) {
      lastError = pollErr;
      console.warn('[AI Image] Pollinations fallback notice:', pollErr.message);
    }
  }

  throw new Error(`AI Image Generation failed after ${attempts} attempts: ${lastError ? lastError.message : 'Unknown error'}`);
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
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('Google Imagen 3 request timed out'));
    });
    req.write(requestBody);
    req.end();
  });
}

/**
 * Test & verify a Google Gemini API Key
 */
function verifyGeminiKey(apiKey) {
  return new Promise((resolve) => {
    if (!apiKey || !apiKey.trim()) {
      return resolve({ valid: false, error: 'API key cannot be empty' });
    }
    const cleanKey = apiKey.trim();
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models?key=${cleanKey}`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.models) {
            resolve({ valid: true, modelsCount: parsed.models.length });
          } else {
            const errDetail = parsed.error?.message || `HTTP ${res.statusCode}: Invalid API Key`;
            resolve({ valid: false, error: errDetail });
          }
        } catch {
          resolve({ valid: false, error: 'Invalid response from Google Gemini API' });
        }
      });
    });

    req.on('error', (e) => resolve({ valid: false, error: e.message }));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ valid: false, error: 'Connection to Google Gemini API timed out' });
    });
    req.end();
  });
}

/**
 * Generate Post using Google Gemini API if key available,
 * or Staff Engineer Case Study Engine, accompanied by tailored AI visual (FLUX.2 Dev / Cloudflare Workers AI).
 */
async function generatePost({ topic = 'AI & Automation Trends', tone = 'engaging', customPrompt = '', customImagePrompt = '', style, aspectRatio, geminiApiKey = '' }) {
  const settings = db.getSettings();
  const apiKey = geminiApiKey || settings.geminiApiKey || process.env.GEMINI_API_KEY;

  let postData = null;

  if (apiKey) {
    try {
      console.log('[AI Generator] Generating thought leadership copy with Google Gemini...');
      postData = await generateWithGemini(apiKey, topic, tone, customPrompt);
    } catch (err) {
      console.warn('[AI Generator] Gemini API call failed, falling back to Staff Case Study Engine:', err.message);
      postData = generateDynamicTemplate(topic, tone, customPrompt);
    }
  } else {
    postData = generateDynamicTemplate(topic, tone, customPrompt);
  }

  // Check if image generation is enabled
  const isImageGenEnabled = settings.imageGenerationEnabled !== false;
  let imageObj = null;

  if (isImageGenEnabled) {
    const visualStyle = style || settings.imageStyle || 'photorealistic';
    const visualAspect = aspectRatio || settings.aspectRatio || '16:9';
    const customInstructions = settings.customImageInstructions || '';
    const visualPrompt = customImagePrompt || postData.suggestedImagePrompt || createImagePrompt(postData.topic, postData.content, visualStyle, customInstructions);

    try {
      imageObj = await generateAiImage(visualPrompt, apiKey, {
        style: visualStyle,
        aspectRatio: visualAspect,
        topic: postData.topic,
        postContent: postData.content,
        customInstructions,
      });
    } catch (imgErr) {
      console.warn('[AI Generator] Image generation warning:', imgErr.message);
      // Fallback behavior: if publish-text is allowed, continue text-only
      if (settings.imageFailureBehavior === 'publish-text') {
        imageObj = null;
      } else {
        throw imgErr;
      }
    }
  }

  return {
    ...postData,
    imageUrl: imageObj ? imageObj.imageUrl : null,
    imageData: imageObj ? (imageObj.dataUri || null) : null,
    imagePrompt: imageObj ? imageObj.imagePrompt : null,
    imageEngine: imageObj ? imageObj.engine : null,
    imageStyle: imageObj ? imageObj.style : null,
    imageAspectRatio: imageObj ? imageObj.aspectRatio : null,
  };
}

/**
 * Call Google Gemini API via HTTPS (Tries Gemini 2.0 Flash first, then 1.5 Flash)
 */
async function generateWithGemini(apiKey, topic, tone, customPrompt) {
  try {
    return await callGeminiModel(apiKey, 'gemini-2.0-flash', topic, tone, customPrompt);
  } catch (err20) {
    console.warn('[AI Generator] Gemini 2.0 Flash notice, trying Gemini 1.5 Flash fallback:', err20.message);
    return await callGeminiModel(apiKey, 'gemini-1.5-flash', topic, tone, customPrompt);
  }
}

function callGeminiModel(apiKey, modelName, topic, tone, customPrompt) {
  return new Promise((resolve, reject) => {
    const promptInstructions = `
You are a Principal Software Engineer & Tech Founder posting directly to your personal LinkedIn network.

Topic: ${topic}
Tone: ${tone} (thought-provoking, battle-tested, high-signal, authentic)
${customPrompt ? `Specific Angle / Directive / Case Study: ${customPrompt}` : ''}

CRITICAL RULES FOR HIGH-ENGAGEMENT LINKEDIN THOUGHT LEADERSHIP:
1. NEVER USE ROBOTIC AI FILLER:
   - BANNED: "In today's fast-paced digital world", "Game-changer", "Let's dive in", "Excited to share", "💡 Thought on", "In this post, I will explain"
2. Hook Formula (First Line):
   - Must be an irresistible pattern interrupt, contrarian truth, concrete production metric, or war story.
   - Examples:
     - "We spent 3 weeks optimizing our vector search, only to discover our latency bottleneck was a missing PostgreSQL composite index."
     - "Writing clean code is good. Writing easily deletable code is world-class."
     - "Autonomous agents fail in production for one reason: treating probabilistic LLMs as deterministic compute."
3. Structure & Pacing:
   - 1-2 sentence paragraphs maximum for mobile scannability.
   - 3-4 bulleted takeaways (• or numbers) packed with actionable technical depth, real architecture trade-offs, or concrete numbers.
   - A clear, hard-earned takeaway.
4. Call To Action:
   - End with a genuinely curious, open-ended question that prompts senior engineers and founders to share their real-world experience in the comments.
5. Hashtags:
   - 4-5 focused, relevant tech hashtags at the very bottom.
6. Visual Concept:
   - 1-sentence prompt for an AI image generator describing a high-end minimalist 3D visual or cinematic aesthetic to illustrate this post (photorealistic, sleek tech concept, no text, no typography).

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
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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

              const engineName = modelName.includes('2.0') ? 'Google Gemini 2.0 Flash' : 'Google Gemini 1.5 Flash';

              resolve({
                content: postContent.trim(),
                topic,
                tone,
                engine: engineName,
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
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Gemini ${modelName} request timed out`));
    });
    req.write(requestBody);
    req.end();
  });
}

/**
 * High-Signal Staff Engineer Template Post Builder
 * Zero robotic prefixes. Seamlessly weaves custom prompt directives into organic hooks.
 */
function generateDynamicTemplate(topic, tone, customPrompt) {
  const categories = Object.keys(TEMPLATES_BY_TOPIC);
  const matchedTopic = categories.find((c) => c.toLowerCase() === topic.toLowerCase()) || categories[0];
  const list = TEMPLATES_BY_TOPIC[matchedTopic] || TEMPLATES_BY_TOPIC['AI & Automation Trends'];
  const template = list[Math.floor(Math.random() * list.length)];

  let postText = '';

  if (customPrompt && customPrompt.trim()) {
    // Transform custom prompt into a natural, high-converting hook instead of a robotic prefix
    const cleanPrompt = customPrompt.trim()
      .replace(/^(thought on|thoughts on|about|regarding|topic:?)\s*/i, '')
      .replace(/[.:;]+$/, '');
    const capitalizedPrompt = cleanPrompt.charAt(0).toUpperCase() + cleanPrompt.slice(1);

    // Contextual organic hook
    const dynamicHook = `${capitalizedPrompt} is fundamentally redefining how engineering teams build and scale in 2026.`;
    postText = `${dynamicHook}\n\n${template.body}\n\n${template.cta}\n\n${(template.tags || []).join(' ')}`;
  } else {
    postText = `${template.hook}\n\n${template.body}\n\n${template.cta}\n\n${(template.tags || []).join(' ')}`;
  }

  return {
    content: postText.trim(),
    topic: matchedTopic,
    tone: tone || 'engaging',
    engine: 'Staff Engineer Case Study Engine',
    suggestedImagePrompt: template.visualPrompt || createImagePrompt(matchedTopic, postText),
  };
}

module.exports = {
  generatePost,
  generateAiImage,
  createImagePrompt,
  verifyGeminiKey,
  verifyCloudflareCredentials,
  generateWithCloudflareWorkersAi,
  validateGeneratedImage,
  IMAGE_STYLES,
  TEMPLATES_BY_TOPIC,
};
