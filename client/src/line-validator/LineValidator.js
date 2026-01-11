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
exports.LineValidator = void 0;
const vscode = __importStar(require("vscode"));
const successDecoration = vscode.window.createTextEditorDecorationType({
    after: { contentText: 'Checked', color: 'green', margin: '0 0 0 10px' }
});
const failureDecoration = vscode.window.createTextEditorDecorationType({
    after: { contentText: ' Security Issue Detected', color: 'red', margin: '0 0 0 10px' }
});
class LineValidator {
    static activeChecks = [];
    static activate(context) {
        const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (event.document.uri.scheme !== 'file')
                return;
            if (this.activeChecks.length > 0) {
            }
            for (const change of event.contentChanges) {
                if (change.text.includes('\n') || change.text.includes('\r\n')) {
                    const targetLineIndex = change.range.start.line;
                    const lineText = event.document.lineAt(targetLineIndex).text;
                    console.log(`🔍 User pressed ENTER on line ${targetLineIndex}: "${lineText}"`);
                    if (!lineText.trim() || lineText.trim().length < 4)
                        continue;
                    await this.validateLine(event.document, targetLineIndex, lineText);
                }
            }
        });
        context.subscriptions.push(changeListener);
    }
    static async validateLine(document, lineIndex, text) {
        try {
            console.log(`Validating: "${text}" ...`);
            const isValid = await this.mockApiCall(text);
            console.log(`Result: ${isValid ? 'Success' : 'Failure'}`);
            const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (editor) {
                this.addCheck(editor, lineIndex, isValid ? 'success' : 'failure');
            }
        }
        catch (error) {
            console.error("Validation failed:", error);
        }
    }
    static addCheck(editor, lineIndex, type) {
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
    static removeCheck(index) {
        const check = this.activeChecks[index];
        clearTimeout(check.timeout);
        this.activeChecks.splice(index, 1);
    }
    static renderDecorations(editor) {
        const successRanges = this.activeChecks.filter(c => c.type === 'success').map(c => c.range);
        const failureRanges = this.activeChecks.filter(c => c.type === 'failure').map(c => c.range);
        editor.setDecorations(successDecoration, successRanges);
        editor.setDecorations(failureDecoration, failureRanges);
    }
    static async mockApiCall(text) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return Math.random() > 0.8;
    }
}
exports.LineValidator = LineValidator;
//# sourceMappingURL=LineValidator.js.map