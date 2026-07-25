/* =========================================================
   DevLaunch — script.js
   Handles: mobile nav toggle, the AI startup-report generator
   (loading state, skeleton -> results swap), per-field and
   "copy all" clipboard actions, Markdown/PDF export, toast
   notifications, and scroll-reveal animations.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Mobile menu toggle ---------- */
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  function openMenu() {
    mobileMenu.classList.add("is-open");
    navToggle.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    mobileMenu.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    mobileMenu.classList.remove("is-open");
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    mobileMenu.setAttribute("aria-hidden", "true");
  }

  navToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.contains("is-open");
    isOpen ? closeMenu() : openMenu();
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  /* ---------- Toast notification ---------- */
  const toast = document.getElementById("toast");
  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  /* ---------- DOM references ---------- */
  const ideaInput = document.getElementById("ideaInput");
  const generateBtn = document.getElementById("generateBtn");
  const formMessage = document.getElementById("formMessage");
  const generateStatus = document.getElementById("generateStatus");

  const resultsSection = document.getElementById("results");
  const resultsHeading = document.getElementById("resultsHeading");
  const resultsSkeleton = document.getElementById("resultsSkeleton");
  const resultsContent = document.getElementById("resultsContent");
  const printMeta = document.getElementById("printMeta");

  const copyAllBtn = document.getElementById("copyAllBtn");
  const exportMarkdownBtn = document.getElementById("exportMarkdownBtn");
  const exportPdfBtn = document.getElementById("exportPdfBtn");

  // Guard: if any required element is missing, bail out of the generator
  // wiring instead of throwing on a null reference later.
  const requiredEls = [
    ideaInput, generateBtn, formMessage, generateStatus,
    resultsSection, resultsHeading, resultsSkeleton, resultsContent,
    printMeta, copyAllBtn, exportMarkdownBtn, exportPdfBtn,
  ];
  const generatorReady = requiredEls.every(Boolean);

  if (generatorReady) {
    initGenerator();
  }

  function initGenerator() {
    /* ---------- Report field definitions ----------
       Each row renders as either a two-column pair (2 fields) or a
       single full-width card (1 field). Both the skeleton and the
       real results are built from this same layout, so they can
       never fall out of sync with each other. */
    const REPORT_LAYOUT = [
      [
        { key: "name", tag: "STARTUP NAME", type: "title" },
        { key: "tagline", tag: "TAGLINE", type: "subtext" },
      ],
      [{ key: "pitch", tag: "ELEVATOR PITCH", type: "paragraph" }],
      [
        { key: "problem", tag: "PROBLEM", type: "paragraph" },
        { key: "solution", tag: "SOLUTION", type: "paragraph" },
      ],
      [
        { key: "audience", tag: "TARGET AUDIENCE", type: "paragraph" },
        { key: "revenue", tag: "REVENUE MODEL", type: "paragraph" },
      ],
      [{ key: "mvpFeatures", tag: "MVP FEATURES", type: "list" }],
      [{ key: "marketing", tag: "MARKETING PLAN", type: "paragraph" }],
      [{ key: "competitors", tag: "COMPETITOR ANALYSIS", type: "paragraph" }],
      [{ key: "techStack", tag: "TECH STACK RECOMMENDATION", type: "paragraph" }],
      [{ key: "checklist", tag: "LAUNCH CHECKLIST", type: "checklist" }],
      [{ key: "nextSteps", tag: "NEXT STEPS", type: "ordered" }],
    ];

    const FIELD_INDEX = {};
    REPORT_LAYOUT.forEach((row) => {
      row.forEach((field) => {
        FIELD_INDEX[field.key] = field;
      });
    });

    // Mock data returned whenever the user generates a report.
    // In a future version this would come from a real API call.
    const MOCK_RESULT = {
      name: "LaunchFlow",
      tagline: "Build Faster. Dream Bigger.",
      pitch:
        "LaunchFlow turns a single paragraph into a validated startup brief in under a minute — giving founders the name, story, and roadmap they need to start real conversations with users, co-founders, and investors before writing a single line of code.",
      problem:
        "Most founders lose momentum at the earliest stage of an idea: they know roughly what they want to build, but naming it, explaining it clearly, and mapping the first steps takes days of scattered notes and stalls before anything ships.",
      solution:
        "LaunchFlow uses a guided AI workflow to convert a rough idea into a structured startup brief — name, pitch, audience, MVP scope, and go-to-market plan — so founders can move from idea to action in one sitting.",
      audience:
        "Early-stage solo founders and small teams (pre-seed to pre-MVP) who have a clear problem in mind but need help structuring it into something they can pitch, build, and test quickly.",
      revenue: [
        "Freemium — unlimited idea generation, paid tier unlocks exports and revision history",
        "Pro subscription ($19/mo) — unlimited briefs, PDF/Markdown export, team sharing",
        "One-time 'Investor Pack' add-on — a polished, pitch-ready export bundle",
      ],
      mvpFeatures: [
        "AI-generated startup brief from a single idea prompt",
        "Editable results with inline regeneration per section",
        "One-click export to PDF and Markdown",
        "Shareable read-only report links",
        "Saved idea history for registered users",
      ],
      marketing: [
        "Launch on Product Hunt and relevant indie-hacker communities",
        "Publish short 'idea to brief in 60 seconds' demo videos",
        "SEO-focused content targeting startup-planning and name-generator keywords",
        "Partner with accelerators to offer a free Pro tier to cohort founders",
        "Build-in-public updates to grow an early waitlist and trust",
      ],
      competitors: [
        {
          label: "Namelix",
          detail: "Strong at logo and name generation, but stops at branding — no strategy, planning, or export tools.",
        },
        {
          label: "Notion AI",
          detail: "Flexible general-purpose writing assistant; founders still have to structure the startup thinking themselves.",
        },
        {
          label: "ChatGPT (general use)",
          detail: "Capable but unstructured — no guided workflow, templates, or exports built specifically for startup planning.",
        },
      ],
      techStack: [
        { label: "Frontend", detail: "HTML, CSS, and vanilla JavaScript for the marketing site; React for the product dashboard." },
        { label: "Backend / API", detail: "Node.js with Express, or a serverless functions layer for the generation endpoint." },
        { label: "Database", detail: "PostgreSQL for structured report data, Redis for caching and rate limits." },
        { label: "AI Layer", detail: "Claude API for generation, with a dedicated prompt template per report section." },
        { label: "Hosting", detail: "Vercel or Render for the app, S3-compatible storage for exported files." },
      ],
      checklist: [
        "Validate the core idea with 10+ target-user conversations",
        "Ship a working MVP covering the 5 core features above",
        "Set up analytics to track activation and export usage",
        "Prepare a one-page pitch using the generated Elevator Pitch",
        "Open a waitlist and share progress publicly before full launch",
      ],
      nextSteps: [
        "Run 5 customer discovery interviews this week to pressure-test the Problem statement",
        "Turn the MVP Features list into a two-week build plan",
        "Draft outreach messages for the Marketing Plan's first two channels",
        "Use the Tech Stack Recommendation to scaffold the project repo",
        "Revisit this brief after your first 10 users and regenerate with real feedback",
      ],
    };

    // How long the skeleton stays visible to simulate a generation delay.
    const SIMULATED_LOAD_MS = 900;

    // Holds the most recently generated report so copy/export actions
    // always work from exactly what's on screen.
    let currentReport = null;

    /* ---------- Text formatting helpers ---------- */

    // Plain-text version of a single field's value, used by that
    // field's individual "Copy" button.
    function fieldToPlainText(field, value) {
      switch (field.type) {
        case "title":
        case "subtext":
        case "paragraph":
          return String(value || "").trim();
        case "list":
          return (value || []).map((item) => `• ${item}`).join("\n");
        case "checklist":
          return (value || []).map((item) => `✓ ${item}`).join("\n");
        case "ordered":
          return (value || []).map((item, index) => `${index + 1}. ${item}`).join("\n");
        case "pairs":
          return (value || []).map((pair) => `${pair.label} — ${pair.detail}`).join("\n");
        default:
          return "";
      }
    }

    // Markdown-formatted body for a single field, used when building
    // the full report for "Copy All" and the Markdown file export.
    function fieldToMarkdownBody(field, value) {
      switch (field.type) {
        case "title":
        case "subtext":
        case "paragraph":
          return String(value || "").trim();
        case "list":
          return (value || []).map((item) => `- ${item}`).join("\n");
        case "checklist":
          return (value || []).map((item) => `- [ ] ${item}`).join("\n");
        case "ordered":
          return (value || []).map((item, index) => `${index + 1}. ${item}`).join("\n");
        case "pairs":
          return (value || []).map((pair) => `- **${pair.label}** — ${pair.detail}`).join("\n");
        default:
          return "";
      }
    }

    function buildFullMarkdown(data) {
      const lines = [`# ${data.name || "Startup"} — DevLaunch Report`];

      if (data.tagline) {
        lines.push(`*${data.tagline}*`);
      }
      lines.push("");

      REPORT_LAYOUT.forEach((row) => {
        row.forEach((field) => {
          // Name and tagline already appear in the title above.
          if (field.key === "name" || field.key === "tagline") return;

          lines.push(`## ${field.tag}`);
          lines.push(fieldToMarkdownBody(field, data[field.key]));
          lines.push("");
        });
      });

      return lines.join("\n").trim() + "\n";
    }

    function slugify(text) {
      const slug = String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-+|-+$)/g, "");
      return slug || "startup";
    }

    /* ---------- DOM builders ---------- */

    function renderFieldBody(field, value) {
      switch (field.type) {
        case "title": {
          const h3 = document.createElement("h3");
          h3.className = "card__value";
          h3.textContent = value || "—";
          return h3;
        }
        case "subtext": {
          const p = document.createElement("p");
          p.className = "card__value card__value--medium";
          p.textContent = value || "—";
          return p;
        }
        case "paragraph": {
          const p = document.createElement("p");
          p.className = "card__body";
          p.textContent = value || "—";
          return p;
        }
        case "list":
        case "checklist": {
          const ul = document.createElement("ul");
          ul.className = field.type === "checklist" ? "feature-list feature-list--checklist" : "feature-list";
          (value || []).forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
          });
          return ul;
        }
        case "ordered": {
          const ol = document.createElement("ol");
          ol.className = "ordered-list";
          (value || []).forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            ol.appendChild(li);
          });
          return ol;
        }
        case "pairs": {
          const wrap = document.createElement("div");
          wrap.className = "pair-list";
          (value || []).forEach((pair) => {
            const item = document.createElement("div");
            item.className = "pair-item";

            const label = document.createElement("span");
            label.className = "pair-item__label";
            label.textContent = pair.label;

            const detail = document.createElement("span");
            detail.className = "pair-item__detail";
            detail.textContent = pair.detail;

            item.appendChild(label);
            item.appendChild(detail);
            wrap.appendChild(item);
          });
          return wrap;
        }
        default:
          return document.createElement("span");
      }
    }

    function buildResultCard(field, value, wide) {
      const article = document.createElement("article");
      article.className = "card card--glass result-card" + (wide ? " card--wide" : "");
      article.id = `card-${field.key}`;

      const head = document.createElement("div");
      head.className = "card__head";

      const tag = document.createElement("span");
      tag.className = "card__tag";
      tag.id = `tag-${field.key}`;
      tag.textContent = `[ ${field.tag} ]`;

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.dataset.copy = field.key;
      copyBtn.setAttribute("aria-label", `Copy ${field.tag.toLowerCase()} to clipboard`);

      const copyIcon = document.createElement("span");
      copyIcon.className = "copy-btn__icon";
      copyIcon.setAttribute("aria-hidden", "true");
      copyIcon.textContent = "⧉";

      const copyLabel = document.createElement("span");
      copyLabel.className = "copy-btn__label";
      copyLabel.textContent = "Copy";

      copyBtn.appendChild(copyIcon);
      copyBtn.appendChild(copyLabel);

      head.appendChild(tag);
      head.appendChild(copyBtn);

      article.setAttribute("aria-labelledby", tag.id);
      article.appendChild(head);
      article.appendChild(renderFieldBody(field, value));

      return article;
    }

    function buildSkeletonCard(wide) {
      const card = document.createElement("div");
      card.className = "card card--glass skeleton-card" + (wide ? " card--wide" : "");

      const tagLine = document.createElement("span");
      tagLine.className = "skeleton-line skeleton-line--tag";
      card.appendChild(tagLine);

      if (wide) {
        for (let i = 0; i < 3; i += 1) {
          const line = document.createElement("span");
          line.className = "skeleton-line skeleton-line--text";
          if (i === 2) line.style.width = "70%";
          card.appendChild(line);
        }
      } else {
        const titleLine = document.createElement("span");
        titleLine.className = "skeleton-line skeleton-line--title";
        card.appendChild(titleLine);
      }

      return card;
    }

    function renderSkeleton() {
      resultsSkeleton.innerHTML = "";
      REPORT_LAYOUT.forEach((row) => {
        if (row.length === 2) {
          const rowEl = document.createElement("div");
          rowEl.className = "manifest__row";
          rowEl.appendChild(buildSkeletonCard(false));
          rowEl.appendChild(buildSkeletonCard(false));
          resultsSkeleton.appendChild(rowEl);
        } else {
          resultsSkeleton.appendChild(buildSkeletonCard(true));
        }
      });
    }

    function renderResults(data) {
      resultsContent.innerHTML = "";
      REPORT_LAYOUT.forEach((row) => {
        if (row.length === 2) {
          const rowEl = document.createElement("div");
          rowEl.className = "manifest__row";
          row.forEach((field) => {
            rowEl.appendChild(buildResultCard(field, data[field.key], false));
          });
          resultsContent.appendChild(rowEl);
        } else {
          const field = row[0];
          resultsContent.appendChild(buildResultCard(field, data[field.key], true));
        }
      });
    }

    /* ---------- Generate flow ---------- */

    function setToolbarEnabled(enabled) {
      [copyAllBtn, exportMarkdownBtn, exportPdfBtn].forEach((btn) => {
        btn.disabled = !enabled;
      });
    }

    generateBtn.addEventListener("click", handleGenerate);

    // Also allow Cmd/Ctrl + Enter inside the textarea to trigger generation
    ideaInput.addEventListener("keydown", (event) => {
      const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
      if (isSubmitCombo) {
        event.preventDefault();
        handleGenerate();
      }
    });

    // Maps the backend's response field names to the shorter internal keys
    // REPORT_LAYOUT/renderResults/copy/export code already use. The API
    // contract (StartupReport) is intentionally more explicit than the
    // frontend's internal names, so this adapter is the single place that
    // bridges the two.
    function adaptApiResponse(apiData) {
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

    function handleGenerate() {
      const idea = ideaInput.value.trim();

      if (idea.length === 0) {
        formMessage.textContent = "Add a quick description of your idea before we generate anything.";
        ideaInput.focus();
        return;
      }

      if (generateBtn.classList.contains("is-loading")) {
        return; // already generating, ignore repeat clicks
      }

      formMessage.textContent = "";
      startLoading();

      // Simulate an API/generation delay so the loading + skeleton states
      // are visible. Swap this for a real request when one exists.
      fetch("https://devlaunch-zuay.onrender.com/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
      },
        body: JSON.stringify({
          idea: idea
      })
    })
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed.");
     }

      finishLoading(adaptApiResponse(data));
  })
    .catch((error) => {
      console.error(error);

      formMessage.textContent = error.message || "Unable to generate your startup report.";

      generateBtn.classList.remove("is-loading");
      generateBtn.disabled = false;
      generateBtn.setAttribute("aria-busy", "false");
  });
    }

    function startLoading() {
      generateBtn.classList.add("is-loading");
      generateBtn.disabled = true;
      generateBtn.setAttribute("aria-busy", "true");
      generateStatus.textContent = "Generating your launch manifest…";

      renderSkeleton();
      setToolbarEnabled(false);

      resultsSection.removeAttribute("hidden");
      resultsSkeleton.hidden = false;
      resultsSkeleton.setAttribute("aria-hidden", "false");
      resultsContent.hidden = true;

      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function finishLoading(data) {
      currentReport = data;

      generateBtn.classList.remove("is-loading");
      generateBtn.disabled = false;
      generateBtn.setAttribute("aria-busy", "false");
      generateStatus.textContent = "Your launch manifest is ready.";

      renderResults(data);

      resultsSkeleton.hidden = true;
      resultsSkeleton.setAttribute("aria-hidden", "true");
      resultsContent.hidden = false;

      // Fade + rise each card in with a slight stagger.
      const cards = resultsContent.querySelectorAll(".result-card");
      cards.forEach((card, index) => {
        window.setTimeout(() => card.classList.add("card--animate"), index * 60);
      });

      setToolbarEnabled(true);

      // Move focus to the results heading so screen reader and keyboard
      // users land where the new content is, without disrupting scroll.
      resultsHeading.focus({ preventScroll: true });
    }

    /* ---------- Copy-to-clipboard ---------- */

    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }

      // Fallback for browsers/contexts without the async Clipboard API
      return new Promise((resolve, reject) => {
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        try {
          document.execCommand("copy");
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          document.body.removeChild(temp);
        }
      });
    }

    function showCopiedState(button) {
      const label = button.querySelector(".copy-btn__label");
      const originalLabel = label ? label.textContent : null;

      button.classList.add("is-copied");
      if (label) label.textContent = "Copied";

      window.setTimeout(() => {
        button.classList.remove("is-copied");
        if (label && originalLabel) label.textContent = originalLabel;
      }, 1600);
    }

    // Event delegation: result cards are rebuilt on every generation, so
    // a single listener on the (static) container is more reliable than
    // re-binding a click handler to each new copy button.
    resultsContent.addEventListener("click", (event) => {
      const button = event.target.closest(".copy-btn");
      if (!button || !currentReport) return;

      const field = FIELD_INDEX[button.dataset.copy];
      if (!field) return;

      const text = fieldToPlainText(field, currentReport[field.key]);
      if (!text) return;

      copyText(text)
        .then(() => {
          showCopiedState(button);
          showToast("Copied!");
        })
        .catch(() => {
          showToast("Couldn't copy — try selecting the text manually.");
        });
    });

    copyAllBtn.addEventListener("click", () => {
      if (!currentReport) return;

      const text = buildFullMarkdown(currentReport);
      copyText(text)
        .then(() => showToast("Copied!"))
        .catch(() => showToast("Couldn't copy — try selecting the text manually."));
    });

    /* ---------- Export: Markdown ---------- */

    function downloadTextFile(text, filename, mimeType) {
      const blob = new Blob([text], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }

    exportMarkdownBtn.addEventListener("click", () => {
      if (!currentReport) return;

      try {
        const markdown = buildFullMarkdown(currentReport);
        downloadTextFile(markdown, `${slugify(currentReport.name)}-startup-report.md`, "text/markdown");
        showToast("Markdown file downloaded.");
      } catch (err) {
        showToast("Couldn't export the file — please try again.");
      }
    });

    /* ---------- Export: PDF (via print) ---------- */

    exportPdfBtn.addEventListener("click", () => {
      if (!currentReport) return;

      const today = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      printMeta.textContent = `${currentReport.name} · Generated ${today}`;

      window.print();
    });
  }

  /* ---------- Scroll-reveal animations ---------- */
  const revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && revealEls.length) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }
});
