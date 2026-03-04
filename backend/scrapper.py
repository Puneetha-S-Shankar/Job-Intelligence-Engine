"""
Job Intelligence Engine - Python Backend
Uses SERP API to fetch LinkedIn job listings with a single optimized query.
"""

import re
import requests


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
API_KEY = "YOUR_SERPAPI_KEY_HERE"   # Replace with your actual SerpAPI key

SERP_ENDPOINT = "https://serpapi.com/search.json"

INDIAN_LOCATIONS = [
    "Bangalore", "Karnataka", "Bengaluru",
    "Chennai", "Tamil Nadu",
    "Hyderabad", "Telangana",
    "Pune", "Maharashtra",
    "Mumbai", "Delhi", "Gurgaon", "Noida", "India"
]


# ──────────────────────────────────────────────
# Utility: Extract LinkedIn Job ID from URL
# ──────────────────────────────────────────────
def extract_job_id(url: str) -> str | None:
    match = re.search(r"jobs/view/(\d+)", url)
    return match.group(1) if match else None


# ──────────────────────────────────────────────
# Utility: Extract Company & Location
# ──────────────────────────────────────────────
def extract_company_location(title: str, snippet: str) -> dict:
    company = "Unknown"
    location = "Unknown"
    mode = "Unknown"

    # LinkedIn title format: "Job Title - Company Name"
    parts = title.split(" - ")
    if len(parts) >= 2:
        company = parts[1].split(" | ")[0].strip()

    text = f"{title} {snippet}".lower()

    for loc in INDIAN_LOCATIONS:
        if loc.lower() in text:
            location = loc
            break

    if "remote" in text:
        mode = "Remote"
    elif "hybrid" in text:
        mode = "Hybrid"
    elif "on-site" in text or "onsite" in text:
        mode = "On-site"

    return {"company": company, "location": location, "mode": mode}


# ──────────────────────────────────────────────
# Build Optimized Query (Single API Call)
# ──────────────────────────────────────────────
def build_query(
    companies: list[str],
    roles: list[str],
    location: str = "All",
    work_mode: str = "All"
) -> str:

    default_roles = ["Software Engineer", "Developer", "Data Analyst"]
    default_companies = ["Google", "Microsoft", "Amazon", "Infosys", "TCS"]

    role_list = roles if roles else default_roles
    company_list = companies if companies else default_companies

    role_str = " OR ".join(f'"{r}"' for r in role_list)
    company_str = " OR ".join(f'"{c}"' for c in company_list)

    query = f'site:linkedin.com/jobs/view ({role_str}) ({company_str})'

    if location and location != "All":
        query += f' "{location}"'
    if work_mode and work_mode != "All":
        query += f' "{work_mode}"'

    return query


# ──────────────────────────────────────────────
# Main Search Function
# ──────────────────────────────────────────────
def search_linkedin_jobs(
    companies: list[str] = None,
    roles: list[str] = None,
    location: str = "All",
    work_mode: str = "All",
    date_filter: str = "week",
    api_key: str = API_KEY
) -> list[dict]:

    companies = companies or []
    roles = roles or []

    query = build_query(companies, roles, location, work_mode)

    date_map = {
        "day":   "qdr:d",
        "week":  "qdr:w",
        "month": "qdr:m",
        "all":   None
    }
    tbs = date_map.get(date_filter, "qdr:w")

    params = {
        "engine":  "google",
        "q":       query,
        "num":     20,
        "hl":      "en",
        "gl":      "in",
        "api_key": api_key
    }
    if tbs:
        params["tbs"] = tbs

    response = requests.get(SERP_ENDPOINT, params=params)
    response.raise_for_status()

    data = response.json()
    organic = data.get("organic_results", [])

    seen_ids = set()
    jobs = []

    for r in organic:
        link = r.get("link", "")
        if "linkedin.com/jobs/view" not in link:
            continue

        job_id = extract_job_id(link)
        if not job_id or job_id in seen_ids:
            continue
        seen_ids.add(job_id)

        title   = r.get("title", "")
        snippet = r.get("snippet", "")
        meta    = extract_company_location(title, snippet)

        jobs.append({
            "Job_ID":   job_id,
            "Title":    title,
            "Company":  meta["company"],
            "Location": meta["location"],
            "Mode":     meta["mode"],
            "Posted":   r.get("date", "Recent"),
            "Link":     link,
            "Summary":  snippet
        })

    return jobs


# ──────────────────────────────────────────────
# Filtering Layer
# ──────────────────────────────────────────────
def filter_jobs(
    jobs: list[dict],
    location: str = "All",
    work_mode: str = "All",
    company_filter: list[str] = None
) -> list[dict]:

    result = jobs

    if location and location != "All":
        result = [j for j in result if location.lower() in j["Location"].lower()]

    if work_mode and work_mode != "All":
        result = [j for j in result if j["Mode"] == work_mode or j["Mode"] == "Unknown"]

    if company_filter:
        cf_lower = [c.lower() for c in company_filter]
        result = [j for j in result if any(c in j["Company"].lower() for c in cf_lower)]

    return result


# ──────────────────────────────────────────────
# Pretty Print
# ──────────────────────────────────────────────
def print_jobs(jobs: list[dict]) -> None:
    if not jobs:
        print("\n⚠  No jobs found. Try adjusting your filters.\n")
        return

    print(f"\n{'═' * 60}")
    print(f"  Found {len(jobs)} jobs")
    print(f"{'═' * 60}\n")

    for i, job in enumerate(jobs, 1):
        print(f"── Job {i} {'─' * 40}")
        print(f"  Job ID   : {job['Job_ID']}")
        print(f"  Title    : {job['Title']}")
        print(f"  Company  : {job['Company']}")
        print(f"  Location : {job['Location']}")
        print(f"  Mode     : {job['Mode']}")
        print(f"  Posted   : {job['Posted']}")
        print(f"  Link     : {job['Link']}")
        print(f"  Summary  : {job['Summary'][:180]}{'…' if len(job['Summary']) > 180 else ''}")
        print()


# ──────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🔎 Job Intelligence Engine — Python CLI\n")

    # ─── CONFIGURE YOUR SEARCH HERE ───────────────────────
    COMPANIES = [
        "Google", "Microsoft", "Amazon", "Meta",
        "Infosys", "TCS", "Wipro", "Zomato", "Swiggy"
    ]

    ROLES = [
        "Software Engineer",
        "Python Developer",
        "Backend Engineer"
    ]

    LOCATION   = "Bangalore"   # All / Bangalore / Chennai / Hyderabad / Pune / Mumbai / Delhi
    WORK_MODE  = "All"         # All / Remote / Hybrid / On-site
    DATE_RANGE = "week"        # day / week / month / all
    # ──────────────────────────────────────────────────────

    print(f"  Companies : {', '.join(COMPANIES)}")
    print(f"  Roles     : {', '.join(ROLES)}")
    print(f"  Location  : {LOCATION}")
    print(f"  Mode      : {WORK_MODE}")
    print(f"  Date      : Past {DATE_RANGE}\n")

    jobs = search_linkedin_jobs(
        companies=COMPANIES,
        roles=ROLES,
        location=LOCATION,
        work_mode=WORK_MODE,
        date_filter=DATE_RANGE
    )

    jobs = filter_jobs(jobs, location=LOCATION, work_mode=WORK_MODE)

    print_jobs(jobs)