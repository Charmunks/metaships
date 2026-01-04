require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const AI_TOKEN = process.env.AI_TOKEN;
const META_CHANNEL_ID = 'C0188CY57PZ';
const CACHE_FILE = path.join(__dirname, '..', 'aicache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Failed to load AI cache:', err.message);
  }
  return {};
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn('Failed to save AI cache:', err.message);
  }
}

async function filterPostsWithAI(programName, posts) {
  if (!AI_TOKEN) {
    console.warn('AI_TOKEN not set, skipping AI filtering');
    return posts.length;
  }

  if (posts.length === 0) {
    return 0;
  }

  const postTexts = posts.map((p, i) => `Post ${i + 1}: ${p.text}`).join('\n\n');

  const prompt = `You are analyzing Slack posts to determine how many are actually about the "${programName}" event/program, versus just offhand references or mentions.

Here are the posts:

${postTexts}

Count ONLY posts that are substantively about "${programName}" (e.g., sharing a project, discussing the event, announcing something related to it). Do NOT count posts that just mention it in passing or as an offhand reference.

Respond with ONLY a single number representing the count of relevant posts. Nothing else.`;

  const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  const count = parseInt(content, 10);

  if (isNaN(count)) {
    console.warn(`AI returned non-numeric response: ${content}, falling back to total count`);
    return posts.length;
  }

  return count;
}

async function search(programName) {
  if (!SLACK_TOKEN) {
    throw new Error('SLACK_TOKEN environment variable is not set');
  }

  let allMessages = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      query: `"${programName}" in:<#${META_CHANNEL_ID}>`,
      count: '100',
      page: String(page),
    });

    const response = await fetch(`https://slack.com/api/search.messages?${params}`, {
      headers: {
        'Authorization': `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    const messages = data.messages?.matches || [];
    allMessages = allMessages.concat(messages);

    totalPages = data.messages?.pagination?.page_count || 1;
    page++;
  }

  const rootPosts = allMessages.filter((msg) => {
    const threadTsMatch = msg.permalink.match(/thread_ts=([0-9.]+)/);
    if (!threadTsMatch) return true;
    const threadTs = threadTsMatch[1];
    return msg.ts === threadTs;
  });

  const rawCount = rootPosts.length;
  const cache = loadCache();
  const cached = cache[programName];

  if (cached && cached.rawCount === rawCount) {
    return {
      programName,
      metaPostCount: cached.aiCount,
      rawPostCount: rawCount,
      posts: rootPosts,
    };
  }

  const relevantCount = await filterPostsWithAI(programName, rootPosts);

  cache[programName] = { rawCount, aiCount: relevantCount };
  saveCache(cache);

  return {
    programName,
    metaPostCount: relevantCount,
    rawPostCount: rawCount,
    posts: rootPosts,
  };
}

module.exports = { search };
