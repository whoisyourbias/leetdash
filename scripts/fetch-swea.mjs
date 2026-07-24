/**
 * Fetches ALL SWEA problems from SW Expert Academy.
 * Scrapes the problem list page with pagination.
 *
 * Usage: node scripts/fetch-swea.mjs
 * Output: JSON array of { id, title, difficulty } to stdout
 */

const BASE_URL = "https://swexpertacademy.com/main/code/problem/problemList.do";
const PAGE_SIZE = 30;
const REQUEST_DELAY_MS = 400;

async function fetchPage(pageIndex) {
  const url = `${BASE_URL}?pageIndex=${pageIndex}&pageSize=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for page ${pageIndex}`);
  return res.text();
}

function parseProblems(html) {
  const problems = [];
  const numRegex = /<span class="week_num">(\d+)\.<\/span>/g;
  const badgeRegex = /badgeC-d([1-8])/;

  let match;
  while ((match = numRegex.exec(html)) !== null) {
    const problemId = match[1];
    const startPos = match.index;

    // Find the title
    const segment = html.substring(startPos, startPos + 500);
    const titleMatch = segment.match(/<span class="week_text">\s*<a[^>]*>\s*([^<]+?)\s*(?:&nbsp;|<\s*)/);
    const title = titleMatch ? titleMatch[1].trim() : "Unknown";

    // Find the difficulty badge between this and next problem
    numRegex.lastIndex = match.index + 1; // temporarily move past current
    const nextMatch = numRegex.exec(html);
    const sectionEnd = nextMatch ? nextMatch.index : html.length;
    const section = html.substring(startPos, sectionEnd);
    // Restore lastIndex for the outer loop
    numRegex.lastIndex = nextMatch ? nextMatch.index : html.length;

    // Check for Attack difficulty first
    const isAttack = /D[Aa]ttack/.test(section);
    const diffMatch = section.match(badgeRegex);
    const difficulty = isAttack ? "Attack" : diffMatch ? `D${diffMatch[1]}` : "Unknown";

    problems.push({ id: problemId, title, difficulty });
  }

  return problems;
}

function findTotalPages(html) {
  // Pattern: <li class="page-item divid">/</li>
  //          <li class="page-item"><a class="page-link bd-none" href="#">39</a></li>
  const match = html.match(/page-item divid[^>]*>\/[\s\S]*?page-link bd-none[^>]*>\s*(\d+)\s*</);
  if (match) return parseInt(match[1], 10);

  // Fallback: look for pageIndex in JS links
  const pageMatches = [...html.matchAll(/pageIndex=(\d+)/g)];
  if (pageMatches.length > 1) {
    return Math.max(...pageMatches.map((m) => parseInt(m[1], 10)));
  }

  return 1;
}

async function main() {
  console.error("[fetch-swea] Starting SWEA scrape (pageSize=30)...");

  const firstHtml = await fetchPage(1);
  const totalPages = findTotalPages(firstHtml);
  const allProblems = parseProblems(firstHtml);

  console.error(`[fetch-swea] Page 1/${totalPages} — ${allProblems.length} problems`);

  for (let page = 2; page <= totalPages; page++) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    try {
      const html = await fetchPage(page);
      const pageProblems = parseProblems(html);
      allProblems.push(...pageProblems);
      console.error(`[fetch-swea] Page ${page}/${totalPages} — ${pageProblems.length} problems (total: ${allProblems.length})`);
    } catch (err) {
      console.error(`[fetch-swea] Page ${page}/${totalPages} FAILED: ${err.message}`);
    }
  }

  const seen = new Set();
  const unique = [];
  for (const p of allProblems) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }

  unique.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

  console.error(`[fetch-swea] Done — ${unique.length} unique problems`);

  const dist = {};
  for (const p of unique) dist[p.difficulty] = (dist[p.difficulty] || 0) + 1;
  for (const [k, v] of Object.entries(dist).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.error(`  ${k}: ${v}`);
  }

  process.stdout.write(JSON.stringify(unique, null, 2));
}

main().catch((err) => {
  console.error(`[fetch-swea] FATAL: ${err.message}`);
  process.exit(1);
});
