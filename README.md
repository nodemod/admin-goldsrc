# @nodemod/admin

> **Note:** This package is intended for use with [NodeMod](https://github.com/nodemod/nodemod), a Node.js-based plugin system for Half-Life/GoldSrc dedicated servers. It will not work standalone.

Admin plugins for NodeMod Half-Life server, providing player management, voting, menus, and server administration commands.

## Documentation

- **[Admin System Guide](https://nodemod.org/docs/guides/admin-system)** - Configuration and usage
- **[Admin Plugin Development](https://nodemod.org/docs/guides/admin-plugins)** - Creating custom admin plugins
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

This port aims to maintain compatibility with the original AMX Mod X command structure and configuration files while leveraging modern JavaScript/TypeScript features and the NodeMod runtime.

## Features

- **Admin System** - User authentication via SteamID, IP, or name with configurable access flags
- **Admin Commands** - kick, ban, slap, slay, map change, cvar control, and more
- **Admin Chat** - Private admin communication channels
- **Voting System** - Map votes, kick votes, and custom votes
- **Menus** - Player management menus, map selection, teleport menu
- **Map Management** - Map chooser, nextmap rotation
- **Localization** - Multi-language support via dictionary files
- **Storage Backends** - File-based (users.ini) or SQL database storage

## Installation

```bash
npm install @nodemod/admin
```

## Configuration

Configuration files are located in `configs/`:

- `users.ini` - Admin accounts
- `plugins.ini` - Enabled plugins
- `cmds.ini` - Custom command definitions
- `maps.ini` - Map rotation
- `cvars.ini` - CVAR settings

## License

This port is released under the same license as the original AMX Mod X project (GPL v2).

The original AMX Mod X is Copyright (C) 2004-2024 AMX Mod X Development Team.
