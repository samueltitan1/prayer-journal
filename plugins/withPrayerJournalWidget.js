const fs = require("fs");
const path = require("path");
const plistModule = require("@expo/plist");
const plist = plistModule.default ?? plistModule;
const {
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} = require("@expo/config-plugins");

const { addXCConfigurationList } = require("react-native-widget-extension/plugin/build/xcode/addXCConfigurationList");
const { addProductFile } = require("react-native-widget-extension/plugin/build/xcode/addProductFile");
const { addToPbxNativeTargetSection } = require("react-native-widget-extension/plugin/build/xcode/addToPbxNativeTargetSection");
const { addToPbxProjectSection } = require("react-native-widget-extension/plugin/build/xcode/addToPbxProjectSection");
const { addTargetDependency } = require("react-native-widget-extension/plugin/build/xcode/addTargetDependency");
const { addBuildPhases } = require("react-native-widget-extension/plugin/build/xcode/addBuildPhases");
const { addPbxGroup } = require("react-native-widget-extension/plugin/build/xcode/addPbxGroup");

const TARGET_NAME = "PrayerJournalWidget";
const SOURCE_WIDGET_DIR = "widget/PrayerJournalWidget";
const IOS_WIDGET_DIR = "PrayerJournalWidget";
const APP_GROUP = "group.app.prayerjournal.widget";
const DEPLOYMENT_TARGET = "16.0";
const PODFILE_MARKER = "# >>> Inserted by withPrayerJournalWidget";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensurePlistFile(plistPath, contents) {
  if (fs.existsSync(plistPath)) return;
  ensureDir(path.dirname(plistPath));
  fs.writeFileSync(plistPath, plist.build(contents));
}

function findProjectName(iosRoot) {
  const xcodeProj = fs
    .readdirSync(iosRoot)
    .find((entry) => entry.endsWith(".xcodeproj"));
  return xcodeProj ? path.basename(xcodeProj, ".xcodeproj") : null;
}

function ensureExpectedInfoPlists(iosRoot, appBundleIdentifier) {
  const projectName = findProjectName(iosRoot);
  if (!projectName) return;

  const appInfoPlistPath = path.join(iosRoot, projectName, "Info.plist");
  ensurePlistFile(appInfoPlistPath, {
    CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    CFBundleDisplayName: projectName,
    CFBundleExecutable: "$(EXECUTABLE_NAME)",
    CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    CFBundleInfoDictionaryVersion: "6.0",
    CFBundleName: "$(PRODUCT_NAME)",
    CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    CFBundleShortVersionString: "$(MARKETING_VERSION)",
    CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
    LSRequiresIPhoneOS: true,
    UIApplicationSceneManifest: {},
    UILaunchStoryboardName: "SplashScreen",
    UIRequiredDeviceCapabilities: ["arm64"],
    UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
  });

  const widgetInfoPlistPath = path.join(iosRoot, IOS_WIDGET_DIR, "Info.plist");
  ensurePlistFile(widgetInfoPlistPath, {
    CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    CFBundleDisplayName: TARGET_NAME,
    CFBundleExecutable: "$(EXECUTABLE_NAME)",
    CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    CFBundleInfoDictionaryVersion: "6.0",
    CFBundleName: "$(PRODUCT_NAME)",
    CFBundlePackageType: "XPC!",
    CFBundleShortVersionString: "$(MARKETING_VERSION)",
    CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
    NSExtension: {
      NSExtensionPointIdentifier: "com.apple.widgetkit-extension",
    },
    MinimumOSVersion: DEPLOYMENT_TARGET,
    NSUserActivityTypes: [`${appBundleIdentifier}.${TARGET_NAME}`],
  });
}

function withInfoPlistGuards(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const iosRoot = modConfig.modRequest.platformProjectRoot;
      ensureExpectedInfoPlists(iosRoot, modConfig.ios.bundleIdentifier);
      return modConfig;
    },
  ]);
}

