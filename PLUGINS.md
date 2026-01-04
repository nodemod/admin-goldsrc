# Plugin Lifecycle Migration Guide

This document maps AMX Mod X `plugin_*` forwards to the NodeMod TypeScript plugin system.

## Forward Mapping Table

| AMX Mod X Forward   | NodeMod Method    | When Called                          | Purpose                                            |
|---------------------|-------------------|--------------------------------------|----------------------------------------------------|
| `plugin_precache()` | `onPrecache()`    | During `dllPrecache` event           | Precache models, sounds, sprites, generic files    |
| `plugin_natives()`  | *constructor*     | Plugin instantiation                 | Register native functions (handled by class setup) |
| `plugin_init()`     | `onLoad()`        | After constructor                    | Register cvars, commands, events, initialize data  |
| `plugin_cfg()`      | `onConfig()`      | After ALL plugins + configs executed | Read cvar values set by config files               |
| `plugin_pause()`    | `onPause()`       | When `pluginLoader.pausePlugin()`    | Save state before pause                            |
| `plugin_unpause()`  | `onUnpause()`     | When `pluginLoader.unpausePlugin()`  | Restore state after pause                          |
| `plugin_log()`      | `onLog(message)`  | When a log message is written        | Intercept/block log messages (return `false`)      |
| `plugin_end()`      | `onUnload()`      | Before plugin unloading              | Cleanup resources, save state                      |
| `plugin_modules()`  | *deprecated*      | N/A                                  | No longer needed since AMXX 1.50                   |
| `plugin_flags()`    | *N/A*             | N/A                                  | Native function, not a forward - rarely used       |
| *(new)*             | `onMapStart()`    | During `dllServerActivate`           | Reset per-map state                                |
| *(new)*             | `onMapEnd()`      | During `dllServerDeactivate`         | Save state, cleanup map resources                  |

**Note:** `plugin_id`, `plugin_name`, and `plugin_native` are not actual forwards - they are
parameter/variable names used in AMX Mod X documentation.

## Lifecycle Order

The plugin loading is **synchronous** - `onConfig()` is called only after ALL plugins have
completed their `constructor()` and `onLoad()` calls, and config files have been executed.

```
STARTUP (synchronous):
  1. For each plugin in plugins.ini:
     a. constructor()   ← Plugin instantiation [plugin_natives]
     b. onLoad()        ← Register cvars, commands, events [plugin_init]
  2. executeConfigFiles() ← Run amxx.cfg, etc.
  3. For each plugin:
     a. onConfig()      ← Read cvar values set by configs [plugin_cfg]

MAP LIFECYCLE (event-driven):
  4. onPrecache()       ← dllPrecache (precache models/sounds) [plugin_precache]
  5. onMapStart()       ← dllServerActivate (each map)
     ... gameplay ...
     onLog(msg)         ← When logging occurs [plugin_log]
  6. onMapEnd()         ← dllServerDeactivate (each map)

RUNTIME (on demand):
  7. onPause()          ← When paused [plugin_pause]
  8. onUnpause()        ← When resumed [plugin_unpause]

SHUTDOWN:
  9. onUnload()         ← Server shutdown [plugin_end]
```

## Files Changed

### Core Files

#### `src/pluginloader.ts`
- Added header comment with AMX Mod X forward mapping table
- Added lifecycle hooks to `Plugin` interface: `onPrecache`, `onConfig`, `onMapStart`, `onMapEnd`, `onPause`, `onUnpause`, `onLog`
- Added `paused` state tracking to `LoadedPlugin`
- Added hook dispatchers: `callPrecache()`, `callConfig()`, `callMapStart()`, `callMapEnd()`, `callLog()`
- Added plugin state management: `pausePlugin()`, `unpausePlugin()`, `unloadPlugin()`, `isPaused()`

#### `src/baseplugin.ts`
- Added header comment with AMX Mod X forward mapping table and usage example
- Added Winston-style logging: `log()`, `debug()`, `info()`, `warn()`, `error()`
- Added log level filtering with `setLogLevel()`
- Added event handling with pause/unload support: `on()`, `once()`, `off()`
- Added lifecycle hook defaults with JSDoc documentation showing AMX equivalents
- Auto-cleanup of event handlers in `onUnload()`

#### `src/index.ts`
- Wrapped plugin loading in try/catch for graceful error handling
- Added lifecycle event hooks for `dllPrecache`, `dllServerActivate`, `dllServerDeactivate`
- Synchronous plugin loading: all `onLoad()` calls complete before `onConfig()` is called
- Calls `pluginLoader.callConfig()` after config files are executed

#### `src/admin.plugin.ts`
- Removed 100ms setTimeout delay in `executeConfigFiles()` (no longer needed)

### Plugin Files Updated

All plugins updated to use lifecycle hooks with JSDoc comments indicating AMX equivalents:

