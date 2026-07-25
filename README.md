# DevLaunch Backend

A production-ready Flask API that turns a one-line startup idea into a full,
structured startup launch report, powered by the OpenAI Responses API.

## Folder structure

```
devlaunch-backend/
├── app.py              # Flask app: routes, validation, OpenAI call, error handling
├── requirements.txt    # Python dependencies
├── .env.example         # Template for required/optional environment variables
├── .env                 # Your actual secrets (create this — never commit it)
└── README.md            # This file
```

## Requirements

- Python 3.11+
- An OpenAI API key with access to a Responses-API-compatible model

## 1. Installation

```bash
# From inside devlaunch-backend/

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 2. Configure your API key

```bash
cp .env.example .env
```

Open `.env` and set your key:

```
OPENAI_API_KEY=sk-your-real-key-here
```

`.env` is loaded by `python-dotenv` at startup and is **only ever read on the
server**. The key is never returned in any API response and never touches
the frontend — the browser only ever talks to *your* Flask server, which in
turn talks to OpenAI.

## 3. Run the backend locally

Development server (auto-reload if `FLASK_ENV=development` in `.env`):

```bash
python app.py
```

The API will be available at `http://localhost:5000`.

For a production-style run instead:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Health check

```bash
curl http://localhost:5000/health
# {"status": "ok"}
```

## API reference

### `POST /generate`

**Request body**

```json
{
  "idea": "An AI app that helps students prepare for exams."
}
```

**Success response — `200 OK`**

```json
{
  "startupName": "PrepPilot",
  "tagline": "Study smarter, not longer.",
  "elevatorPitch": "PrepPilot turns any syllabus into a personalized study plan...",
  "problem": "Students waste hours deciding what to study instead of studying...",
  "solution": "PrepPilot ingests course material and generates adaptive quizzes...",
  "targetAudience": "High school and college students preparing for exams...",
  "revenueModel": "Freemium with a paid tier for unlimited practice sets...",
  "mvpFeatures": [
    "Upload syllabus or notes to auto-generate a study plan",
    "Adaptive practice quizzes based on weak areas",
    "..."
  ],
  "marketingPlan": "Launch on Product Hunt and target student communities...",
  "competitorAnalysis": "Quizlet offers flashcards but no adaptive planning...",
  "techStack": "React frontend, Node.js/Express API, PostgreSQL, OpenAI for generation...",
  "launchChecklist": [
    "Validate with 10 target students",
    "..."
  ],
  "nextSteps": [
    "Run 5 user interviews this week",
    "..."
  ]
}
```

**Error responses**

| Status | When | Body |
|---|---|---|
| `400` | `idea` missing, empty, non-string, or over 1000 characters | `{"error": "..."}` |
| `400` | Request body isn't valid JSON | `{"error": "Request body must be a valid JSON object."}` |
| `500` | OpenAI API error (rate limit, timeout, connection issue) | `{"error": "..."}` |
| `500` | Any other unexpected server error | `{"error": "..."}` |

Example error:

```bash
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{"idea": ""}'
```

```json
{"error": "Field 'idea' is required and cannot be empty."}
```

## Configuration reference (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | Your OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-5-mini` | Model used for generation |
| `OPENAI_TIMEOUT_SECONDS` | No | `30` | Per-request timeout to OpenAI |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed frontend origins |
| `LOG_LEVEL` | No | `INFO` | Python logging level |
| `PORT` | No | `5000` | Local dev server port |
| `FLASK_ENV` | No | `production` | Set to `development` for debug/auto-reload |

**Production tip:** set `CORS_ORIGINS` to your actual frontend domain(s)
(e.g. `https://devlaunch.app`) instead of `*` once you deploy.

## Connecting the existing JavaScript frontend

The DevLaunch frontend (`script.js`) currently builds its report with mock
data inside `handleGenerate()`. To connect it to this API:

### 1. Replace the simulated delay with a real `fetch()` call

Find this block in `script.js`:

```js
window.setTimeout(() => {
  finishLoading(MOCK_RESULT);
}, SIMULATED_LOAD_MS);
```

Replace it with:

```js
const API_BASE_URL = "http://localhost:5000"; // swap for your deployed URL

fetch(`${API_BASE_URL}/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idea }),
})
  .then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }
    return data;
  })
  .then((apiData) => {
    finishLoading(adaptReport(apiData));
  })
  .catch((err) => {
    generateBtn.classList.remove("is-loading");
    generateBtn.disabled = false;
    generateBtn.setAttribute("aria-busy", "false");
    resultsSection.setAttribute("hidden", "");
    formMessage.textContent = err.message;
    ideaInput.focus();
  });
```

### 2. Add a small adapter for the field names

The API's JSON keys are intentionally explicit (`startupName`,
`elevatorPitch`, `targetAudience`, etc.) while the frontend's internal
`REPORT_LAYOUT` uses shorter keys (`name`, `pitch`, `audience`, etc.). Add
this adapter above `handleGenerate()`:

```js
function adaptReport(apiData) {
  return {
    name: apiData.startupName,
    tagline: apiData.tagline,
    pitch: apiData.elevatorPitch,
    problem: apiData.problem,
    solution: apiData.solution,
    audience: apiData.targetAudience,
    revenue: apiData.revenueModel,
    mvpFeatures: apiData.mvpFeatures,
    marketing: apiData.marketingPlan,
    competitors: apiData.competitorAnalysis,
    techStack: apiData.techStack,
    checklist: apiData.launchChecklist,
    nextSteps: apiData.nextSteps,
  };
}
```

### 3. Update four field types in `REPORT_LAYOUT`

The API returns `revenueModel`, `marketingPlan`, `competitorAnalysis`, and
`techStack` as plain paragraphs (strings), not lists or label/detail pairs.
Update their `type` in `REPORT_LAYOUT` to `"paragraph"` so they render
correctly:

```js
{ key: "revenue",      tag: "REVENUE MODEL",           type: "paragraph" }, // was "list"
{ key: "marketing",    tag: "MARKETING PLAN",          type: "paragraph" }, // was "list"
{ key: "competitors",  tag: "COMPETITOR ANALYSIS",     type: "paragraph" }, // was "pairs"
{ key: "techStack",    tag: "TECH STACK RECOMMENDATION", type: "paragraph" }, // was "pairs"
```

`mvpFeatures`, `checklist` (`launchChecklist`), and `nextSteps` are already
arrays on both sides, so no type changes are needed for those.

### 4. Enable CORS for your dev origin

If you're serving the frontend from a different port (e.g. via
`python -m http.server 8000` or a dev server), make sure that origin is
allowed. For local development, the default `CORS_ORIGINS=*` in `.env`
already covers this. For production, set it explicitly:

```
CORS_ORIGINS=https://your-frontend-domain.com
```

## Notes on the OpenAI integration

- Uses `client.responses.parse()` with a Pydantic `StartupReport` model as
  `text_format`. OpenAI's structured outputs feature constrains generation
  so the returned JSON always matches the schema — no manual JSON parsing,
  regex, or "hope it's valid JSON" logic required.
- If the model ever refuses or fails to produce a parseable result,
  `response.output_parsed` is `None`; the backend treats this as an error
  and returns a `500` rather than passing through `null`/partial data.
- The system prompt instructs the model to act as an experienced startup
  consultant and to stay concrete and specific to the given idea, not
  generic boilerplate.
