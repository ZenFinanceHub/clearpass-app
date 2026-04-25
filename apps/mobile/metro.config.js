const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Ensure Metro watches local packages so hot-reload works across the monorepo.
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages/core'),
  path.resolve(monorepoRoot, 'packages/content'),
  path.resolve(monorepoRoot, 'packages/ai'),
];

// Allow resolution from both the app's own node_modules and the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
