#!/usr/bin/env node

/**
 * React Native App Preparation Script
 * This script prepares both Android and iOS app configurations with parameters from config files
 * and generates app icons and logos directly in the iOS project
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const generateAppAssets = require("./app_icons");
const updateIosBundleUrls = require("./bundle_urls");
const setupGoogleServiceInfo = require("./google_service_info");
const setupKeychainsIos = require("./keychains_ios");
const setupKeychainsAndroid = require("./keychains_android");

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
const DEFAULT_BUNDLE_ID = "com.myapp.default";
const DEFAULT_TEAM_ID = "ABCDEF1234";
const DEFAULT_DISPLAY_NAME = "My App";
const DEFAULT_APP_ICON = "";
const DEFAULT_LOGO_ICON = "";
const DEFAULT_PLATFORM = "all";
const DEFAULT_IOS_PROJECT_NAME = "MyApp";
const DEFAULT_VERSION = "1.0.0";
const DEFAULT_PRIMARY_COLOR = "#FFFFFF";
const DEFAULT_THEME_COLOR = "#000000";
const DEFAULT_KEYCHAINS = [];

// Function to load config from file
function loadConfig(configFile) {
  if (!fs.existsSync(configFile)) {
    log(`Error: Config file ${configFile} not found!`, colors.red);
    process.exit(1);
  }

  log(`Loading configuration from ${configFile}...`, colors.blue);

  try {
    const data = fs.readFileSync(configFile, "utf8");
    const config = JSON.parse(data);

    const result = {
      BUNDLE_ID: config.bundle_id || DEFAULT_BUNDLE_ID,
      TEAM_ID: config.team_id || DEFAULT_TEAM_ID,
      DISPLAY_NAME: config.display_name || DEFAULT_DISPLAY_NAME,
      APP_ICON: config.app_icon || DEFAULT_APP_ICON,
      LOGO_ICON: config.logo_icon || DEFAULT_LOGO_ICON,
      PRIMARY_COLOR: config.primary_color || DEFAULT_PRIMARY_COLOR,
      THEME_COLOR: config.theme_color || DEFAULT_THEME_COLOR,
      PLATFORM: config.platform || DEFAULT_PLATFORM,
      IOS_PROJECT_NAME: config.ios_project_name || DEFAULT_IOS_PROJECT_NAME,
      VERSION: config.version || DEFAULT_VERSION,
      KEYCHAINS: Array.isArray(config.keychains)
        ? config.keychains
        : DEFAULT_KEYCHAINS,
    };

    // Use display_name for both iOS and Android
    result.APP_NAME = result.DISPLAY_NAME;

    // Use bundle_id for Android too
    result.ANDROID_APP_ID = result.BUNDLE_ID;

    log("Configuration loaded successfully.", colors.green);
    return result;
  } catch (error) {
    log(`Error parsing config file: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Function to update iOS configuration
function updateIosConfig(config) {
  log("Updating iOS configuration...", colors.blue);

  // Update Info.plist
  const plistPath = `ios/${config.IOS_PROJECT_NAME}/Info.plist`;

  // Update bundle identifier in project.pbxproj
  const pbxprojPath = `ios/${config.IOS_PROJECT_NAME}.xcodeproj/project.pbxproj`;

  // Check if files exist
  if (!fs.existsSync(plistPath)) {
    log(`Error: ${plistPath} not found!`, colors.red);
    process.exit(1);
  }

  if (!fs.existsSync(pbxprojPath)) {
    log(`Error: ${pbxprojPath} not found!`, colors.red);
    process.exit(1);
  }

  // Update bundle display name in Info.plist
  execSync(
    `/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${config.DISPLAY_NAME}" "${plistPath}"`
  );

  // Update bundle identifier in Info.plist (additional to project.pbxproj)
  execSync(
    `/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ${config.BUNDLE_ID}" "${plistPath}"`
  );

  // Replace bundle identifier in project.pbxproj
  // Update DEVELOPMENT_TEAM in project.pbxproj - this handles both quoted and unquoted values
  let pbxprojContent = fs.readFileSync(pbxprojPath, "utf8");
  pbxprojContent = pbxprojContent.replace(
    /DEVELOPMENT_TEAM = ("[^"]*"|[^"]*);/g,
    `DEVELOPMENT_TEAM = ${config.TEAM_ID};`
  );

  // Handle the case where DEVELOPMENT_TEAM might be missing and needs to be added
  if (!pbxprojContent.includes("DEVELOPMENT_TEAM")) {
    pbxprojContent = pbxprojContent.replace(
      /buildSettings = {/g,
      `buildSettings = {\n\t\t\t\tDEVELOPMENT_TEAM = ${config.TEAM_ID};`
    );
  }

  // Update version number in Info.plist
  execSync(
    `/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${config.VERSION}" "${plistPath}"`
  );

  // Get current build number
  let currentBuild = "0";
  try {
    currentBuild = execSync(
      `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plistPath}"`,
      { encoding: "utf8" }
    ).trim();
  } catch (error) {
    // If current build is not found, start with 0
  }

  let newBuild = currentBuild;

  // Only auto-increment build number if autoVersionCode flag is set
  if (config.autoVersionCode) {
    newBuild = isNaN(parseInt(currentBuild)) ? 1 : parseInt(currentBuild) + 1;

    log(
      `Auto-incrementing iOS build number from ${currentBuild} to ${newBuild}`,
      colors.blue
    );

    // Update build number in Info.plist
    execSync(
      `/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${newBuild}" "${plistPath}"`
    );

    log(
      `iOS version updated to ${config.VERSION} (build ${newBuild})`,
      colors.green
    );
  } else {
    // Keep current build number
    log(`Keeping current iOS build number: ${currentBuild}`, colors.blue);

    log(
      `iOS version updated to ${config.VERSION} (build unchanged)`,
      colors.green
    );
  }

  // Update entitlements
  const entitlementsFiles = fs
    .readdirSync(`ios/${config.IOS_PROJECT_NAME}`)
    .filter((file) => file.endsWith(".entitlements"))
    .map((file) => path.join(`ios/${config.IOS_PROJECT_NAME}`, file));

  if (entitlementsFiles.length > 0) {
    const entitlementsPath = entitlementsFiles[0];

    // Ensure aps-environment is set to production
    let entitlementsContent = fs.readFileSync(entitlementsPath, "utf8");

    if (!entitlementsContent.includes("<key>aps-environment</key>")) {
      log("Adding aps-environment entitlement...", colors.blue);
      // Add before the closing dict tag
      entitlementsContent = entitlementsContent.replace(
        "</dict>",
        "\t<key>aps-environment</key>\n\t<string>production</string>\n</dict>"
      );
    } else {
      // Update existing aps-environment to production
      entitlementsContent = entitlementsContent.replace(
        "<string>development</string>",
        "<string>production</string>"
      );
    }

    fs.writeFileSync(entitlementsPath, entitlementsContent);

    // Setup keychains in iOS
    setupKeychainsIos(config.CONFIG_FILE);
  } else {
    log(
      "Warning: No entitlements file found. Push notifications might not work properly.",
      colors.yellow
    );
  }

  // Update bundle URLs
  updateIosBundleUrls(config.CONFIG_FILE);

  // Setup Google Service Info
  setupGoogleServiceInfo(config.CONFIG_FILE);

  log("iOS configuration updated successfully.", colors.green);
}

// Function to update Android configuration
function updateAndroidConfig(config) {
  log("Updating Android configuration...", colors.blue);

  // Update applicationId in build.gradle
  const gradlePath = "android/app/build.gradle";

  // Update app_name in strings.xml
  const stringsPath = "android/app/src/main/res/values/strings.xml";

  // Update colors in colors.xml
  const colorsPath = "android/app/src/main/res/values/colors.xml";
  const colorsNightPath = "android/app/src/main/res/values-night/colors.xml";

  // Update AndroidManifest.xml for keychains
  const manifestPath = "android/app/src/main/AndroidManifest.xml";

  // Check if files exist
  if (!fs.existsSync(gradlePath)) {
    log(`Error: ${gradlePath} not found!`, colors.red);
    process.exit(1);
  }

  if (!fs.existsSync(stringsPath)) {
    log(`Error: ${stringsPath} not found!`, colors.red);
    process.exit(1);
  }

  if (!fs.existsSync(colorsPath)) {
    log(`Error: ${colorsPath} not found!`, colors.red);
    process.exit(1);
  }

  if (!fs.existsSync(manifestPath)) {
    log(`Error: ${manifestPath} not found!`, colors.red);
    process.exit(1);
  }

  // Update applicationId in build.gradle
  let gradleContent = fs.readFileSync(gradlePath, "utf8");
  gradleContent = gradleContent.replace(
    /applicationId "[^"]*"/,
    `applicationId "${config.ANDROID_APP_ID}"`
  );

  // Update app_name in strings.xml
  let stringsContent = fs.readFileSync(stringsPath, "utf8");
  stringsContent = stringsContent.replace(
    /<string name="app_name">.*<\/string>/,
    `<string name="app_name">${config.APP_NAME}</string>`
  );
  fs.writeFileSync(stringsPath, stringsContent);

  // Update colors
  let colorsContent = fs.readFileSync(colorsPath, "utf8");
  colorsContent = colorsContent.replace(
    /<color name="primary_color">.*<\/color>/,
    `<color name="primary_color">${config.PRIMARY_COLOR}</color>`
  );
  colorsContent = colorsContent.replace(
    /<color name="theme_color">.*<\/color>/,
    `<color name="theme_color">${config.THEME_COLOR}</color>`
  );
  fs.writeFileSync(colorsPath, colorsContent);

  // Update night colors if file exists
  if (fs.existsSync(colorsNightPath)) {
    let colorsNightContent = fs.readFileSync(colorsNightPath, "utf8");
    colorsNightContent = colorsNightContent.replace(
      /<color name="primary_color">.*<\/color>/,
      `<color name="primary_color">${config.PRIMARY_COLOR}</color>`
    );
    colorsNightContent = colorsNightContent.replace(
      /<color name="theme_color">.*<\/color>/,
      `<color name="theme_color">${config.THEME_COLOR}</color>`
    );
    fs.writeFileSync(colorsNightPath, colorsNightContent);
  }

  // Update version in build.gradle
  gradleContent = gradleContent.replace(
    /versionName "[^"]*"/,
    `versionName "${config.VERSION}"`
  );

  // Get current version code (build number)
  const versionCodeMatch = gradleContent.match(/versionCode (\d+)/);
  let currentVersionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : 0;

  let newVersionCode;

  // Only auto-increment version code if autoVersionCode flag is set
  if (config.autoVersionCode) {
    newVersionCode = currentVersionCode + 1;
    log(
      `Auto-incrementing version code from ${currentVersionCode} to ${newVersionCode}`,
      colors.blue
    );

    // Update version code in build.gradle
    gradleContent = gradleContent.replace(
      /versionCode \d+/,
      `versionCode ${newVersionCode}`
    );
    fs.writeFileSync(gradlePath, gradleContent);

    log(
      `Android version updated to ${config.VERSION} (code ${newVersionCode})`,
      colors.green
    );
  } else {
    // Keep current version code
    log(`Keeping current version code: ${currentVersionCode}`, colors.blue);

    log(
      `Android version updated to ${config.VERSION} (code unchanged)`,
      colors.green
    );
  }

  // Setup keychains in Android
  setupKeychainsAndroid(config.CONFIG_FILE);

  log("Android configuration updated successfully.", colors.green);
}

// Parse command line arguments
function parseArgs() {
  const args = {
    configFile: DEFAULT_CONFIG_FILE,
    appIcon: null,
    logoIcon: null,
    autoVersionCode: false,
    help: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === "--file" && i + 1 < process.argv.length) {
      args.configFile = process.argv[++i];
    } else if (arg === "--app-icon" && i + 1 < process.argv.length) {
      args.appIcon = process.argv[++i];
    } else if (arg === "--logo" && i + 1 < process.argv.length) {
      args.logoIcon = process.argv[++i];
    } else if (arg === "--autoVersionCode" && i + 1 < process.argv.length) {
      // Accept a value for autoVersionCode (0 = false, 1 = true)
      const value = process.argv[++i];
      if (value === "1") {
        args.autoVersionCode = true;
      } else if (value === "0") {
        args.autoVersionCode = false;
      } else {
        log(
          `Warning: Invalid value for --autoVersionCode: ${value}. Expected 0 or 1. Defaulting to 0.`,
          colors.yellow
        );
        args.autoVersionCode = false;
      }
    } else if (arg === "--autoVersionCode") {
      // Also support flag-style usage (no argument)
      args.autoVersionCode = true;
    } else if (arg === "--help") {
      args.help = true;
    } else {
      log(`Unknown option: ${arg}`, colors.red);
      log("Use --help for available options.", colors.yellow);
      process.exit(1);
    }
  }

  return args;
}

// Display help message
function showHelp() {
  log("Usage: node prepare.js [options]", colors.green);
  log("Options:");
  log(
    `  --file           Path to configuration file (default: ${DEFAULT_CONFIG_FILE})`
  );
  log(
    "  --app-icon       Path to 1024x1024 PNG image for app icon (overrides config file)"
  );
  log(
    "  --logo           Path to 64x64 PNG image for ic_logo (overrides config file)"
  );
  log(
    "  --autoVersionCode [0|1]  Auto-increment version numbers (0=disabled, 1=enabled, default: 0)"
  );
  log("  --help           Show this help message");
  process.exit(0);
}

// Main function
function main() {
  // Parse command line arguments
  const args = parseArgs();

  // Show help if requested
  if (args.help) {
    showHelp();
  }

  // Load configuration from file
  const config = loadConfig(args.configFile);
  config.CONFIG_FILE = args.configFile;

  // Override with command line values if provided
  if (args.appIcon) config.APP_ICON = args.appIcon;
  if (args.logoIcon) config.LOGO_ICON = args.logoIcon;
  config.autoVersionCode = args.autoVersionCode;

  // Display main configuration
  log("React Native App Preparation Script", colors.green);
  log("=========================", colors.green);
  log("Building with parameters:");
  log(
    `Bundle ID: ${config.BUNDLE_ID} (used for both iOS and Android)`,
    colors.blue
  );
  log(`Team ID: ${config.TEAM_ID}`, colors.blue);
  log(
    `Display Name: ${config.DISPLAY_NAME} (used for both iOS and Android)`,
    colors.blue
  );
  log(`iOS Project Name: ${config.IOS_PROJECT_NAME}`, colors.blue);
  log(
    `Version: ${config.VERSION} ${
      config.autoVersionCode
        ? "(build numbers will be auto-incremented)"
        : "(build numbers will remain unchanged)"
    }`,
    colors.blue
  );
  log(`Primary Color: ${config.PRIMARY_COLOR}`, colors.blue);
  log(`Theme Color: ${config.THEME_COLOR}`, colors.blue);
  log(`Platform: ${config.PLATFORM}`, colors.blue);
  log(`App Icon: ${config.APP_ICON}`, colors.blue);
  log(`Logo Icon: ${config.LOGO_ICON}`, colors.blue);

  if (config.KEYCHAINS.length > 0) {
    log("Keychains:", colors.blue);
    for (const keychain of config.KEYCHAINS) {
      log(`  - ${keychain}`, colors.blue);
    }
  }
  log("=========================", colors.green);

  // Generate app assets first
  generateAppAssets({
    configFile: args.configFile,
    appIcon: config.APP_ICON,
    logoIcon: config.LOGO_ICON,
    iosProjectName: config.IOS_PROJECT_NAME,
  });

  // Update configurations based on platform
  if (config.PLATFORM === "ios" || config.PLATFORM === "all") {
    updateIosConfig(config);
  }

  if (config.PLATFORM === "android" || config.PLATFORM === "all") {
    updateAndroidConfig(config);
  }

  log(
    "Preparation process completed successfully! You can now run the build script to create release builds.",
    colors.green
  );
}

// Execute main function
main();
