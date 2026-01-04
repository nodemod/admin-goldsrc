// Plugin Loader System
// Loads plugins dynamically based on plugins.ini configuration
// Similar to AMX Mod X plugin loading system
//
// ============================================================================
// AMX Mod X plugin_* Forward Mapping
// ============================================================================
//
// | AMX Mod X Forward  | NodeMod Method   | When Called                        |
// |--------------------|------------------|------------------------------------|
// | plugin_precache()  | onPrecache()     | During map precache phase          |
// | plugin_natives()   | constructor      | Plugin instantiation               |
// | plugin_init()      | onLoad()         | After constructor                  |
// | plugin_cfg()       | onConfig()       | After ALL plugins + configs loaded |
// | plugin_pause()     | onPause()        | When plugin is paused              |
// | plugin_unpause()   | onUnpause()      | When plugin is unpaused            |
// | plugin_log()       | onLog(message)   | When a log message is written      |
// | plugin_end()       | onUnload()       | Before plugin unloading            |
// | plugin_modules()   | (deprecated)     | No longer used since AMXX 1.50     |
//
// Lifecycle Order (SYNCHRONOUS - onConfig waits for all onLoad to complete):
//
// STARTUP:
//   1. For each plugin: constructor() + onLoad()
//   2. executeConfigFiles()
//   3. For each plugin: onConfig()
//
// MAP LIFECYCLE:
//   4. onPrecache()  ← dllPrecache
//   5. onMapStart()  ← dllServerActivate
//   6. onMapEnd()    ← dllServerDeactivate
//
// SHUTDOWN:
//   7. onUnload()    ← Server shutdown
//
// ============================================================================

import fs from 'fs';
import path from 'path';

/**
 * Plugin metadata interface
 * Each plugin must export this information
 */
export interface PluginMetadata {
    /** Plugin name (e.g., "Admin Base") */
    name: string;
    /** Plugin version (e.g., "1.0.0") */
    version: string;
    /** Plugin author(s) */
    author: string;
    /** Plugin description */
    description?: string;
}

/**
 * Plugin interface that all plugins must implement
 *
 * Lifecycle order:
 * 1. onPrecache() - During map precache phase (register models, sounds, etc.)
 * 2. constructor() - Plugin instantiation
 * 3. onLoad() - Plugin initialization (register cvars, commands, events)
 * 4. onConfig() - After ALL plugins loaded (configs executed, cvars set)
 * 5. onMapStart() - When a new map starts (after precache, server active)
 * 6. onMapEnd() - When map is ending (before new map or shutdown)
 * 7. onPause() / onUnpause() - When plugin execution is paused/resumed
 * 8. onUnload() - Plugin cleanup before unloading
 */
export interface Plugin {
    /** Plugin metadata */
    readonly metadata: PluginMetadata;

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION HOOKS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Called during map precache phase.
     * Use this to precache models, sounds, sprites, and generic files.
     * Equivalent to AMX Mod X: plugin_precache()
     *
     * @example
     * onPrecache() {
     *     nodemod.eng.precacheModel('models/custom.mdl');
     *     nodemod.eng.precacheSound('sounds/custom.wav');
     * }
     */
    onPrecache?(): void;

    /**
     * Called when plugin is loaded and initialized.
     * Use this to register cvars, commands, events, and initialize data structures.
     * Equivalent to AMX Mod X: plugin_init()
     *
     * @example
     * onLoad() {
     *     this.registerCvar('my_cvar', '1');
     *     nodemodCore.cmd.add({ name: 'mycmd', handler: this.myCommand });
     * }
     */
    onLoad?(): void;

    /**
     * Called after ALL plugins have been loaded and initialized.
     * At this point, all cvars and commands from all plugins are registered.
     * Config files (amxx.cfg, etc.) have been executed.
     * Equivalent to AMX Mod X: plugin_cfg()
     *
     * @example
     * onConfig() {
     *     // Read cvar values that may have been set by config files
     *     const myValue = this.myCvar.float;
     *     this.applySettings(myValue);
     * }
     */
    onConfig?(): void;