| Plugin | Lifecycle Hooks | Completeness | Notes |
|--------|-----------------|--------------|-------|
| `adminchat.plugin.ts` | `onLoad()` | ✅ Complete | |
| `admincmd.plugin.ts` | `onLoad()`, `onConfig()`, `onUnload()` | ✅ Complete | Added: `amx_extendmap`, `amx_xvar_float/int`, xvar system |
| `adminslots.plugin.ts` | `onLoad()`, `onConfig()`, `onUnload()` | ✅ Complete | Improvements: bot filtering, auth polling |
| `imessage.plugin.ts` | `onLoad()`, `onConfig()`, `onUnload()` | ✅ Complete | Improvements: file persistence |
| `mapchooser.plugin.ts` | `onLoad()`, `onUnload()` | ✅ Complete | |
| `mapsmenu.plugin.ts` | `onLoad()`, `onUnload()` | ✅ Complete | |
| `plmenu.plugin.ts` | `onLoad()`, `onUnload()` | ✅ Complete | Added: temp bans, CS detection, silent mode, CVAR caching |

### Key Patterns Applied

1. **Constructor**: Only basic setup (CVAR wrapping, localization loading)
2. **onLoad()**: Command registration, event handlers via `this.on()`, file loading
3. **onConfig()**: Actions that need CVAR values from config files (timers, settings)
4. **onUnload()**: Timer cleanup, state saving, must call `super.onUnload()`
5. **Event handlers**: Use `this.on()` instead of `nodemod.on()` for automatic pause/unload handling

## Example Plugin

```typescript
import { BasePlugin, Plugin, PluginMetadata } from '@nodemod/admin';

export default class MyPlugin extends BasePlugin implements Plugin {
    readonly metadata: PluginMetadata = {
        name: 'My Plugin',
        version: '1.0.0',
        author: 'Me'
    };

    private myCvar: any;

    constructor(pluginName: string) {
        super(pluginName);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════════════

    onPrecache() {
        // Precache resources (like plugin_precache)
        nodemod.eng.precacheModel('models/custom.mdl');
    }

    onLoad() {
        // Initialize plugin (like plugin_init)
        this.myCvar = this.registerCvar('my_setting', '1');
        this.registerCommand('mycmd', 0, 'My command', this.myCommand.bind(this));

        // Use this.on() for automatic pause/unload handling
        this.on('dllClientCommand', (entity, text) => {
            this.info('Command: %s', text);
        });
    }

    onConfig() {
        // Config files have been executed (like plugin_cfg)
        this.info('My setting value: %d', this.myCvar.int);
    }

    onMapStart() {
        this.info('Map started: %s', nodemod.mapname);
    }

    onMapEnd() {
        // Save stats, cleanup map data
    }

    onPause() {
        this.info('Plugin paused');
    }

    onUnpause() {
        this.info('Plugin resumed');
    }

    onLog(message: string): boolean | void {
        // Return false to block a log message
        if (message.includes('sensitive')) {
            return false;
        }
    }

    onUnload() {
        // Cleanup (like plugin_end)
        this.info('Plugin unloading');
        super.onUnload(); // Required for event handler cleanup!
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLUGIN METHODS
    // ═══════════════════════════════════════════════════════════════════════

    private myCommand(entity: nodemod.Entity | null, args: string[]) {
        this.info('Command executed by %s', this.getAdminName(entity));
    }
}
```

## Logging API

```typescript
// Set minimum log level (default: 'info')
this.setLogLevel('debug');  // Show all logs

// Log methods with printf-style formatting
this.debug('Processing entity %d', entityId);
this.info('Plugin initialized');
this.warn('Config not found, using defaults');
this.error('Failed to load: %s', error.message);

// Generic log method
this.log('info', 'Custom message with %s', 'args');
```

### Log Levels
- `debug` - Verbose debugging info (only shown if level is 'debug')
- `info` - General information
- `warn` - Warnings
- `error` - Errors (always shown)

### Format Specifiers
- `%s` - String
- `%d` / `%i` - Integer
- `%f` - Float
- `%j` - JSON
- `%o` / `%O` - Object (pretty-printed)

## Event Handling API

```typescript
// Register event handler (auto-unregisters on unload, respects pause)
this.on('dllClientCommand', (entity, text) => {
    this.info('Command: %s', text);
});

// One-time handler
this.once('dllServerActivate', () => {
    this.info('First map loaded!');
});

// Manual unregister
const handler = (entity: nodemod.Entity) => { ... };
this.on('dllPlayerSpawn', handler);
this.off('dllPlayerSpawn', handler);

// Check if paused
if (this.paused) {
    return;
}
```

**Important**: Use `this.on()` instead of `nodemod.on()` to ensure:
- Handlers are skipped when the plugin is paused
- Handlers are automatically unregistered on unload
- Errors in handlers are caught and logged

## PluginLoader API

```typescript
import { pluginLoader } from '@nodemod/admin';

// Pause/unpause a plugin
pluginLoader.pausePlugin('myplugin');   // Calls onPause, stops events
pluginLoader.unpausePlugin('myplugin'); // Resumes events, calls onUnpause

// Unload a plugin
pluginLoader.unloadPlugin('myplugin');  // Calls onUnload, removes plugin

// Check state
pluginLoader.isPaused('myplugin');      // Returns boolean
pluginLoader.isLoaded('myplugin');      // Returns boolean
```

