/**
 * Generates the complete HTML string for the VS Code Webview panel content.
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
    <title>Architecture Chat</title>
    
    <link href="${webviewStyleUri}" rel="stylesheet">
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>

    <script src="${markedJsUri}"></script>
  </head>
  
  <body>
    <div class="chat-container">
    
      <div class="header">
        <h3>Architecture Chat</h3>
        <button id="clearButton" class="clear-button">Clear History</button>
      </div>
      
      <div id="messages" class="messages">
        <div class="welcome-message">How can I help you today?</div>
      </div>
      
      <div class="input-area">
        <input type="text" id="messageInput" placeholder="Type a message...">
        
        <button id="sendButton" class="send-button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
    
    <script src="${webviewScriptUri}"></script>
  </body>
  </html>`;
}
