import * as vscode from 'vscode';
import { generateWebviewContent } from '../chatWebviewGenerator';

/**
 * Provides the webview for the chat interface in the sidebar.
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'analyzer.chatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'webviewReady':
                        console.log('Webview is ready');
                        break;
                    case 'sendMessage':
                        this._handleUserMessage(message.text);
                        break;
                    case 'clearChat':
                        this._clearChat();
                        break;
                }
            }
        );
    }

    private _handleUserMessage(text: string) {
        if (!this._view) {
            return;
        }

        // Echo the user message back first
        this._view.webview.postMessage({
            command: 'receiveMessage',
            message: {
                text: text,
                sender: 'user',
                timestamp: new Date().toLocaleTimeString()
            }
        });

        // Send a bot response (this is where you'd integrate your AI model)
        setTimeout(() => {
            this._view?.webview.postMessage({
                command: 'receiveMessage',
                message: {
                    text: `You said: "${text}". This is a placeholder response. Integrate your AI model here.`,
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString()
                }
            });
        }, 500);
    }

    private _clearChat() {
        if (!this._view) {
            return;
        }
        
        this._view.webview.postMessage({
            command: 'clearChat'
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get URIs for resources based on your actual folder structure
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, 
                'src', 
                'webviews', 
                'static', 
                'styles', 
                'webview.css'
            )
        );
        
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, 
                'dist', 
                'webview-main.js'
            )
        );

        const markedUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, 
                'src', 
                'webviews', 
                'static', 
                'assets', 
                'marked.min.js'
            )
        );

        return generateWebviewContent(
            styleUri.toString(),
            scriptUri.toString(),
            markedUri.toString()
        );
    }
}
