// Base Plugin Class
// Provides common functionality for admin plugins to reduce code duplication
//
// ============================================================================
// AMX Mod X plugin_* Forward Mapping (Lifecycle Hooks)
// ============================================================================
//
// | AMX Mod X Forward  | BasePlugin Method | Description                        |
// |--------------------|-------------------|------------------------------------|
// | plugin_precache()  | onPrecache()      | Precache models, sounds, files     |
// | plugin_natives()   | constructor       | Register natives (class setup)     |
// | plugin_init()      | onLoad()          | Register cvars, commands, events   |
// | plugin_cfg()       | onConfig()        | Read cvar values after configs run |
// | plugin_pause()     | onPause()         | Save state before pause            |
// | plugin_unpause()   | onUnpause()       | Restore state after pause          |
// | plugin_log()       | onLog(message)    | Intercept/block log messages       |
// | plugin_end()       | onUnload()        | Cleanup resources, save state      |
// | plugin_modules()   | (deprecated)      | Not used - handled by TS imports   |
//
// Lifecycle is SYNCHRONOUS - onConfig() is called only after ALL plugins
// have completed their constructor() and onLoad() calls.
//
// ============================================================================
//
// Usage:
//   class MyPlugin extends BasePlugin implements Plugin {
//       readonly metadata: PluginMetadata = { ... };
//       constructor(pluginName: string) {
//           super(pluginName);
//           // ... basic setup only (plugin_natives equivalent)
//       }
//       onLoad() {
//           // ... register commands, events (plugin_init equivalent)
//           // Use this.on() for event handlers (auto-cleanup on unload)
//       }
//       onConfig() {
//           // ... read cvar values (plugin_cfg equivalent)
//           // Called AFTER all plugins loaded + config files executed
//       }
//       onUnload() {
//           // ... cleanup (plugin_end equivalent)
//           super.onUnload(); // Required for event handler cleanup!
//       }
//   }
//
// The pluginName is passed by the plugin loader from plugins.ini and is used
// for localization lookups and command/CVAR registration.

import nodemodCore from '@nodemod/core';
import { adminSystem } from './admin.plugin';
import { ADMIN_ADMIN } from './constants';
import { registerCommand as helpRegisterCommand, registerServerCommand as helpRegisterServerCommand, registerClientCommand as helpRegisterClientCommand, cvarRegistry } from './helpregistry';
import localization from './localization';
import * as utils from './utils';
import type { PluginMetadata } from './pluginloader';
import { pluginLoader } from './pluginloader';

const cvar = nodemodCore.cvar;

/**
 * Log levels for plugin logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log level priorities (higher = more severe)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

/**
 * Log level display names
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR'
};

/**
 * Base class for admin plugins providing common utilities.
 * Extend this class to get access to shared functionality.
 */
/**
 * Registered event handler entry
 */
interface RegisteredHandler {
    eventName: string;
    originalHandler: Function;
    wrappedHandler: Function;
}

export abstract class BasePlugin {
    /** Plugin name from plugins.ini - used for localization and registration */
    protected readonly pluginName: string;

    /** Cached CVAR wrapper for amx_show_activity */
    private amxShowActivity: any;

    /** Registered event handlers for cleanup on unload */
    private registeredHandlers: RegisteredHandler[] = [];

    /** Whether this plugin is currently paused */
    private _paused: boolean = false;

    /**
     * Plugin metadata - must be implemented by subclasses.
     */
    abstract readonly metadata: PluginMetadata;

    /**
     * @param pluginName Plugin name from plugins.ini (e.g., 'adminchat', 'plmenu')
     */
    constructor(pluginName: string) {
        this.pluginName = pluginName;

        // Get amx_show_activity CVAR (registered by admin base)
        this.amxShowActivity = cvar.wrap('amx_show_activity');

        // Load localization dictionary for this plugin
        localization.loadDictionary(pluginName);
    }

    // ========================================================================
    // Logging
    // ========================================================================

    /** Minimum log level for this plugin (can be overridden per-plugin) */
    protected minLogLevel: LogLevel = 'info';