## Command Registration and META_RES

Commands registered through the admin system use Metamod's `META_RES` to control whether
the original engine command is blocked or allowed to pass through.

### Command Types and Default Behavior

| Registration Method | AMXX Equivalent | Type | Default META_RES | Use Case |
|---------------------|-----------------|------|------------------|----------|
| `this.registerCommand()` | `register_concmd` | console | `SUPERCEDE` (auto) | Admin commands (`amx_kick`, `amx_ban`) |
| `this.registerServerCommand()` | `register_srvcmd` | server | `SUPERCEDE` (auto) | Server-only commands (`amx_imessage`) |
| `this.registerClientCommand()` | `register_clcmd` | client | `IGNORED` | Chat hooks (`say`, `say_team`) - must explicitly block |

**Note:** AMXX added these three registration types to address gaps in the original AMX Mod.
`register_concmd` works from both client console and server console/rcon, while `register_clcmd`
and `register_srvcmd` are restricted to their respective contexts.

### The Logic Chain

When a client sends a command (e.g., `say hello` or `amx_kick player`), here's what happens:

```
1. Engine receives command from client
   ↓
2. Metamod intercepts via dllClientCommand hook
   - META_RES starts as IGNORED (engine default)
   ↓
3. NodeMod's cmd system checks for registered handlers
   ↓
4. All matching handlers are executed
   - Handler can return META_RES value to set it
   - If handler returns SUPERCEDE, stop processing further handlers
   ↓
5. After all handlers run, check command type:

   IF command was registered as 'client' type:
     → Keep current META_RES (stays IGNORED unless handler changed it)
     → Engine processes the command normally (e.g., chat is sent)

   IF command was registered as 'console' type (and no 'client' handlers):
     → Auto-set META_RES to SUPERCEDE
     → Engine never sees the command (blocked)
   ↓
6. Metamod returns to engine with final META_RES
```

This logic lives in `@nodemod/core` (`cmd.ts` lines 193-197):
```typescript
// Auto-SUPERCEDE only for console commands (register/registerServer)
// Client-only commands (registerClient) let the plugin decide
if (clientCommands.length === 0 && nodemod.getMetaResult() === nodemod.META_RES.IGNORED) {
  nodemod.setMetaResult(nodemod.META_RES.SUPERCEDE);
}
```

### Why This Design?

- **Admin commands** (`amx_kick`, `amx_ban`) are custom - the engine doesn't know them.
  Auto-blocking prevents "unknown command" errors in console.

- **Chat hooks** (`say`, `say_team`) intercept real engine commands.
  You usually want chat to still work, only blocking specific messages (spam, bad words).

### How It Works

**Console/Server commands** automatically block the engine from processing the command:
```typescript
// In your plugin - amx_kick is auto-blocked, engine never sees it
this.registerCommand('amx_kick', ADMIN_KICK, '<player> - kick player', (entity, args) => {
    // Handle kick...
    // No need to return anything - command is blocked by default
});
```

**Client commands** let the command pass through by default:
```typescript
// Chat messages pass through to other players unless you block them
this.registerClientCommand('say', 0, '', (entity, args) => {
    const message = args.join(' ');

    if (message.includes('badword')) {
        // Block this chat message
        return nodemod.META_RES.SUPERCEDE;
    }

    // No return = IGNORED, chat passes through normally
});
```

### META_RES Values

```typescript
nodemod.META_RES.IGNORED    // 1 - Plugin didn't act, continue normally
nodemod.META_RES.HANDLED    // 2 - Plugin acted, but still run original
nodemod.META_RES.OVERRIDE   // 3 - Run original, but use plugin's return value
nodemod.META_RES.SUPERCEDE  // 4 - Skip original function entirely
```

### Manual Control

You can explicitly set META_RES in any command handler:
```typescript
this.registerCommand('amx_test', 0, '', (entity, args) => {
    // Do something...

    // Explicitly allow engine to also process this command
    return nodemod.META_RES.HANDLED;
});
```

## Menu Colors

Menu color codes (`\y`, `\w`, `\d`, `\r`) are only supported by certain mods.

### Supported Mods
- `cstrike` - Counter-Strike
- `czero` - Counter-Strike: Condition Zero
- `dod` - Day of Defeat
- `tfc` - Team Fortress Classic
- `dmc` - Deathmatch Classic
- `valve` - Half-Life Deathmatch

### Usage

The `coloredMenus()` utility automatically detects support:
```typescript
import { coloredMenus, getMenuFormatters } from '@nodemod/admin';

// Check if colors are supported
if (coloredMenus()) {
    console.log('This mod supports colored menus');
}

// Use auto-detecting formatters (recommended)
const formatters = getMenuFormatters();
nodemodCore.menu.show(entity, {
    title: 'My Menu',
    items: [...],
    formatters
});
```