    // ═══════════════════════════════════════════════════════════════════════
    // MAP LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Called when a new map starts (server is active).
     * This is called after precaching is complete and players can connect.
     *
     * @example
     * onMapStart() {
     *     this.resetMapState();
     *     console.log(`Map started: ${nodemod.mapname}`);
     * }
     */
    onMapStart?(): void;

    /**
     * Called when the current map is ending.
     * Use this to save state, cleanup map-specific resources.
     *
     * @example
     * onMapEnd() {
     *     this.savePlayerStats();
     *     this.clearMapData();
     * }
     */
    onMapEnd?(): void;

    // ═══════════════════════════════════════════════════════════════════════
    // EXECUTION STATE HOOKS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Called when plugin execution is paused.
     * Plugin will stop receiving events until unpaused.
     * Equivalent to AMX Mod X: plugin_pause()
     *
     * @example
     * onPause() {
     *     this.saveState();
     *     console.log('Plugin paused');
     * }
     */
    onPause?(): void;

    /**
     * Called when plugin execution is resumed after being paused.
     * Equivalent to AMX Mod X: plugin_unpause()
     *
     * @example
     * onUnpause() {
     *     this.restoreState();
     *     console.log('Plugin resumed');
     * }
     */
    onUnpause?(): void;

    // ═══════════════════════════════════════════════════════════════════════
    // LOG HOOKS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Called when a message is about to be logged.
     * Can be used to intercept, modify, or block log messages.
     * Equivalent to AMX Mod X: plugin_log()
     *
     * @param message The log message
     * @returns false to block the log message, true or undefined to allow it
     *
     * @example
     * onLog(message: string) {
     *     if (message.includes('sensitive')) {
     *         return false; // Block this log
     *     }
     *     // Allow all other logs
     * }
     */
    onLog?(message: string): boolean | void;

    // ═══════════════════════════════════════════════════════════════════════
    // CLEANUP HOOKS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Called when plugin is being unloaded.
     * Use this to cleanup resources, save state, unregister handlers.
     * Equivalent to AMX Mod X: plugin_end()
     *
     * @example
     * onUnload() {
     *     this.saveAllData();
     *     this.cleanup();
     * }
     */
    onUnload?(): void;
}

/**
 * Plugin class constructor type
 * Plugins export a class that takes pluginName in constructor
 */
export type PluginConstructor = new (pluginName: string) => Plugin;

/**
 * Loaded plugin entry
 */
export interface LoadedPlugin {
    /** The plugin instance */
    plugin: Plugin;
    /** Plugin name from plugins.ini */
    pluginName: string;
    /** Load status (matches AMXX: running, paused, stopped, bad load) */
    status: 'running' | 'paused' | 'bad load' | 'stopped';
    /** Whether the plugin is currently paused */
    paused: boolean;
    /** Error message if status is 'bad load' */
    error?: string;
}

/**
 * Plugin Loader
 * Manages loading and tracking of plugins
 */
class PluginLoader {
    private plugins: Map<string, LoadedPlugin> = new Map();
    private configPath: string;
    private searchPaths: string[];

    constructor() {
        // Use nodemod.cwd + nodemod.gameDir to find configs and plugins
        // Structure: <cwd>/<gameDir>/addons/nodemod/{configs,plugins}
        const nodemodBase = path.join(nodemod.cwd, nodemod.gameDir, 'addons', 'nodemod');

        this.configPath = path.join(nodemodBase, 'configs', 'plugins.ini');

        // Default search paths for plugins (in order of priority)
        // 1. plugins/dist - custom plugins
        // 2. plugins/packages/admin/dist - admin package plugins
        this.searchPaths = [
            path.join(nodemodBase, 'plugins', 'dist'),
            path.join(nodemodBase, 'plugins', 'packages', 'admin', 'dist'),
        ];
    }

    /**
     * Set the path to plugins.ini
     */
    setConfigPath(configPath: string): void {
        this.configPath = configPath;
    }

    /**
     * Set search paths for resolving plugins
     * Plugins are searched in order until found
     */
    setSearchPaths(paths: string[]): void {
        this.searchPaths = paths;
    }

    /**
     * Add a search path for plugins
     */
    addSearchPath(searchPath: string): void {
        this.searchPaths.push(searchPath);
    }