    /**
     * Set the minimum log level for this plugin.
     * Messages below this level will not be logged.
     * @param level Minimum log level ('debug', 'info', 'warn', 'error')
     */
    protected setLogLevel(level: LogLevel): void {
        this.minLogLevel = level;
    }

    /**
     * Log options for customizing output format
     */
    protected static defaultLogOptions = {
        showPluginName: true,
        showLevel: true
    };

    /**
     * Log a message at the specified level.
     * Messages are passed through onLog() hooks and can be intercepted.
     *
     * @param level Log level (null to skip level check and prefix)
     * @param message Message or format string
     * @param args Additional arguments for string interpolation
     * @param options Optional formatting options
     *
     * @example
     * this.log('info', 'Player %s connected', playerName);
     * this.log('error', 'Failed to load config:', error);
     * this.log(null, 'Raw message without level');
     */
    protected log(
        level: LogLevel | null,
        message: string,
        ...args: any[]
    ): void {
        this.logWithOptions(level, message, args, {
            showPluginName: true,
            showLevel: level !== null
        });
    }

    /**
     * Internal log method with full options control
     */
    private logWithOptions(
        level: LogLevel | null,
        message: string,
        args: any[],
        options: { showPluginName?: boolean; showLevel?: boolean; prefix?: string }
    ): void {
        // Check if this level should be logged (skip check if level is null)
        if (level !== null && LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLogLevel]) {
            return;
        }

        // Format the message
        const formattedMessage = args.length > 0
            ? this.formatString(message, ...args)
            : message;

        // Build prefix parts
        const parts: string[] = [];
        if (options.prefix) {
            parts.push(`[${options.prefix}]`);
        } else if (options.showPluginName !== false) {
            parts.push(`[${this.pluginName}]`);
        }
        if (options.showLevel !== false && level !== null) {
            parts.push(`[${LOG_LEVEL_NAMES[level]}]`);
        }

        const fullMessage = parts.length > 0
            ? `${parts.join(' ')} ${formattedMessage}`
            : formattedMessage;

        // Pass through onLog hooks - any plugin can intercept/block
        if (!pluginLoader.callLog(fullMessage)) {
            return; // A plugin blocked this log
        }

