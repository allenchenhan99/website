const darkTheme = "dark";
const lightTheme = "light";

function isDarkTheme() {
  return document.documentElement.dataset.theme === darkTheme;
}

function updateToggle(toggle: HTMLButtonElement, dark: boolean) {
  const nextMode = dark ? "light" : "dark";
  toggle.textContent = dark ? "☀️" : "🌙";
  toggle.setAttribute("aria-label", `Switch to ${nextMode} mode`);
  toggle.title = `Switch to ${nextMode} mode`;
}

function persistTheme(theme: string) {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Theme changes remain available for the current page when storage is disabled.
  }
}

export function initializeThemeToggle() {
  const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!toggle) return;

  updateToggle(toggle, isDarkTheme());
  toggle.addEventListener("click", () => {
    const nextTheme = isDarkTheme() ? lightTheme : darkTheme;
    document.documentElement.dataset.theme = nextTheme;
    persistTheme(nextTheme);
    updateToggle(toggle, nextTheme === darkTheme);
  });
}
