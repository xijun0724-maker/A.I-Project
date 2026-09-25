// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Store } from "../../src/core/store.js";

describe("Chrome Profile Popover", () => {
  beforeEach(() => {
    Store.resetAll();
    document.body.innerHTML = `
      <div class="sidebar">
        <div class="sb-footer">
          <button class="sb-profile" id="btnProfile" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">
            <div class="sb-avatar">U</div>
            <span class="sb-username">User</span>
          </button>
          <div class="sb-profile-dropdown" id="profileDropdown" role="menu">
            <div class="sb-dropdown-user">
              <div class="sb-avatar">U</div>
              <span class="sb-user-name sb-username">User</span>
            </div>
            <button class="sb-dropdown-item" role="menuitem" data-act="nav" data-arg="settings">Settings</button>
            <button class="sb-dropdown-item" role="menuitem" data-act="nav" data-arg="settings" data-sub="developer">Developer</button>
            <button class="sb-dropdown-item" role="menuitem" data-act="nav" data-arg="help">Help</button>
            <button class="sb-dropdown-item" role="menuitem" id="btnThemeToggle">Dark mode</button>
            <button class="sb-dropdown-item" role="menuitem" id="btnLogout" data-act="nav" data-arg="settings">Log out</button>
          </div>
        </div>
      </div>
    `;
  });

  it("toggles the profile dropdown and updates aria-expanded", async () => {
    const { initChrome } = await import("../../src/app/chrome.js");
    initChrome();

    const btn = document.querySelector("#btnProfile");
    const dropdown = document.querySelector("#profileDropdown");

    expect(dropdown.classList.contains("open")).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("false");

    btn.click();
    expect(dropdown.classList.contains("open")).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    btn.click();
    expect(dropdown.classList.contains("open")).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes dropdown when clicking outside or clicking an item", async () => {
    const { initChrome } = await import("../../src/app/chrome.js");
    initChrome();

    const btn = document.querySelector("#btnProfile");
    const dropdown = document.querySelector("#profileDropdown");

    btn.click();
    expect(dropdown.classList.contains("open")).toBe(true);

    document.body.click();
    expect(dropdown.classList.contains("open")).toBe(false);

    btn.click();
    expect(dropdown.classList.contains("open")).toBe(true);

    const settingsItem = dropdown.querySelector('[data-arg="settings"]');
    settingsItem.click();
    expect(dropdown.classList.contains("open")).toBe(false);
  });

  it("syncs user name and avatar initials across all profile elements", async () => {
    const { initChrome } = await import("../../src/app/chrome.js");
    initChrome();

    const usernames = document.querySelectorAll(".sb-username");
    const avatars = document.querySelectorAll(".sb-avatar");

    expect(usernames[0].textContent).toBe("User");
    expect(usernames[1].textContent).toBe("User");
    expect(avatars[0].textContent).toBe("U");
    expect(avatars[1].textContent).toBe("U");

    Store.db.settings.userName = "Alex Rivera";
    Store.saveNow();

    expect(usernames[0].textContent).toBe("Alex Rivera");
    expect(usernames[1].textContent).toBe("Alex Rivera");
    expect(avatars[0].textContent).toBe("AR");
    expect(avatars[1].textContent).toBe("AR");
  });
});
