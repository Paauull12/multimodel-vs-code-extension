/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/webviews/chat/client/viewRouter.js":
/*!************************************************!*\
  !*** ./src/webviews/chat/client/viewRouter.js ***!
  \************************************************/
/***/ (() => {

(function () {
  const vscode = acquireVsCodeApi();
  const container = document.getElementById("viewContainer");

  if (!container) {
    return;
  }

  function generateChatContent() {
    return `
        <div class="mess-container">
        <div id="messages" class="messages">
            <div class="welcome-message">
            <svg class="welcome-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <div>How can I help you today?</div>
            </div>
        </div>

        <div class="input-area">

            <div id="attachedFiles" class="attached-files hidden"></div>

            <div class="input-wrapper">
            <input type="file" id="fileInput" multiple accept="*/*">

            <button id="attachButton" class="attach-button" title="Attach files">
                <svg class="attach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14"/>
                <path d="M5 12h14"/>
                </svg>
            </button>

            <textarea 
                id="messageInput"
                placeholder="Ask anything" 
                rows="1"
            ></textarea>

            <button id="sendButton" class="send-button" title="Send message" disabled>
                <svg class="send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
                </svg>
            </button>
            </div>
        </div>
      </div>`;
  }

  function generateSecurityView() {
    return `
          <div class="security-container system-centered">
            <button id="securityStart" class="primary-button">Run Security Audit</button>
            <pre id="securityOutput" class="output-box"></pre>
          </div>
        `;
  }

  function generatePullRequestView() {
    return `
        <div class="pr-review">
            <div class="input-group">
                <label class="label" for="prUrl">Pull Request URL</label>
                <div class="pr-input-row">
                <input id="prUrl" placeholder="Paste URL" class="text-input"/>
                <button id="startPRReview" class="primary-button">Start Review</button>
                </div>
            </div>
            <pre id="prOutput" class="output-box"></pre>
        </div>`;
  }

  function generateCheckRulesView() {
    return `
        <div class="check-rules">

            <div class="input-group">
                <label class="label">Policy File</label>
                <input type="file" id="policyFile" class="text-input" />
            </div>

            <div class="input-group">
                <label class="label">File to analize</label>
                <input type="file" id="codeFile" class="text-input" />
            </div>

            <div class="actions">
                <button id="startRulesCheck" class="primary-button">Run Check</button>
            </div>

            <pre id="rulesOutput" class="output-box"></pre>
        </div>`;
  }

  function render(mode) {
    switch (mode) {
      case "chat":
        container.innerHTML = generateChatContent();
        break;
      case "security":
        container.innerHTML = generateSecurityView();
        break;
      case "pull-request":
        container.innerHTML = generatePullRequestView();
        break;
      case "check-rules":
        container.innerHTML = generateCheckRulesView();
        break;
      default:
        container.innerHTML = generateChatContent();
    }

    attachHandlersForMode(mode);
  }

  function attachHandlersForMode(mode) {
    if (mode === "chat") {
      setupChatHandlers();
    }

    if (mode === "check-rules") {
      document
        .getElementById("startRulesCheck")
        ?.addEventListener("click", () => {
          const code =
            /** @type {HTMLTextAreaElement} */ (
              document.getElementById("codeInput")
            )?.value || "";
          vscode.postMessage({ command: "checkRules", code });
        });
    }

    if (mode === "security") {
      document
        .getElementById("securityStart")
        ?.addEventListener("click", () => {
          vscode.postMessage({ command: "securityAudit" });
        });
    }

    if (mode === "pull-request") {
      document
        .getElementById("startPRReview")
        ?.addEventListener("click", () => {
          const url =
            /** @type {HTMLInputElement} */ (document.getElementById("prUrl"))
              ?.value || "";
          vscode.postMessage({ command: "reviewPullRequest", url });
        });

      window.addEventListener("message", (event) => {
        const { command, output } = event.data;
        if (command === "pullRequestResult") {
          const out = document.getElementById("prOutput");
          if (out) {
            out.textContent = output;
          }
        }
      });
    }

    function setupChatHandlers() {
      const chatMessagesDisplay = document.getElementById("messages");
      const userInput = document.getElementById("messageInput");
      const sendMsgButton = document.getElementById("sendButton");
      const refreshButton = document.getElementById("refreshButton");
      const attachButton = document.getElementById("attachButton");
      const fileInput = document.getElementById("fileInput");
      const attachedFilesContainer = document.getElementById("attachedFiles");

      let attachedFiles = [];

      // Configure marked.js for markdown parsing
      if (typeof marked !== "undefined") {
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: false,
          mangle: false,
        });
      }

      /**
       * Safely escapes HTML characters to prevent XSS.
       */
      function sanitizeHtml(text) {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      /**
       * Creates a message element with modern styling
       */
      function createMessageElement(text, sender, timestamp, isCode) {
        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper ${sender}`;

        // Create avatar
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = sender === "user" ? "U" : "AI";

        // Create content container
        const content = document.createElement("div");
        content.className = "message-content";

        // Create header with sender name and timestamp
        const header = document.createElement("div");
        header.className = "message-header";

        const senderLabel = document.createElement("span");
        senderLabel.className = "message-sender";
        senderLabel.textContent = sender === "user" ? "You" : "Assistant";

        const timeLabel = document.createElement("span");
        timeLabel.className = "message-time";
        timeLabel.textContent = timestamp || "";

        header.appendChild(senderLabel);
        header.appendChild(timeLabel);

        // Create message bubble
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const messageText = document.createElement("div");
        messageText.className = "message-text";

        // Handle different message types
        if (isCode) {
          messageText.innerHTML =
            "<pre><code>" + sanitizeHtml(text) + "</code></pre>";
        } else if (sender === "bot" && typeof marked !== "undefined") {
          messageText.innerHTML = marked.parse(text);
        } else {
          messageText.innerHTML = sanitizeHtml(text).replace(/\n/g, "<br>");
        }

        bubble.appendChild(messageText);
        content.appendChild(header);
        content.appendChild(bubble);

        wrapper.appendChild(avatar);
        wrapper.appendChild(content);

        return wrapper;
      }

      /**
       * Creates a typing indicator for bot responses
       */
      function createTypingIndicator() {
        const wrapper = document.createElement("div");
        wrapper.className = "message-wrapper bot";
        wrapper.id = "typing-indicator";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar bot-avatar";
        avatar.textContent = "AI";

        const content = document.createElement("div");
        content.className = "message-content";

        const indicator = document.createElement("div");
        indicator.className = "typing-indicator";
        indicator.innerHTML =
          '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

        content.appendChild(indicator);
        wrapper.appendChild(avatar);
        wrapper.appendChild(content);

        return wrapper;
      }

      /**
       * Shows typing indicator
       */
      function showTypingIndicator() {
        const existing = document.getElementById("typing-indicator");
        if (existing) {
          return;
        }

        const indicator = createTypingIndicator();
        chatMessagesDisplay.appendChild(indicator);

        chatMessagesDisplay.scrollTo({
          top: chatMessagesDisplay.scrollHeight,
          behavior: "smooth",
        });
      }

      /**
       * Removes typing indicator
       */
      function hideTypingIndicator() {
        const indicator = document.getElementById("typing-indicator");
        if (indicator) {
          indicator.remove();
        }
      }

      /**
       * Creates and appends a new message element to the chat interface.
       */
      function appendMessageToChat(message) {
        const welcomeMessage =
          chatMessagesDisplay.querySelector(".welcome-message");
        if (welcomeMessage) {
          welcomeMessage.remove();
        }

        const messageElement = createMessageElement(
          message.text,
          message.sender,
          message.timestamp,
          message.isCode
        );

        chatMessagesDisplay.appendChild(messageElement);

        setTimeout(() => {
          chatMessagesDisplay.scrollTo({
            top: chatMessagesDisplay.scrollHeight,
            behavior: "smooth",
          });
        }, 10);
      }

      /**
       * Updates the send button state based on input
       */
      function updateSendButtonState() {
        const hasText = userInput.value.trim().length > 0;
        const hasFiles = attachedFiles.length > 0;
        sendMsgButton.disabled = !hasText && !hasFiles;
      }

      /**
       * Renders attached files
       */
      function renderAttachedFiles() {
        if (attachedFiles.length === 0) {
          attachedFilesContainer.classList.add("hidden");
          attachedFilesContainer.innerHTML = "";
          return;
        }

        attachedFilesContainer.classList.remove("hidden");
        attachedFilesContainer.innerHTML = "";

        attachedFiles.forEach((file, index) => {
          const chip = document.createElement("div");
          chip.className = "file-chip";

          const nameSpan = document.createElement("span");
          nameSpan.className = "file-chip-name";
          nameSpan.textContent = file.name;
          nameSpan.title = file.name;

          const removeBtn = document.createElement("button");
          removeBtn.className = "file-chip-remove";
          removeBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          removeBtn.onclick = () => removeFile(index);

          chip.appendChild(nameSpan);
          chip.appendChild(removeBtn);
          attachedFilesContainer.appendChild(chip);
        });
      }

      /**
       * Removes a file from attached files
       */
      function removeFile(index) {
        attachedFiles.splice(index, 1);
        renderAttachedFiles();
        updateSendButtonState();
      }

      /**
       * Handles file selection
       */
      function handleFileSelect(event) {
        const files = Array.from(event.target.files || []);

        files.forEach((file) => {
          // Avoid duplicates
          if (
            !attachedFiles.some(
              (f) => f.name === file.name && f.size === file.size
            )
          ) {
            attachedFiles.push({
              name: file.name,
              size: file.size,
              type: file.type,
            });
          }
        });

        renderAttachedFiles();
        updateSendButtonState();

        // Reset file input
        fileInput.value = "";
      }

      /**
       * Sends user message to the editor extension backend.
       */
      function handleSendMessage() {
        const text = userInput.value.trim();

        if (!text && attachedFiles.length === 0) {
          return;
        }

        // Prepare message data
        const messageData = {
          text: text,
          files: attachedFiles.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
          })),
        };

        // Clear input and reset
        userInput.value = "";
        attachedFiles = [];
        renderAttachedFiles();
        adjustTextareaHeight();
        updateSendButtonState();

        // Post message to the extension backend
        vsCodeApi.postMessage({
          command: "sendMessage",
          text: text,
          files: messageData.files,
        });

        // Disable send button briefly
        sendMsgButton.disabled = true;
        setTimeout(() => {
          updateSendButtonState();
        }, 500);
      }
      /**
       * Refreshes/clears the conversation.
       */
      function handleRefresh() {
        vsCodeApi.postMessage({ command: "clearChat" });
      }

      /**
       * Clears the chat display
       */
      function clearChatDisplay() {
        chatMessagesDisplay.innerHTML = `
                <div class="welcome-message">
                    <svg class="welcome-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    <div>How can I help you today?</div>
                </div>
            `;

        // Clear attached files
        attachedFiles = [];
        renderAttachedFiles();
        updateSendButtonState();
      }

      /**
       * Adjusts textarea height based on content
       */
      function adjustTextareaHeight() {
        userInput.style.height = "auto";
        const newHeight = Math.min(userInput.scrollHeight, 200);
        userInput.style.height = newHeight + "px";
      }

      // Event listeners
      sendMsgButton.addEventListener("click", handleSendMessage);
      refreshButton.addEventListener("click", handleRefresh);
      attachButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", handleFileSelect);

      userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });

      userInput.addEventListener("input", () => {
        adjustTextareaHeight();
        updateSendButtonState();
      });

      // Router for messages received from the editor extension backend
      window.addEventListener("message", (event) => {
        const message = event.data;

        switch (message.command) {
          case "receiveMessage":
            if (message.message.sender === "user") {
              appendMessageToChat(message.message);
              showTypingIndicator();
            } else if (message.message.sender === "bot") {
              hideTypingIndicator();
              appendMessageToChat(message.message);
            }
            break;

          case "clearChat":
            clearChatDisplay();
            break;
        }
      });

      // Initial setup
      adjustTextareaHeight();
      updateSendButtonState();
    }
  }

  // Default view
  render("chat");

  // Dropdown handling for mode switching
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("dropdownMenu");
    const toggle = document.getElementById("dropdownButton");
    const target = e.target;

    if (toggle && toggle.contains(target)) {
      menu?.classList.toggle("hidden");
      return;
    }

    const mode = target?.dataset?.mode;
    if (mode) {
      render(mode);
      menu?.classList.add("hidden");
      return;
    }

    if (menu && !menu.contains(target)) {
      menu.classList.add("hidden");
    }
  });

  document.getElementById("startPRReview")?.addEventListener("click", () => {
    const url = document.getElementById("prUrl").value;
    vscode.postMessage({ command: "reviewPullRequest", url });
  });

  window.addEventListener("message", (event) => {
    const { command, output } = event.data;
    if (command === "pullRequestResult") {
      document.getElementById("prOutput").textContent = output;
    }
  });

  document
    .getElementById("startSecurityAudit")
    ?.addEventListener("click", () => {
      vscode.postMessage({ command: "securityAudit" });
    });

  window.addEventListener("message", (event) => {
    const { command, output } = event.data;
    if (command === "securityAuditResult") {
      document.getElementById("securityOutput").textContent = output;
    }
  });
})();


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!******************************************!*\
  !*** ./src/webviews/chat/client/main.js ***!
  \******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _viewRouter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./viewRouter */ "./src/webviews/chat/client/viewRouter.js");
/* harmony import */ var _viewRouter__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_viewRouter__WEBPACK_IMPORTED_MODULE_0__);


(function() {
    const vsCodeApi = acquireVsCodeApi(); 

    document.addEventListener("click", (e) => {
        const toggle = document.getElementById("dropdownButton");
        const menu = document.getElementById("dropdownMenu");

        if (toggle.contains(e.target)) {
            menu.classList.toggle("hidden");
        } else if (!menu.contains(e.target)) {
            menu.classList.add("hidden");
        }
        });
        
        // Notify the extension that the webview is ready
        vsCodeApi.postMessage({ command: 'webviewReady' }); 

    
})();
})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=webview-main.js.map