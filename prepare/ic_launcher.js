/**
 * Script to copy ic_launcher folders from source to Android res directory
 * Copies and overwrites files without removing existing content
 */

const fs = require('fs');
const path = require('path');

/**
 * Recursively copy a directory from source to destination
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 */
function copyFolderRecursive(src, dest) {
    // Check if source exists
    if (!fs.existsSync(src)) {
        console.error(`Error: Source directory ${src} does not exist`);
        return false;
    }

    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    // Read source directory contents
    const entries = fs.readdirSync(src, { withFileTypes: true });

    // Process each entry
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            // Recursively copy subdirectories
            copyFolderRecursive(srcPath, destPath);
        } else {
            // Copy file and overwrite if exists
            fs.copyFileSync(srcPath, destPath);
        }
    }

    return true;
}

/**
 * Copy launcher icons from source to Android res directory
 * @param {Object} options - Configuration options
 * @param {string} options.source - Source directory containing ic_launcher resources
 * @param {string} options.androidResPath - Path to Android res directory (default: 'android/app/src/main/res')
 * @returns {boolean} - Success status
 */
function copyLauncherIcons(options) {
    const { source, androidResPath = 'android/app/src/main/res' } = options;

    if (!source) {
        console.error('Error: No source directory provided');
        return false;
    }

    console.log(`\x1b[34mCopying launcher icons from ${source} to ${androidResPath}...\x1b[0m`);

    try {
        const success = copyFolderRecursive(source, androidResPath);

        if (success) {
            console.log(`\x1b[32mLauncher icons copied successfully\x1b[0m`);
            return true;
        } else {
            console.error(`\x1b[31mFailed to copy launcher icons\x1b[0m`);
            return false;
        }
    } catch (error) {
        console.error(`\x1b[31mError copying launcher icons: ${error.message}\x1b[0m`);
        return false;
    }
}

module.exports = copyLauncherIcons;
