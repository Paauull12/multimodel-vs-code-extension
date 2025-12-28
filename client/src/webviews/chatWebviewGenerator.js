"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWebviewContent = generateWebviewContent;
/**
 * Generates the complete HTML string for the VS Code Webview panel content.
 *
 * @param webviewStyleUri The URI pointing to the bundled CSS stylesheet.
 * @param webviewScriptUri The URI pointing to the bundled JavaScript logic file.
 * @param markedJsUri The URI pointing to the local JavaScript Marked file.
 * @returns A string containing the full HTML document structure.
 */
function generateWebviewContent(webviewStyleUri, webviewScriptUri, markedJsUri) {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' vscode-resource: https:; script-src 'unsafe-inline' 'unsafe-eval' vscode-resource: https:; img-src vscode-resource: https: data:;">
    <title>Assistant</title>

    <link href="${webviewStyleUri}" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
    <script src="${markedJsUri}"></script>
  </head>

  <body>
    <div class="chat-container">

      <!-- HEADER -->
      <div class="header">

        <div class="header-left">
          <div class="dropdown">
            <button id="dropdownButton" class="dropdown-toggle" data-mode="chat">
              Choose agent
              <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <div class="dropdown-menu hidden" id="dropdownMenu">
              <button class="dropdown-item" data-mode="chat">Main chat</button>
              <button class="dropdown-item" data-mode="security">Security</button>
              <button class="dropdown-item" data-mode="check-rules">Check rules</button>
              <button class="dropdown-item" data-mode="pull-request">Pull request</button>
              <button class="dropdown-item" data-mode="company-rules">Company rules</button>
            </div>
          </div>
        </div>

        <div class="header-right">
          <button id="refreshButton" class="refresh-button" title="Clear chat">
            <svg viewBox="0 0 24 24"> <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/> </svg>
          </button>
        </div>
      </div>

      <div id="viewContainer"></div>
    
    </div>

    <script src="${webviewScriptUri}"></script> 
  </body>
  </html>`;
}
//# sourceMappingURL=chatWebviewGenerator.js.map