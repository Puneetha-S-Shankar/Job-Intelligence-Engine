require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

function extractJobId(url) {
  const match = url.match(/jobs\/view\/.*?(\d+)/);
  return match ? match[1] : null;
}

function extractCompanyLocation(title, snippet) {
  let company = "Unknown", location = "Unknown", mode = "Unknown";

  if (title.includes(" - ")) {
    company = title.split(" - ")[1].split(" | ")[0].trim();
  } else if (title.includes(" at ")) {
    company = title.split(" at ")[1].split(" | ")[0].trim();
  } else if (title.includes(" hiring ")) {
    company = title.split(" hiring ")[0].trim();
  }

  const text = `${title} ${snippet}`.toLowerCase();
  const locationMap = ["Bangalore","Karnataka","Bengaluru","Chennai","Tamil Nadu","Hyderabad","Telangana","Pune","Maharashtra","Mumbai","Delhi","Gurgaon","Noida","India"];
  for (const loc of locationMap) {
    if (text.includes(loc.toLowerCase())) { location = loc; break; }
  }

  if (text.includes("remote")) mode = "Remote";
  else if (text.includes("hybrid")) mode = "Hybrid";
  else if (text.includes("on-site") || text.includes("onsite")) mode = "On-site";

  return { company, location, mode };
}

function buildQuery(companies, roles, location, workMode) {
  let query = `site:linkedin.com/jobs/view`;
  if (roles && roles.length > 0) query += ` (${roles.map(r => `"${r}"`).join(" OR ")})`;
  if (companies && companies.length > 0) query += ` (${companies.map(c => `"${c}"`).join(" OR ")})`;
  if (location && location !== "All") query += ` "${location}"`;
  if (workMode && workMode !== "All") query += ` "${workMode}"`;
  return query;
}

app.post("/api/search", async (req, res) => {
  const { companies = [], roles = [], location = "All", workMode = "All", dateFilter = "week" } = req.body;

  // API key is read from .env — never sent from frontend
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "SERP_API_KEY is not set in your .env file." });
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

      jobs.push({ Job_ID: jobId, Title: title, Company: company, Location: loc, Mode: mode, Posted: r.date || "Recent", Link: link, Summary: snippet });
    }

    const filtered = jobs.filter(job => {
      if (location !== "All" && !job.Location.toLowerCase().includes(location.toLowerCase()) && job.Location !== "Unknown") return false;
      if (workMode !== "All" && job.Mode !== workMode && job.Mode !== "Unknown") return false;
      return true;
    });

    res.json({ jobs: filtered, total: filtered.length, query });
  } catch (err) {
    console.error("SERP API Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || "Search failed. Check your .env API key." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n✅ Job Intelligence Engine running at http://localhost:${PORT}\n`));