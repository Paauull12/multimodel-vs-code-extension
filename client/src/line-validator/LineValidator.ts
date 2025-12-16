import * as vscode from 'vscode';

const successDecoration = vscode.window.createTextEditorDecorationType({
    after: { contentText: 'Checked', color: 'green', margin: '0 0 0 10px' } 
});

const failureDecoration = vscode.window.createTextEditorDecorationType({
    after: { contentText: ' Security Issue Detected', color: 'red', margin: '0 0 0 10px' }
});

interface ActiveCheck {
    id: string; 
    range: vscode.Range;
    type: 'success' | 'failure';
    timeout: NodeJS.Timeout;
}

export class LineValidator {
    
    private static activeChecks: ActiveCheck[] = [];

    public static activate(context: vscode.ExtensionContext) {
        
        const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (event.document.uri.scheme !== 'file') return;

            if (this.activeChecks.length > 0) {
            }

            for (const change of event.contentChanges) {
                if (change.text.includes('\n') || change.text.includes('\r\n')) {
                    
                    const targetLineIndex = change.range.start.line; 
                    const lineText = event.document.lineAt(targetLineIndex).text;

                    console.log(`🔍 User pressed ENTER on line ${targetLineIndex}: "${lineText}"`);

                    if (!lineText.trim() || lineText.trim().length < 4) continue;

                    await this.validateLine(event.document, targetLineIndex, lineText);
                }
            }
        });

        context.subscriptions.push(changeListener);
    }

    private static async validateLine(document: vscode.TextDocument, lineIndex: number, text: string) {
        try {
            console.log(`Validating: "${text}" ...`);
            
            const isValid = await this.mockApiCall(text);
            
            console.log(`Result: ${isValid ? 'Success' : 'Failure'}`);

            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (editor) {
                this.addCheck(editor, lineIndex, isValid ? 'success' : 'failure');
            }
        } catch (error) {
            console.error("Validation failed:", error);
        }
    }

    private static addCheck(editor: vscode.TextEditor, lineIndex: number, type: 'success' | 'failure') {
        const range = editor.document.lineAt(lineIndex).range;
        
        const timeout = setTimeout(() => {
            const index = this.activeChecks.findIndex(c => c.range.isEqual(range));
            if (index !== -1) {
                this.removeCheck(index);
                this.renderDecorations(editor);
            }
        }, 1500); 

        this.activeChecks.push({
            id: range.start.line.toString(),
            range: range,
            type: type,
            timeout: timeout
        });

        this.renderDecorations(editor);
    }

    private static removeCheck(index: number) {
        const check = this.activeChecks[index];
        clearTimeout(check.timeout);
        this.activeChecks.splice(index, 1);
    }

    private static renderDecorations(editor: vscode.TextEditor) {
        const successRanges = this.activeChecks.filter(c => c.type === 'success').map(c => c.range);
        const failureRanges = this.activeChecks.filter(c => c.type === 'failure').map(c => c.range);

        editor.setDecorations(successDecoration, successRanges);
        editor.setDecorations(failureDecoration, failureRanges);
    }

    private static async mockApiCall(text: string): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 500));
        return Math.random() > 0.8;
    }
}