/* =========================================================
   DevLaunch — script.js
   Handles: mobile nav toggle, mock "generate" flow
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Mobile menu toggle ---------- */
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  navToggle.addEventListener("click", () => {
    const isOpen = mobileMenu.hasAttribute("hidden") === false;

    if (isOpen) {
      mobileMenu.setAttribute("hidden", "");
      navToggle.setAttribute("aria-expanded", "false");
    } else {
      mobileMenu.removeAttribute("hidden");
      navToggle.setAttribute("aria-expanded", "true");
    }
  });

  // Close mobile menu after a link is tapped
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.setAttribute("hidden", "");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------- Generate flow ---------- */
  const ideaInput = document.getElementById("ideaInput");
  const generateBtn = document.getElementById("generateBtn");
  const formMessage = document.getElementById("formMessage");
  const resultsSection = document.getElementById("results");

  const resultName = document.getElementById("resultName");
  const resultSlogan = document.getElementById("resultSlogan");
  const resultDescription = document.getElementById("resultDescription");
  const resultFeatures = document.getElementById("resultFeatures");

  // Mock data returned whenever the user generates a result.
  // In a future version this would come from a real API call.
  const MOCK_RESULT = {
    name: "LaunchFlow",
    slogan: "Build Faster. Dream Bigger.",
    description:
      "LaunchFlow helps entrepreneurs validate and launch business ideas quickly using AI.",
    features: [
      "AI-generated branding",
      "Business planning",
      "Landing page ideas",
      "Marketing suggestions",
      "Growth roadmap",
    ],
  };

  generateBtn.addEventListener("click", handleGenerate);

  // Also allow Cmd/Ctrl + Enter inside the textarea to trigger generation
  ideaInput.addEventListener("keydown", (event) => {
    const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    if (isSubmitCombo) {
      event.preventDefault();
      handleGenerate();
    }
  });

  function handleGenerate() {
    const idea = ideaInput.value.trim();

    if (idea.length === 0) {
      formMessage.textContent = "Add a quick description of your idea before we generate anything.";
      ideaInput.focus();
      return;
    }

    formMessage.textContent = "";
    populateResults(MOCK_RESULT);
    revealResults();
  }

  function populateResults(data) {
    resultName.textContent = data.name;
    resultSlogan.textContent = data.slogan;
    resultDescription.textContent = data.description;

    // Rebuild the feature list from the mock data
    resultFeatures.innerHTML = "";
    data.features.forEach((feature) => {
      const li = document.createElement("li");
      li.textContent = feature;
      resultFeatures.appendChild(li);
    });
  }

  function revealResults() {
    resultsSection.removeAttribute("hidden");

    // Smoothly scroll the results into view once they're visible
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
