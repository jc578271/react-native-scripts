/**
 * Module to add GoogleService-Info.plist to iOS Project
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

// Extract config from JSON file
function extractConfigFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    log(`Error parsing JSON file: ${error.message}`, colors.red);
    return {};
  }
}

// Find iOS project name by scanning the iOS directory
function findIosProjectName(iosPath) {
  if (!fs.existsSync(iosPath)) {
    log(`iOS directory not found at ${iosPath}`, colors.red);
    return null;
  }

  const entries = fs.readdirSync(iosPath, { withFileTypes: true });

  // Look for a directory that isn't Pods and doesn't start with a dot
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      entry.name !== "Pods" &&
      !entry.name.startsWith(".")
    ) {
      // Skip some common directories that aren't the project
      if (["build", "Frameworks", "node_modules"].includes(entry.name)) {
        continue;
      }

      // Check if this directory contains a .xcodeproj file
      const subEntries = fs.readdirSync(path.join(iosPath, entry.name));
      if (subEntries.some((name) => name.endsWith(".xcodeproj"))) {
        return entry.name;
      }
    }
  }

  // Look for .xcodeproj files directly
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith(".xcodeproj")) {
      return entry.name.replace(".xcodeproj", "");
    }
  }

  return null;
}

// Add the GoogleService-Info.plist file to the XCode project
function addFileToXcodeProject(iosPath, projectName, googleServiceInfoPath) {
  const projectPath = path.join(
    iosPath,
    `${projectName}.xcodeproj`,
    "project.pbxproj"
  );

  if (!fs.existsSync(projectPath)) {
    log(`Could not find project file at ${projectPath}`, colors.yellow);
    log(
      "The GoogleService-Info.plist has been copied, but you may need to add it to the Xcode project manually.",
      colors.yellow
    );
    return;
  }

  log("Adding file reference to Xcode project...", colors.blue);

  try {
    // Read the project.pbxproj file
    let pbxprojContent = fs.readFileSync(projectPath, 'utf8');

    // Define the path to GoogleService-Info.plist with sourceTree = SOURCE_ROOT
    // This tells Xcode to look for the file in the project root directory (ios/)
    // rather than in the project subdirectory
    const fileRefEntry = `\t\t/* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = SOURCE_ROOT; };`;

    // Check if the reference already exists to avoid duplicates
    if (pbxprojContent.includes('GoogleService-Info.plist')) {
      log("GoogleService-Info.plist already defined in Xcode project", colors.green);
    } else {
      // Find the PBXFileReference section
      const fileRefSection = pbxprojContent.match(/\/\* Begin PBXFileReference section \*\/\n([\s\S]*?)\/\* End PBXFileReference section \*\//);

      if (fileRefSection && fileRefSection[1]) {
        // Add the file reference to the PBXFileReference section
        const updatedFileRefSection = fileRefSection[0].replace(
            fileRefSection[1],
            fileRefSection[1] + fileRefEntry + "\n"
        );
        pbxprojContent = pbxprojContent.replace(fileRefSection[0], updatedFileRefSection);

        // Write the updated content back to the file
        fs.writeFileSync(projectPath, pbxprojContent);
        log("Successfully defined GoogleService-Info.plist in Xcode project", colors.green);
      } else {
        log("Could not find PBXFileReference section in project.pbxproj", colors.red);
      }
    }
  } catch (error) {
    log(`Error modifying Xcode project: ${error.message}`, colors.red);
    log("You may need to define GoogleService-Info.plist in the Xcode project manually.", colors.yellow);
  }
}

/**
 * Setup GoogleService-Info.plist in the iOS project
 * @param {string} configFile - Path to configuration file
 * @param {Object} options - Additional options
 * @returns {boolean} - Success or failure
 */
function setupGoogleServiceInfo(configFile, options = {}) {
  log("Starting GoogleService-Info.plist setup", colors.green);

  // Default options
  const defaultOptions = {
    googleServiceInfo: null,
    projectName: null,
    iosPath: "ios",
  };

  // Combine default options with provided options
  const config = { ...defaultOptions, ...options };

  // Load config from file if specified
  if (configFile && fs.existsSync(configFile)) {
    log(`Loading configuration from ${configFile}...`, colors.blue);
    const fileConfig = extractConfigFromFile(configFile);

    // Config file takes precedence over default values but not over explicit options
    if (!config.googleServiceInfo) {
      config.googleServiceInfo = fileConfig.google_service_info;
    }

    if (!config.projectName) {
      config.projectName = fileConfig.ios_project_name;
    }
  }

  if (!config.googleServiceInfo) {
    log("Error: GoogleService-Info.plist path not specified.", colors.red);
    log("Provide 'google_service_info' in the config file.", colors.yellow);
    return false;
  }

  // Check if the GoogleService-Info.plist file exists
  if (!fs.existsSync(config.googleServiceInfo)) {
    log(
        `Error: GoogleService-Info.plist not found at ${config.googleServiceInfo}`,
        colors.red
    );
    return false;
  }

  // Determine project name
  let projectName = config.projectName;

  if (!projectName) {
    log("Project name not specified, attempting to detect...", colors.blue);
    projectName = findIosProjectName(config.iosPath);

    if (projectName) {
      log(`Detected iOS project name: ${projectName}`, colors.green);
    } else {
      log(
          "Could not detect iOS project name. Please specify in the config file.",
          colors.red
      );
      return false;
    }
  }

  // Place GoogleService-Info.plist in the iOS root directory
  const destinationPath = path.join(config.iosPath, "GoogleService-Info.plist");

  // Copy the file
  try {
    log(
        `Copying GoogleService-Info.plist to ${destinationPath}...`,
        colors.blue
    );
    fs.copyFileSync(config.googleServiceInfo, destinationPath);
    log("File copied successfully!", colors.green);

    // Add the file to the Xcode project
    addFileToXcodeProject(config.iosPath, projectName, destinationPath);
  } catch (error) {
    log(`Error copying file: ${error.message}`, colors.red);
    return false;
  }

  log("=== GoogleService-Info.plist setup complete ===", colors.green);
  return true;
}

module.exports = setupGoogleServiceInfo;
