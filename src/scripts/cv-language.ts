type CvLanguage = "en" | "zh";

const storageKey = "cv-lang";

function readLanguage(): CvLanguage {
  let saved: CvLanguage | null = null;
  try {
    saved = localStorage.getItem(storageKey) as CvLanguage | null;
  } catch {
    return "en";
  }
  return (saved === "en" || saved === "zh" ? saved : undefined) ?? "en";
}

function persistLanguage(language: CvLanguage) {
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Language switching remains available for the current page when storage is disabled.
  }
}

function applyLanguage(language: CvLanguage) {
  document.querySelectorAll<HTMLElement>("[data-lang]").forEach((node) => {
    node.hidden = node.dataset.lang !== language;
  });
  document.documentElement.lang = language === "zh" ? "zh-Hant" : "en";
}

export function initializeCvLanguage() {
  let language = readLanguage();
  applyLanguage(language);

  document.querySelector<HTMLButtonElement>("[data-language-toggle]")?.addEventListener("click", () => {
    language = language === "en" ? "zh" : "en";
    applyLanguage(language);
    persistLanguage(language);
  });
}
