// Admin System Entry Point
// Loads the admin system and plugins based on plugins.ini configuration.
//
// Plugin Loading:
//   Plugins are loaded based on configs/plugins.ini. The plugin loader
//   dynamically imports each plugin and instantiates it with the plugin name.
//
// Lifecycle Order:
//   1. onPrecache() - During dllPrecache event (precache models, sounds)
//   2. constructor() - Plugin instantiation
//   3. onLoad() - Plugin initialization (register cvars, commands, events)
//   4. onConfig() - After ALL plugins loaded AND config files executed
//   5. onMapStart() - When server is activated (dllServerActivate)
//   6. onMapEnd() - When map is ending (dllServerDeactivate)
//   7. onPause() / onUnpause() - When plugin execution is paused/resumed
//   8. onUnload() - Plugin cleanup before unloading
//
// Usage:
//   import { adminSystem, BasePlugin, Plugin, PluginMetadata, ADMIN_KICK } from '@nodemod/admin'

import { pluginLoader } from './pluginloader';
import { adminSystem } from './admin.plugin';

// Export plugin development API
export { pluginLoader, Plugin, PluginMetadata } from './pluginloader';
export { BasePlugin, LogLevel } from './baseplugin';
export { adminSystem } from './admin.plugin';
export * from './constants';
export * as utils from './utils';
export { default as localization } from './localization';

// ═══════════════════════════════════════════════════════════════════════════
// PLUGIN LOADING (SYNCHRONOUS)
// ═══════════════════════════════════════════════════════════════════════════
//
// Loading order ensures onConfig() is called AFTER all plugins complete onLoad():
//   1. For each plugin: constructor() + onLoad()  [plugin_natives + plugin_init]
//   2. executeConfigFiles()                        [run amxx.cfg, etc.]
//   3. For each plugin: onConfig()                 [plugin_cfg]
//
// This matches AMX Mod X behavior where plugin_cfg is called after ALL plugins
// have executed plugin_init and config files have been processed.

try {
    // Step 1a: Load admin system first (other plugins depend on it)
    // Calls constructor() + onLoad() for admin plugin
    pluginLoader.loadPluginSync('admin');

    // Step 1b: Load remaining plugins from plugins.ini
    // Calls constructor() + onLoad() for each plugin
    pluginLoader.loadFromConfig();

    // Step 2: Execute config files AFTER all plugins are loaded
    // This ensures all CVARs are registered before amxx.cfg sets their values
    adminSystem.executeConfigFiles();

    // Step 3: Call onConfig() on all plugins
    // CVARs are now set from config files - plugins can read their values
    pluginLoader.callConfig();

    console.log(`[Admin] Loaded ${pluginLoader.getRunningCount()} of ${pluginLoader.getPluginCount()} plugins`);
} catch (e) {
    console.error('[Admin] Fatal error during plugin loading:', e);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAP LIFECYCLE EVENTS
// ═══════════════════════════════════════════════════════════════════════════

// Call onPrecache() during map precache phase
// This fires on worldspawn entity (first entity spawned on map load)
// Similar to how AMXX implements plugin_precache via DispatchSpawn
let precacheCalled = false;
nodemod.on('dllSpawn', (entity: nodemod.Entity) => {
    if (!precacheCalled) {
        precacheCalled = true;
        pluginLoader.callPrecache();
    }
});

// Reset precache flag when map ends
nodemod.on('dllServerDeactivate', () => {
    precacheCalled = false;
    pluginLoader.callMapEnd();
});

// Call onMapStart() when server is activated (map loaded, ready for players)
nodemod.on('dllServerActivate', () => {
    pluginLoader.callMapStart();
});
