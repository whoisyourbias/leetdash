/**
 * Fetches all Programmers problems for levels 0, 1, 2, 3
 * from the Programmers public API.
 *
 * Usage: node scripts/fetch-programmers.mjs
 * Output: JSON array of problems to stdout
 *
 * Each problem has: { id, title, partTitle, level, finishedCount, acceptanceRate }
 */

const BASE_URL = "https://school.programmers.co.kr/api/v2/school/challenges";
const PER_PAGE = 30; // API fixes perPage at 30
const TARGET_LEVELS = [0, 1, 2, 3];
const REQUEST_DELAY_MS = 200; // be respectful to the API

async function fetchPage(levels, page) {
  const params = new URLSearchParams();
  for (const level of levels) {
    params.append("levels[]", level);
  }
  params.set("page", String(page));

  const url = `${BASE_URL}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "leetdash-catalog-builder/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status} for page ${page}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchAllLevels(levels) {
  const allProblems = [];

  // Fetch first page to get totalPages
  const firstPage = await fetchPage(levels, 1);
  const totalPages = firstPage.totalPages;
  allProblems.push(...firstPage.result);

  console.error(`[fetch-programmers] Page 1/${totalPages} — ${firstPage.totalEntries} total entries`);

  // Fetch remaining pages
  const pagePromises = [];
  for (let page = 2; page <= totalPages; page++) {
    // Add delay between requests to be respectful
    const delay = REQUEST_DELAY_MS * (page - 1);
    pagePromises.push(
      new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
        fetchPage(levels, page).then((data) => {
          console.error(`[fetch-programmers] Page ${page}/${totalPages} — ${data.result.length} problems`);
          return data.result;
        })
      )
    );
  }

  const results = await Promise.all(pagePromises);
  for (const problems of results) {
    allProblems.push(...problems);
  }

  return allProblems;
}

async function main() {
  try {
    console.error(`[fetch-programmers] Fetching levels ${TARGET_LEVELS.join(", ")}...`);
    const problems = await fetchAllLevels(TARGET_LEVELS);
    console.error(`[fetch-programmers] Done — fetched ${problems.length} problems total`);

    // Validate no duplicates by id
    const ids = new Set();
    const duplicates = [];
    for (const p of problems) {
      if (ids.has(p.id)) {
        duplicates.push(p.id);
      }
      ids.add(p.id);
    }
    if (duplicates.length > 0) {
      console.error(`[fetch-programmers] WARNING: Found ${duplicates.length} duplicate IDs`);
    }

    // Output JSON to stdout for piping
    process.stdout.write(JSON.stringify(problems, null, 2));
  } catch (err) {
    console.error(`[fetch-programmers] ERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
