"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectNode = void 0;
/**
 * Represents a node in the project's structure tree (either a file or a folder).
 * This class mirrors the target Java class it is designed to generate code for.
 */
class ProjectNode {
    name;
    isAFile;
    children;
    constructor(name, isAFile = false, children = []) {
        this.name = name;
        this.isAFile = isAFile;
        this.children = children;
    }
    /**
     * Adds a new child node (file or directory) to this node's list.
     * @param childNode The node to add.
     */
    addChild(childNode) {
        this.children.push(childNode);
    }
}
exports.ProjectNode = ProjectNode;
//# sourceMappingURL=ProjectNode.js.map