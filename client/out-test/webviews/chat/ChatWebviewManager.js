"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const chatWebviewGenerator_1 = require("../chatWebviewGenerator");
const axios_1 = __importDefault(require("axios"));
class ChatViewProvider {
    _extensionUri;
    static viewType = 'analyzer.chatView';
    _view;
    _currentThreadId;
    _pollingInterval;
    _apiBaseUrl;
    _lastDisplayedMessageId = null;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        const config = vscode.workspace.getConfiguration('analyzer');
        this._apiBaseUrl = config.get('apiBaseUrl', 'http://localhost:8000/mock');
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'out'),
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'src'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static')
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'webviewReady':
                    console.log('Webview is ready');
                    break;
                case 'sendMessage':
                    this._handleUserMessage(message.text, message.files);
                    break;
                case 'clearChat':
                    this._clearChat();
                    break;
                case 'securityAudit':
                    this._runSecurityAudit();
                    break;
                case 'reviewPullRequest':
                    this._reviewPullRequest(message.url);
                    break;
                case 'checkRules':
                    this._checkRules(message.code);
                    break;
                default:
                    console.warn("Unknown command from webview:", message);
            }
        });
        webviewView.onDidDispose(() => {
            this._stopPolling();
        });
    }
    async _handleUserMessage(text, files) {
        if (!this._view) {
            return;
        }
        this._view.webview.postMessage({
            command: 'receiveMessage',
            message: {
                text: text,
                sender: 'user',
                timestamp: new Date().toLocaleTimeString()
            }
        });
        try {
            // Get authentication token 
            const token = await this._getAuthToken();
            // Send message to backend
            const response = await axios_1.default.post(`${this._apiBaseUrl}/chat/send/`, {
                message: text,
                thread_id: this._currentThreadId || null
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Token ${token}` })
                }
            });
            // Store thread ID for future messages
            this._currentThreadId = response.data.thread_id;
            // If files are attached, upload them immediately before starting to poll
            if (files && files.length > 0) {
                await this._uploadFiles(files);
            }
            else {
                // Only start polling if no files to upload
                this._startPolling();
            }
        }
        catch (error) {
            console.error('Error sending message:', error);
            this._stopPolling();
            this._view.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: `Error: ${error.response?.data?.error || error.message || 'Failed to send message'}`,
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString(),
                    isError: true
                }
            });
        }
    }
    _startPolling() {
        // Clear existing polling
        this._stopPolling();
        // Poll every 1 second
        this._pollingInterval = setInterval(async () => {
            if (!this._currentThreadId) {
                return;
            }
            try {
                const token = await this._getAuthToken();
                const response = await axios_1.default.get(`${this._apiBaseUrl}/chat/poll/${this._currentThreadId}/`, {
                    headers: {
                        ...(token && { 'Authorization': `Token ${token}` })
                    }
                });
                const data = response.data;
                // Check if conversation is complete
                if (data.status === 'completed' || data.status === 'failed') {
                    this._stopPolling();
                }
                // Stop polling if waiting for user input (e.g., file upload request)
                if (data.status === 'running' &&
                    data.latest_message?.metadata?.target === 'request_files') {
                    console.log('Waiting for files, stopping polling');
                    this._stopPolling();
                }
                // Display latest message if it's from the bot
                if (data.latest_message && data.latest_message.sender !== 'user') {
                    // Create a unique ID for this message (use message id or content hash)
                    const messageId = data.latest_message.id ||
                        JSON.stringify(data.latest_message.content);
                    // Only display if it's a new message
                    if (messageId !== this._lastDisplayedMessageId) {
                        console.log('New message detected, displaying');
                        this._lastDisplayedMessageId = messageId;
                        this._displayBotMessage(data.latest_message);
                    }
                    else {
                        console.log('Message already displayed, skipping');
                    }
                }
            }
            catch (error) {
                console.error('Polling error:', error);
                // Stop polling on error
                this._stopPolling();
            }
        }, 1000);
    }
    _stopPolling() {
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = undefined;
        }
    }
    _displayBotMessage(messageData) {
        if (!this._view) {
            return;
        }
        let text = messageData.content || '';
        // Handle code files if present
        if (messageData.files && messageData.files.length > 0) {
            text += '\n\n**Generated Files:**\n';
            messageData.files.forEach((file) => {
                text += `\n**${file.name}**\n\`\`\`\n${file.content}\n\`\`\`\n`;
            });
        }
        // Handle summary if present
        // if (messageData.summary) {
        //     text += JSON.stringify(messageData.summary, null, 2);
        // }
        this._view.webview.postMessage({
            command: 'receiveMessage',
            message: {
                text: text,
                sender: 'bot',
                timestamp: new Date(messageData.timestamp).toLocaleTimeString(),
                metadata: messageData.metadata
            }
        });
    }
    async _uploadFiles(files) {
        if (!this._currentThreadId || !this._view) {
            return;
        }
        try {
            const token = await this._getAuthToken();
            const fileContents = files.map(file => {
                let content = '';
                if (file.content) {
                    // Remove data URL prefix (e.g., "data:text/plain;base64,...")
                    const base64Match = file.content.match(/^data:.*?;base64,(.*)$/);
                    if (base64Match) {
                        // Decode base64 to text
                        try {
                            content = Buffer.from(base64Match[1], 'base64').toString('utf-8');
                        }
                        catch (e) {
                            console.error('Error decoding base64 for file:', file.name, e);
                            content = file.content; // Fallback to raw content
                        }
                    }
                    else {
                        // If not base64, use as-is
                        content = file.content;
                    }
                }
                return {
                    name: file.name,
                    content: content
                };
            });
            const validFiles = fileContents.filter(f => f !== null);
            if (validFiles.length === 0) {
                return;
            }
            const response = await axios_1.default.post(`${this._apiBaseUrl}/chat/upload/${this._currentThreadId}/`, {
                files: validFiles
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Token ${token}` })
                }
            });
            console.log('Files uploaded successfully:', response.data);
            this._startPolling();
        }
        catch (error) {
            console.error('Error uploading files:', error);
            this._view?.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: `Error uploading files: ${error.response?.data?.error || error.message}`,
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString(),
                    isError: true
                }
            });
        }
    }
    async _getAuthToken() {
        const config = vscode.workspace.getConfiguration('analyzer');
        let token = config.get('authToken');
        return token || "6808865f7e71f08bf114082b52c86dd17d583610";
    }
    _clearChat() {
        if (!this._view) {
            return;
        }
        // Clear thread ID and stop polling
        this._currentThreadId = undefined;
        this._lastDisplayedMessageId = null;
        this._stopPolling();
        this._view.webview.postMessage({
            command: 'clearChat'
        });
    }
    _getHtmlForWebview(webview) {
        const stylePaths = [
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static', 'styles', 'webview.css'),
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webviews', 'static', 'styles', 'webview.css'),
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css')
        ];
        const styleUri = webview.asWebviewUri(stylePaths[0]);
        const scriptPaths = [
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-main.js'),
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webviews', 'chat', 'client', 'main.js'),
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'chat', 'client', 'main.js')
        ];
        const scriptUri = webview.asWebviewUri(scriptPaths[0]);
        const markedUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static', 'assets', 'marked.min.js'));
        // Main script (chat logic)
        const mainScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "chat", "client", "main.js"));
        // Router script (view switching)
        const routerScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "chat", "client", "viewRouter.js"));
        console.log('CSS URI:', styleUri.toString());
        console.log('Script URI:', scriptUri.toString());
        console.log('Marked URI:', markedUri.toString());
        return (0, chatWebviewGenerator_1.generateWebviewContent)(styleUri.toString(), mainScriptUri.toString(), markedUri.toString()).replace("</body>", `  <script src="${routerScriptUri}"></script>\n</body>`);
    }
    _runSecurityAudit() {
        vscode.window.showInformationMessage("Running Security Audit...");
        // TODO: implement logic
        this._view?.webview.postMessage({
            command: "securityAuditResult",
            output: "Security audit results will appear here."
        });
    }
    _reviewPullRequest(url) {
        vscode.window.showInformationMessage("Reviewing PR: " + url);
        // TODO: implement logic
        this._view?.webview.postMessage({
            command: "pullRequestResult",
            output: `Pull request review for: ${url}`
        });
    }
    _checkRules(code) {
        vscode.window.showInformationMessage("Checking rules...");
        // TODO: implement logic
        this._view?.webview.postMessage({
            command: "rulesCheckResult",
            output: `Rules check complete for:\n\n${code}`
        });
    }
}
exports.ChatViewProvider = ChatViewProvider;
//# sourceMappingURL=ChatWebviewManager.js.map