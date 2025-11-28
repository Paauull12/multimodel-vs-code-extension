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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const chatWebviewGenerator_1 = require("../chatWebviewGenerator");
class ChatViewProvider {
    _extensionUri;
    static viewType = 'analyzer.chatView';
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
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
                    this._checkRules(message.code);
                    break;
                default:
                    console.warn("Unknown command from webview:", message);
            }
        });
    }
    _handleUserMessage(text) {
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
    _clearChat() {
        if (!this._view) {
            return;
        }
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