import * as vscode from 'vscode';
import { generateWebviewContent } from '../chatWebviewGenerator';

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
                vscode.Uri.joinPath(this._extensionUri, 'out'),
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'src'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'static')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

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

        this._view.webview.postMessage({
            command: 'receiveMessage',
            message: {
                text: text,
                sender: 'user',
                timestamp: new Date().toLocaleTimeString()
            }
        });

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

        console.log('CSS URI:', styleUri.toString());
        console.log('Script URI:', scriptUri.toString());
        console.log('Marked URI:', markedUri.toString());

        return generateWebviewContent(
            styleUri.toString(),
            scriptUri.toString(),
            markedUri.toString()
        );
    }
}
