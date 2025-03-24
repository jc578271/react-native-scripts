/**
 * Module to update Info.plist file with bundle_urls from config.json
 * The Info.plist path is automatically determined from ios_project_name in config.json
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

/**
 * Update Info.plist with bundle URLs from config file
 * @param {string} configPath - Path to config file
 * @returns {boolean} - Success or failure
 */
function updateIosBundleUrls(configPath = "./config.json") {
  try {
    // Read and parse config file
    log(`Reading config from: ${configPath}`, colors.blue);
    const configData = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configData);

    // Ensure required fields exist
    if (!config.bundle_urls || !Array.isArray(config.bundle_urls)) {
      throw new Error("bundle_urls is missing or not an array in config file");
    }

    if (!config.ios_project_name) {
      throw new Error("ios_project_name is missing in config file");
    }

    // Determine Info.plist path based on ios_project_name
    const infoPlistPath = `./ios/${config.ios_project_name}/Info.plist`;

    if (!fs.existsSync(infoPlistPath)) {
      throw new Error(`Info.plist not found at ${infoPlistPath}`);
    }

    log(`Using ios_project_name: ${config.ios_project_name}`, colors.blue);
    log(
      `Found ${
        config.bundle_urls.length
      } bundle URLs: ${config.bundle_urls.join(", ")}`,
      colors.blue
    );

    // Use PlistBuddy to modify the plist file without changing its format
    // This assumes you're on macOS which has PlistBuddy

    // First, remove the existing CFBundleURLTypes if it exists
    try {
      execSync(
        `/usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "${infoPlistPath}"`,
        { stdio: "ignore" }
      );
      log("Removed existing CFBundleURLTypes", colors.yellow);
    } catch (error) {
      // Ignore error if the key doesn't exist
      log(
        "No existing CFBundleURLTypes found (this is normal for first run)",
        colors.yellow
      );
    }

    // Create the CFBundleURLTypes array
    execSync(
      `/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "${infoPlistPath}"`
    );
    log("Created CFBundleURLTypes array", colors.blue);

    // Add entries for each bundle URL
    config.bundle_urls.forEach((url, index) => {
      log(`Adding bundle URL: ${url} (index: ${index})`, colors.blue);

      // Add a new dict to the CFBundleURLTypes array
      execSync(
        `/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:${index} dict" "${infoPlistPath}"`
      );

      // Add CFBundleTypeRole
      execSync(
        `/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:${index}:CFBundleTypeRole string Editor" "${infoPlistPath}"`
      );

      // Add CFBundleURLName for the second entry as per example
      if (index === 1) {
        execSync(
          `/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:${index}:CFBundleURLName string 'sso login'" "${infoPlistPath}"`
        );
      }

      // Add CFBundleURLSchemes array
      execSync(
        `/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:${index}:CFBundleURLSchemes array" "${infoPlistPath}"`
      );

      // Add URL to CFBundleURLSchemes array
      execSync(
        `/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:${index}:CFBundleURLSchemes:0 string ${url}" "${infoPlistPath}"`
      );
    });

    log(
      "✅ Info.plist updated successfully with bundle URLs from config file!",
      colors.green
    );
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
    return false;
  }
}

module.exports = updateIosBundleUrls;
