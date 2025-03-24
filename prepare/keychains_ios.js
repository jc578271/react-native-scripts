/**
 * iOS Keychain Access Groups Setup Module
 * This module updates or creates iOS entitlements file with keychain access groups
 * for secure sharing between apps with the same team ID
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

// Default values
const DEFAULT_CONFIG_FILE = "./build.config.json";
const DEFAULT_IOS_PROJECT_NAME = "MyApp";
const DEFAULT_BUNDLE_ID = "com.myapp.default";

// Extract value from JSON file
function extractJsonValue(filePath, key, defaultValue) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(fileContent);
    return json[key] !== undefined ? json[key] : defaultValue;
  } catch (error) {
    log(`Error parsing JSON file: ${error.message}`, colors.red);
    return defaultValue;
  }
}

// Extract array from JSON file
function extractJsonArray(filePath, key) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(fileContent);
    return Array.isArray(json[key]) ? json[key] : [];
  } catch (error) {
    log(`Error parsing JSON file: ${error.message}`, colors.red);
    return [];
  }
}

// Find iOS project directory automatically
function findIosProjectDir(iosDir) {
  try {
    const entries = fs.readdirSync(iosDir, { withFileTypes: true });

    // Filter directories that aren't Pods and don't start with a dot
    const projectDirs = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name !== "Pods" &&
          !entry.name.startsWith(".")
      )
      .filter(
        (entry) => !["build", "Frameworks", "node_modules"].includes(entry.name)
      )
      .map((entry) => entry.name);

    // Check for directories containing .xcodeproj
    for (const dir of projectDirs) {
      try {
        const subEntries = fs.readdirSync(path.join(iosDir, dir));
        if (subEntries.some((name) => name.endsWith(".xcodeproj"))) {
          return dir;
        }
      } catch (error) {
        // Skip if we can't read a directory
      }
    }

    // Check for .xcodeproj files directly
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith(".xcodeproj")) {
        return entry.name.replace(".xcodeproj", "");
      }
    }
  } catch (error) {
    log(`Error finding iOS project directory: ${error.message}`, colors.red);
  }

  return null;
}

// Find existing entitlements files
function findEntitlementsFiles(projectDir) {
  try {
    const files = [];

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith(".entitlements")) {
          files.push(fullPath);
        }
      }
    }

    scanDir(projectDir);
    return files;
  } catch (error) {
    log(`Error finding entitlements files: ${error.message}`, colors.red);
    return [];
  }
}

// Create a new entitlements file
function createEntitlementsFile(filePath) {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
</dict>
</plist>`;

  try {
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    log(`Error creating entitlements file: ${error.message}`, colors.red);
    return false;
  }
}

// Update existing entitlements file with keychain access groups
function updateEntitlementsFile(filePath, bundleId, keychains) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Check if keychain-access-groups already exists
    if (content.includes("<key>keychain-access-groups</key>")) {
      log(
        "Keychain access groups already exist in the entitlements file. Updating...",
        colors.blue
      );

      // Process the file to update existing keychain groups
      const newLines = [];
      let inKeychainSection = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes("<key>keychain-access-groups</key>")) {
          inKeychainSection = true;
          newLines.push(line); // Keep the key line
          newLines.push("	<array>"); // Add array start
          newLines.push(`		<string>$(AppIdentifierPrefix)${bundleId}</string>`); // Add main bundle ID

          // Add each additional keychain
          for (const keychain of keychains) {
            newLines.push(`		<string>$(AppIdentifierPrefix)${keychain}</string>`);
          }
        } else if (inKeychainSection && line.includes("</array>")) {
          newLines.push(line); // Add array end
          inKeychainSection = false;
        } else if (!inKeychainSection) {
          newLines.push(line); // Keep non-keychain lines
        }
        // Skip lines inside the keychain array section
      }

      fs.writeFileSync(filePath, newLines.join("\n"));
      log("Updated existing keychain access groups", colors.green);
    } else {
      log(
        "Adding new keychain access groups to the entitlements file...",
        colors.blue
      );

      // Add keychain-access-groups before the closing dict
      const newLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes("</dict>")) {
          // Add keychain access groups before closing dict
          newLines.push("	<key>keychain-access-groups</key>");
          newLines.push("	<array>");
          newLines.push(`		<string>$(AppIdentifierPrefix)${bundleId}</string>`);

          // Add each additional keychain
          for (const keychain of keychains) {
            newLines.push(`		<string>$(AppIdentifierPrefix)${keychain}</string>`);
          }

          newLines.push("	</array>");
          newLines.push(line); // Add closing dict
        } else {
          newLines.push(line);
        }
      }

      fs.writeFileSync(filePath, newLines.join("\n"));
      log("Added new keychain access groups", colors.green);
    }

    return true;
  } catch (error) {
    log(`Error updating entitlements file: ${error.message}`, colors.red);
    return false;
  }
}

// Check if Xcode project references entitlements file
function checkXcodeProjectReference(xcodeProjectPath, entitlementsFileName) {
  try {
    if (!fs.existsSync(xcodeProjectPath)) {
      return false;
    }

    const content = fs.readFileSync(xcodeProjectPath, "utf8");
    return content.includes(entitlementsFileName);
  } catch (error) {
    log(`Error checking Xcode project file: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Set up keychain sharing for iOS
 * @param {string} configFile - Path to configuration file
 * @param {Object} options - Additional options
 * @returns {boolean} - Success or failure
 */
