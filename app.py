"""
DevLaunch backend — Flask API that turns a one-line startup idea into a
full, structured startup report using the Gemini API (google-genai SDK).

Run locally with:
    python app.py

See README.md for setup, environment variables, and frontend integration.
"""

# =============================================================================
# Imports
# =============================================================================
import logging
import os
from typing import List

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

# =============================================================================
# Environment & configuration
# =============================================================================
# Loads variables from a local .env file (see .env.example) into os.environ.
# This must run before we read any GEMINI_API_KEY / config values below.
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
PORT = int(os.getenv("PORT", "5000"))
FLASK_ENV = os.getenv("FLASK_ENV", "production")

# The API key is never sent to or read by the frontend — it only ever lives
# in this process's environment, loaded from .env, and is used solely for
# server-to-server calls to Gemini below.
if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Copy .env.example to .env and add your "
        "Gemini API key before starting the server."
    )

# Longest idea description we'll accept, to keep requests reasonable and
# bound token usage/cost per call.
MAX_IDEA_LENGTH = 1000

# =============================================================================
# Logging
# =============================================================================
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("devlaunch")

# =============================================================================
# Flask app + CORS
# =============================================================================
app = Flask(__name__)

# Restrict CORS to specific origins in production via CORS_ORIGINS in .env
# (comma-separated). Defaults to "*" for local development convenience.
_allowed_origins = (
    "*" if CORS_ORIGINS.strip() == "*" else [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
)
CORS(app, resources={r"/generate": {"origins": _allowed_origins}, r"/health": {"origins": _allowed_origins}})

# =============================================================================
# Gemini client
# -----------------------------------------------------------------------------
# Uses the Gemini Developer API (API key auth) rather than Vertex AI. The
# timeout is expressed in milliseconds per google.genai.types.HttpOptions.
# =============================================================================
client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=types.HttpOptions(timeout=int(GEMINI_TIMEOUT_SECONDS * 1000)),
)

# =============================================================================
# Response schema (Pydantic)
# -----------------------------------------------------------------------------
# Passed to generate_content as `response_schema`. Gemini's structured-output
# support constrains generation so the model's JSON always matches this
# schema exactly — no missing keys, no wrong types, no manual JSON parsing
# or repair logic needed on our side. This model — and therefore the JSON
# shape returned to the frontend — is unchanged from the OpenAI version.
# =============================================================================
class StartupReport(BaseModel):
    startupName: str = Field(..., description="A short, memorable, brandable startup name.")
    tagline: str = Field(..., description="A punchy one-line tagline, under ~12 words.")
    elevatorPitch: str = Field(..., description="A 2-3 sentence elevator pitch, sayable in 30 seconds.")
    problem: str = Field(..., description="The concrete problem this startup solves.")
    solution: str = Field(..., description="How the product solves that problem.")
    targetAudience: str = Field(..., description="The primary target customer segment.")
    revenueModel: str = Field(..., description="How the business makes money.")
    mvpFeatures: List[str] = Field(..., description="5 to 8 concrete, specific MVP feature bullet points.")
    marketingPlan: str = Field(..., description="A short, practical go-to-market plan.")
    competitorAnalysis: str = Field(..., description="A short analysis of the competitive landscape.")
    techStack: str = Field(..., description="A recommended, concrete tech stack for building the MVP.")
    launchChecklist: List[str] = Field(..., description="5 to 10 concrete, sequential pre-launch tasks.")
    nextSteps: List[str] = Field(..., description="3 to 6 concrete actions for the founder to take next.")


# =============================================================================
# AI prompt
# -----------------------------------------------------------------------------
# System prompt establishes the persona (experienced startup consultant) and
# quality bar. It's passed as `system_instruction` in GenerateContentConfig,
# kept separate from the per-request user message so it's easy to tune
# independently of the idea being analyzed.
# =============================================================================
SYSTEM_PROMPT = """You are a senior startup consultant with 15+ years of experience advising \
early-stage founders, in the style of a top-tier accelerator (e.g. Y Combinator) partner.

A founder will give you a single short description of a startup idea. Produce a complete, \
professional startup launch report for that exact idea.

Guidelines:
- Be concise, concrete, and practical. Avoid vague filler language and generic advice that \
could apply to any startup — every section must clearly reflect the specific idea given.
- mvpFeatures: 5 to 8 short, concrete, buildable product features (not vague goals).
- launchChecklist: 5 to 10 concrete, sequential, actionable pre-launch tasks.
- nextSteps: 3 to 6 concrete actions the founder can realistically take in the next 1-2 weeks.
- marketingPlan, competitorAnalysis, and techStack should each be a short, well-structured \
paragraph (roughly 3-6 sentences) — informative and specific, not exhaustive.
- Write as a trusted advisor speaking directly to the founder: confident, clear, no hype.
- Plain prose only inside string fields — no markdown syntax, headers, or bullet characters."""


