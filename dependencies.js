#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Configuration
const PACKAGES_DIR = "../../packages"; // Directory for local packages
const GIT_PACKAGES_PATH = path.resolve("./git_packages.json");

// Check if git_packages.json exists
if (!fs.existsSync(GIT_PACKAGES_PATH)) {
  console.error("❌ git_packages.json not found. Please create it first.");
  process.exit(1);
}

// Load git packages
const gitPackages = JSON.parse(fs.readFileSync(GIT_PACKAGES_PATH, "utf8"));

// Load package.json
const packageJsonPath = path.resolve("./package.json");
const packageJson = require(packageJsonPath);

// Ensure workspace configuration is correct
if (
  !packageJson.workspaces ||
  !packageJson.workspaces.includes(`${PACKAGES_DIR}/*`)
) {
  if (!packageJson.workspaces) {
    packageJson.workspaces = [`${PACKAGES_DIR}/*`];
  } else if (Array.isArray(packageJson.workspaces)) {
    if (!packageJson.workspaces.includes(`${PACKAGES_DIR}/*`)) {
      packageJson.workspaces.push(`${PACKAGES_DIR}/*`);
    }
  }
  console.log(`📝 Updated workspaces to include "${PACKAGES_DIR}/*"`);
}

// Check if the packages directory exists
const packagesDir = path.resolve(`./${PACKAGES_DIR}`);
if (!fs.existsSync(packagesDir)) {
  console.log(`❌ ${PACKAGES_DIR}/ directory not found. Creating it...`);
  fs.mkdirSync(packagesDir, { recursive: true });
}

// Function to find all local packages
function findLocalPackages() {
  const localPackages = {};

  if (!fs.existsSync(packagesDir)) return localPackages;

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packageDir = path.join(packagesDir, entry.name);
      const packageJsonPath = path.join(packageDir, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        try {
          const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
          if (pkgJson.name) {
            localPackages[pkgJson.name] = {
              path: entry.name,
              version: pkgJson.version || "1.0.0",
            };
            console.log(
              `✅ Found local package: ${pkgJson.name} in ${PACKAGES_DIR}/${entry.name}`
            );
          }
        } catch (error) {
          console.warn(
            `⚠️ Error reading package.json in ${packageDir}: ${error.message}`
          );
        }
      }
    }
  }

  return localPackages;
}

// Get all local packages
const localPackages = findLocalPackages();
console.log(
  `Found ${
    Object.keys(localPackages).length
  } local packages in ${PACKAGES_DIR}/`
);

// Track changes
let hasChanges = false;

// Update dependencies based on what's available locally
console.log("\nChecking regular dependencies...");
for (const [depName, gitUrl] of Object.entries(
  gitPackages.dependencies || {}
)) {
  if (depName in localPackages) {
    // Package exists locally, use workspace reference
    const localPath = `link:./${PACKAGES_DIR}/${localPackages[depName].path}`;
    if (packageJson.dependencies[depName] !== localPath) {
      console.log(
        `🔄 Using local ${depName} from ${PACKAGES_DIR}/${localPackages[depName].path}`
      );
      packageJson.dependencies[depName] = localPath;
      hasChanges = true;
    }
  } else {
    // No local package, use git
    if (
      packageJson.dependencies[depName] !== gitUrl &&
      packageJson.dependencies[depName]
    ) {
      console.log(`🔄 Using git repository for ${depName}: ${gitUrl}`);
      packageJson.dependencies[depName] = gitUrl;
      hasChanges = true;
    } else if (!packageJson.dependencies[depName]) {
      console.log(
        `⚠️ ${depName} is in git_packages.json but not in package.json dependencies`
      );
    }
  }
}