function setupKeychainsIos(configFile = DEFAULT_CONFIG_FILE, options = {}) {
  log("Starting keychain setup for iOS", colors.green);

  // Default options
  const defaultOptions = {
    iosProjectName: null,
    bundleId: null,
    keychains: [],
  };

  // Combine default options with provided options
  const config = { ...defaultOptions, ...options };

  // Load configuration from file if it exists
  if (fs.existsSync(configFile)) {
    log(`Loading configuration from ${configFile}...`, colors.blue);

    // Extract project name if not provided in options
    if (!config.iosProjectName) {
      config.iosProjectName = extractJsonValue(
        configFile,
        "ios_project_name",
        DEFAULT_IOS_PROJECT_NAME
      );
      log(`Loaded project name: ${config.iosProjectName}`, colors.blue);
    }

    // Extract bundle ID if not provided in options
    if (!config.bundleId) {
      config.bundleId = extractJsonValue(
        configFile,
        "bundle_id",
        DEFAULT_BUNDLE_ID
      );
      log(`Loaded bundle ID: ${config.bundleId}`, colors.blue);
    }

    // Extract keychains if not provided in options
    if (config.keychains.length === 0) {
      config.keychains = extractJsonArray(configFile, "keychains");
      log(`Loaded keychains: ${config.keychains.join(", ")}`, colors.blue);
    }
  } else {
    log(`Config file not found: ${configFile}`, colors.yellow);
  }

  // Check if we have the required values
  if (!config.iosProjectName) {
    log("Error: iOS project name not specified", colors.red);
    return false;
  }

  if (!config.bundleId) {
    log("Error: Bundle ID not specified", colors.red);
    return false;
  }

  // Display configuration
  log("============ Configuration ============", colors.green);
  log(`iOS Project Name: ${config.iosProjectName}`, colors.green);
  log(`Main Bundle ID: ${config.bundleId}`, colors.green);
  log(`Keychains: ${config.keychains.join(", ")}`, colors.green);
  log("=======================================", colors.green);

  // Check if iOS directory exists
  const iosDir = "ios";

  if (!fs.existsSync(iosDir)) {
    log(
      "Error: 'ios' directory not found. Make sure you're running this from the React Native project root.",
      colors.red
    );
    return false;
  }

  // Find iOS project directory
  let projectDir = path.join(iosDir, config.iosProjectName);

  if (!fs.existsSync(projectDir)) {
    log(
      `Warning: iOS project directory not found at ${projectDir}`,
      colors.yellow
    );

    // Try to auto-detect the project directory
    const detectedName = findIosProjectDir(iosDir);

    if (!detectedName) {
      log(
        "Error: No iOS project directories found. Cannot continue.",
        colors.red
      );
      return false;
    }

    config.iosProjectName = detectedName;
    projectDir = path.join(iosDir, config.iosProjectName);
    log(
      `Auto-detected iOS project name: ${config.iosProjectName}`,
      colors.green
    );

    if (!fs.existsSync(projectDir)) {
      log(
        "Error: iOS project directory still not found. Cannot continue.",
        colors.red
      );
      return false;
    }
  }

  // Check for existing entitlements file
  const entitlementsFiles = findEntitlementsFiles(projectDir);
  let entitlementsPath;

  if (entitlementsFiles.length > 0) {
    entitlementsPath = entitlementsFiles[0];
    log(`Found existing entitlements file: ${entitlementsPath}`, colors.green);
  } else {
    // Create a new entitlements file
    entitlementsPath = path.join(
      projectDir,
      `${config.iosProjectName}.entitlements`
    );
    log(`Creating new entitlements file: ${entitlementsPath}`, colors.blue);

    if (!createEntitlementsFile(entitlementsPath)) {
      log("Error: Failed to create entitlements file", colors.red);
      return false;
    }
  }

  // Check if the entitlements file exists now
  if (!fs.existsSync(entitlementsPath)) {
    log("Error: Failed to create or find entitlements file", colors.red);
    return false;
  }

  // Update the entitlements file
  if (
    !updateEntitlementsFile(entitlementsPath, config.bundleId, config.keychains)
  ) {
    log("Error: Failed to update entitlements file", colors.red);
    return false;
  }

  log("Entitlements file updated successfully", colors.green);

  // Check the Xcode project file to ensure it references the entitlements file
  const pbxprojPath = path.join(
    iosDir,
    `${config.iosProjectName}.xcodeproj`,
    "project.pbxproj"
  );

  if (fs.existsSync(pbxprojPath)) {
    log(`Checking Xcode project file: ${pbxprojPath}`, colors.blue);

    // Get the entitlements filename only
    const entitlementsFilename = path.basename(entitlementsPath);

    if (!checkXcodeProjectReference(pbxprojPath, entitlementsFilename)) {
      log(
        "Entitlements file not referenced in project. You need to manually add it in Xcode.",
        colors.yellow
      );
      log("1. Open Xcode project", colors.yellow);
      log("2. Select your target", colors.yellow);
      log("3. Go to 'Signing & Capabilities'", colors.yellow);
      log("4. Add the 'Keychain Sharing' capability", colors.yellow);
    } else {
      log(
        "Entitlements file is already referenced in the Xcode project",
        colors.green
      );
    }
  } else {
    log(`Warning: Xcode project file not found: ${pbxprojPath}`, colors.yellow);
    log(
      "Make sure to configure the entitlements file in Xcode manually",
      colors.yellow
    );
  }

  log("=== Keychain setup complete ===", colors.green);
  log("");
  log("The following keychains have been configured:");
  log(`Main Bundle ID: ${config.bundleId}`, colors.blue);

  for (const keychain of config.keychains) {
    log(`Additional: ${keychain}`, colors.blue);
  }

  return true;
}

module.exports = setupKeychainsIos;
