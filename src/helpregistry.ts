// Plugin Registry
// Shared registry for commands and CVARs
// Plugins register their commands/cvars here for help system and plugin menus

import nodemodCore from '@nodemod/core';
import { ADMIN_ADMIN } from './constants';
import * as utils from './utils';

export interface HelpCommand {
    name: string;
    flags: number;
    description: string;
    plugin?: string;  // Plugin filename that registered this command
    serverOnly?: boolean;  // If true, only shown in server console help, not client amx_help
}

// ============================================================================
// CVAR Registry
// ============================================================================

interface CvarEntry {
    name: string;
    plugin: string;
}

class CvarRegistry {
    private cvars: CvarEntry[] = [];

    /**
     * Register a CVAR for a plugin
     */
    register(name: string, plugin: string): void {
        const existing = this.cvars.find(c => c.name === name);
        if (!existing) {
            this.cvars.push({ name, plugin });
        }
    }

    /**
     * Unregister a CVAR
     */
    unregister(name: string): void {
        const index = this.cvars.findIndex(c => c.name === name);
        if (index !== -1) {
            this.cvars.splice(index, 1);
        }
    }

    /**
     * Get CVARs registered by a specific plugin
     */
    getCvarsByPlugin(pluginFilename: string): string[] {
        return this.cvars.filter(c => c.plugin === pluginFilename).map(c => c.name);
    }

    /**
     * Get all registered CVARs
     */
    getAllCvars(): CvarEntry[] {
        return this.cvars;
    }
}

// Singleton CVAR registry
export const cvarRegistry = new CvarRegistry();

// ============================================================================
// Command (Help) Registry
// ============================================================================

class HelpRegistry {
    private commands: HelpCommand[] = [];

    /**
     * Register a command for the help system
     * @param name Command name (e.g., "amx_kick")
     * @param flags Required access flags (e.g., ADMIN_KICK)
     * @param description Command description/usage
     * @param plugin Optional plugin filename that registered this command
     * @param serverOnly If true, command is only shown in server console help
     */
    register(name: string, flags: number, description: string, plugin?: string, serverOnly?: boolean): void {
        // Check if already registered
        const existing = this.commands.find(c => c.name === name);
        if (existing) {
            existing.flags = flags;
            existing.description = description;
            if (plugin) existing.plugin = plugin;
            if (serverOnly !== undefined) existing.serverOnly = serverOnly;
            return;
        }
        this.commands.push({ name, flags, description, plugin, serverOnly });
    }

    /**
     * Get commands registered by a specific plugin
     */
    getCommandsByPlugin(pluginFilename: string): HelpCommand[] {
        return this.commands.filter(cmd => cmd.plugin === pluginFilename);
    }

    /**
     * Get all commands
     */
    getAllCommands(): HelpCommand[] {
        return this.commands;
    }

    /**
     * Unregister a command
     */
    unregister(name: string): void {
        const index = this.commands.findIndex(c => c.name === name);
        if (index !== -1) {
            this.commands.splice(index, 1);
        }
    }

    /**
     * Get commands accessible by a user with given flags
     * @param userFlags User's access flags
     * @param isServer If true, include server-only commands (for server console)
     */
    getAccessibleCommands(userFlags: number, isServer: boolean = false): HelpCommand[] {
        return this.commands.filter(cmd => {
            // Skip commands with empty descriptions (hidden from help)
            if (!cmd.description || cmd.description.trim() === '') return false;

            // Skip server-only commands for clients
            if (cmd.serverOnly && !isServer) return false;

            if (cmd.flags === 0) return true; // Everyone can access
            if (cmd.flags === ADMIN_ADMIN) {
                return utils.isUserAdmin(userFlags);
            }
            return (userFlags & cmd.flags) !== 0;
        });
    }

    /**
     * Get total command count for a user
     * @param userFlags User's access flags
     * @param isServer If true, include server-only commands
     */
    getCommandCount(userFlags: number, isServer: boolean = false): number {
        return this.getAccessibleCommands(userFlags, isServer).length;
    }

    /**
     * Get a page of commands for a user
     * @param userFlags User's access flags
     * @param start Start index
     * @param amount Number of commands to return
     * @param isServer If true, include server-only commands
     */
    getCommandPage(userFlags: number, start: number, amount: number, isServer: boolean = false): HelpCommand[] {
        const accessible = this.getAccessibleCommands(userFlags, isServer);
        return accessible.slice(start, start + amount);
    }
}

// Singleton registry
export const helpRegistry = new HelpRegistry();

/**
 * Register a command with both the command system and help registry.
 * Equivalent to AMX Mod X's register_concmd which does both in one call.
 *
 * @param name Command name (e.g., "amx_kick")
 * @param flags Required access flags (e.g., ADMIN_KICK)
 * @param description Command description/usage for help
 * @param callback Command handler function
 * @param plugin Optional plugin filename for tracking
 */
export function registerCommand(
    name: string,
    flags: number,
    description: string,
    callback: (entity: nodemod.Entity | null, args: string[]) => void,
    plugin?: string
): void {
    nodemodCore.cmd.register(name, callback);
    helpRegistry.register(name, flags, description, plugin);
}

/**
 * Register a server-only command with both the command system and help registry.
 * This command can only be executed from the server console or rcon.
 * Server commands are NOT shown in amx_help for clients.
 *
 * @param name Command name (e.g., "amx_imessage")
 * @param flags Required access flags (usually 0 for server commands)
 * @param description Command description/usage for help
 * @param callback Command handler function
 * @param plugin Optional plugin filename for tracking
 */
export function registerServerCommand(
    name: string,
    flags: number,
    description: string,
    callback: (args: string[]) => void,
    plugin?: string
): void {
    nodemodCore.cmd.registerServer(name, callback);
    helpRegistry.register(name, flags, description, plugin, true);  // serverOnly = true
}

/**
 * Register a client-only command with both the command system and help registry.
 * This command can only be executed by connected clients.
 *
 * @param name Command name (e.g., "say")
 * @param flags Required access flags
 * @param description Command description/usage for help
 * @param callback Command handler function
 * @param plugin Optional plugin filename for tracking
 */
export function registerClientCommand(
    name: string,
    flags: number,
    description: string,
    callback: (entity: nodemod.Entity, args: string[]) => void,
    plugin?: string
): void {
    nodemodCore.cmd.registerClient(name, callback);
    helpRegistry.register(name, flags, description, plugin);
}
