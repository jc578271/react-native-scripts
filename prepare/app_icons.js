/**
 * App Assets Generator Module
 * This module generates iOS app icons and logos directly in the iOS project
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
const DEFAULT_APP_ICON = "";
const DEFAULT_LOGO_ICON = "";
const DEFAULT_IOS_PROJECT_NAME = "MyApp";

// Load configuration from file
function loadConfig(configFile, options = {}) {
  if (!fs.existsSync(configFile)) {
    log(`Error: Config file ${configFile} not found!`, colors.red);
    throw new Error(`Config file ${configFile} not found!`);
  }

  log(`Loading configuration from ${configFile}...`, colors.blue);

  try {
    const configData = fs.readFileSync(configFile, "utf8");
    const config = JSON.parse(configData);

    // Get values from config file if not provided in options
    return {
      appIcon: options.appIcon || config.app_icon || DEFAULT_APP_ICON,
      logoIcon: options.logoIcon || config.logo_icon || DEFAULT_LOGO_ICON,
      iosProjectName:
        options.iosProjectName ||
        config.ios_project_name ||
        DEFAULT_IOS_PROJECT_NAME,
    };
  } catch (error) {
    log(`Error parsing config file: ${error.message}`, colors.red);
    throw error;
  }
}

// Generate app icons and logo
function generateAppAssets(options) {
  const configFile = options.configFile || DEFAULT_CONFIG_FILE;
  let appIcon, logoIcon, iosProjectName;

  try {
    // If appIcon, logoIcon, or iosProjectName are directly provided, use them
    // Otherwise, try to load from config file
    if (options.appIcon && options.logoIcon && options.iosProjectName) {
      appIcon = options.appIcon;
      logoIcon = options.logoIcon;
      iosProjectName = options.iosProjectName;
    } else {
      const config = loadConfig(configFile, options);
      appIcon = config.appIcon;
      logoIcon = config.logoIcon;
      iosProjectName = config.iosProjectName;
    }
  } catch (error) {
    log(`Failed to load configuration: ${error.message}`, colors.red);
    return false;
  }

  log("Generating app assets...", colors.green);

  // Check if app icon parameter was provided
  if (!appIcon) {
    log(
      "Warning: No app icon provided. Skipping app icon generation.",
      colors.yellow
    );
    return false;
  }

  // Check if app icon file exists and is a PNG
  if (!fs.existsSync(appIcon)) {
    log(`Error: App icon file '${appIcon}' does not exist.`, colors.red);
    return false;
  }

  if (!appIcon.toLowerCase().endsWith(".png")) {
    log("Error: App icon file must be a PNG file.", colors.red);
    return false;
  }

  // Check logo if provided
  if (logoIcon) {
    if (!fs.existsSync(logoIcon)) {
      log(`Error: Logo file '${logoIcon}' does not exist.`, colors.red);
      return false;
    }

    if (!logoIcon.toLowerCase().endsWith(".png")) {
      log("Error: Logo file must be a PNG file.", colors.red);
      return false;
    }
  }

  // Check if ImageMagick is installed
  let convertCmd = "";
  try {
    execSync("magick -version", { stdio: "ignore" });
    convertCmd = "magick";
  } catch (error) {
    try {
      execSync("convert -version", { stdio: "ignore" });
      convertCmd = "convert";
    } catch (error) {
      log(
        "Error: ImageMagick is not installed. Please install it using:",
        colors.red
      );
      log("  brew install imagemagick", colors.yellow);
      return false;
    }
  }

  // Generate app icons directly into iOS project assets directory
  log("Generating iOS app icons...", colors.blue);

  // Create AppIcon.appiconset directory directly in the iOS project
  const appiconset = `ios/${iosProjectName}/Images.xcassets/AppIcon.appiconset`;
  fs.mkdirSync(appiconset, { recursive: true });

  // Create Contents.json file for AppIcon with all icon sizes from provided Content.json
  fs.writeFileSync(`${appiconset}/Contents.json`, APPICON_CONTENTS_JSON);

  // Function to extract size from a filename
  function extractSize(filename, sizeInfo) {
    // Extract width and height from size_info (format: "WxH")
    const [width, height] = sizeInfo.split("x");

    log(`Creating ${filename} (${width}x${height})...`, colors.blue);
    execSync(
      `${convertCmd} "${appIcon}" -resize ${width}x${height} "${appiconset}/${filename}"`
    );
  }

  // Generate all the required icon sizes
  log("Generating all icon sizes from source image...", colors.blue);
  const iconSizes = [
    ["16.png", "16x16"],
    ["20.png", "20x20"],
    ["29.png", "29x29"],
    ["32.png", "32x32"],
    ["40.png", "40x40"],
    ["48.png", "48x48"],
    ["50.png", "50x50"],
    ["55.png", "55x55"],
    ["57.png", "57x57"],
    ["58.png", "58x58"],
    ["60.png", "60x60"],
    ["64.png", "64x64"],
    ["66.png", "66x66"],
    ["72.png", "72x72"],
    ["76.png", "76x76"],
    ["80.png", "80x80"],
    ["87.png", "87x87"],
    ["88.png", "88x88"],
    ["92.png", "92x92"],
    ["100.png", "100x100"],
    ["102.png", "102x102"],
    ["108.png", "108x108"],
    ["114.png", "114x114"],
    ["120.png", "120x120"],
    ["128.png", "128x128"],
    ["144.png", "144x144"],
    ["152.png", "152x152"],
    ["167.png", "167x167"],
    ["172.png", "172x172"],
    ["180.png", "180x180"],
    ["196.png", "196x196"],
    ["216.png", "216x216"],
    ["234.png", "234x234"],
    ["256.png", "256x256"],
    ["258.png", "258x258"],
    ["512.png", "512x512"],
    ["1024.png", "1024x1024"],
  ];

  // Process each icon size
  for (const [filename, size] of iconSizes) {
    extractSize(filename, size);
  }

  log(`App icons generated successfully at: ${appiconset}`, colors.green);

  // Generate Logo Image Set if provided
  if (logoIcon) {
    log("Generating ic_logo image set...", colors.blue);

    // Create ic_logo.imageset directory directly in the iOS project
    const logoDir = `ios/${iosProjectName}/Images.xcassets/ic_logo.imageset`;
    fs.mkdirSync(logoDir, { recursive: true });

    // Get logo dimensions
    let logoDimensions;
    try {
      if (convertCmd === "magick") {
        logoDimensions = execSync(
          `magick identify -format "%wx%h" "${logoIcon}"`
        )
          .toString()
          .trim();
      } else {
        logoDimensions = execSync(`identify -format "%wx%h" "${logoIcon}"`)
          .toString()
          .trim();
      }
    } catch (error) {
      log(
        "Warning: Could not get logo dimensions. Assuming it needs resizing.",
        colors.yellow
      );
      logoDimensions = "unknown";
    }

    if (logoDimensions !== "64x64") {
      log(
        `Warning: Logo image is ${logoDimensions}, not 64x64. Resizing...`,
        colors.yellow
      );
      execSync(
        `${convertCmd} "${logoIcon}" -resize 64x64 "${logoDir}/ic_logo.png"`
      );
    } else {
      fs.copyFileSync(logoIcon, `${logoDir}/ic_logo.png`);
    }

    // Generate @2x version (128x128)
    execSync(
      `${convertCmd} "${logoIcon}" -resize 128x128 "${logoDir}/ic_logo@2x.png"`
    );

    // Generate @3x version (192x192)
    execSync(
      `${convertCmd} "${logoIcon}" -resize 192x192 "${logoDir}/ic_logo@3x.png"`
    );

    // Create Contents.json for ic_logo
    const logoContentsJson = `{
  "images" : [
    {
      "idiom" : "universal",
      "filename" : "ic_logo.png",
      "scale" : "1x"
    },
    {
      "idiom" : "universal",
      "filename" : "ic_logo@2x.png",
      "scale" : "2x"
    },
    {
      "idiom" : "universal",
      "filename" : "ic_logo@3x.png",
      "scale" : "3x"
    }
  ],
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}`;

    fs.writeFileSync(`${logoDir}/Contents.json`, logoContentsJson);
    log(`Logo image set generated successfully at: ${logoDir}`, colors.green);
  }

  log(
    "App icons and logo generated directly in the iOS project's Images.xcassets directory.",
    colors.green
  );
  return true;
}

// AppIcon Contents.json
const APPICON_CONTENTS_JSON = `{
  "images": [
    {
      "filename": "40.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "20x20"
    },
    {
      "filename": "60.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "20x20"
    },
    {
      "filename": "29.png",
      "idiom": "iphone",
      "scale": "1x",
      "size": "29x29"
    },
    {
      "filename": "58.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "87.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "29x29"
    },
    {
      "filename": "80.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "40x40"
    },
    {
      "filename": "120.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "40x40"
    },
    {
      "filename": "57.png",
      "idiom": "iphone",
      "scale": "1x",
      "size": "57x57"
    },
    {
      "filename": "114.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "57x57"
    },
    {
      "filename": "120.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "60x60"
    },
    {
      "filename": "180.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "60x60"
    },
    {
      "filename": "20.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "20x20"
    },
    {
      "filename": "40.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "20x20"
    },
    {
      "filename": "29.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "29x29"
    },
    {
      "filename": "58.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "40.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "40x40"
    },
    {
      "filename": "80.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "40x40"
    },
    {
      "filename": "50.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "50x50"
    },
    {
      "filename": "100.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "50x50"
    },
    {
      "filename": "72.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "72x72"
    },
    {
      "filename": "144.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "72x72"
    },
    {
      "filename": "76.png",
      "idiom": "ipad",
      "scale": "1x",
      "size": "76x76"
    },
    {
      "filename": "152.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "76x76"
    },
    {
      "filename": "167.png",
      "idiom": "ipad",
      "scale": "2x",
      "size": "83.5x83.5"
    },
    {
      "filename": "1024.png",
      "idiom": "ios-marketing",
      "scale": "1x",
      "size": "1024x1024"
    },
    {
      "filename": "16.png",
      "idiom": "mac",
      "scale": "1x",
      "size": "16x16"
    },
    {
      "filename": "32.png",
      "idiom": "mac",
      "scale": "2x",
      "size": "16x16"
    },
    {
      "filename": "32.png",
      "idiom": "mac",
      "scale": "1x",
      "size": "32x32"
    },
    {
      "filename": "64.png",
      "idiom": "mac",
      "scale": "2x",
      "size": "32x32"
    },
    {
      "filename": "128.png",
      "idiom": "mac",
      "scale": "1x",
      "size": "128x128"
    },
    {
      "filename": "256.png",
      "idiom": "mac",
      "scale": "2x",
      "size": "128x128"
    },
    {
      "filename": "256.png",
      "idiom": "mac",
      "scale": "1x",
      "size": "256x256"
    },
    {
      "filename": "512.png",
      "idiom": "mac",
      "scale": "2x",
      "size": "256x256"
    },
    {
      "filename": "512.png",
      "idiom": "mac",
      "scale": "1x",
      "size": "512x512"
    },
    {
      "filename": "1024.png",
      "idiom": "mac",
      "scale": "2x",
      "size": "512x512"
    },
    {
      "filename": "48.png",
      "idiom": "watch",
      "role": "notificationCenter",
      "scale": "2x",
      "size": "24x24",
      "subtype": "38mm"
    },
    {
      "filename": "55.png",
      "idiom": "watch",
      "role": "notificationCenter",
      "scale": "2x",
      "size": "27.5x27.5",
      "subtype": "42mm"
    },
    {
      "filename": "58.png",
      "idiom": "watch",
      "role": "companionSettings",
      "scale": "2x",
      "size": "29x29"
    },
    {
      "filename": "87.png",
      "idiom": "watch",
      "role": "companionSettings",
      "scale": "3x",
      "size": "29x29"
    },
    {
      "filename": "66.png",
      "idiom": "watch",
      "role": "notificationCenter",
      "scale": "2x",
      "size": "33x33",
      "subtype": "45mm"
    },
    {
      "filename": "80.png",
      "idiom": "watch",
      "role": "appLauncher",
      "scale": "2x",
      "size": "40x40",
      "subtype": "38mm"
    },
    {
      "filename": "88.png",
      "idiom": "watch",
      "role": "appLauncher",
      "scale": "2x",
      "size": "44x44",
      "subtype": "40mm"
    },
    {
      "filename": "92.png",
      "idiom": "watch",
      "role": "appLauncher",
      "scale": "2x",
      "size": "46x46",
      "subtype": "41mm"
    },
    {
      "filename": "100.png",
      "idiom": "watch",
      "role": "appLauncher",
      "scale": "2x",
      "size": "50x50",
      "subtype": "44mm"
    },
    {
      "filename": "102.png",
      "idiom": "watch",
      "role": "appLauncher",
      "scale": "2x",
      "size": "51x51",
      "subtype": "45mm"
    },
    {
      "filename": "108.png",
      "idiom": "watch",
      "role": "appLauncher",
      "scale": "2x",
      "size": "54x54",
      "subtype": "49mm"
    },
    {
      "filename": "172.png",
      "idiom": "watch",
      "role": "quickLook",
      "scale": "2x",
      "size": "86x86",
      "subtype": "38mm"
    },
    {
      "filename": "196.png",
      "idiom": "watch",
      "role": "quickLook",
      "scale": "2x",
      "size": "98x98",
      "subtype": "42mm"
    },
    {
      "filename": "216.png",
      "idiom": "watch",
      "role": "quickLook",
      "scale": "2x",
      "size": "108x108",
      "subtype": "44mm"
    },
    {
      "filename": "234.png",
      "idiom": "watch",
      "role": "quickLook",
      "scale": "2x",
      "size": "117x117",
      "subtype": "45mm"
    },
    {
      "filename": "258.png",
      "idiom": "watch",
      "role": "quickLook",
      "scale": "2x",
      "size": "129x129",
      "subtype": "49mm"
    },
    {
      "filename": "1024.png",
      "idiom": "watch-marketing",
      "scale": "1x",
      "size": "1024x1024"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}`;

// Export the function
module.exports = generateAppAssets;