    /**
     * Try to require a module from search paths
     * Returns the module if found, null otherwise
     * Only loads *.plugin.js files
     */
    private tryRequire(pluginName: string): { module: any; path: string } | null {
        for (const basePath of this.searchPaths) {
            const fullPath = path.join(basePath, `${pluginName}.plugin`);
            try {
                const module = require(fullPath);
                return { module, path: fullPath };
            } catch (e: any) {
                // Only continue if module not found, rethrow other errors
                if (e.code !== 'MODULE_NOT_FOUND') {
                    throw e;
                }
            }
        }
        return null;
    }

    /**
     * Load a plugin by name
     * @param pluginName Name from plugins.ini (e.g., 'adminchat' or 'admin/example')
     * @param importPath Optional import path (overrides search path resolution)
     */
    async loadPlugin(pluginName: string, importPath?: string): Promise<void> {
        let module: any;
        let modulePath: string;

        if (importPath) {
            modulePath = importPath;
            module = await import(modulePath);
        } else {
            const result = this.tryRequire(pluginName);
            if (!result) {
                console.error(`[PluginLoader] Plugin not found: ${pluginName}`);
                console.error(`[PluginLoader] Searched in: ${this.searchPaths.join(', ')}`);
                this.plugins.set(pluginName, {
                    plugin: null as any,
                    pluginName,
                    status: 'bad load',
                    paused: false,
                    error: `Plugin not found in search paths`
                });
                return;
            }
            module = result.module;
            modulePath = result.path;
        }

        try {

            // Get the plugin class (default export)
            const PluginClass: PluginConstructor = module.default;

            if (!PluginClass || typeof PluginClass !== 'function') {
                throw new Error(`Plugin ${pluginName} does not export a class as default`);
            }

            // Instantiate with the plugin name
            const plugin = new PluginClass(pluginName);

            this.plugins.set(pluginName, {
                plugin,
                pluginName,
                status: 'running',
                paused: false
            });

            // Call onLoad if available
            if (plugin.onLoad) {
                try {
                    plugin.onLoad();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onLoad for ${pluginName}:`, e);
                }
            }
        } catch (e) {
            console.error(`[PluginLoader] Failed to load ${pluginName}:`, e);
            this.plugins.set(pluginName, {
                plugin: null as any,
                pluginName,
                status: 'bad load',
                paused: false,
                error: String(e)
            });
        }
    }

    /**
     * Load a plugin synchronously (for require-style loading)
     * @param pluginName Name from plugins.ini (e.g., 'adminchat' or 'admin/example')
     * @param importPath Optional import path (overrides search path resolution)
     */
    loadPluginSync(pluginName: string, importPath?: string): void {
        let module: any;

        if (importPath) {
            try {
                module = require(importPath);
            } catch (e) {
                console.error(`[PluginLoader] Failed to load ${pluginName}:`, e);
                this.plugins.set(pluginName, {
                    plugin: null as any,
                    pluginName,
                    status: 'bad load',
                    paused: false,
                    error: String(e)
                });
                return;
            }
        } else {
            const result = this.tryRequire(pluginName);
            if (!result) {
                console.error(`[PluginLoader] Plugin not found: ${pluginName}`);
                console.error(`[PluginLoader] Searched in: ${this.searchPaths.join(', ')}`);
                this.plugins.set(pluginName, {
                    plugin: null as any,
                    pluginName,
                    status: 'bad load',
                    paused: false,
                    error: `Plugin not found in search paths`
                });
                return;
            }
            module = result.module;
        }

        try {
            let plugin: Plugin;

            // Check if module exports a pre-created instance (e.g., admin exports adminSystem)
            // This handles singleton services that other plugins depend on
            const instanceName = pluginName.replace(/-/g, '') + 'System';
            const altInstanceName = pluginName.replace(/-/g, '');

            if (module[instanceName] && typeof module[instanceName] === 'object' && module[instanceName].metadata) {
                plugin = module[instanceName];
            } else if (module[altInstanceName] && typeof module[altInstanceName] === 'object' && module[altInstanceName].metadata) {
                plugin = module[altInstanceName];
            } else {
                // Get the plugin class (default export)
                const PluginClass: PluginConstructor = module.default;

                if (!PluginClass || typeof PluginClass !== 'function') {
                    throw new Error(`Plugin ${pluginName} does not export a class as default (got ${typeof PluginClass})`);
                }

                // Instantiate with the plugin name
                plugin = new PluginClass(pluginName);
            }

            this.plugins.set(pluginName, {
                plugin,
                pluginName,
                status: 'running',
                paused: false
            });

            // Call onLoad if available
            if (plugin.onLoad) {
                try {
                    plugin.onLoad();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onLoad for ${pluginName}:`, e);
                }
            }
        } catch (e) {
            console.error(`[PluginLoader] Failed to load ${pluginName}:`, e);
            this.plugins.set(pluginName, {
                plugin: null as any,
                pluginName,
                status: 'bad load',
                paused: false,
                error: String(e)
            });
        }
    }

    /**
     * Load plugins from plugins.ini
     * Returns list of plugin names to load
     */
    parsePluginsIni(): string[] {
        const plugins: string[] = [];

        if (!fs.existsSync(this.configPath)) {
            return [];
        }

        try {
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();

                // Skip empty lines and comments
                if (!trimmed || trimmed.startsWith(';')) {
                    continue;
                }

                // Extract plugin name (everything before semicolon comment)
                const parts = trimmed.split(';');
                const pluginName = parts[0].trim();

                if (pluginName) {
                    plugins.push(pluginName);
                }
            }
        } catch (e) {
            console.error(`[PluginLoader] Error reading plugins.ini:`, e);
        }

        return plugins;
    }

    /**
     * Load all plugins from plugins.ini
     */
    loadFromConfig(): void {
        const pluginNames = this.parsePluginsIni();

        for (const pluginName of pluginNames) {
            // Skip admin as it's loaded separately (dependency)
            if (pluginName === 'admin') {
                continue;
            }

            this.loadPluginSync(pluginName);
        }
    }

    /**
     * Get all loaded plugins
     */
    getPlugins(): LoadedPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugin count
     */
    getPluginCount(): number {
        return this.plugins.size;
    }

    /**
     * Get running plugin count
     */
    getRunningCount(): number {
        return Array.from(this.plugins.values()).filter(p => p.status === 'running').length;
    }

    /**
     * Get plugin by name
     */
    getPlugin(pluginName: string): LoadedPlugin | undefined {
        return this.plugins.get(pluginName);
    }

    /**
     * Check if a plugin is loaded
     */
    isLoaded(pluginName: string): boolean {
        const plugin = this.plugins.get(pluginName);
        return plugin?.status === 'running';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LIFECYCLE HOOK DISPATCHERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Call onPrecache() on all loaded plugins.
     * Should be called during map precache phase (dllPrecache event).
     */
    callPrecache(): void {
        for (const entry of this.plugins.values()) {
            if (entry.status === 'running' && !entry.paused && entry.plugin?.onPrecache) {
                try {
                    entry.plugin.onPrecache();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onPrecache for ${entry.pluginName}:`, e);
                }
            }
        }
    }

    /**
     * Call onConfig() on all loaded plugins.
     * Should be called after all plugins are loaded and config files are executed.
     */
    callConfig(): void {
        for (const entry of this.plugins.values()) {
            if (entry.status === 'running' && !entry.paused && entry.plugin?.onConfig) {
                try {
                    entry.plugin.onConfig();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onConfig for ${entry.pluginName}:`, e);
                }
            }
        }
    }

    /**
     * Call onMapStart() on all loaded plugins.
     * Should be called when a new map starts (dllServerActivate event).
     */
    callMapStart(): void {
        for (const entry of this.plugins.values()) {
            if (entry.status === 'running' && !entry.paused && entry.plugin?.onMapStart) {
                try {
                    entry.plugin.onMapStart();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onMapStart for ${entry.pluginName}:`, e);
                }
            }
        }
    }

    /**
     * Call onMapEnd() on all loaded plugins.
     * Should be called when the current map is ending (dllServerDeactivate event).
     */
    callMapEnd(): void {
        for (const entry of this.plugins.values()) {
            if (entry.status === 'running' && !entry.paused && entry.plugin?.onMapEnd) {
                try {
                    entry.plugin.onMapEnd();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onMapEnd for ${entry.pluginName}:`, e);
                }
            }
        }
    }

    /**
     * Call onLog() on all loaded plugins.
     * Should be called when a log message is about to be written.
     * @param message The log message
     * @returns true if the message should be logged, false if any plugin blocked it
     */
    callLog(message: string): boolean {
        for (const entry of this.plugins.values()) {
            if (entry.status === 'running' && !entry.paused && entry.plugin?.onLog) {
                try {
                    const result = entry.plugin.onLog(message);
                    if (result === false) {
                        return false; // Plugin blocked the log
                    }
                } catch (e) {
                    console.error(`[PluginLoader] Error in onLog for ${entry.pluginName}:`, e);
                }
            }
        }
        return true; // Allow the log
    }

    /**
     * Call onUnload() on all loaded plugins and clear the plugin list.
     * Should be called on server shutdown or plugin system reload.
     */
    unloadAll(): void {
        for (const entry of this.plugins.values()) {
            if (entry.plugin?.onUnload) {
                try {
                    entry.plugin.onUnload();
                } catch (e) {
                    console.error(`[PluginLoader] Error in onUnload for ${entry.pluginName}:`, e);
                }
            }
            entry.status = 'stopped';
        }
        this.plugins.clear();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLUGIN STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Pause a plugin's execution.
     * The plugin will stop receiving events until unpaused.
     * @returns true if the plugin was paused, false if not found or already paused
     */
    pausePlugin(pluginName: string): boolean {
        const entry = this.plugins.get(pluginName);
        if (!entry || entry.paused || entry.status !== 'running') {
            return false;
        }

        // Call onPause hook
        if (entry.plugin?.onPause) {
            try {
                entry.plugin.onPause();
            } catch (e) {
                console.error(`[PluginLoader] Error in onPause for ${pluginName}:`, e);
            }
        }

        // Set paused state on BasePlugin instances (for event handler filtering)
        const plugin = entry.plugin as any;
        if (typeof plugin?._setPaused === 'function') {
            plugin._setPaused(true);
        }

        entry.paused = true;
        entry.status = 'paused';
        return true;
    }

    /**
     * Unpause a plugin's execution.
     * The plugin will resume receiving events.
     * @returns true if the plugin was unpaused, false if not found or not paused
     */
    unpausePlugin(pluginName: string): boolean {
        const entry = this.plugins.get(pluginName);
        if (!entry || !entry.paused || entry.status !== 'paused') {
            return false;
        }

        // Set paused state on BasePlugin instances (for event handler filtering)
        const plugin = entry.plugin as any;
        if (typeof plugin?._setPaused === 'function') {
            plugin._setPaused(false);
        }

        entry.paused = false;
        entry.status = 'running';

        // Call onUnpause hook
        if (entry.plugin?.onUnpause) {
            try {
                entry.plugin.onUnpause();
            } catch (e) {
                console.error(`[PluginLoader] Error in onUnpause for ${pluginName}:`, e);
            }
        }

        return true;
    }

    /**
     * Unload a specific plugin.
     * @returns true if the plugin was unloaded, false if not found
     */
    unloadPlugin(pluginName: string): boolean {
        const entry = this.plugins.get(pluginName);
        if (!entry) {
            return false;
        }

        // Call onUnload hook
        if (entry.plugin?.onUnload) {
            try {
                entry.plugin.onUnload();
            } catch (e) {
                console.error(`[PluginLoader] Error in onUnload for ${pluginName}:`, e);
            }
        }

        entry.status = 'stopped';
        this.plugins.delete(pluginName);
        return true;
    }

    /**
     * Check if a plugin is paused
     */
    isPaused(pluginName: string): boolean {
        const entry = this.plugins.get(pluginName);
        return entry?.paused ?? false;
    }
}

// Singleton instance
export const pluginLoader = new PluginLoader();

/**
 * Helper function to create plugin metadata
 */
export function createPluginMetadata(
    name: string,
    version: string,
    author: string,
    description?: string
): PluginMetadata {
    return { name, version, author, description };
}
