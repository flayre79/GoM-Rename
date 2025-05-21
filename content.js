// content.js

const TEXT_TO_FIND = "Gulf of America";
const TEXT_TO_REPLACE_WITH = "Gulf of Mexico";

// Regex for case-insensitive and global replacement.
// It escapes TEXT_TO_FIND to ensure special characters are treated literally.
const SEARCH_REGEX = new RegExp(TEXT_TO_FIND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

// Tags within which text replacement should be avoided.
// 'PRE' has been removed from this list to allow replacement in <pre> tags.
const EXCLUDED_TAGS = [
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
    'IFRAME', 'CANVAS', /* 'PRE' was here */ 'CODE', 'SVG', 'MATH'
];

/**
 * Checks a text node and its ancestors for conditions that would exclude it from replacement.
 * (e.g., if it's inside a <script>, <style>, contentEditable element).
 * @param {Node} textNode - The text node to check.
 * @returns {boolean} True if the node should be skipped, false otherwise.
 */
function shouldSkipNode(textNode) {
    let currentElement = textNode.parentNode;

    while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
        const tagName = currentElement.tagName.toUpperCase();
        if (EXCLUDED_TAGS.includes(tagName)) {
            return true; // Skip if an ancestor is an excluded tag
        }
        if (currentElement.isContentEditable) {
            return true; // Skip if an ancestor is contentEditable
        }
        currentElement = currentElement.parentNode;
    }
    return false; // No exclusion found
}

/**
 * Performs the text replacement on a given text node if it's not excluded.
 * @param {Node} textNode - The text node to process.
 */
function checkAndReplaceInTextNode(textNode) {
    if (shouldSkipNode(textNode)) {
        return;
    }

    const originalValue = textNode.nodeValue;
    const newValue = originalValue.replace(SEARCH_REGEX, TEXT_TO_REPLACE_WITH);

    if (newValue !== originalValue) {
        textNode.nodeValue = newValue;
    }
}

/**
 * Traverses the DOM starting from rootNode and applies replacement to text nodes.
 * @param {Node} rootNode - The node to start traversal from.
 */
function processNodes(rootNode) {
    if (!rootNode) return;

    // If the rootNode itself is an element that should be entirely skipped
    if (rootNode.nodeType === Node.ELEMENT_NODE) {
        const rootTagName = rootNode.tagName.toUpperCase();
        if (EXCLUDED_TAGS.includes(rootTagName) || rootNode.isContentEditable) {
            return; // Don't process this node or its children
        }
    }

    const treeWalker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT, // Only interested in text nodes for replacement
        null, // No custom filter function, conditions checked per node
        false
    );

    // Collect nodes first to avoid issues if the DOM changes during iteration by replacements.
    const nodesToModify = [];
    let currentNode;
    while (currentNode = treeWalker.nextNode()) {
        nodesToModify.push(currentNode);
    }

    nodesToModify.forEach(checkAndReplaceInTextNode);
}

// --- Main execution ---

// Initial run on the entire document body once the DOM is idle.
// The "run_at": "document_idle" in manifest.json helps ensure document.body exists.
if (document.body) {
    processNodes(document.body);
} else {
    // Fallback: If document.body is not yet available (should be rare with document_idle)
    document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
            processNodes(document.body);
        }
    }, { once: true });
}

// Observe DOM changes to handle dynamically loaded content.
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            // Process all newly added nodes and their subtrees
            mutation.addedNodes.forEach(newNode => {
                processNodes(newNode);
            });
        } else if (mutation.type === 'characterData') {
            // The mutation.target is the text node that changed
            checkAndReplaceInTextNode(mutation.target);
        }
    }
});

// Start observing the document body for relevant mutations.
// Ensure document.body is available before starting the observer.
const startObserver = () => {
    if (document.body) {
        observer.observe(document.body, {
            childList: true,     // Observe additions/removals of child nodes
            subtree: true,       // Observe all descendants, not just direct children
            characterData: true  // Observe changes to the text content of nodes
        });
    } else {
        // If body isn't ready, wait for DOMContentLoaded.
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body) { // Double check body exists
                 observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
        }, { once: true });
    }
};

startObserver();