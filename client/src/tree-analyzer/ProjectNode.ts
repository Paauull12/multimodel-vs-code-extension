/**
 * Represents a node in the project's structure tree (either a file or a folder).
 * This class mirrors the target Java class it is designed to generate code for.
 */
export class ProjectNode {
    name: string;
    isAFile: boolean;
    children: ProjectNode[];

    constructor(name: string, isAFile: boolean = false, children: ProjectNode[] = []) {
        this.name = name;
        this.isAFile = isAFile;
        this.children = children;
    }

    /**
     * Adds a new child node (file or directory) to this node's list.
     * @param childNode The node to add.
     */
    addChild(childNode: ProjectNode): void {
        this.children.push(childNode);
    }
}
