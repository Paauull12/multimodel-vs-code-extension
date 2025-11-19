// Access the editor API bridge for communication
const vsCodeApi = acquireVsCodeApi(); 

const chatMessagesDisplay = document.getElementById('messages');
const userInput = document.getElementById('messageInput');
const sendMsgButton = document.getElementById('sendButton');
const clearHistoryButton = document.getElementById('clearButton');

// Notify the extension that the webview is ready
vsCodeApi.postMessage({ command: 'webviewReady' }); 

/** 
 * Sends user message to the editor extension backend. 
 */
function handleSendMessage() { 
    const text = userInput.value;
    if (text.trim() === '') {
        return;
    }
    
    // Post message to the extension backend
    vsCodeApi.postMessage({ command: 'sendMessage', text });
    userInput.value = '';
}

/** 
 * Sends command to clear the conversation history. 
 */
function handleClearHistory() { 
    vsCodeApi.postMessage({ command: 'clearChat' });
}

/** 
 * Safely escapes HTML characters to prevent XSS. 
 */
function sanitizeHtml(text) { 
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

/** 
 * Creates and appends a new message element to the chat interface. 
 * @param message The message object containing text, sender, and metadata.
 */
function appendMessageToChat(message) { 
    const messageElement = document.createElement('div');
    messageElement.className = 'message ' + message.sender;
    
    // Check for code and markdown rendering
    if (message.isCode) {
        // Render raw code, ensuring inner HTML is sanitized
        messageElement.innerHTML = '<pre><code>' + sanitizeHtml(message.text) + '</code></pre>';
    } else if (message.sender === 'bot') {
        // Render bot message
        messageElement.innerHTML = marked.parse(message.text);
    } else {
        // Render user text, sanitizing content
        messageElement.innerHTML = sanitizeHtml(message.text).replace(/\n/g, '<br>');
    }
    
    const timestampEl = document.createElement('div');
    timestampEl.className = 'time-stamp';
    timestampEl.textContent = message.timestamp || '';
    messageElement.appendChild(timestampEl);
    
    chatMessagesDisplay.appendChild(messageElement);
    
    // Auto-scroll to the bottom
    chatMessagesDisplay.scrollTop = chatMessagesDisplay.scrollHeight;
}

sendMsgButton.addEventListener('click', handleSendMessage);
clearHistoryButton.addEventListener('click', handleClearHistory);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
});

// Router for messages received from the editor extension backend
window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command === 'receiveMessage') {
        appendMessageToChat(message.message);
    } else if (message.command === 'clearChat') {
        chatMessagesDisplay.innerHTML = 
            '<div class="welcome-message">How can I help you today?</div>';
    }
});