console.log("\nChecking devDependencies...");
for (const [depName, gitUrl] of Object.entries(
  gitPackages.devDependencies || {}
)) {
  if (depName in localPackages) {
    // Package exists locally, use workspace reference
    const localPath = `link:./${PACKAGES_DIR}/${localPackages[depName].path}`;
    if (packageJson.devDependencies[depName] !== localPath) {
      console.log(
        `🔄 Using local ${depName} from ${PACKAGES_DIR}/${localPackages[depName].path}`
      );
      if (!packageJson.devDependencies) packageJson.devDependencies = {};
      packageJson.devDependencies[depName] = localPath;
      hasChanges = true;
    }
  } else {
    // No local package, use git
    if (
      packageJson.devDependencies &&
      packageJson.devDependencies[depName] !== gitUrl &&
      packageJson.devDependencies[depName]
    ) {
      console.log(`🔄 Using git repository for ${depName}: ${gitUrl}`);
      packageJson.devDependencies[depName] = gitUrl;
      hasChanges = true;
    } else if (
      !packageJson.devDependencies ||
      !packageJson.devDependencies[depName]
    ) {
      console.log(
        `⚠️ ${depName} is in git_packages.json devDependencies but not in package.json devDependencies`
      );
    }
  }
}

// Check for link: dependencies that no longer exist in regular dependencies
for (const [depName, depValue] of Object.entries(
  packageJson.dependencies || {}
)) {
  if (
    typeof depValue === "string" &&
    depValue.startsWith("link:") &&
    !(depName in localPackages)
  ) {
    // This is a link to a local package that doesn't exist anymore
    if (gitPackages.dependencies && gitPackages.dependencies[depName]) {
      console.log(
        `🔄 Replacing broken link for ${depName} with git repository in dependencies`
      );
      packageJson.dependencies[depName] = gitPackages.dependencies[depName];
      hasChanges = true;
    } else {
      console.warn(
        `⚠️ Found broken link reference for ${depName} in dependencies but no git fallback defined in git_packages.json`
      );
    }
  }
}

// Check for link: dependencies that no longer exist in devDependencies
for (const [depName, depValue] of Object.entries(
  packageJson.devDependencies || {}
)) {
  if (
    typeof depValue === "string" &&
    depValue.startsWith("link:") &&
    !(depName in localPackages)
  ) {
    // This is a link to a local package that doesn't exist anymore
    if (gitPackages.devDependencies && gitPackages.devDependencies[depName]) {
      console.log(
        `🔄 Replacing broken link for ${depName} with git repository in devDependencies`
      );
      packageJson.devDependencies[depName] =
        gitPackages.devDependencies[depName];
      hasChanges = true;
    } else {
      console.warn(
        `⚠️ Found broken link reference for ${depName} in devDependencies but no git fallback defined in git_packages.json`
      );
    }
  }
}

// Sort dependencies alphabetically
function sortObjectByKeys(obj) {
  if (!obj) return {};
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

// Always sort dependencies and devDependencies, even if no other changes were made
console.log("\n📝 Sorting all dependencies alphabetically");

// Sort dependencies and devDependencies alphabetically
if (packageJson.dependencies) {
  const originalDeps = JSON.stringify(packageJson.dependencies);
  packageJson.dependencies = sortObjectByKeys(packageJson.dependencies);
  if (originalDeps !== JSON.stringify(packageJson.dependencies)) {
    hasChanges = true;
  }
}

if (packageJson.devDependencies) {
  const originalDevDeps = JSON.stringify(packageJson.devDependencies);
  packageJson.devDependencies = sortObjectByKeys(packageJson.devDependencies);
  if (originalDevDeps !== JSON.stringify(packageJson.devDependencies)) {
    hasChanges = true;
  }
}

// Write changes if necessary
if (hasChanges) {
  console.log("📝 Updating package.json with changes");
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n"
  );
  console.log(
    "✅ package.json updated successfully with alphabetically sorted dependencies"
  );
} else {
  console.log("✅ No changes needed in package.json");
}

// Add helper information
console.log(`
📋 How to use this script:

1. Add git package references to git_packages.json
2. To use a local version of a package:
   - Clone or create the package in "${PACKAGES_DIR}/" directory
   - Ensure it has a valid package.json with a "name" field matching the one in git_packages.json
   - Run this script again

3. To switch back to git versions:
   - Simply remove the local package directory
   - Run this script again

Run this script before yarn install to ensure dependencies are correctly configured.
`);
