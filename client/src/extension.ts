import * as vscode from 'vscode';
import { getProjectStructureRoot } from './tree-analyzer/treeBuilder';
import { formatAsTextTree, generateJavaInstantiationCode } from './tree-analyzer/treeFormatter';
import { ChatViewProvider } from './webviews/chat/ChatWebviewManager';
import { LineValidator } from './line-validator/LineValidator';

const ANALYSIS_CHANNEL = vscode.window.createOutputChannel(
    "Project Analysis Output"
);

async function handleAnalyzeProjectCommand() {
    ANALYSIS_CHANNEL.clear();
    ANALYSIS_CHANNEL.show(true);
    ANALYSIS_CHANNEL.appendLine("Starting Project Structure Analysis...");

    const rootNode = await getProjectStructureRoot();
    if (!rootNode) {
        ANALYSIS_CHANNEL.appendLine("Analysis failed: No workspace folder open.");
        return;
    }

    ANALYSIS_CHANNEL.appendLine("Analysis Complete. Formatting Output...");
    ANALYSIS_CHANNEL.appendLine("--------------------------------------------------");

    // Format and display text tree
    const treeOutput = formatAsTextTree(rootNode);
    ANALYSIS_CHANNEL.appendLine("Text-Based Project Tree:");
    ANALYSIS_CHANNEL.appendLine(treeOutput);
    ANALYSIS_CHANNEL.appendLine("--------------------------------------------------");

    // Format and display Java instantiation code
    const javaCode = generateJavaInstantiationCode(rootNode);
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
export function activate(context: vscode.ExtensionContext) {
    console.log('Multimodel Chat Extension is now active');
    
    // Register the webview view provider for the chat sidebar
    const chatProvider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatViewProvider.viewType,
            chatProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );
    
    // Register the analyze project command
    const analyzeCommand = vscode.commands.registerCommand(
        'extension.analyzeProject', 
        handleAnalyzeProjectCommand
    );
    context.subscriptions.push(analyzeCommand);

    // Register the open chat command (focuses the sidebar)
    const openChatCommand = vscode.commands.registerCommand(
        'extension.openChat',
        () => {
            vscode.commands.executeCommand('analyzer.chatView.focus');
        }
    );
    context.subscriptions.push(openChatCommand);

    // Register the clear chat command
    const clearChatCommand = vscode.commands.registerCommand(
        'analyzer.clearChat',
        () => {
            vscode.window.showInformationMessage('Chat cleared');
        }
    );
    context.subscriptions.push(clearChatCommand);
    LineValidator.activate(context);
}

/**
 * This function is called when the extension is deactivated.
 */
export function deactivate() {
    ANALYSIS_CHANNEL.dispose(); 
}