function copyFolderRecursive(sourceDir, targetDir) {
  ensureDir(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function collectWidgetFiles(widgetDir) {
  const files = fs.existsSync(widgetDir) ? fs.readdirSync(widgetDir) : [];
  const widgetFiles = {
    swiftFiles: [],
    entitlementFiles: [],
    plistFiles: [],
    assetDirectories: [],
    intentFiles: [],
    otherFiles: [],
  };

  for (const file of files) {
    const absolute = path.join(widgetDir, file);
    if (fs.lstatSync(absolute).isDirectory()) {
      if (file.endsWith(".xcassets")) {
        widgetFiles.assetDirectories.push(file);
      } else {
        widgetFiles.otherFiles.push(file);
      }
      continue;
    }

    const ext = path.extname(file);
    if (ext === ".swift") widgetFiles.swiftFiles.push(file);
    else if (ext === ".entitlements") widgetFiles.entitlementFiles.push(file);
    else if (ext === ".plist") widgetFiles.plistFiles.push(file);
    else if (ext === ".intentdefinition") widgetFiles.intentFiles.push(file);
    else widgetFiles.otherFiles.push(file);
  }

  return widgetFiles;
}

function hasNativeTarget(xcodeProject, targetName) {
  const section = xcodeProject.pbxNativeTargetSection();
  return Object.values(section).some(
    (value) =>
      value &&
      typeof value === "object" &&
      value.isa === "PBXNativeTarget" &&
      value.name === targetName
  );
}

function withWidgetFileCopy(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const iosRoot = modConfig.modRequest.platformProjectRoot;
      const sourceDir = path.join(projectRoot, SOURCE_WIDGET_DIR);
      const targetDir = path.join(iosRoot, IOS_WIDGET_DIR);

      if (!fs.existsSync(sourceDir)) {
        throw new Error(`Widget source directory not found: ${sourceDir}`);
      }

      copyFolderRecursive(sourceDir, targetDir);

      const entitlementsPath = path.join(targetDir, `${TARGET_NAME}.entitlements`);
      const existing = fs.existsSync(entitlementsPath)
        ? plist.parse(fs.readFileSync(entitlementsPath, "utf8"))
        : {};
      const groups = new Set(existing["com.apple.security.application-groups"] || []);
      groups.add(APP_GROUP);
      existing["com.apple.security.application-groups"] = Array.from(groups);
      fs.writeFileSync(entitlementsPath, plist.build(existing));

      return modConfig;
    },
  ]);
}

function withWidgetTarget(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const widgetBundleIdentifier = `${modConfig.ios.bundleIdentifier}.${TARGET_NAME}`;
    const targetAlreadyExists = hasNativeTarget(project, TARGET_NAME);

    if (!targetAlreadyExists) {
      const targetUuid = project.generateUuid();
      const groupName = "Embed Foundation Extensions";
      const widgetTargetPath = path.join(modConfig.modRequest.platformProjectRoot, TARGET_NAME);
      ensureDir(widgetTargetPath);
      const widgetFiles = collectWidgetFiles(widgetTargetPath);
      const xCConfigurationList = addXCConfigurationList(project, {
        targetName: TARGET_NAME,
        currentProjectVersion: modConfig.ios.buildNumber || "1",
        bundleIdentifier: widgetBundleIdentifier,
        deploymentTarget: DEPLOYMENT_TARGET,
        marketingVersion: modConfig.version,
      });
      const productFile = addProductFile(project, {
        targetName: TARGET_NAME,
        groupName,
      });
      const target = addToPbxNativeTargetSection(project, {
        targetName: TARGET_NAME,
        targetUuid,
        productFile,
        xCConfigurationList,
      });
      addToPbxProjectSection(project, target);
      addTargetDependency(project, target);
      addBuildPhases(project, {
        targetUuid,
        groupName,
        productFile,
        widgetFiles,
      });
      addPbxGroup(project, {
        targetName: TARGET_NAME,
        widgetFiles,
      });
    }

    const configs = project.pbxXCBuildConfigurationSection();
    for (const value of Object.values(configs)) {
      if (!value || typeof value !== "object" || !value.buildSettings) continue;
      const bundleId = String(value.buildSettings.PRODUCT_BUNDLE_IDENTIFIER || "").replace(/"/g, "");
      if (bundleId !== widgetBundleIdentifier) continue;

      value.buildSettings.INFOPLIST_FILE = `${IOS_WIDGET_DIR}/Info.plist`;
      value.buildSettings.GENERATE_INFOPLIST_FILE = "NO";
    }

    return modConfig;
  });
}

function withWidgetPodTarget(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) {
        return modConfig;
      }

      const podfile = fs.readFileSync(podfilePath, "utf8");
      if (podfile.includes(`target '${TARGET_NAME}' do`)) {
        return modConfig;
      }

      const widgetBlock = `
${PODFILE_MARKER}
target '${TARGET_NAME}' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
end
${PODFILE_MARKER}
`;

      fs.writeFileSync(podfilePath, `${podfile}\n${widgetBlock}`);
      return modConfig;
    },
  ]);
}

function withMainAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    const current =
      modConfig.modResults["com.apple.security.application-groups"] || [];
    if (!current.includes(APP_GROUP)) {
      modConfig.modResults["com.apple.security.application-groups"] = [
        APP_GROUP,
        ...current,
      ];
    }
    return modConfig;
  });
}

function withEasAppExtensionConfig(config) {
  const bundleIdentifier = `${config.ios.bundleIdentifier}.${TARGET_NAME}`;
  const current =
    config.extra?.eas?.build?.experimental?.ios?.appExtensions || [];
  const already = current.some((ext) => ext?.targetName === TARGET_NAME);
  if (already) {
    return config;
  }

  config.extra = {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions: [
              ...current,
              {
                targetName: TARGET_NAME,
                bundleIdentifier,
                entitlements: {
                  "com.apple.security.application-groups": [APP_GROUP],
                },
              },
            ],
          },
        },
      },
    },
  };

  return config;
}

module.exports = function withPrayerJournalWidget(config) {
  config = withEasAppExtensionConfig(config);
  config = withMainAppGroupEntitlement(config);
  config = withWidgetFileCopy(config);
  config = withInfoPlistGuards(config);
  config = withWidgetTarget(config);
  config = withWidgetPodTarget(config);
  return config;
};
