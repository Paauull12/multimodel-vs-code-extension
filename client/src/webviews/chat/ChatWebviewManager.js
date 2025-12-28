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
const form_data_1 = __importDefault(require("form-data"));
const chatWebviewGenerator_1 = require("../chatWebviewGenerator");
const axios_1 = __importDefault(require("axios"));
const path = __importStar(require("path"));
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
                case 'approveFileRequest':
                    this._handleFileRequestApproval(message.files);
                    break;
                case 'denyFileRequest':
                    this._handleFileRequestDenial();
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
                case 'getCompanyDocuments':
                    this._fetchCompanyDocuments();
                    break;
                case 'checkCompanyRules':
                    this._checkCompanyRules(message.code);
                    break;
                default:
                    console.warn("Unknown command from webview:", message);
            }
        });
        webviewView.onDidDispose(() => {
            this._stopPolling();
        });
    }
    async _fetchCompanyDocuments() {
        const token = await this._getAuthToken();
        const response = await axios_1.default.get(`http://127.0.0.1:8000/api/list/`, {
            headers: { 'Authorization': `Token ${token}` }
        });
        // Trimitem lista înapoi la webview
        this._view?.webview.postMessage({ command: 'companyDocumentsList', docs: response.data });
    }
    async _checkCompanyRules(code) {
        try {
            const token = await this._getAuthToken();
            const response = await axios_1.default.post(`http://127.0.0.1:8000/file/check-company-compliance/`, { code: code }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                }
            });
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                result: response.data
            });
        }
        catch (err) {
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                result: err.response?.data?.error || err.message
            });
        }
    }
    async _handleUserMessage(text, files) {
        if (!this._view) {
            return;
        }
        try {
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
                // Start polling for bot response
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
                console.log('TOKEN:', token);
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
                // Check if bot is requesting files
                if (data.latest_message?.metadata?.target === 'request_files') {
                    console.log('Bot requesting files, stopping polling');
                    this._stopPolling();
                    await this._handleFileRequest(data.latest_message);
                    return;
                }
                // Display latest message if it's from the bot
                if (data.latest_message && data.latest_message.sender !== 'user') {
                    const messageId = data.latest_message.id ||
                        JSON.stringify(data.latest_message.content);
                    if (messageId !== this._lastDisplayedMessageId) {
                        console.log('New message detected, displaying');
                        this._lastDisplayedMessageId = messageId;
                        this._displayBotMessage(data.latest_message);
                    }
                }
            }
            catch (error) {
                console.error('Polling error:', error);
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
    async _handleFileRequest(messageData) {
        if (!this._view) {
            return;
        }
        const requestedFiles = messageData.metadata?.requested_files || [];
        const message = messageData.content || 'The assistant is requesting access to the following files:';
        console.log('File request received:', requestedFiles);
        // Resolve full paths for the requested files
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this._view.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: 'Error: No workspace folder open. Please open a folder or workspace.',
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString(),
                    isError: true
                }
            });
            return;
        }
        // Check which files exist and prepare file info
        const fileInfoPromises = requestedFiles.map(async (filePath) => {
            try {
                // Remove leading slash if present for proper path joining
                const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
                const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, cleanPath);
                // Check if file exists
                try {
                    const stat = await vscode.workspace.fs.stat(fullPath);
                    return {
                        path: filePath,
                        fullPath: fullPath.fsPath,
                        exists: true,
                        size: stat.size
                    };
                }
                catch {
                    return {
                        path: filePath,
                        fullPath: fullPath.fsPath,
                        exists: false,
                        size: 0
                    };
                }
            }
            catch (error) {
                console.error('Error checking file:', filePath, error);
                return {
                    path: filePath,
                    fullPath: '',
                    exists: false,
                    size: 0
                };
            }
        });
        const fileInfos = await Promise.all(fileInfoPromises);
        // Send file request to webview for user approval
        this._view.webview.postMessage({
            command: 'fileRequest',
            message: message,
            files: fileInfos,
            timestamp: new Date().toLocaleTimeString()
        });
    }
    async _handleFileRequestApproval(approvedFiles) {
        if (!this._view || !this._currentThreadId) {
            return;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }
        try {
            // Read file contents
            const fileContents = await Promise.all(approvedFiles.map(async (filePath) => {
                try {
                    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
                    const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, cleanPath);
                    const fileData = await vscode.workspace.fs.readFile(fullPath);
                    const content = Buffer.from(fileData).toString('utf-8');
                    return {
                        name: path.basename(filePath),
                        path: filePath,
                        content: content
                    };
                }
                catch (error) {
                    console.error('Error reading file:', filePath, error);
                    return null;
                }
            }));
            const validFiles = fileContents.filter(f => f !== null);
            if (validFiles.length > 0) {
                // Upload approved files
                await this._uploadFiles(validFiles);
                // Show confirmation message
                this._view.webview.postMessage({
                    command: 'receiveMessage',
                    message: {
                        text: `✓ Sent ${validFiles.length} file(s) to the assistant.`,
                        sender: 'bot',
                        timestamp: new Date().toLocaleTimeString()
                    }
                });
            }
        }
        catch (error) {
            console.error('Error handling file request approval:', error);
            this._view.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: `Error reading files: ${error.message}`,
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString(),
                    isError: true
                }
            });
        }
    }
    async _handleFileRequestDenial() {
        if (!this._view || !this._currentThreadId) {
            return;
        }
        try {
            const token = await this._getAuthToken();
            // Send denial to backend
            await axios_1.default.post(`${this._apiBaseUrl}/chat/send/`, {
                message: "I cannot provide those files.",
                thread_id: this._currentThreadId
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Token ${token}` })
                }
            });
            // Show confirmation
            this._view.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: 'File request denied.',
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString()
                }
            });
            // Resume polling
            this._startPolling();
        }
        catch (error) {
            console.error('Error handling file request denial:', error);
        }
    }
    _displayBotMessage(messageData) {
        if (!this._view) {
            return;
        }
        let text = messageData.content || '';
        let files = [];
        // Handle code files if present
        if (messageData.files && messageData.files.length > 0) {
            files = messageData.files;
        }
        this._view.webview.postMessage({
            command: 'receiveMessage',
            message: {
                text: text,
                sender: 'bot',
                timestamp: new Date(messageData.timestamp).toLocaleTimeString(),
                metadata: messageData.metadata,
                files: files
            }
        });
    }
    async _uploadFiles(files) {
        if (!this._currentThreadId || !this._view) {
            return;
        }
        try {
            const token = await this._getAuthToken();
            // Process each file to ensure proper format
            const processedFiles = files.map(file => {
                let content = '';
                // Handle different input formats
                if (typeof file === 'string') {
                    console.warn('File is a string, skipping:', file);
                    return null;
                }
                if (file.content) {
                    // Check if content is base64 encoded (from file upload)
                    const base64Match = file.content.match(/^data:.*?;base64,(.*)$/);
                    if (base64Match) {
                        try {
                            content = Buffer.from(base64Match[1], 'base64').toString('utf-8');
                        }
                        catch (e) {
                            console.error('Error decoding base64 for file:', file.name, e);
                            content = file.content;
                        }
                    }
                    else {
                        // Content is already plain text
                        content = file.content;
                    }
                }
                else {
                    console.warn('File has no content:', file);
                }
                // Return simple object format expected by backend
                return {
                    name: file.name || 'unnamed',
                    path: file.path || file.name || 'unnamed',
                    content: content
                };
            });
            const validFiles = processedFiles.filter(f => f !== null && f !== undefined);
            if (validFiles.length === 0) {
                console.warn('No valid files to upload');
                return;
            }
            console.log('Uploading files:', validFiles.map(f => f.name || f.path));
            // Backend expects: {"files": [{name, path, content}, ...]}
            const response = await axios_1.default.post(`${this._apiBaseUrl}/chat/upload/${this._currentThreadId}/`, {
                files: validFiles // Wrap in object with 'files' key
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Token ${token}` })
                }
            });
            console.log('Files uploaded successfully:', response.data);
            // Resume polling after upload
            this._startPolling();
        }
        catch (error) {
            console.error('Error uploading files:', error);
            console.error('Error details:', error.response?.data);
            this._view?.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: `Error uploading files: ${error.response?.data?.error || error.response?.data?.detail || error.message}`,
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
        return token || "324ed2e3795db52aea7ed3828196e5af5493140e";
    }
    _clearChat() {
        if (!this._view) {
            return;
        }
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
        const markedUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static', 'assets', 'marked.min.js'));
        const mainScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "chat", "client", "main.js"));
        const routerScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "chat", "client", "viewRouter.js"));
        return (0, chatWebviewGenerator_1.generateWebviewContent)(styleUri.toString(), mainScriptUri.toString(), markedUri.toString()).replace("</body>", `  <script src="${routerScriptUri}"></script>\n</body>`);
    }
    _runSecurityAudit() {
        vscode.window.showInformationMessage("Running Security Audit...");
        this._view?.webview.postMessage({
            command: "securityAuditResult",
            output: "Security audit results will appear here."
        });
    }
    _reviewPullRequest(url) {
        vscode.window.showInformationMessage("Reviewing PR: " + url);
        this._view?.webview.postMessage({
            command: "pullRequestResult",
            output: `Pull request review for: ${url}`
        });
    }
    async _checkRules(message) {
        vscode.window.showInformationMessage("Running Rule Check...");
        const policyFile = message.policy;
        const codeFile = message.code;
        try {
            const policyBuffer = Buffer.from(policyFile.content, "base64");
            const codeBuffer = Buffer.from(codeFile.content, "base64");
            const form = new form_data_1.default();
            form.append("policy_file", policyBuffer, policyFile.name);
            form.append("code_file", codeBuffer, codeFile.name);
            const response = await axios_1.default.post("http://127.0.0.1:8000/file/check-compliance/", form, {
                headers: form.getHeaders()
            });
            const resultData = await response.data;
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                output: resultData
            });
        }
        catch (err) {
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                output: "Error: " + err.message
            });
        }
    }
}
exports.ChatViewProvider = ChatViewProvider;
//# sourceMappingURL=ChatWebviewManager.js.map