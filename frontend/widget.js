/**
 * Embeddable AI chat widget — vanilla JS, no dependencies, no build step.
 *
 * Usage: set window.ChatWidgetConfig before loading this script:
 *   window.ChatWidgetConfig = {
 *     apiUrl: "http://localhost:8000",
 *     businessName: "Bloom & Co Bakery",
 *     primaryColor: "#2563eb",
 *     greeting: "Hi! Ask me anything."
 *   };
 */
(function () {
  "use strict";

  var userConfig = window.ChatWidgetConfig || {};
  var config = {
    apiUrl: userConfig.apiUrl || "http://localhost:8000",
    businessName: userConfig.businessName || "this business",
    primaryColor: userConfig.primaryColor || "#2563eb",
    greeting:
      userConfig.greeting ||
      "Hi there! How can I help you today?"
  };

  var MAX_HISTORY = 20;
  var history = []; // { role: "user" | "assistant", content: string }

  // ---------------------------------------------------------------- styles

  var css = [
    "#cw-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;",
    "background:" + config.primaryColor + ";color:#fff;border:none;cursor:pointer;z-index:99999;",
    "box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:26px;line-height:56px;text-align:center;",
    "transition:transform .15s ease}",
    "#cw-bubble:hover{transform:scale(1.08)}",
    "#cw-window{position:fixed;bottom:92px;right:24px;width:340px;max-width:calc(100vw - 32px);",
    "height:460px;max-height:calc(100vh - 120px);background:#fff;border-radius:12px;z-index:99999;",
    "box-shadow:0 8px 30px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
    "#cw-window.cw-open{display:flex}",
    "#cw-header{background:" + config.primaryColor + ";color:#fff;padding:12px 16px;display:flex;",
    "align-items:center;justify-content:space-between;flex-shrink:0}",
    "#cw-header span{font-weight:600;font-size:15px}",
    "#cw-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 4px;line-height:1}",
    "#cw-messages{flex:1;overflow-y:auto;padding:12px;background:#f8fafc}",
    ".cw-msg{margin:6px 0;padding:9px 12px;border-radius:12px;max-width:82%;font-size:14px;",
    "line-height:1.45;white-space:pre-wrap;word-wrap:break-word}",
    ".cw-msg-user{background:" + config.primaryColor + ";color:#fff;margin-left:auto;border-bottom-right-radius:4px}",
    ".cw-msg-bot{background:#e5e7eb;color:#111827;margin-right:auto;border-bottom-left-radius:4px}",
    ".cw-msg-typing{color:#6b7280;font-style:italic}",
    "#cw-inputbar{display:flex;border-top:1px solid #e5e7eb;flex-shrink:0;background:#fff}",
    "#cw-input{flex:1;border:none;padding:12px;font-size:14px;outline:none;font-family:inherit}",
    "#cw-send{background:" + config.primaryColor + ";color:#fff;border:none;padding:0 18px;",
    "cursor:pointer;font-size:14px;font-weight:600}",
    "#cw-send:disabled{opacity:.6;cursor:default}"
  ].join("");

  var styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // ------------------------------------------------------------------- DOM

  var bubble = document.createElement("button");
  bubble.id = "cw-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.textContent = "💬"; // 💬

  var windowEl = document.createElement("div");
  windowEl.id = "cw-window";
  windowEl.innerHTML =
    '<div id="cw-header">' +
    "<span></span>" +
    '<button id="cw-close" aria-label="Close chat">&times;</button>' +
    "</div>" +
    '<div id="cw-messages"></div>' +
    '<div id="cw-inputbar">' +
    '<input id="cw-input" type="text" placeholder="Type your question..." />' +
    '<button id="cw-send">Send</button>' +
    "</div>";

  document.body.appendChild(bubble);
  document.body.appendChild(windowEl);

  windowEl.querySelector("#cw-header span").textContent = config.businessName;

  var messagesEl = windowEl.querySelector("#cw-messages");
  var inputEl = windowEl.querySelector("#cw-input");
  var sendBtn = windowEl.querySelector("#cw-send");
  var closeBtn = windowEl.querySelector("#cw-close");

  // --------------------------------------------------------------- helpers

  function appendMessage(role, text) {
    var el = document.createElement("div");
    el.className = "cw-msg " + (role === "user" ? "cw-msg-user" : "cw-msg-bot");
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function pushHistory(role, content) {
    history.push({ role: role, content: content });
    if (history.length > MAX_HISTORY) {
      history = history.slice(history.length - MAX_HISTORY);
    }
  }

  function toggleWindow(open) {
    var shouldOpen =
      typeof open === "boolean" ? open : !windowEl.classList.contains("cw-open");
    windowEl.classList.toggle("cw-open", shouldOpen);
    if (shouldOpen) {
      inputEl.focus();
    }
  }

  // ------------------------------------------------------------------ send

  var sending = false;

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || sending) return;

    sending = true;
    sendBtn.disabled = true;
    inputEl.value = "";

    appendMessage("user", text);

    var typingEl = appendMessage("assistant", "typing...");
    typingEl.classList.add("cw-msg-typing");

    fetch(config.apiUrl + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: history,
        business_name: config.businessName
      })
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Request failed with status " + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        typingEl.classList.remove("cw-msg-typing");
        typingEl.textContent = data.reply;
        pushHistory("user", text);
        pushHistory("assistant", data.reply);
      })
      .catch(function (err) {
        console.error("[chat-widget] Failed to get a reply:", err);
        typingEl.classList.remove("cw-msg-typing");
        typingEl.textContent =
          "Sorry, something went wrong on our end. Please try again in a moment.";
      })
      .then(function () {
        sending = false;
        sendBtn.disabled = false;
        inputEl.focus();
      });
  }

  // ---------------------------------------------------------------- events

  bubble.addEventListener("click", function () {
    toggleWindow();
  });
  closeBtn.addEventListener("click", function () {
    toggleWindow(false);
  });
  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  // Initial greeting (display only — not sent to the API as history)
  appendMessage("assistant", config.greeting);
})();
