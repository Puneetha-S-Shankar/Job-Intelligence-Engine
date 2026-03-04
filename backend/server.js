const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

// -----------------------------------------------
// Utility: Extract Job ID from LinkedIn URL
// -----------------------------------------------
function extractJobId(url) {
  const match = url.match(/jobs\/view\/(\d+)/);
  return match ? match[1] : null;
}

// -----------------------------------------------
// Utility: Extract Company & Location from title/snippet
// -----------------------------------------------
function extractCompanyLocation(title, snippet) {
  let company = "Unknown";
  let location = "Unknown";
  let mode = "Unknown";

  // LinkedIn format: "Job Title - Company Name"
  const parts = title.split(" - ");
  if (parts.length >= 2) {
    company = parts[1].split(" | ")[0].trim();
  }

  const text = `${title} ${snippet}`.toLowerCase();

  const locationMap = [
    "Bangalore", "Karnataka", "Bengaluru",
    "Chennai", "Tamil Nadu",
    "Hyderabad", "Telangana",
    "Pune", "Maharashtra",
    "Mumbai", "Delhi", "Gurgaon", "Noida", "India"
  ];

  for (const loc of locationMap) {
    if (text.includes(loc.toLowerCase())) {
      location = loc;
      break;
    }
  }

  if (text.includes("remote")) mode = "Remote";
  else if (text.includes("hybrid")) mode = "Hybrid";
  else if (text.includes("on-site") || text.includes("onsite")) mode = "On-site";

  return { company, location, mode };
}

// -----------------------------------------------
// Utility: Build optimized SERP API query
// -----------------------------------------------
function buildQuery(companies, roles, location, workMode) {
  const roleStr = roles.length
    ? `(${roles.map(r => `"${r}"`).join(" OR ")})`
    : `("Software Engineer" OR "Developer" OR "Analyst")`;

  const companyStr = companies.length
    ? `(${companies.map(c => `"${c}"`).join(" OR ")})`
    : `("Google" OR "Microsoft" OR "Amazon" OR "Infosys" OR "TCS")`;

  let query = `site:linkedin.com/jobs/view ${roleStr} ${companyStr}`;

  if (location && location !== "All") query += ` "${location}"`;
  if (workMode && workMode !== "All") query += ` "${workMode}"`;

  return query;
}

// -----------------------------------------------
// POST /api/search
// -----------------------------------------------
app.post("/api/search", async (req, res) => {
  const {
    companies = [],
    roles = [],
    location = "All",
    workMode = "All",
    dateFilter = "week",
    apiKey
  } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "SERP API key is required." });
  }

  const query = buildQuery(companies, roles, location, workMode);

  // Map dateFilter to SERP API tbs param
  const tbsMap = {
    day: "qdr:d",
    week: "qdr:w",
    month: "qdr:m",
    all: ""
  };
  const tbs = tbsMap[dateFilter] || "qdr:w";

  try {
    const params = {
      engine: "google",
      q: query,
      num: 20,
      hl: "en",
      gl: "in",
      api_key: apiKey
    };
    if (tbs) params.tbs = tbs;

    const response = await axios.get("https://serpapi.com/search.json", { params });
    const organicResults = response.data?.organic_results || [];

    const seen = new Set();
    const jobs = [];

    for (const r of organicResults) {
      const link = r.link || "";
      if (!link.includes("linkedin.com/jobs/view")) continue;

      const jobId = extractJobId(link);
      if (!jobId || seen.has(jobId)) continue;
      seen.add(jobId);

      const title = r.title || "";
      const snippet = r.snippet || "";
      const { company, location: loc, mode } = extractCompanyLocation(title, snippet);

      jobs.push({
        Job_ID: jobId,
        Title: title,
        Company: company,
        Location: loc,
        Mode: mode,
        Posted: r.date || "Recent",
        Link: link,
        Summary: snippet
      });
    }

    // Client-side filterable response — also do server-side pass
    const filtered = jobs.filter(job => {
      if (location !== "All" && !job.Location.toLowerCase().includes(location.toLowerCase())) return false;
      if (workMode !== "All" && job.Mode !== workMode && job.Mode !== "Unknown") return false;
      return true;
    });

    res.json({ jobs: filtered, total: filtered.length, query });
  } catch (err) {
    console.error("SERP API Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || "Search failed. Check your API key." });
  }
});

// -----------------------------------------------
// Serve frontend for all other routes
// -----------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Job Intelligence Engine running at http://localhost:${PORT}\n`);
});