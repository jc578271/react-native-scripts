/**
 * Android Manifest Package Queries Setup Module
 * This module updates AndroidManifest.xml with package queries
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Default values
const DEFAULT_CONFIG_FILE = "./build.config.json";
const DEFAULT_MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml";

// Console colors for better output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

// Log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Extract array values from JSON
function extractJsonArray(filePath, key) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(fileContent);

    // Get the array for the specified key
    return Array.isArray(json[key]) ? json[key] : [];
  } catch (error) {
    log(`Error parsing JSON file: ${error.message}`, colors.red);
    return [];
  }
}

/**
 * Setup Android package queries in the manifest file
 * @param {string} configFile - Path to configuration file
 * @param {Object} options - Additional options
 * @returns {boolean} - Success or failure
 */
function setupKeychainsAndroid(configFile = DEFAULT_CONFIG_FILE, options = {}) {
  log("Starting Android manifest package queries setup", colors.green);

  // Default options
  const defaultOptions = {
    manifestPath: DEFAULT_MANIFEST_PATH,
    packages: [],
  };

  // Combine default options with provided options
  const config = { ...defaultOptions, ...options };

  // Load packages from config file if no packages provided via options
  let packages = [...config.packages];

  if (packages.length === 0 && fs.existsSync(configFile)) {
    log(`Loading packages from ${configFile}...`, colors.blue);

    const configPackages = extractJsonArray(configFile, "keychains");

    if (configPackages.length > 0) {
      packages = configPackages;
      log(`Loaded packages: ${packages.join(", ")}`, colors.green);
    } else {
      log(
        "No packages found in config file under 'keychains' key.",
        colors.yellow
      );
    }
  }

  // Check if we have packages to add
  if (packages.length === 0) {
    log(
      "Error: No packages specified. Provide them in the config file or options.",
      colors.red
    );
    return false;
  }

  // Check if manifest file exists
  if (!fs.existsSync(config.manifestPath)) {
    log(
      `Error: AndroidManifest.xml not found at ${config.manifestPath}`,
      colors.red
    );
    log(
      "Use the manifestPath option to specify the correct path to AndroidManifest.xml",
      colors.yellow
    );
    return false;
  }

  // Read the manifest file
  let manifestContent = fs.readFileSync(config.manifestPath, "utf8");

  // Check if <queries> tag already exists in the manifest
  if (manifestContent.includes("<queries")) {
    log("Found existing <queries> section in AndroidManifest.xml", colors.blue);

    // Check if it's a self-closing or empty tag
    if (/<queries\s*\/>|<queries\s*><\/queries>/.test(manifestContent)) {
      log("Replacing empty queries tag with full section...", colors.blue);
      // Replace the self-closing or empty queries tag with a properly formatted one
      manifestContent = manifestContent.replace(
        /<queries\s*\/>|<queries\s*><\/queries>/,
        "<queries>\n</queries>"
      );
    }

    // Get the lines of the manifest for easier processing
    const lines = manifestContent.split("\n");

    // Find the queries opening and closing lines
    let queriesOpenLine = -1;
    let queriesCloseLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("<queries") && queriesOpenLine === -1) {
        queriesOpenLine = i;
      }
      if (lines[i].includes("</queries>") && queriesCloseLine === -1) {
        queriesCloseLine = i;
      }
    }

    if (queriesOpenLine !== -1 && queriesCloseLine !== -1) {
      log(
        `Found queries section from line ${queriesOpenLine + 1} to ${
          queriesCloseLine + 1
        }`,
        colors.blue
      );

      // Determine the indentation level for the tags inside <queries>
      const queriesIndent = lines[queriesOpenLine].match(/^\s*/)[0];
      const packageIndent = queriesIndent + "  ";

      // Create new content by processing the file line by line
      const newLines = [];
      let inQueriesSection = false;

      for (let i = 0; i < lines.length; i++) {
        if (i === queriesOpenLine) {
          inQueriesSection = true;
          // Write the opening queries tag
          newLines.push(lines[i]);

          // Write new package entries right after the opening tag
          for (const pkg of packages) {
            newLines.push(`${packageIndent}<package android:name="${pkg}" />`);
            log(`Added package: ${pkg}`, colors.green);
          }
        } else if (i === queriesCloseLine) {
          inQueriesSection = false;
          // Write the closing queries tag
          newLines.push(lines[i]);
        } else if (inQueriesSection) {
          // Skip existing package entries, keep other content
          if (
            lines[i].includes("<package") &&
            lines[i].includes("android:name")
          ) {
            log(`Removing package entry: ${lines[i].trim()}`, colors.yellow);
          } else {
            newLines.push(lines[i]);
          }
        } else {
          // Outside the queries section, keep everything
          newLines.push(lines[i]);
        }
      }

      // Update manifest content
      manifestContent = newLines.join("\n");
      log("Updated queries section with new packages", colors.green);
    } else {
      log(
        "Error: Invalid queries section. Cannot parse the manifest structure.",
        colors.red
      );
      return false;
    }
  } else {
    log(
      "No <queries> section found. Adding new section to AndroidManifest.xml",
      colors.blue
    );

    // Get the lines of the manifest for easier processing
    const lines = manifestContent.split("\n");

    // Find the position to insert the queries section (before <application> tag)
    let applicationLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("<application")) {
        applicationLine = i;
        break;
      }
    }

    if (applicationLine === -1) {
      log(
        "Error: No <application> tag found in AndroidManifest.xml",
        colors.red
      );
      return false;
    }

    log(`Found <application> tag at line ${applicationLine + 1}`, colors.blue);

    // Extract the indentation from the line with <application>
    const applicationIndent = lines[applicationLine].match(/^\s*/)[0];
    const queriesIndent = applicationIndent;
    const packageIndent = queriesIndent + "  ";

    // Create new content
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      if (i === applicationLine) {
        // Add queries section right before <application> tag with proper indentation
        newLines.push(`${queriesIndent}<queries>`);

        for (const pkg of packages) {
          newLines.push(`${packageIndent}<package android:name="${pkg}" />`);
          log(`Added package: ${pkg}`, colors.green);
        }

        newLines.push(`${queriesIndent}</queries>`);
        newLines.push("");
      }

      // Add the original line
      newLines.push(lines[i]);
    }

    // Update manifest content
    manifestContent = newLines.join("\n");
    log("Added new <queries> section with specified packages", colors.green);
  }

  // Write the modified manifest back to file
  fs.writeFileSync(config.manifestPath, manifestContent);

  log("=== Android manifest package queries setup complete ===", colors.green);
  log("");
  log("The following packages have been added to queries:");

  for (const pkg of packages) {
    log(`  - ${pkg}`, colors.blue);
  }

  log("");
  log(
    "You should now rebuild your Android app to verify the changes",
    colors.green
  );
  log(
    `The manifest file has been updated at: ${config.manifestPath}`,
    colors.green
  );

  return true;
}

module.exports = setupKeychainsAndroid;
