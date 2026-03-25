const fs = require("fs");
const path = require("path");
const plist = require("@expo/plist");
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
    const targetAlreadyExists = hasNativeTarget(project, TARGET_NAME);
    if (targetAlreadyExists) {
      return modConfig;
    }

    const targetUuid = project.generateUuid();
    const groupName = "Embed Foundation Extensions";
    const bundleIdentifier = `${modConfig.ios.bundleIdentifier}.${TARGET_NAME}`;
    const widgetTargetPath = path.join(modConfig.modRequest.platformProjectRoot, TARGET_NAME);
    ensureDir(widgetTargetPath);
    const widgetFiles = collectWidgetFiles(widgetTargetPath);
    const xCConfigurationList = addXCConfigurationList(project, {
      targetName: TARGET_NAME,
      currentProjectVersion: modConfig.ios.buildNumber || "1",
      bundleIdentifier,
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
  config = withWidgetTarget(config);
  config = withWidgetPodTarget(config);
  return config;
};
