# @nodemod/admin

> **Note:** This package is intended for use with [NodeMod](https://github.com/nodemod/nodemod), a Node.js-based plugin system for Half-Life/GoldSrc dedicated servers. It will not work standalone.

Admin system for NodeMod Half-Life servers, providing player management, voting, menus, and server administration commands. This is a TypeScript port of AMX Mod X.

## Plugin System

### File Naming Convention

All plugins use the `.plugin.ts` extension. The plugin loader only loads files matching this pattern:

```
src/
├── admin.plugin.ts        # Core admin system
├── adminchat.plugin.ts    # Admin chat commands
├── admincmd.plugin.ts     # Admin commands (kick, ban, etc.)
├── plmenu.plugin.ts       # Player menu
├── baseplugin.ts          # Base class (NOT a plugin)
├── utils.ts               # Utilities (NOT a plugin)
└── constants.ts           # Constants (NOT a plugin)
```

### Creating a Plugin

```typescript
// myplugin.plugin.ts
import nodemodCore from '@nodemod/core';
import { BasePlugin, Plugin, PluginMetadata, ADMIN_KICK } from '@nodemod/admin';

class MyPlugin extends BasePlugin implements Plugin {
    readonly metadata: PluginMetadata = {
        name: 'My Plugin',
        version: '1.0.0',
        author: 'Your Name',
        description: 'A custom admin plugin'
    };

    constructor(pluginName: string) {
        super(pluginName);

        // Register a CVAR
        const myCvar = this.registerCvar('my_enabled', '1', 0, 'Enable my plugin');

        // Register a command requiring ADMIN_KICK access
        this.registerCommand('my_cmd', ADMIN_KICK, 'Does something',
            (entity, args) => this.onCommand(entity, args));
    }

    private onCommand(entity: nodemod.Entity | null, args: string[]): void {
        this.sendConsole(entity, 'Command executed!');
        this.showActivity(entity, 'used my_cmd');
    }

    onUnload(): void {
        // Cleanup when plugin is unloaded
    }
}

export default MyPlugin;
```

### BasePlugin API

When extending `BasePlugin`, you get access to these utilities:

| Method | Description |
|--------|-------------|
| `registerCommand(name, flags, desc, callback)` | Register admin command |
| `registerCvar(name, default, flags, desc)` | Register and wrap a CVAR |
| `getLang(entity, key, ...args)` | Get localized string |
| `sendConsole(entity, message)` | Send to console |
| `sendChat(target, message)` | Send chat message |
| `showActivity(admin, message)` | Show admin activity |
| `logAdminAction(admin, action, target, params)` | Log admin action |
| `getPlayerName(entity)` | Get player name |
| `getAdminName(entity)` | Get admin name (or "CONSOLE") |

### Plugin Lifecycle

```typescript
class MyPlugin extends BasePlugin implements Plugin {
    constructor(pluginName: string) {
        super(pluginName);
        // Initialize: register commands, CVARs, event handlers
    }

    onLoad?(): void {
        // Called after constructor (optional)
    }

    onUnload?(): void {
        // Cleanup: clear timers, remove event handlers (optional)
    }
}
```

## Features

- **Admin System** - User authentication via SteamID, IP, or name with configurable access flags
- **Admin Commands** - kick, ban, slap, slay, map change, cvar control, and more
- **Admin Chat** - Private admin communication channels
- **Voting System** - Map votes, kick votes, and custom votes
- **Menus** - Player management menus, map selection, teleport menu
- **Map Management** - Map chooser, nextmap rotation
- **Localization** - Multi-language support via dictionary files
- **Storage Backends** - File-based (users.ini) or SQL database storage

## Configuration

Configuration files are located in `configs/`:

| File | Description |
|------|-------------|
| `plugins.ini` | Enabled plugins |
| `users.ini` | Admin accounts |
| `cmds.ini` | Custom command definitions |
| `maps.ini` | Map rotation |
| `cvars.ini` | CVAR settings |
| `amxx.cfg` | Executed after plugins load |

## Access Flags

| Flag | Constant | Description |
|------|----------|-------------|
| a | `ADMIN_IMMUNITY` | Immunity from kicks/bans |
| b | `ADMIN_RESERVATION` | Slot reservation |
| c | `ADMIN_KICK` | Kick players |
| d | `ADMIN_BAN` | Ban players |
| e | `ADMIN_SLAY` | Slay/slap players |
| f | `ADMIN_MAP` | Change maps |
| g | `ADMIN_CVAR` | Change CVARs |
| h | `ADMIN_CFG` | Execute configs |
| i | `ADMIN_CHAT` | Admin chat |
| j | `ADMIN_VOTE` | Start votes |
| k | `ADMIN_PASSWORD` | Password access |
| l | `ADMIN_RCON` | RCON access |
| m | `ADMIN_LEVEL_A` | Custom level A |
| n | `ADMIN_LEVEL_B` | Custom level B |
| o | `ADMIN_LEVEL_C` | Custom level C |
| p | `ADMIN_LEVEL_D` | Custom level D |
| q | `ADMIN_LEVEL_E` | Custom level E |
| r | `ADMIN_LEVEL_F` | Custom level F |
| s | `ADMIN_LEVEL_G` | Custom level G |
| t | `ADMIN_LEVEL_H` | Custom level H |
| u | `ADMIN_MENU` | Menu access |
| z | `ADMIN_USER` | Regular user |

## Documentation

- **[Admin System Guide](https://nodemod.org/docs/guides/admin-system)** - Configuration and usage
- **[Admin Plugin Development](https://nodemod.org/docs/guides/admin-plugins)** - Creating custom plugins
- **[API Reference](https://nodemod.org/docs/api)** - Full API documentation

## Credits

This package is a TypeScript port of the original **AMX Mod X** admin plugins for Half-Life. The original plugins were developed by the AMX Mod X Development Team, with significant contributions from:

- **OLO** - Original developer of most core admin plugins
- **tcquest78** - adminhelp plugin
- **p3tsin** - potti plugin
- **The AMX Mod X Development Team** - Continued maintenance and development

The original AMX Mod X project can be found at: https://www.amxmodx.org/

### NodeMod Port

Ported to TypeScript for NodeMod by **Steven Linn** (stevenlafl).

## License

This port is released under the same license as the original AMX Mod X project (GPL v2).

The original AMX Mod X is Copyright (C) 2004-2024 AMX Mod X Development Team.
