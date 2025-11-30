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
exports.getProjectStructureRoot = getProjectStructureRoot;
exports.buildJavaFileTree = buildJavaFileTree;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ProjectNode_1 = require("./ProjectNode");
/**
 * Entry point to analyze the project structure of the currently open workspace.
 * @returns The root ProjectNode, or null if no workspace is open.
 */
async function getProjectStructureRoot() {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace open');
        return null;
    }
    const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const projectRootNode = await buildJavaFileTree(workspaceRootPath);
    return projectRootNode;
}
/**
 * Finds all '.java' files in the workspace and constructs a ProjectNode tree structure.
 * @param searchRootPath The absolute file system path to start the search from.
 * @returns The root node of the constructed project tree.
 */
async function buildJavaFileTree(searchRootPath) {
    const rootDirectoryName = path.basename(searchRootPath);
    const rootDirectoryNode = new ProjectNode_1.ProjectNode(rootDirectoryName);
    const javaFileUris = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**');
    for (const fileUri of javaFileUris) {
        const absoluteFilePath = fileUri.fsPath;
        const relativeFilePath = path.relative(searchRootPath, absoluteFilePath);
        insertPathSegments(rootDirectoryNode, relativeFilePath.split(path.sep), true);
    }
    return rootDirectoryNode;
}
/**
 * Helper function to insert a file path into the existing tree structure.
 */
function insertPathSegments(currentRootNode, pathSegments, isFinalSegmentFile) {
    let travelerNode = currentRootNode;
    // Process directory segments (all except the last one)
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segmentName = pathSegments[i];
        let foundChildNode = travelerNode.children.find(child => child.name === segmentName && !child.isAFile);
        if (!foundChildNode) {
            foundChildNode = new ProjectNode_1.ProjectNode(segmentName, false);
            travelerNode.addChild(foundChildNode);
        }
        travelerNode = foundChildNode;
    }
    // Handle the final file segment
    const fileNameSegment = pathSegments[pathSegments.length - 1];
    if (!travelerNode.children.some(child => child.name === fileNameSegment && child.isAFile)) {
        travelerNode.addChild(new ProjectNode_1.ProjectNode(fileNameSegment, isFinalSegmentFile));
    }
}
//# sourceMappingURL=treeBuilder.js.map