        // Output to console based on level
        if (level === 'warn') {
            console.warn(fullMessage);
        } else if (level === 'error') {
            console.error(fullMessage);
        } else {
            console.log(fullMessage);
        }
    }

    /**
     * Log a debug message.
     * Only shown when log level is 'debug'.
     *
     * @example
     * this.debug('Processing entity %d', entityId);
     */
    protected debug(message: string, ...args: any[]): void {
        this.log('debug', message, ...args);
    }

    /**
     * Log an info message.
     * Shown when log level is 'info' or lower.
     *
     * @example
     * this.info('Plugin initialized successfully');
     */
    protected info(message: string, ...args: any[]): void {
        this.log('info', message, ...args);
    }

    /**
     * Log a warning message.
     * Shown when log level is 'warn' or lower.
     *
     * @example
     * this.warn('Config file not found, using defaults');
     */
    protected warn(message: string, ...args: any[]): void {
        this.log('warn', message, ...args);
    }

    /**
     * Log an error message.
     * Always shown (highest priority).
     *
     * @example
     * this.error('Failed to save data: %s', error.message);
     */
    protected error(message: string, ...args: any[]): void {
        this.log('error', message, ...args);
    }

    /**
     * Format a string with printf-style placeholders.
     * Supports %s (string), %d/%i (integer), %f (float), %o/%O (object), %j (JSON).
     */
    private formatString(format: string, ...args: any[]): string {
        let argIndex = 0;
        return format.replace(/%([sdifjoO%])/g, (match, type) => {
            if (type === '%') return '%';
            if (argIndex >= args.length) return match;

            const arg = args[argIndex++];
            switch (type) {
                case 's': return String(arg);
                case 'd':
                case 'i': return parseInt(arg, 10).toString();
                case 'f': return parseFloat(arg).toString();
                case 'j': return JSON.stringify(arg);
                case 'o':
                case 'O': return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
                default: return String(arg);
            }
        });
    }

    // ========================================================================
    // Event Handling
    // ========================================================================

    /**
     * Check if this plugin is currently paused.
     */
    protected get paused(): boolean {
        return this._paused;
    }

    /**
     * Register an event handler.
     * Handlers are automatically:
     * - Skipped when the plugin is paused
     * - Unregistered when the plugin is unloaded
     *
     * Use this instead of nodemod.on() to ensure proper lifecycle management.
     *
     * @param eventName The event name (e.g., 'dllClientCommand', 'dllPlayerSpawn')
     * @param handler The event handler function
     *
     * @example
     * this.on('dllClientCommand', (entity, text) => {
     *     this.info('Client command: %s', text);
     * });
     */
    protected on<T extends keyof nodemod.EventCallbacks>(
        eventName: T,
        handler: nodemod.EventCallbacks[T]
    ): void {
        // Create a wrapper that checks paused state
        const wrappedHandler = ((...args: any[]) => {
            if (this._paused) {
                return; // Skip handler when paused
            }
            try {
                return (handler as Function).apply(this, args);
            } catch (e) {
                this.error('Error in event handler for %s: %s', eventName, e);
            }
        }) as nodemod.EventCallbacks[T];

        // Register with nodemod
        nodemod.on(eventName, wrappedHandler);

        // Track for cleanup
        this.registeredHandlers.push({
            eventName,
            originalHandler: handler as Function,
            wrappedHandler
        });
    }

    /**
     * Register a one-time event handler.
     * The handler is automatically removed after it fires once.
     * Also respects pause state and is cleaned up on unload.
     *
     * @param eventName The event name
     * @param handler The event handler function
     *
     * @example
     * this.once('dllServerActivate', () => {
     *     this.info('First map loaded!');
     * });
     */
    protected once<T extends keyof nodemod.EventCallbacks>(
        eventName: T,
        handler: nodemod.EventCallbacks[T]
    ): void {
        const onceHandler = ((...args: any[]) => {
            // Remove this handler after first call
            this.off(eventName, onceHandler as nodemod.EventCallbacks[T]);
            return (handler as Function).apply(this, args);
        }) as nodemod.EventCallbacks[T];

        this.on(eventName, onceHandler);
    }

    /**
     * Unregister an event handler.
     *
     * @param eventName The event name
     * @param handler The original handler function passed to on()
     *
     * @example
     * const handler = (entity) => { ... };
     * this.on('dllPlayerSpawn', handler);
     * // Later:
     * this.off('dllPlayerSpawn', handler);
     */
    protected off<T extends keyof nodemod.EventCallbacks>(
        eventName: T,
        handler: nodemod.EventCallbacks[T]
    ): void {
        const index = this.registeredHandlers.findIndex(
            h => h.eventName === eventName && h.originalHandler === handler
        );

        if (index !== -1) {
            const entry = this.registeredHandlers[index];
            nodemod.removeListener(eventName, entry.wrappedHandler as nodemod.EventCallbacks[T]);
            this.registeredHandlers.splice(index, 1);
        }
    }

    /**
     * Unregister all event handlers for this plugin.
     * Called automatically on unload.
     */
    private unregisterAllHandlers(): void {
        for (const entry of this.registeredHandlers) {
            try {
                nodemod.removeListener(
                    entry.eventName as keyof nodemod.EventCallbacks,
                    entry.wrappedHandler as any
                );
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        this.registeredHandlers = [];
    }

    /**
     * Called by PluginLoader when plugin is paused.
     * @internal
     */
    _setPaused(paused: boolean): void {
        this._paused = paused;
    }

    // ========================================================================
    // Command & CVAR Registration
    // ========================================================================

    /**
     * Register a command with automatic plugin tracking.
     */
    protected registerCommand(
        name: string,
        flags: number,
        description: string,
        callback: (entity: nodemod.Entity | null, args: string[]) => void
    ): void {
        helpRegisterCommand(name, flags, description, callback, this.pluginName);
    }

    /**
     * Register a server-only command with automatic plugin tracking.
     * This command can only be executed from the server console or rcon.
     */
    protected registerServerCommand(
        name: string,
        flags: number,
        description: string,
        callback: (args: string[]) => void
    ): void {
        helpRegisterServerCommand(name, flags, description, callback, this.pluginName);
    }

    /**
     * Register a client-only command with automatic plugin tracking.
     * This command can only be executed by connected clients.
     */
    protected registerClientCommand(
        name: string,
        flags: number,
        description: string,
        callback: (entity: nodemod.Entity, args: string[]) => void
    ): void {
        helpRegisterClientCommand(name, flags, description, callback, this.pluginName);
    }

    /**
     * Register a CVAR with automatic plugin tracking.
     * @param name CVAR name
     * @param defaultValue Default value
     * @param flags CVAR flags
     * @param description CVAR description
     * @returns Wrapped CVAR for easy access
     */
    protected registerCvar(
        name: string,
        defaultValue: string,
        flags: number = 0,
        description: string = ''
    ): any {
        if (!cvar.exists(name)) {
            cvar.register(name, defaultValue, flags, description);
        }
        cvarRegistry.register(name, this.pluginName);
        return cvar.wrap(name);
    }

    // ========================================================================
    // Localization
    // ========================================================================

    /**
     * Get localized string for the current plugin
     * @param entity Target entity for language detection, or null
     * @param key Localization key
     * @param args Format arguments
     */
    protected getLang(entity: nodemod.Entity | null, key: string, ...args: any[]): string {
        return localization.getLang(entity, this.pluginName, key, ...args);
    }

    /**
     * Get localized string, falling back to common dictionary
     * @param entity Target entity for language detection, or null
     * @param key Localization key
     * @param args Format arguments
     */
    protected getLangWithFallback(entity: nodemod.Entity | null, key: string, ...args: any[]): string {
        let result = localization.getLang(entity, this.pluginName, key, ...args);
        if (result === key) {
            result = localization.getLang(entity, 'common', key, ...args);
        }
        return result;
    }

    // ========================================================================
    // Console/Chat Output
    // ========================================================================

    /**
     * Send message to entity's console, or server console if null
     */
    protected sendConsole(entity: nodemod.Entity | null, message: string): void {
        utils.sendMessage(entity, message);
    }

    /**
     * Send chat message to target entity, or all players if null
     */
    protected sendChat(target: nodemod.Entity | null, message: string): void {
        utils.sendChatToTarget(message, target, () => adminSystem.getPlayers());
    }

    /**
     * Send chat message to all players with a specific access flag
     */
    protected sendChatToAccess(message: string, accessFlag: number): void {
        for (const player of adminSystem.getPlayers()) {
            if (adminSystem.hasAccess(player, accessFlag)) {
                nodemodCore.util.sendChat(message, player);
            }
        }
    }

    // ========================================================================
    // Show Activity
    // ========================================================================

    /**
     * Get show activity options for use with utils.showActivity
     */
    protected getShowActivityOptions(): utils.ShowActivityOptions {
        return {
            getShowActivityLevel: () => this.amxShowActivity?.int || 2,
            hasAdminAccess: (e) => adminSystem.hasAccess(e, ADMIN_ADMIN)
        };
    }

    /**
     * Show admin activity to all players based on amx_show_activity setting
     * @param adminEntity The admin performing the action (null for console)
     * @param message The activity message
     */
    protected showActivity(adminEntity: nodemod.Entity | null, message: string): void {
        const adminName = utils.getAdminName(adminEntity);
        const options = this.getShowActivityOptions();

        for (const player of adminSystem.getPlayers({ excludeBots: true })) {
            utils.showActivity(player, adminName, message, options);
        }
    }

    /**
     * Show admin activity using two lang keys - one for activity level 1 (no name),
     * one for activity level 2+ (with name substituted via %s).
     * Equivalent to AMXX show_activity_key().
     *
     * @param adminEntity The admin performing the action
     * @param langKey1 Lang key for activity level 1 (e.g., "ADMIN: action %s")
     * @param langKey2 Lang key for activity level 2+ (e.g., "ADMIN %s: action %s")
     * @param args Additional arguments for the lang strings (e.g., map name)
     */
    protected showActivityKey(
        adminEntity: nodemod.Entity | null,
        langKey1: string,
        langKey2: string,
        ...args: any[]
    ): void {
        const adminName = utils.getAdminName(adminEntity);
        const activityLevel = this.amxShowActivity?.int || 2;

        if (activityLevel === 0) {
            return; // Show nothing
        }

        for (const player of adminSystem.getPlayers({ excludeBots: true })) {
            if (utils.isBot(player)) continue;

            let message: string;
            if (activityLevel === 1) {
                // Activity level 1: show without admin name
                message = this.getLang(player, langKey1, ...args);
            } else {
                // Activity level 2+: show with admin name as first arg
                message = this.getLang(player, langKey2, adminName, ...args);
            }

            this.sendChat(player, message);
        }
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Get current game time in seconds
     */
    protected getGameTime(): number {
        return utils.getGameTime();
    }

    /**
     * Get player name with fallback to 'Unknown'
     */
    protected getPlayerName(entity: nodemod.Entity): string {
        return utils.getPlayerName(entity);
    }

    /**
     * Get admin name - returns 'CONSOLE' for null entity
     */
    protected getAdminName(entity: nodemod.Entity | null): string {
        return utils.getAdminName(entity);
    }

    /**
     * Parse command string into arguments
     */
    protected parseCommand(text: string): string[] {
        return utils.parseCommand(text);
    }

    /**
     * Log an AMXX-style message in HL log format.
     * These messages go through the onLog() hook system.
     * Format: [NodeMod] message
     *
     * @example
     * this.logAmx(`Kick: "${adminName}<${userId}><${authId}><>" kick "${targetName}"`);
     */
    protected logAmx(message: string): void {
        this.logWithOptions(null, message, [], {
            showPluginName: false,
            showLevel: false,
            prefix: 'NodeMod'
        });
    }

    // ========================================================================
    // Player Information Extraction
    // ========================================================================

    /**
     * Player information structure for logging and display
     */
    protected extractPlayerInfo(entity: nodemod.Entity | null): {
        name: string;
        authId: string;
        userId: number;
        team: string;
        teamShort: string;
        /** Formatted string for HL log format: "name<userid><authid><team>" */
        logFormat: string;
    } {
        if (!entity) {
            return {
                name: 'CONSOLE',
                authId: 'CONSOLE',
                userId: 0,
                team: '',
                teamShort: '',
                logFormat: '"Console<0><CONSOLE><>"'
            };
        }

        const name = entity.netname || 'Unknown';
        const authId = nodemod.eng.getPlayerAuthId(entity) || '';
        const userId = nodemod.eng.getPlayerUserId(entity);
        const team = utils.getPlayerTeamName(entity);
        const teamShort = utils.getPlayerTeamShort(entity);

        return {
            name,
            authId,
            userId,
            team,
            teamShort,
            logFormat: `"${name}<${userId}><${authId}><${team}>"`
        };
    }

    // ========================================================================
    // Admin Action Logging
    // ========================================================================

    /**
     * Log an admin action in HL engine format.
     * Consolidates the dual-format logging pattern used across admin commands.
     *
     * This logs in the format: L MM/DD/YYYY - HH:MM:SS: "admin<id><auth><team>" action "target<id><auth><team>" (params...)
     *
     * @param admin The admin performing the action (null for server console)
     * @param action The action description (e.g., "kick", "ban", "slay")
     * @param target Optional target player
     * @param params Additional key-value pairs to log
     */
    protected logAdminAction(
        admin: nodemod.Entity | null,
        action: string,
        target?: nodemod.Entity | null,
        params: { [key: string]: string } = {}
    ): void {
        const adminInfo = this.extractPlayerInfo(admin);

        let logLine = `L ${this.getLogTimestamp()}: ${adminInfo.logFormat} ${action}`;

        if (target) {
            const targetInfo = this.extractPlayerInfo(target);
            logLine += ` ${targetInfo.logFormat}`;
        }

        // Build parameters string
        for (const [key, value] of Object.entries(params)) {
            logLine += ` (${key} "${value}")`;
        }

        console.log(logLine);
    }

    /**
     * Log a message in HL engine format for external log parsing tools.
     * This is the format used by log analysis tools like HLSW, etc.
     *
     * Format: "<name><userid><authid><team>" triggered "<action>" (key "value")...
     *
     * @param entity The player entity (or null for server)
     * @param action The action name (e.g., "amx_tsay", "amx_chat")
     * @param params Additional key-value pairs to log
     */
    protected logMessage(
        entity: nodemod.Entity | null,
        action: string,
        params: { [key: string]: string } = {}
    ): void {
        const playerInfo = this.extractPlayerInfo(entity);

        // Build parameters string
        let paramsStr = '';
        for (const [key, value] of Object.entries(params)) {
            paramsStr += ` (${key} "${value}")`;
        }

        console.log(`L ${this.getLogTimestamp()}: ${playerInfo.logFormat} triggered "${action}"${paramsStr}`);
    }

    /**
     * Get timestamp in HL log format: MM/DD/YYYY - HH:MM:SS
     */
    private getLogTimestamp(): string {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${month}/${day}/${year} - ${hours}:${minutes}:${seconds}`;
    }

    // ========================================================================
    // Lifecycle Hooks (Override in subclasses)
    // ========================================================================

    /**
     * Called during map precache phase.
     * Override to precache models, sounds, sprites, and generic files.
     * Equivalent to AMX Mod X: plugin_precache()
     *
     * @example
     * onPrecache() {
     *     nodemod.eng.precacheModel('models/custom.mdl');
     *     nodemod.eng.precacheSound('sounds/custom.wav');
     * }
     */
    onPrecache(): void {
        // Override in subclass
    }

    /**
     * Called when plugin is loaded and initialized.
     * Override to register cvars, commands, events, and initialize data.
     * Equivalent to AMX Mod X: plugin_init()
     *
     * Note: The base constructor already handles basic initialization.
     * Call super.onLoad() if you override this method.
     */
    onLoad(): void {
        // Override in subclass
    }

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
    onConfig(): void {
        // Override in subclass
    }

    /**
     * Called when a new map starts (server is active).
     * Override to reset map state, initialize per-map resources.
     *
     * @example
     * onMapStart() {
     *     this.resetMapState();
     *     console.log(`Map started: ${nodemod.mapname}`);
     * }
     */
    onMapStart(): void {
        // Override in subclass
    }

    /**
     * Called when the current map is ending.
     * Override to save state, cleanup map-specific resources.
     *
     * @example
     * onMapEnd() {
     *     this.savePlayerStats();
     *     this.clearMapData();
     * }
     */
    onMapEnd(): void {
        // Override in subclass
    }

    /**
     * Called when plugin execution is paused.
     * Override to save state before pause.
     * Equivalent to AMX Mod X: plugin_pause()
     */
    onPause(): void {
        // Override in subclass
    }

    /**
     * Called when plugin execution is resumed after being paused.
     * Override to restore state after pause.
     * Equivalent to AMX Mod X: plugin_unpause()
     */
    onUnpause(): void {
        // Override in subclass
    }

    /**
     * Called when a message is about to be logged.
     * Override to intercept, modify, or block log messages.
     * Equivalent to AMX Mod X: plugin_log()
     *
     * @param message The log message
     * @returns false to block the log message, true or undefined to allow it
     */
    onLog(message: string): boolean | void {
        // Override in subclass
        // Return false to block the log
    }

    /**
     * Called when plugin is being unloaded.
     * Override to cleanup resources, save state.
     * Event handlers registered with this.on() are automatically unregistered.
     * Equivalent to AMX Mod X: plugin_end()
     *
     * IMPORTANT: If you override this method, call super.onUnload() to ensure
     * proper cleanup of event handlers!
     *
     * @example
     * onUnload() {
     *     this.saveAllData();
     *     this.cleanup();
     *     super.onUnload(); // Required for event handler cleanup!
     * }
     */
    onUnload(): void {
        // Cleanup all registered event handlers
        this.unregisterAllHandlers();
    }
}

export default BasePlugin;
