require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// Allow requests from your Vercel frontend
// After deploying to Vercel, replace the URL below with your actual Vercel URL
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://job-intelligence-engine.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. curl, Postman) or from allowed list
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

// -----------------------------------------------
// Health check — Render pings this to keep alive
// -----------------------------------------------
app.get("/", (req, res) => {
  res.json({ status: "Job Intelligence Engine API is running ✅" });
});

// -----------------------------------------------
// Utility: Extract Job ID from LinkedIn URL
// -----------------------------------------------
function extractJobId(url) {
  const match = url.match(/jobs\/view\/.*?(\d+)/);
  return match ? match[1] : null;
}

// -----------------------------------------------
// Utility: Extract Company, Location, Mode
// -----------------------------------------------
function extractCompanyLocation(title, snippet) {
  let company = "Unknown";
  let location = "Unknown";
  let mode = "Unknown";

  if (title.includes(" - ")) {
    company = title.split(" - ")[1].split(" | ")[0].trim();
  } else if (title.includes(" at ")) {
    company = title.split(" at ")[1].split(" | ")[0].trim();
  } else if (title.includes(" hiring ")) {
    company = title.split(" hiring ")[0].trim();
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
    if (text.includes(loc.toLowerCase())) { location = loc; break; }
  }

  if (text.includes("remote")) mode = "Remote";
  else if (text.includes("hybrid")) mode = "Hybrid";
  else if (text.includes("on-site") || text.includes("onsite")) mode = "On-site";

  return { company, location, mode };
}

// -----------------------------------------------
// Utility: Build optimized SERP query
// -----------------------------------------------
function buildQuery(companies, roles, location, workMode) {
  let query = `site:linkedin.com/jobs/view`;
  if (roles && roles.length > 0) query += ` (${roles.map(r => `"${r}"`).join(" OR ")})`;
  if (companies && companies.length > 0) query += ` (${companies.map(c => `"${c}"`).join(" OR ")})`;
  if (location && location !== "All") query += ` "${location}"`;
  if (workMode && workMode !== "All") query += ` "${workMode}"`;
  return query;
}

// -----------------------------------------------
// POST /api/search
// -----------------------------------------------
app.post("/api/search", async (req, res) => {
  const { companies = [], roles = [], location = "All", workMode = "All", dateFilter = "week" } = req.body;

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "SERP_API_KEY not set in environment variables." });
  }

  const query = buildQuery(companies, roles, location, workMode);
  const tbsMap = { day: "qdr:d", week: "qdr:w", month: "qdr:m", all: "" };
  const tbs = tbsMap[dateFilter] || "qdr:w";

  try {
    const params = { engine: "google", q: query, num: 20, hl: "en", gl: "in", api_key: apiKey };
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
        Job_ID: jobId, Title: title, Company: company,
        Location: loc, Mode: mode,
        Posted: r.date || "Recent", Link: link, Summary: snippet
      });
    }

    const filtered = jobs.filter(job => {
      if (location !== "All" && !job.Location.toLowerCase().includes(location.toLowerCase()) && job.Location !== "Unknown") return false;
      if (workMode !== "All" && job.Mode !== workMode && job.Mode !== "Unknown") return false;
      return true;
    });

    res.json({ jobs: filtered, total: filtered.length, query });
  } catch (err) {
    console.error("SERP API Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || "Search failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Backend running on port ${PORT}`);
  console.log(`🔑 SERP API Key: ${process.env.SERP_API_KEY ? "Loaded ✓" : "MISSING ✗"}\n`);
});