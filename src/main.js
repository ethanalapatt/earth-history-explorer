import "./layout.css";
import "./civilization.css";
try {
  await import("./civilization.js");
  for (const selector of [
    "#nav-science",
    "#civil-credits",
    "#story-record",
    ".mobile-sources",
  ])
    document.querySelector(selector)?.remove();
  await import("./explorer.js");
  const inspiration = document.createElement("a");
  inspiration.className = "inspiration-credit";
  inspiration.href = "https://earth.ethanplus.ai/civilization.html";
  inspiration.target = "_blank";
  inspiration.rel = "noopener noreferrer";
  inspiration.textContent = "Inspired by earth.ethanplus.ai ↗";
  document.querySelector(".world-shell").append(inspiration);
} catch (error) {
  console.error("Earth could not initialize:", error);
  const fallback = document.createElement("main");
  fallback.style.cssText =
    "position:fixed;inset:0;display:grid;place-content:center;padding:32px;background:#030609;color:#dfdcd4;font:16px Manrope,sans-serif;z-index:100";
  const heading = document.createElement("h1");
  heading.textContent = "Earth could not load.";
  const message = document.createElement("p");
  message.textContent =
    "Try reloading the page. If the globe still does not appear, enable graphics acceleration in your browser.";
  const button = document.createElement("button");
  button.textContent = "Reload Earth";
  button.style.cssText =
    "margin-top:16px;padding:14px 20px;border:1px solid #bda87f;border-radius:4px;color:#e7d5b4;font:inherit";
  button.onclick = () => location.reload();
  fallback.append(heading, message, button);
  document.body.append(fallback);
}
