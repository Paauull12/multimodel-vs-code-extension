import { ProjectNode } from './ProjectNode';

/**
 * Formats the ProjectNode structure into a human-readable text-based tree view.
 * @param treeNode The current ProjectNode to format.
 * @param currentPrefix The string prefix for the current level.
 * @param isLastNode A flag indicating if the current node is the last sibling in its parent's list.
 * @returns The string representation of the tree structure.
 */
export function formatAsTextTree(
    treeNode: ProjectNode, 
    currentPrefix: string = '', 
    isLastNode: boolean = true
): string {
    let outputString = '';
    
    // Line construction
    outputString += `${currentPrefix}${isLastNode ? '└─' : '├─'}` + 
        `${treeNode.name}${treeNode.isAFile ? '' : '/'}\n`;
    
    // Determine the prefix for child nodes
    const childLinePrefix = currentPrefix + (isLastNode ? '  ' : '│ ');
    
    // Recursively call the function for all children
    for (let i = 0; i < treeNode.children.length; i++) {
        const isLastChild = i === treeNode.children.length - 1;
        outputString += formatAsTextTree(treeNode.children[i], childLinePrefix, isLastChild);
    }
    
    return outputString;
}

/**
 * Converts the ProjectNode structure into a Java code string that instantiates the same structure.
 * @param treeNode The current ProjectNode to convert.
 * @returns A string representing the Java object instantiation code.
 */
export function generateJavaInstantiationCode(treeNode: ProjectNode): string {
    if (treeNode.children.length === 0) {
        // If no children, return the simple constructor call
        return `new ProjectNode("${treeNode.name}", ${treeNode.isAFile})`;
    }
    
    const childrenInstantiationString = treeNode.children
        .map(child => generateJavaInstantiationCode(child))
        .join(', ');
    
    // Return the constructor call including the array of instantiated children
    return `new ProjectNode("${treeNode.name}", ${treeNode.isAFile}, [${childrenInstantiationString}])`;
}
