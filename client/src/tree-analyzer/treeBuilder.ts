import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectNode } from './ProjectNode';

/**
 * Entry point to analyze the project structure of the currently open workspace.
 * @returns The root ProjectNode, or null if no workspace is open.
 */
export async function getProjectStructureRoot(): Promise<ProjectNode | null> {
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
export async function buildJavaFileTree(searchRootPath: string): Promise<ProjectNode> {
    const rootDirectoryName = path.basename(searchRootPath);
    const rootDirectoryNode = new ProjectNode(rootDirectoryName);

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
function insertPathSegments(currentRootNode: ProjectNode, pathSegments: string[], isFinalSegmentFile: boolean): void {
    let travelerNode = currentRootNode;
    
    // Process directory segments (all except the last one)
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segmentName = pathSegments[i];
        
        let foundChildNode = travelerNode.children.find(child => child.name === segmentName && !child.isAFile);
        
        if (!foundChildNode) {
            foundChildNode = new ProjectNode(segmentName, false);
            travelerNode.addChild(foundChildNode);
        }
        
        travelerNode = foundChildNode;
    }
    
    // Handle the final file segment
    const fileNameSegment = pathSegments[pathSegments.length - 1];
    
    if (!travelerNode.children.some(child => child.name === fileNameSegment && child.isAFile)) {
        travelerNode.addChild(new ProjectNode(fileNameSegment, isFinalSegmentFile));
    }
}
