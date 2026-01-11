import * as vscode from 'vscode';
import FormData from 'form-data';
import { generateWebviewContent } from '../chatWebviewGenerator';
import axios from 'axios';
import * as path from 'path';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'analyzer.chatView';
    private _view?: vscode.WebviewView;
    private _currentThreadId?: string;
    private _pollingInterval?: NodeJS.Timeout;
    private _apiBaseUrl: string;
    private _lastDisplayedMessageId: string | null = null;

    constructor(private readonly _extensionUri: vscode.Uri) {
        const config = vscode.workspace.getConfiguration('analyzer');
        this._apiBaseUrl = config.get('apiBaseUrl', 'http://localhost:8000/mock');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
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

                case 'checkRules':
                    this._checkRules(message);
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

    private async _checkCompanyRules(code: string) {
        try{
            const token = await this._getAuthToken();
            const response = await axios.post(
                `http://127.0.0.1:8000/file/check-company-compliance/`,
                { code: code },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`
                    }
                }
            );

            this._view?.webview.postMessage({
                command: "rulesCheckResult", 
                result: response.data
            });
        } catch (err: any){
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                result: err.response?.data?.error || err.message
            });
        }
    }

    private async _handleUserMessage(text: string, files?: any[]) {
        if (!this._view) {
            return;
        }

        try {
            const token = await this._getAuthToken();

            // Send message to backend
            const response = await axios.post(
                `${this._apiBaseUrl}/chat/send/`,
                {
                    message: text,
                    thread_id: this._currentThreadId || null
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Token ${token}` })
                    }
                }
            );

            // Store thread ID for future messages
            this._currentThreadId = response.data.thread_id;

            // If files are attached, upload them immediately before starting to poll
            if (files && files.length > 0) {
                await this._uploadFiles(files);
            } else {
                // Start polling for bot response
                this._startPolling();
            }

        } catch (error: any) {
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

    private _startPolling() {
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
                const response = await axios.get(
                    `${this._apiBaseUrl}/chat/poll/${this._currentThreadId}/`,
                    {
                        headers: {
                            ...(token && { 'Authorization': `Token ${token}` })
                        }
                    }
                );

                const data = response.data;

                if (data.status === 'failed') {
                    this._stopPolling();
                    this._view?.webview.postMessage({
                        command: 'receiveMessage',
                        message: {
                            text: "Something went wrong on server side. Please try again!",
                            sender: 'bot',
                            timestamp: new Date().toLocaleTimeString(),
                            isError: true
                        }
                    });
                    return;
                }

                if (data.status === 'completed') {
                    this._stopPolling();
                    
                    const hasContent = data.latest_message?.content && data.latest_message.content.trim().length > 0;

                    if (!hasContent) {
                        this._view?.webview.postMessage({
                            command: 'receiveMessage',
                            message: {
                                text: "The assistant has finished processing, but did not generate a text response. Please try rephrasing your request!",
                                sender: 'bot',
                                timestamp: new Date().toLocaleTimeString(),
                                isError: true
                            }
                        });
                        return;
                    }
                }

                if (data.status === 'awaiting_files') {
                    this._stopPolling();
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

            } catch (error: any) {
                console.error('Polling error:', error);
                this._stopPolling();
            }
        }, 1000);
    }

    private _stopPolling() {
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = undefined;
        }
    }

    private _displayBotMessage(messageData: any) {
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

    private async _uploadFiles(files: any[]) {
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
                        } catch (e) {
                            console.error('Error decoding base64 for file:', file.name, e);
                            content = file.content;
                        }
                    } else {
                        // Content is already plain text
                        content = file.content;
                    }
                } else {
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
            const response = await axios.post(
                `${this._apiBaseUrl}/chat/upload/${this._currentThreadId}/`,
                {
                    files: validFiles  // Wrap in object with 'files' key
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Token ${token}` })
                    }
                }
            );

            console.log('Files uploaded successfully:', response.data);

            // Resume polling after upload
            this._startPolling();

        } catch (error: any) {
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

    private async _getAuthToken(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('analyzer');
        let token = config.get<string>('authToken');
        return token || "24e60db7ec851cd254001c363a05304057f51dd4";
    }

    private _clearChat() {
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

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const stylePaths = [
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static', 'styles', 'webview.css'),
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webviews', 'static', 'styles', 'webview.css'),
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css')
        ];
        
        const styleUri = webview.asWebviewUri(stylePaths[0]);
        const markedUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static', 'assets', 'marked.min.js')
        );
        const mainScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "chat", "client", "main.js")
        );
        const routerScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "chat", "client", "viewRouter.js")
        );

        return generateWebviewContent(
            styleUri.toString(),
            mainScriptUri.toString(),
            markedUri.toString()
        ).replace(
            "</body>",
            `  <script src="${routerScriptUri}"></script>\n</body>`
        );
    }

    private _runSecurityAudit() {
        vscode.window.showInformationMessage("Running Security Audit...");
        this._view?.webview.postMessage({
            command: "securityAuditResult",
            output: "Security audit results will appear here."
        });
    }

    private async _checkRules(message: any) {
        vscode.window.showInformationMessage("Running Rule Check...");

        const policyFile = message.policy;
        const codeFile = message.code;

        try {
            const policyBuffer = Buffer.from(policyFile.content, "base64");
            const codeBuffer = Buffer.from(codeFile.content, "base64");

            const form = new FormData();
            form.append("policy_file", policyBuffer, policyFile.name);
            form.append("code_file", codeBuffer, codeFile.name);

            const response = await axios.post(
                "http://127.0.0.1:8000/file/check-compliance/",
                form,
                {
                    headers: form.getHeaders()
                }
            );

            const resultData = await response.data;

            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                result: resultData
            });

        } catch (err: any) {
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                output: "Error: " + err.message
            });
        }
    }
}