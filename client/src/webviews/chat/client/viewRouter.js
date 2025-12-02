(function () {
  const vscode = acquireVsCodeApi();
  const container = document.getElementById("viewContainer");

  function sanitizeHtml(text) {
    if (text === undefined || text === null){
      return "";
    } 
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

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

        <div class="check-rules-card">
          <h3 class="check-rules-title">Document Compliance Check</h3>
          <p class="check-rules-subtitle">
            Upload the requiered files. The analyzer will check how well the code complies.
          </p>

          <div class="input-group">
            <label class="label">Rules Document</label>
            <div class="file-input-row">
              <button type="button" id="policyFileButton" class="file-button">
                Choose file…
              </button>
              <span id="policyFileName" class="file-name">No file selected</span>
              <input type="file" id="policyFile" class="file-input-hidden" />
            </div>
          </div>

          <div class="input-group">
            <label class="label">Code File</label>
            <div class="file-input-row">
              <button type="button" id="codeFileButton" class="file-button">
                Choose file…
              </button>
              <span id="codeFileName" class="file-name">No file selected</span>
              <input type="file" id="codeFile" class="file-input-hidden" />
            </div>
          </div>

          <div class="actions">
            <button id="startRulesCheck" class="primary-button">Run Check</button>
          </div>
        </div>

        <div id="rulesOutput" class="rules-output">
          <div class="rules-placeholder">
            Upload files and click <strong>Run Check</strong> to see the compliance report.
          </div>
        </div>
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
      setUpChcekRulesHandlers();
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

    async function fileToBase64(file) {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
    }

    function setUpChcekRulesHandlers(){
      const policyFileInput = document.getElementById("policyFile");
      const codeFileInput = document.getElementById("codeFile");
      const policyFileButton = document.getElementById("policyFileButton");
      const codeFileButton = document.getElementById("codeFileButton");
      const policyFileName = document.getElementById("policyFileName");
      const codeFileName = document.getElementById("codeFileName");

      policyFileButton?.addEventListener("click", () => policyFileInput?.click());
      codeFileButton?.addEventListener("click", () => codeFileInput?.click());

      policyFileInput?.addEventListener("change", () => {
        const file = policyFileInput.files?.[0];
        policyFileName.textContent = file ? file.name : "No file selected";
      });

      codeFileInput?.addEventListener("change", () => {
        const file = codeFileInput.files?.[0];
        codeFileName.textContent = file ? file.name : "No file selected";
      });

      document
        .getElementById("startRulesCheck")?.addEventListener("click", async () => {
          const policyFile = policyFileInput?.files?.[0];
          const codeFile = codeFileInput?.files?.[0];

          if (!policyFile || !codeFile) {
              renderRulesResult({
                compliant: false,
                summary: "Please upload both a policy/design document and a code file.",
                violations: [],
                missing_implementations: []
              });
              return;
          }

          renderRulesLoading();

          // Read file contents into base64
          const [policyBase64, codeBase64] = await Promise.all([
            fileToBase64(policyFile),
            fileToBase64(codeFile)
          ]);

          vscode.postMessage({
              command: "checkRules",
              policy: {
                  name: policyFile.name,
                  content: policyBase64
              },
              code: {
                  name: codeFile.name,
                  content: codeBase64
              }
          });
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
        vscode.postMessage({
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
        vscode.postMessage({ command: "clearChat" });
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


  function renderIssueSection(title, items, keyField) {
    if (!items || !items.length) {
      return `
        <div class="rules-section">
          <h3>${title}</h3>
          <p class="empty">None</p>
        </div>
      `;
    }

    const cards = items
      .map((item, idx) => {
        const mainTitle = item[keyField] || `${title} #${idx + 1}`;
        return `
          <details class="issue-card" ${idx === 0 ? "open" : ""}>
            <summary>
              <span class="issue-title">${sanitizeHtml(mainTitle)}</span>
              <span class="issue-pill">#${idx + 1}</span>
            </summary>
            <div class="issue-body">
              ${item.description ? `
                <div class="issue-block">
                  <h4>Description</h4>
                  <p>${sanitizeHtml(item.description)}</p>
                </div>` : ""
              }
              ${item.reason ? `
                <div class="issue-block">
                  <h4>Reason</h4>
                  <p>${sanitizeHtml(item.reason)}</p>
                </div>` : ""
              }
              ${item.code_section ? `
                <div class="issue-block">
                  <h4>Code section</h4>
                  <pre><code>${sanitizeHtml(item.code_section)}</code></pre>
                </div>` : ""
              }
              ${item.fix ? `
                <div class="issue-block fix">
                  <h4>Fix</h4>
                  <p>${sanitizeHtml(item.fix)}</p>
                </div>` : ""
              }
            </div>
          </details>
        `;
      })
      .join("");

    return `
      <div class="rules-section">
        <h3>${title}</h3>
        ${cards}
      </div>
    `;
  }

  function renderRulesLoading() {
    const container = document.getElementById("rulesOutput");
    if (!container){
      return;
    } 
    container.innerHTML = `
      <div class="rules-loading">
        <div class="spinner"></div>
        <div>Analyzing compliance…</div>
      </div>
    `;
  }

  function renderRulesResult(result) {
      const container = document.getElementById("rulesOutput");
      if (!container){
        return;
      } 

      if (!result) {
        container.innerHTML = 
        `<div class="rules-error">
          ⚠️ No result received from backend. <br>
          Please try again.
        </div>`;
        return;
      }

      if (typeof result === "string") {
        container.innerHTML = `
          <div class="rules-error">
            ⚠️ Something went wrong.<br>
            Please try again.<br>
            <span class="rules-error-detail">${sanitizeHtml(result)}</span>
          </div>
        `;
        return;
      }

      if (
        !result ||
        typeof result !== "object" ||
        !("compliant" in result) ||
        !("violations" in result) ||
        !("missing_implementations" in result)
      ) {
        container.innerHTML = `
          <div class="rules-error">
            ⚠️ Invalid response received.<br>
            Please try again.
          </div>
        `;
        return;
      }

      if (!result.summary || typeof result.summary !== "string") {
        container.innerHTML = `
          <div class="rules-error">
            ⚠️ The analysis completed, but no summary was generated.<br>
            Please try again.
          </div>
        `;
        return;
      }

      if(result.summary === "Please upload both a policy/design document and a code file."){
        container.innerHTML = `
          <div class="rules-error">
            ${result.summary}
          </div>
        `;
        return;
      }
      const compliant = !!result.compliant;
      const violations = result.violations || [];
      const missing = result.missing_implementations || [];
      const summary = result.summary || "No summary provided.";

      const totalIssues = violations.length + missing.length;
      let score = compliant ? 100 : Math.max(0, 100 - totalIssues * 15);
      if (score < 0){
        score = 0;
      }
      if (score > 100) { 
        score = 100;
      }

      let parsedSummary = summary;
      // try {
      //     parsedSummary = marked?.parse(summary) || sanitize(summary);
      // } catch {
      //     parsedSummary = sanitize(summary);
      // }

      container.innerHTML = `
        <div class="rules-header ${compliant ? "ok" : "fail"}">
          <div class="rules-header-main">
            <span class="badge ${compliant ? "badge-success" : "badge-danger"}">
              ${compliant ? "Compliant ✅" : "Non-compliant ❌"}
            </span>
            <span class="issues-count">
              ${totalIssues === 0 ? "No issues detected" : `${totalIssues} issue(s) detected`}
            </span>
          </div>

          <div class="score">
            <div class="score-label">
              Compliance score: <strong>${score}%</strong>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill" style="width: ${score}%;"></div>
            </div>
          </div>
        </div>

        <div class="rules-summary markdown-body">
          ${parsedSummary}
        </div>

        <div class="rules-sections">
          ${renderIssueSection("Violations", violations, "rule")}
          ${renderIssueSection("Missing implementations", missing, "requirement")}
        </div>
      `;
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

  document
    .getElementById("startSecurityAudit")
    ?.addEventListener("click", () => {
      vscode.postMessage({ command: "securityAudit" });
    });


  window.addEventListener("message", (event) => {
      console.log("MESSAGE RECEIVED IN WEBVIEW:", event.data);
      const { command, result } = event.data;

      if (command === "rulesCheckResult") {
        renderRulesResult(result);
      }

      if (command === "securityAuditResult") {
        document.getElementById("securityOutput").textContent = result;
      }

      if (command === "pullRequestResult") {
        document.getElementById("prOutput").textContent = result;
      }
  });

})();