def build_user_prompt(idea: str) -> str:
    """Wraps the raw idea text in a small instruction so the model has clear
    context about what the string represents."""
    return f"Startup idea: {idea}"


# =============================================================================
# Core generation logic
# =============================================================================
def generate_startup_report(idea: str) -> dict:
    """
    Calls the Gemini API (via google-genai) to turn a startup idea into a
    structured StartupReport, and returns it as a plain JSON-serializable
    dict.

    Raises google.genai.errors.APIError (covers both client- and server-side
    failures, e.g. rate limits, invalid requests, upstream outages) or
    ValueError on an unexpected/empty result — callers are responsible for
    catching these and translating them into HTTP responses.
    """
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=build_user_prompt(idea),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=StartupReport,
        ),
    )

    report = response.parsed
    if report is None:
        # The model either refused the request or produced output that
        # didn't match the schema (rare, since structured outputs enforce
        # schema conformance, but handled defensively).
        logger.warning("Model returned no parsed report. Raw text: %s", getattr(response, "text", None))
        raise ValueError("The model did not return a structured report.")

    return report.model_dump()


# =============================================================================
# Routes
# =============================================================================
@app.route("/health", methods=["GET"])
def health():
    """Simple liveness check — useful for uptime monitors and deploy checks."""
    return jsonify({"status": "ok"}), 200


@app.route("/generate", methods=["POST"])
def generate():
    """
    POST /generate
    Body:     {"idea": "<startup idea description>"}
    Success:  200, JSON body matching the StartupReport schema
    Errors:   400 for invalid/missing input, 500 for unexpected failures
    """
    # ---- 1. Parse & validate the request body -----------------------------
    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a valid JSON object."}), 400

    idea = payload.get("idea", "")
    if not isinstance(idea, str) or not idea.strip():
        return jsonify({"error": "Field 'idea' is required and cannot be empty."}), 400

    idea = idea.strip()
    if len(idea) > MAX_IDEA_LENGTH:
        return (
            jsonify({"error": f"Field 'idea' must be {MAX_IDEA_LENGTH} characters or fewer."}),
            400,
        )

    # ---- 2. Call Gemini and build the report -------------------------------
    try:
        report = generate_startup_report(idea)
        logger.info("Generated startup report for idea: %r", idea[:80])
        return jsonify(report), 200

    except genai_errors.APIError as exc:
        # Known failure modes talking to Gemini (rate limits, invalid
        # requests, upstream server errors, etc. — covers both ClientError
        # and ServerError, which both subclass APIError). Logged with
        # detail server-side; the client just gets a generic 500.
        logger.error("Gemini API error while generating report: %s", exc)
        return jsonify({"error": "The AI service is currently unavailable. Please try again shortly."}), 500

    except ValidationError as exc:
        logger.error("AI response failed schema validation: %s", exc)
        return jsonify({"error": "The AI returned an unexpected response format."}), 500

    except Exception:
        # Catch-all for anything unforeseen (including network-level issues
        # such as connection errors/timeouts that surface as generic
        # exceptions rather than APIError) so the process never crashes and
        # the client always gets valid JSON back.
        logger.exception("Unexpected error while generating startup report")
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 500


# =============================================================================
# JSON error handlers
# -----------------------------------------------------------------------------
# Flask's default error pages are HTML. Since this API promises "return JSON
# only", we override the common error handlers to keep every response
# (including framework-level errors) valid JSON.
# =============================================================================
@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "Not found."}), 404


@app.errorhandler(405)
def method_not_allowed(_error):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def internal_error(_error):
    return jsonify({"error": "Internal server error."}), 500


# =============================================================================
# Entrypoint
# -----------------------------------------------------------------------------
# For local development only. In production, run with a WSGI server instead,
# e.g.: gunicorn -w 4 -b 0.0.0.0:5000 app:app  (see README.md).
# =============================================================================
if __name__ == "__main__":
    debug_mode = FLASK_ENV != "production"
    logger.info("Starting DevLaunch backend on port %s (debug=%s)", PORT, debug_mode)
    app.run(host="0.0.0.0", port=PORT, debug=debug_mode)
