/**
 * Generates the complete HTML string for the VS Code Webview panel content.
 * 
 * @param webviewStyleUri The URI pointing to the bundled CSS stylesheet.
 * @param webviewScriptUri The URI pointing to the bundled JavaScript logic file.
 * @param markedJsUri The URI pointing to the local JavaScript Marked file.
 * @returns A string containing the full HTML document structure.
 */
export function generateWebviewContent(
  webviewStyleUri: string, 
  webviewScriptUri: string,
  markedJsUri: string
): string {
  return `<!DOCTYPE html>
  <html lang="en">
  
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' vscode-resource: https:; script-src 'unsafe-inline' 'unsafe-eval' vscode-resource: https:; img-src vscode-resource: https: data:;">
    <title>Assistant</title>
    
    <link href="${webviewStyleUri}" rel="stylesheet">
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
    <script src="${markedJsUri}"></script>
  </head>
  
  <body>
    <div class="chat-container">
    
      <div class="header">
        <h3>AI Assistant</h3>
        <div class="header-actions">
          <button id="refreshButton" class="icon-button" title="Refresh chat">
            <svg viewBox="0 0 24 24">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
            </svg>
          </button>
        </div>
      </div>
      
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
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          
          <textarea 
            id="messageInput" 
            placeholder="Message AI Assistant..." 
            rows="1"
          ></textarea>
          
          <button id="sendButton" class="send-button" title="Send message" disabled>
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <script src="${webviewScriptUri}"></script>
  </body>
  </html>`;
}
