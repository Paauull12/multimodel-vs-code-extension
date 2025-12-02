import * as vscode from 'vscode';
import FormData from "form-data";
import { generateWebviewContent } from '../chatWebviewGenerator';
import axios from 'axios';

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

        webviewView.webview.onDidReceiveMessage(message => {
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

            case 'securityAudit':
                this._runSecurityAudit();
                break;

            case 'reviewPullRequest':
                this._reviewPullRequest(message.url);
                break;

            case 'checkRules':
                this._checkRules(message);
                break;

            default:
                console.warn("Unknown command from webview:", message);
        }
});

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

        // Main script (chat logic)
        const mainScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "src",
                "webviews",
                "chat",
                "client",
                "main.js"
            )
        );

        // Router script (view switching)
        const routerScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "src",
                "webviews",
                "chat",
                "client",
                "viewRouter.js"
            )
        );

        console.log('CSS URI:', styleUri.toString());
        console.log('Script URI:', scriptUri.toString());
        console.log('Marked URI:', markedUri.toString());

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
        // TODO: implement logic
        this._view?.webview.postMessage({
            command: "securityAuditResult",
            result: "Security audit results will appear here."
        });
    }

    private _reviewPullRequest(url: string) {
        vscode.window.showInformationMessage("Reviewing PR: " + url);
        // TODO: implement logic
        this._view?.webview.postMessage({
            command: "pullRequestResult",
            result: `Pull request review for: ${url}`
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
            // const summary = result.summary ?? "No summary available.";

            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                result: resultData
            });

        } catch (err: any) {
            this._view?.webview.postMessage({
                command: "rulesCheckResult",
                result: "Error: " + err.message
            });
        }
    }
}
