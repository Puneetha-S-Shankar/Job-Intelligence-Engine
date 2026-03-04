    # 🔎 Job Intelligence Engine

Scan LinkedIn job listings using a **single optimized SERP API query**.  
Supports company upload, role/location/mode filtering, and a clean web UI.

---

## 📁 Folder Structure

```
job-intelligence-engine/
├── backend/
│   ├── server.js          ← Node.js Express API server
│   └── scraper.py         ← Python CLI version (standalone)
├── frontend/
│   └── public/
│       └── index.html     ← Web UI (served by Node server)
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### Option A: Web App (Node.js)

**Requirements:** Node.js v18+

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

Enter your SerpAPI key in the UI, configure filters, and click **Search**.

---

### Option B: Python CLI (standalone)

**Requirements:** Python 3.10+ · `requests` library

```bash
pip install requests
```

Edit `backend/scraper.py` — set your API key and filters at the bottom:

```python
API_KEY    = "your_serpapi_key"
COMPANIES  = ["Google", "Microsoft", "Amazon"]
ROLES      = ["Software Engineer", "Python Developer"]
LOCATION   = "Bangalore"
WORK_MODE  = "All"
DATE_RANGE = "week"
```

Then run:
```bash
python backend/scraper.py
```

---

## 🔑 Get a SERP API Key

1. Sign up at [serpapi.com](https://serpapi.com)
2. Free tier: **100 searches/month**
3. Copy your API key from the dashboard

---

## ⚙️ Features

| Feature | Detail |
|---|---|
| Single optimized query | Minimizes API calls |
| Company upload | `.txt` or `.csv` file |
| Filters | Location, work mode, date range |
| Deduplication | No duplicate job IDs |
| Structured output | Job ID, title, company, location, mode, link |
| Web UI + CLI | Choose your workflow |

---

## 📤 Output Format

```
Job_ID   : 4085234771
Title    : Software Engineer - Google
Company  : Google
Location : Bangalore
Mode     : Hybrid
Posted   : 3 days ago
Link     : https://linkedin.com/jobs/view/4085234771
Summary  : We are looking for a…
```

---

## 🛠 Tech Stack

- **Backend**: Node.js + Express (web) / Python (CLI)
- **API**: [SerpAPI](https://serpapi.com) — Google search engine
- **Frontend**: Vanilla HTML/CSS/JS
- **Query Target**: `site:linkedin.com/jobs/view`