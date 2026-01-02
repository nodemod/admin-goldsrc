// Admin System Entry Point
// Loads the admin system and plugins based on plugins.ini configuration.
//
// Plugin Loading:
//   Plugins are loaded based on configs/plugins.ini. The plugin loader
//   dynamically imports each plugin and instantiates it with the plugin name.
//
// Load Order:
//   1. Admin plugin (core system, registers base CVARs)
//   2. Other plugins from plugins.ini (register their CVARs)
//   3. Execute amxx.cfg and sql.cfg (sets CVAR values)
//
// Usage:
//   import { adminSystem, BasePlugin, Plugin, PluginMetadata, ADMIN_KICK } from '@nodemod/admin'

import { pluginLoader } from './pluginloader';
import { adminSystem } from './admin.plugin';

// Export plugin development API
export { pluginLoader, Plugin, PluginMetadata } from './pluginloader';
export { BasePlugin } from './baseplugin';
export { adminSystem } from './admin.plugin';
export * from './constants';
export * as utils from './utils';
export { default as localization } from './localization';

// Load admin system first (other plugins depend on it)
pluginLoader.loadPluginSync('admin');

// Load remaining plugins from plugins.ini
pluginLoader.loadFromConfig();

// Execute config files AFTER all plugins are loaded
// This ensures all CVARs are registered before amxx.cfg sets their values
adminSystem.executeConfigFiles();
