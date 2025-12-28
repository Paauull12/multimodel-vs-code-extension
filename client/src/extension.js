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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const treeBuilder_1 = require("./tree-analyzer/treeBuilder");
const treeFormatter_1 = require("./tree-analyzer/treeFormatter");
const ChatWebviewManager_1 = require("./webviews/chat/ChatWebviewManager");
const LineValidator_1 = require("./line-validator/LineValidator");
// Create a dedicated output channel accessible by the handler
const ANALYSIS_CHANNEL = vscode.window.createOutputChannel("Project Analysis Output");
/**
 * Handles the command execution for project analyzation.
 */
async function handleAnalyzeProjectCommand() {
    ANALYSIS_CHANNEL.clear();
    ANALYSIS_CHANNEL.show(true);
    ANALYSIS_CHANNEL.appendLine("Starting Project Structure Analysis...");
    // Execute the core analysis logic
    const rootNode = await (0, treeBuilder_1.getProjectStructureRoot)();
    if (!rootNode) {
        ANALYSIS_CHANNEL.appendLine("Analysis failed: No workspace folder open.");
        return;
    }
    ANALYSIS_CHANNEL.appendLine("Analysis Complete. Formatting Output...");
    ANALYSIS_CHANNEL.appendLine("--------------------------------------------------");
    // Format and display text tree
    const treeOutput = (0, treeFormatter_1.formatAsTextTree)(rootNode);
    ANALYSIS_CHANNEL.appendLine("Text-Based Project Tree:");
    ANALYSIS_CHANNEL.appendLine(treeOutput);
    ANALYSIS_CHANNEL.appendLine("--------------------------------------------------");
    // Format and display Java instantiation code
    const javaCode = (0, treeFormatter_1.generateJavaInstantiationCode)(rootNode);
    ANALYSIS_CHANNEL.appendLine("Java Instantiation Code:");
    ANALYSIS_CHANNEL.appendLine(javaCode);
    ANALYSIS_CHANNEL.appendLine("--------------------------------------------------");
    vscode.window.showInformationMessage('Project analysis complete.');
}
/**
 * The main activation function for the editor extension.
 * This function is called when the extension is activated.
 * @param context The extension context provided by the editor.
 */
function activate(context) {
    console.log('Multimodel Chat Extension is now active');
    // Register the webview view provider for the chat sidebar
    const chatProvider = new ChatWebviewManager_1.ChatViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ChatWebviewManager_1.ChatViewProvider.viewType, chatProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // Register the analyze project command
    const analyzeCommand = vscode.commands.registerCommand('extension.analyzeProject', handleAnalyzeProjectCommand);
    context.subscriptions.push(analyzeCommand);
    // Register the open chat command (focuses the sidebar)
    const openChatCommand = vscode.commands.registerCommand('extension.openChat', () => {
        vscode.commands.executeCommand('analyzer.chatView.focus');
    });
    context.subscriptions.push(openChatCommand);
    // Register the clear chat command
    const clearChatCommand = vscode.commands.registerCommand('analyzer.clearChat', () => {
        vscode.window.showInformationMessage('Chat cleared');
    });
    context.subscriptions.push(clearChatCommand);
    LineValidator_1.LineValidator.activate(context);
}
/**
 * This function is called when the extension is deactivated.
 */
function deactivate() {
    ANALYSIS_CHANNEL.dispose();
}
//# sourceMappingURL=extension.js.map