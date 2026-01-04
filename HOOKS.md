# NodeMod Hook Reference

Complete list of all DLL and Engine hooks available in NodeMod.

## Naming Convention

Hooks follow a consistent naming pattern:
- `dll*` - Game DLL hooks (pre-hook, fires before original function)
- `postDll*` - Game DLL hooks (post-hook, fires after original function)
- `eng*` - Engine hooks (pre-hook)
- `postEng*` - Engine hooks (post-hook)

## Usage

```typescript
// Pre-hook (fires BEFORE original function)
nodemod.on('dllSpawn', (entity) => {
    console.log('Spawning:', entity.classname);
});

// Post-hook (fires AFTER original function)
nodemod.on('postDllSpawn', (entity) => {
    console.log('Spawned:', entity.classname);
});
```

---

## Execution Order

The following shows the actual execution order of hooks during server startup and player connection. Post-hooks fire immediately after their corresponding pre-hooks.

### Server Initialization
```
dllGameInit                    ← Game DLL initialization
├── engAddServerCommand        ← Register server commands
├── engCVarRegister            ← Register cvars
└── engServerCommand           ← Execute server commands

dllPMInit                      ← Player movement initialization
dllRegisterEncoders            ← Delta encoder registration
├── engDeltaAddEncoder

dllGetHullBounds               ← Hull bounds setup
dllResetGlobalState            ← Reset global state
```

### Map Load (Entity Spawning)
```
dllSpawn                       ← Entity spawning begins (worldspawn first)
├── engServerExecute           ← Execute queued commands
│   ├── engCmdArgc/engCmdArgv  ← Command parsing
│   └── engAlertMessage        ← Console messages
├── engPrecacheModel           ← Model precaching
├── engPrecacheSound           ← Sound precaching
├── engPrecacheEvent           ← Event precaching
├── engRegUserMsg              ← Register user messages
├── engCreateEntity            ← Entity creation
├── engCreateNamedEntity       ← Named entity creation
├── engLoadFileForMe           ← File loading
├── engLightStyle              ← Light styles
├── engDecalIndex              ← Decal indexing
├── engSetModel                ← Set entity models
└── engSetOrigin               ← Set entity positions
```

### Server Activation
```
dllServerActivate              ← Server ready for players
dllTouch                       ← Entity touch events begin
├── engEmitSound               ← Sound emission

dllCreateBaseline              ← Network baselines
dllCreateInstancedBaselines
├── engDeltaFindField
```

### Player Connection
```
dllClientUserInfoChanged       ← Player info set
dllClientConnect               ← Player connecting
├── engFindEntityByString      ← Entity lookups

dllClientPutInServer           ← Player enters game
├── engSetClientMaxspeed       ← Set player speed
├── engSetPhysicsKeyValue      ← Physics settings
├── engGetInfoKeyBuffer        ← Get player info
├── engInfoKeyValue            ← Parse info keys
├── engSetView                 ← Set player view
├── engPlaybackEvent           ← Play events

dllPlayerCustomization         ← Player customization (sprays, models)
```

### Gameplay Loop
```
dllStartFrame                  ← Every server frame (~100fps)
├── dllPlayerPreThink          ← Before player physics
├── dllThink                   ← Entity think functions
├── dllPlayerPostThink         ← After player physics
├── engTraceLine/TraceHull     ← Collision traces
├── engEmitSound               ← Sounds
└── engMessageBegin/End        ← Network messages

dllClientCommand               ← Player console commands
```

### Player Disconnect
```
dllClientDisconnect            ← Player leaving
```

### Server Shutdown / Map Change
```
dllServerDeactivate            ← Map ending begins
postDllServerDeactivate        ← After map deactivation

For EACH connected player (in reverse order):
├── dllClientDisconnect        ← Player being disconnected
└── postDllClientDisconnect    ← After player disconnected
```

---

## Precaching

**Important:** Precaching MUST happen during `dllSpawn` of the worldspawn entity (first entity spawned).

**Note:** `nodemod.mapname` is available during worldspawn's `dllSpawn` (extracted from the worldspawn's model property). However, `gpGlobals.mapname` is NOT set until after all entities spawn.

```typescript
let precacheDone = false;
nodemod.on('dllSpawn', (entity) => {
    if (!precacheDone && entity.classname === 'worldspawn') {
        precacheDone = true;

        // nodemod.mapname works during precaching
        console.log(`Precaching for map: ${nodemod.mapname}`);

        // Precache here!
        nodemod.eng.precacheModel('models/custom.mdl');
        nodemod.eng.precacheSound('weapons/custom.wav');
    }
});

// Reset flag for next map
nodemod.on('dllServerDeactivate', () => {
    precacheDone = false;
});
```

---

## Common Patterns

### Map Start/End

```typescript
// Map fully loaded, ready for players
nodemod.on('dllServerActivate', (pEdictList, edictCount, clientMax) => {
    console.log(`Map loaded with ${edictCount} entities, max ${clientMax} players`);
});

// Map ending
nodemod.on('dllServerDeactivate', () => {
    console.log('Map ending, save state here');
});
```

### Player Events

```typescript
// Player connecting (can reject)
nodemod.on('dllClientConnect', (entity, name, address, rejectReason) => {
    console.log(`${name} connecting from ${address}`);
    // To reject: set rejectReason and return META_RES.SUPERCEDE
});

// Player fully in game
nodemod.on('dllClientPutInServer', (entity) => {
    console.log(`${entity.netname} joined the game`);
});

// Player commands (say, buy, etc.)
nodemod.on('dllClientCommand', (client, commandText) => {
    console.log(`${client.netname}: ${commandText}`);
});

// Player leaving
nodemod.on('dllClientDisconnect', (entity) => {
    console.log(`${entity.netname} disconnected`);
});
```

### Per-Frame Processing

```typescript
// Runs every server frame (~100fps)
nodemod.on('dllStartFrame', () => {
    // Lightweight processing only!
    // Heavy work should use timers or be spread across frames
});

// Per-player, every frame
nodemod.on('dllPlayerPreThink', (entity) => {
    // Before player physics
});

nodemod.on('dllPlayerPostThink', (entity) => {
    // After player physics
});
```

---

## META_RES Control

Use `nodemod.setMetaResult()` to control function execution:

```typescript
nodemod.on('dllClientConnect', (entity, name, address, rejectReason) => {
    if (isBanned(address)) {
        // Block the connection
        nodemod.setMetaResult(nodemod.META_RES.SUPERCEDE);
        return false;
    }
    // Allow normal processing
    nodemod.setMetaResult(nodemod.META_RES.IGNORED);
});
```

| Value | Effect |
|-------|--------|
| `META_RES.IGNORED` (1) | Plugin didn't act, continue normally |
| `META_RES.HANDLED` (2) | Plugin acted, but still run original |
| `META_RES.OVERRIDE` (3) | Run original, use plugin's return value |
| `META_RES.SUPERCEDE` (4) | Skip original function entirely |

---

## Performance Considerations

1. **dllStartFrame** - Runs every frame (~100fps). Keep handlers lightweight.
2. **dllPlayerPreThink/PostThink** - Runs per-player per-frame. O(players × fps).
3. **dllThink** - Can be called many times per frame for active entities.
4. **Post hooks** - Use only when you need to act after the original function.

For heavy processing, use timers or spread work across multiple frames.

---

## Hot Reload (`nodemod_reload`)

When `nodemod_reload` is executed, NodeMod reloads all JavaScript/TypeScript code. Since the map is already running, certain events have already fired. NodeMod automatically fires **catch-up events** after reload:

### Events Fired After Reload

```
nodemod_reload
    │
    ├── (Scripts loaded and initialized)
    │
    ├── dllServerActivate           ← Synthetic event to notify server is ready
    │   └── Parameters: (pEdictList, edictCount, clientMax)
    │
    ├── For EACH connected player (in order):
    │   │
    │   ├── dllClientConnect        ← Player connection info
    │   │   └── Parameters: (pEntity, name, "reload", "")
    │   │   └── Note: Address is "reload" since original IP unavailable
    │   │
    │   ├── dllClientUserInfoChanged ← Player settings (name, model, etc.)
    │   │   └── Parameters: (pEntity, infobuffer)
    │   │
    │   └── dllClientPutInServer    ← Player in game
    │       └── Parameters: (pEntity)
    │
    ├── For EACH spectator (HLTV/SourceTV):
    │   │
    │   └── dllSpectatorConnect     ← Spectator connected
    │       └── Parameters: (pEntity)
    │       └── Note: Detected via FL_PROXY or FL_SPECTATOR flags
    │
    └── For EACH stored player customization:
        │
        └── dllPlayerCustomization  ← Player spray/model customization
            └── Parameters: (pEntity, pCustom)
            └── Note: Stored in C++ during postDllPlayerCustomization
```

### Events NOT Fired After Reload

| Event | Reason |
|-------|--------|
| `dllGameInit` | Only fires once at server start |
| `dllSpawn` (worldspawn) | Would trigger precaching → crash |
| `dllSpawn` (entities) | Entities already exist |

### Handling Reload in Plugins

Plugins that track state should handle both normal startup AND reload scenarios:

```typescript
// This works for both normal map start AND reload
nodemod.on('dllServerActivate', (pEdictList, edictCount, clientMax) => {
    // Initialize/reset map state
    this.mapState = new Map();
});

// This works for both normal connection AND reload
nodemod.on('dllClientPutInServer', (entity) => {
    // Add player to tracking
    this.players.set(entity.id, { entity, joinTime: Date.now() });
});
```

### Precaching After Reload

Precaching **cannot** happen after reload - the precache window closes after worldspawn. If you add new models/sounds, you must change the map or restart the server.

```typescript
// This will CRASH if called after reload:
nodemod.eng.precacheModel('models/new.mdl');  // ❌ Server crash!

// Safe pattern: only precache during worldspawn
let precacheDone = false;
nodemod.on('dllSpawn', (entity) => {
    if (!precacheDone && entity.classname === 'worldspawn') {
        precacheDone = true;
        nodemod.eng.precacheModel('models/new.mdl');  // ✅ Safe
    }
});
```

---

## DLL Hooks (Game DLL Functions)

Pre-hooks fire before the game DLL function executes.

| Hook | Signature |
|------|-----------|
| `dllGameInit` | `() => void` |
| `dllSpawn` | `(pent: Entity) => void` |
| `dllThink` | `(pent: Entity) => void` |
| `dllUse` | `(pentUsed: Entity, pentOther: Entity) => void` |
| `dllTouch` | `(pentTouched: Entity, pentOther: Entity) => void` |
| `dllBlocked` | `(pentBlocked: Entity, pentOther: Entity) => void` |
| `dllKeyValue` | `(pentKeyvalue: Entity, pkvd: KeyValueData) => void` |
| `dllSave` | `(pent: Entity, pSaveData: SaveRestoreData) => void` |
| `dllRestore` | `(pent: Entity, pSaveData: SaveRestoreData, globalEntity: number) => void` |
| `dllSetAbsBox` | `(pent: Entity) => void` |
| `dllSaveWriteFields` | `(value0: SaveRestoreData, value1: string, value2: ArrayBuffer | Uint8Array | null, value3: TypeDescription, value4: number) => void` |
| `dllSaveReadFields` | `(value0: SaveRestoreData, value1: string, value2: ArrayBuffer | Uint8Array | null, value3: TypeDescription, value4: number) => void` |
| `dllSaveGlobalState` | `(value0: SaveRestoreData) => void` |
| `dllRestoreGlobalState` | `(value0: SaveRestoreData) => void` |
| `dllResetGlobalState` | `() => void` |
| `dllClientConnect` | `(pEntity: Entity, pszName: string, pszAddress: string, szRejectReason: string) => void` |
| `dllClientDisconnect` | `(pEntity: Entity) => void` |
| `dllClientKill` | `(pEntity: Entity) => void` |
| `dllClientPutInServer` | `(pEntity: Entity) => void` |
| `dllClientCommand` | `(client: Entity, commandText: string) => void` |
| `dllClientUserInfoChanged` | `(pEntity: Entity, infobuffer: string) => void` |
| `dllServerActivate` | `(pEdictList: Entity, edictCount: number, clientMax: number) => void` |
| `dllServerDeactivate` | `() => void` |
| `dllPlayerPreThink` | `(pEntity: Entity) => void` |
| `dllPlayerPostThink` | `(pEntity: Entity) => void` |
| `dllStartFrame` | `() => void` |
| `dllParmsNewLevel` | `() => void` |
| `dllParmsChangeLevel` | `() => void` |
| `dllGetGameDescription` | `() => void` |
| `dllPlayerCustomization` | `(pEntity: Entity, pCustom: Customization) => void` |
| `dllSpectatorConnect` | `(pEntity: Entity) => void` |
| `dllSpectatorDisconnect` | `(pEntity: Entity) => void` |
| `dllSpectatorThink` | `(pEntity: Entity) => void` |
| `dllSysError` | `(error_string: string) => void` |
| `dllPMMove` | `(ppmove: PlayerMove, server: boolean) => void` |
| `dllPMInit` | `(ppmove: PlayerMove) => void` |
| `dllPMFindTextureType` | `(name: string) => void` |
| `dllSetupVisibility` | `(pViewEntity: Entity, pClient: Entity, pvs: number[], pas: number[]) => void` |
| `dllUpdateClientData` | `(ent: Entity, sendweapons: number, cd: ClientData) => void` |
| `dllAddToFullPack` | `(state: EntityState, e: number, ent: Entity, host: Entity, hostflags: number, player: number, pSet: number[]) => void` |
| `dllCreateBaseline` | `(player: number, eindex: number, baseline: EntityState, entity: Entity, playermodelindex: number, player_mins: number[], player_maxs: number[]) => void` |
| `dllRegisterEncoders` | `() => void` |
| `dllGetWeaponData` | `(player: Entity, info: WeaponData) => void` |
| `dllCmdStart` | `(player: Entity, cmd: UserCmd, random_seed: number) => void` |
| `dllCmdEnd` | `(player: Entity) => void` |
| `dllConnectionlessPacket` | `(net_from: NetAdr, args: string, response_buffer: string, response_buffer_size: number[]) => void` |
| `dllGetHullBounds` | `(hullnumber: number, mins: number[], maxs: number[]) => void` |
| `dllCreateInstancedBaselines` | `() => void` |
| `dllInconsistentFile` | `(player: Entity, filename: string, disconnect_message: string) => void` |
| `dllAllowLagCompensation` | `() => void` |

---

## Post-DLL Hooks

Post-hooks fire after the game DLL function executes.

| Hook | Signature |
|------|-----------|
| `postDllGameInit` | `() => void` |
| `postDllSpawn` | `(pent: Entity) => void` |
| `postDllThink` | `(pent: Entity) => void` |
| `postDllUse` | `(pentUsed: Entity, pentOther: Entity) => void` |
| `postDllTouch` | `(pentTouched: Entity, pentOther: Entity) => void` |
| `postDllBlocked` | `(pentBlocked: Entity, pentOther: Entity) => void` |
| `postDllKeyValue` | `(pentKeyvalue: Entity, pkvd: KeyValueData) => void` |
| `postDllSave` | `(pent: Entity, pSaveData: SaveRestoreData) => void` |
| `postDllRestore` | `(pent: Entity, pSaveData: SaveRestoreData, globalEntity: number) => void` |
| `postDllSetAbsBox` | `(pent: Entity) => void` |
| `postDllSaveWriteFields` | `(value0: SaveRestoreData, value1: string, value2: ArrayBuffer | Uint8Array | null, value3: TypeDescription, value4: number) => void` |
| `postDllSaveReadFields` | `(value0: SaveRestoreData, value1: string, value2: ArrayBuffer | Uint8Array | null, value3: TypeDescription, value4: number) => void` |
| `postDllSaveGlobalState` | `(value0: SaveRestoreData) => void` |
| `postDllRestoreGlobalState` | `(value0: SaveRestoreData) => void` |
| `postDllResetGlobalState` | `() => void` |
| `postDllClientConnect` | `(pEntity: Entity, pszName: string, pszAddress: string, szRejectReason: string) => void` |
| `postDllClientDisconnect` | `(pEntity: Entity) => void` |
| `postDllClientKill` | `(pEntity: Entity) => void` |
| `postDllClientPutInServer` | `(pEntity: Entity) => void` |
| `postDllClientCommand` | `(client: Entity, commandText: string) => void` |
| `postDllClientUserInfoChanged` | `(pEntity: Entity, infobuffer: string) => void` |
| `postDllServerActivate` | `(pEdictList: Entity, edictCount: number, clientMax: number) => void` |
| `postDllServerDeactivate` | `() => void` |
| `postDllPlayerPreThink` | `(pEntity: Entity) => void` |
| `postDllPlayerPostThink` | `(pEntity: Entity) => void` |
| `postDllStartFrame` | `() => void` |
| `postDllParmsNewLevel` | `() => void` |
| `postDllParmsChangeLevel` | `() => void` |
| `postDllGetGameDescription` | `() => void` |
| `postDllPlayerCustomization` | `(pEntity: Entity, pCustom: Customization) => void` |
| `postDllSpectatorConnect` | `(pEntity: Entity) => void` |
| `postDllSpectatorDisconnect` | `(pEntity: Entity) => void` |
| `postDllSpectatorThink` | `(pEntity: Entity) => void` |
| `postDllSysError` | `(error_string: string) => void` |
| `postDllPMMove` | `(ppmove: PlayerMove, server: boolean) => void` |
| `postDllPMInit` | `(ppmove: PlayerMove) => void` |
| `postDllPMFindTextureType` | `(name: string) => void` |
| `postDllSetupVisibility` | `(pViewEntity: Entity, pClient: Entity, pvs: number[], pas: number[]) => void` |
| `postDllUpdateClientData` | `(ent: Entity, sendweapons: number, cd: ClientData) => void` |
| `postDllAddToFullPack` | `(state: EntityState, e: number, ent: Entity, host: Entity, hostflags: number, player: number, pSet: number[]) => void` |
| `postDllCreateBaseline` | `(player: number, eindex: number, baseline: EntityState, entity: Entity, playermodelindex: number, player_mins: number[], player_maxs: number[]) => void` |
| `postDllRegisterEncoders` | `() => void` |
| `postDllGetWeaponData` | `(player: Entity, info: WeaponData) => void` |
| `postDllCmdStart` | `(player: Entity, cmd: UserCmd, random_seed: number) => void` |
| `postDllCmdEnd` | `(player: Entity) => void` |
| `postDllConnectionlessPacket` | `(net_from: NetAdr, args: string, response_buffer: string, response_buffer_size: number[]) => void` |
| `postDllGetHullBounds` | `(hullnumber: number, mins: number[], maxs: number[]) => void` |
| `postDllCreateInstancedBaselines` | `() => void` |
| `postDllInconsistentFile` | `(player: Entity, filename: string, disconnect_message: string) => void` |
| `postDllAllowLagCompensation` | `() => void` |

---

## Engine Hooks

Pre-hooks fire before engine functions execute.

| Hook | Signature |
|------|-----------|
| `engPrecacheModel` | `(s: string) => void` |
| `engPrecacheSound` | `(s: string) => void` |
| `engSetModel` | `(e: Entity, m: string) => void` |
| `engModelIndex` | `(m: string) => void` |
| `engModelFrames` | `(modelIndex: number) => void` |
| `engSetSize` | `(e: Entity, rgflMin: number[], rgflMax: number[]) => void` |
| `engChangeLevel` | `(s1: string, s2: string) => void` |
| `engGetSpawnParms` | `(ent: Entity) => void` |
| `engSaveSpawnParms` | `(ent: Entity) => void` |
| `engVecToYaw` | `(rgflVector: number[]) => void` |
| `engVecToAngles` | `(rgflVectorIn: number[], rgflVectorOut: number[]) => void` |
| `engMoveToOrigin` | `(ent: Entity, pflGoal: number[], dist: number, iMoveType: number) => void` |
| `engChangeYaw` | `(ent: Entity) => void` |
| `engChangePitch` | `(ent: Entity) => void` |
| `engFindEntityByString` | `(pEdictStartSearchAfter: Entity, pszField: string, pszValue: string) => void` |
| `engGetEntityIllum` | `(pEnt: Entity) => void` |
| `engFindEntityInSphere` | `(pEdictStartSearchAfter: Entity, org: number[], rad: number) => void` |
| `engFindClientInPVS` | `(pEdict: Entity) => void` |
| `engEntitiesInPVS` | `(pplayer: Entity) => void` |
| `engMakeVectors` | `(rgflVector: number[]) => void` |
| `engAngleVectors` | `(rgflVector: number[], forward: number[], right: number[], up: number[]) => void` |
| `engCreateEntity` | `() => void` |
| `engRemoveEntity` | `(e: Entity) => void` |
| `engCreateNamedEntity` | `(className: number) => void` |
| `engMakeStatic` | `(ent: Entity) => void` |
| `engEntIsOnFloor` | `(e: Entity) => void` |
| `engDropToFloor` | `(e: Entity) => void` |
| `engWalkMove` | `(ent: Entity, yaw: number, dist: number, iMode: number) => void` |
| `engSetOrigin` | `(e: Entity, rgflOrigin: number[]) => void` |
| `engEmitSound` | `(entity: Entity, channel: number, sample: string, volume: number, attenuation: number, fFlags: number, pitch: number) => void` |
| `engEmitAmbientSound` | `(entity: Entity, pos: number[], samp: string, vol: number, attenuation: number, fFlags: number, pitch: number) => void` |
| `engTraceLine` | `(start: number[], end: number[], flags: number, skipEntity: Entity | null) => void` |
| `engTraceToss` | `(pent: Entity, pentToIgnore: Entity) => void` |
| `engTraceMonsterHull` | `(pEdict: Entity, v1: number[], v2: number[], fNoMonsters: number, pentToSkip: Entity) => void` |
| `engTraceHull` | `(v1: number[], v2: number[], fNoMonsters: number, hullNumber: number, pentToSkip: Entity) => void` |
| `engTraceModel` | `(v1: number[], v2: number[], hullNumber: number, pent: Entity) => void` |
| `engTraceTexture` | `(pTextureEntity: Entity, v1: number[], v2: number[]) => void` |
| `engTraceSphere` | `(v1: number[], v2: number[], fNoMonsters: number, radius: number, pentToSkip: Entity) => void` |
| `engGetAimVector` | `(ent: Entity, speed: number, rgflReturn: number[]) => void` |
| `engServerCommand` | `(str: string) => void` |
| `engServerExecute` | `() => void` |
| `engClientCommand` | `(entity: Entity, commandArgs: string) => void` |
| `engParticleEffect` | `(org: number[], dir: number[], color: number, count: number) => void` |
| `engLightStyle` | `(style: number, val: string) => void` |
| `engDecalIndex` | `(name: string) => void` |
| `engPointContents` | `(rgflVector: number[]) => void` |
| `engMessageBegin` | `(msg_dest: number, msg_type: number, pOrigin: number[], ed: Entity | null) => void` |
| `engMessageEnd` | `() => void` |
| `engWriteByte` | `(iValue: number) => void` |
| `engWriteChar` | `(iValue: number) => void` |
| `engWriteShort` | `(iValue: number) => void` |
| `engWriteLong` | `(iValue: number) => void` |
| `engWriteAngle` | `(flValue: number) => void` |
| `engWriteCoord` | `(flValue: number) => void` |
| `engWriteString` | `(sz: string) => void` |
| `engWriteEntity` | `(iValue: number) => void` |
| `engCVarRegister` | `(cvar: Cvar) => void` |
| `engCVarGetFloat` | `(szVarName: string) => void` |
| `engCVarGetString` | `(szVarName: string) => void` |
| `engCVarSetFloat` | `(szVarName: string, flValue: number) => void` |
| `engCVarSetString` | `(szVarName: string, szValue: string) => void` |
| `engAlertMessage` | `(atype: number, szFmt: string, ...args: any[]) => void` |
| `engEngineFprintf` | `(pfile: FileHandle, szFmt: string, ...args: any[]) => void` |
| `engPvAllocEntPrivateData` | `(pEdict: Entity, cb: number) => void` |
| `engPvEntPrivateData` | `(pEdict: Entity) => void` |
| `engFreeEntPrivateData` | `(pEdict: Entity) => void` |
| `engSzFromIndex` | `(iString: number) => void` |
| `engAllocString` | `(szValue: string) => void` |
| `engGetVarsOfEnt` | `(pEdict: Entity) => void` |
| `engPEntityOfEntOffset` | `(iEntOffset: number) => void` |
| `engEntOffsetOfPEntity` | `(pEdict: Entity) => void` |
| `engIndexOfEdict` | `(pEdict: Entity) => void` |
| `engPEntityOfEntIndex` | `(iEntIndex: number) => void` |
| `engFindEntityByVars` | `(pvars: Entvars) => void` |
| `engGetModelPtr` | `(pEdict: Entity) => void` |
| `engRegUserMsg` | `(pszName: string, iSize: number) => void` |
| `engAnimationAutomove` | `(pEdict: Entity, flTime: number) => void` |
| `engGetBonePosition` | `(pEdict: Entity, iBone: number, rgflOrigin: number[], rgflAngles: number[]) => void` |
| `engFunctionFromName` | `(pName: string) => void` |
| `engNameForFunction` | `(callback: ArrayBuffer | Uint8Array | null) => void` |
| `engClientPrintf` | `(pEdict: Entity, ptype: number, szMsg: string) => void` |
| `engServerPrint` | `(szMsg: string) => void` |
| `engCmdArgs` | `() => void` |
| `engCmdArgv` | `(argc: number) => void` |
| `engCmdArgc` | `() => void` |
| `engGetAttachment` | `(pEdict: Entity, iAttachment: number, rgflOrigin: number[], rgflAngles: number[]) => void` |
| `engRandomLong` | `(lLow: number, lHigh: number) => void` |
| `engRandomFloat` | `(flLow: number, flHigh: number) => void` |
| `engSetView` | `(pClient: Entity, pViewent: Entity) => void` |
| `engTime` | `() => void` |
| `engCrosshairAngle` | `(pClient: Entity, pitch: number, yaw: number) => void` |
| `engLoadFileForMe` | `(filename: string) => void` |
| `engFreeFile` | `(buffer: ArrayBuffer | Uint8Array | null) => void` |
| `engEndSection` | `(pszSectionName: string) => void` |
| `engCompareFileTime` | `(filename1: string, filename2: string, iCompare: number[]) => void` |
| `engGetGameDir` | `(szGetGameDir: string) => void` |
| `engCvarRegisterVariable` | `(variable: Cvar) => void` |
| `engFadeClientVolume` | `(pEdict: Entity, fadePercent: number, fadeOutSeconds: number, holdTime: number, fadeInSeconds: number) => void` |
| `engSetClientMaxspeed` | `(pEdict: Entity, fNewMaxspeed: number) => void` |
| `engCreateFakeClient` | `(netname: string) => void` |
| `engRunPlayerMove` | `(fakeclient: Entity, viewangles: number[], forwardmove: number, sidemove: number, upmove: number, buttons: number, impulse: number, msec: number) => void` |
| `engNumberOfEntities` | `() => void` |
| `engGetInfoKeyBuffer` | `(e: Entity) => void` |
| `engInfoKeyValue` | `(infobuffer: string, key: string) => void` |
| `engSetKeyValue` | `(infobuffer: string, key: string, value: string) => void` |
| `engSetClientKeyValue` | `(clientIndex: number, entity: Entity, key: string, value: string) => void` |
| `engIsMapValid` | `(filename: string) => void` |
| `engStaticDecal` | `(origin: number[], decalIndex: number, entityIndex: number, modelIndex: number) => void` |
| `engPrecacheGeneric` | `(s: string) => void` |
| `engGetPlayerUserId` | `(e: Entity) => void` |
| `engBuildSoundMsg` | `(entity: Entity, channel: number, sample: string, volume: number, attenuation: number, fFlags: number, pitch: number, msg_dest: number, msg_type: number, pOrigin: number[], ed: Entity) => void` |
| `engIsDedicatedServer` | `() => void` |
| `engCVarGetPointer` | `(szVarName: string) => void` |
| `engGetPlayerWONId` | `(e: Entity) => void` |
| `engInfoRemoveKey` | `(s: string, key: string) => void` |
| `engGetPhysicsKeyValue` | `(pClient: Entity, key: string) => void` |
| `engSetPhysicsKeyValue` | `(pClient: Entity, key: string, value: string) => void` |
| `engGetPhysicsInfoString` | `(pClient: Entity) => void` |
| `engPrecacheEvent` | `(type: number, psz: string) => void` |
| `engPlaybackEvent` | `(flags: number, pInvoker: Entity, eventindex: number, delay: number, origin: number[], angles: number[], fparam1: number, fparam2: number, iparam1: number, iparam2: number, bparam1: number, bparam2: number) => void` |
| `engSetFatPVS` | `(org: number[]) => void` |
| `engSetFatPAS` | `(org: number[]) => void` |
| `engCheckVisibility` | `(entity: Entity, pset: number[]) => void` |
| `engDeltaSetField` | `(pFields: Delta, fieldname: string) => void` |
| `engDeltaUnsetField` | `(pFields: Delta, fieldname: string) => void` |
| `engDeltaAddEncoder` | `(encoderName: string, callback: (pFields: any, from: ArrayBuffer | Uint8Array | null, to: ArrayBuffer | Uint8Array | null) => void) => void` |
| `engGetCurrentPlayer` | `() => void` |
| `engCanSkipPlayer` | `(player: Entity) => void` |
| `engDeltaFindField` | `(pFields: Delta, fieldname: string) => void` |
| `engDeltaSetFieldByIndex` | `(pFields: Delta, fieldNumber: number) => void` |
| `engDeltaUnsetFieldByIndex` | `(pFields: Delta, fieldNumber: number) => void` |
| `engSetGroupMask` | `(mask: number, op: number) => void` |
| `engCreateInstancedBaseline` | `(classname: number, baseline: EntityState) => void` |
| `engCvarDirectSet` | `(variable: Cvar, value: string) => void` |
| `engForceUnmodified` | `(type: number, mins: number[], maxs: number[], filename: string) => void` |
| `engGetPlayerStats` | `(pClient: Entity, ping: number[], packet_loss: number[]) => void` |
| `engAddServerCommand` | `(commandName: string, callback: () => void) => void` |
| `engVoiceGetClientListening` | `(iReceiver: number, iSender: number) => void` |
| `engVoiceSetClientListening` | `(iReceiver: number, iSender: number, bListen: boolean) => void` |
| `engGetPlayerAuthId` | `(e: Entity) => void` |
| `engSequenceGet` | `(fileName: string, entryName: string) => void` |
| `engSequencePickSentence` | `(groupName: string, pickMethod: number, picked: number[]) => void` |
| `engGetFileSize` | `(filename: string) => void` |
| `engGetApproxWavePlayLen` | `(filepath: string) => void` |
| `engIsCareerMatch` | `() => void` |
| `engGetLocalizedStringLength` | `(label: string) => void` |
| `engRegisterTutorMessageShown` | `(mid: number) => void` |
| `engGetTimesTutorMessageShown` | `(mid: number) => void` |
| `engProcessTutorMessageDecayBuffer` | `(buffer: number[]) => void` |
| `engConstructTutorMessageDecayBuffer` | `(buffer: number[]) => void` |
| `engResetTutorMessageDecayData` | `() => void` |
| `engQueryClientCvarValue` | `(player: Entity, cvarName: string) => void` |
| `engQueryClientCvarValue2` | `(player: Entity, cvarName: string, requestID: number) => void` |
| `engCheckParm` | `(parm: string, ppnext: string[]) => void` |
| `engPEntityOfEntIndexAllEntities` | `(iEntIndex: number) => void` |

---

## Post-Engine Hooks

Post-hooks fire after engine functions execute.

| Hook | Signature |
|------|-----------|
| `postEngPrecacheModel` | `(s: string) => void` |
| `postEngPrecacheSound` | `(s: string) => void` |
| `postEngSetModel` | `(e: Entity, m: string) => void` |
| `postEngModelIndex` | `(m: string) => void` |
| `postEngModelFrames` | `(modelIndex: number) => void` |
| `postEngSetSize` | `(e: Entity, rgflMin: number[], rgflMax: number[]) => void` |
| `postEngChangeLevel` | `(s1: string, s2: string) => void` |
| `postEngGetSpawnParms` | `(ent: Entity) => void` |
| `postEngSaveSpawnParms` | `(ent: Entity) => void` |
| `postEngVecToYaw` | `(rgflVector: number[]) => void` |
| `postEngVecToAngles` | `(rgflVectorIn: number[], rgflVectorOut: number[]) => void` |
| `postEngMoveToOrigin` | `(ent: Entity, pflGoal: number[], dist: number, iMoveType: number) => void` |
| `postEngChangeYaw` | `(ent: Entity) => void` |
| `postEngChangePitch` | `(ent: Entity) => void` |
| `postEngFindEntityByString` | `(pEdictStartSearchAfter: Entity, pszField: string, pszValue: string) => void` |
| `postEngGetEntityIllum` | `(pEnt: Entity) => void` |
| `postEngFindEntityInSphere` | `(pEdictStartSearchAfter: Entity, org: number[], rad: number) => void` |
| `postEngFindClientInPVS` | `(pEdict: Entity) => void` |
| `postEngEntitiesInPVS` | `(pplayer: Entity) => void` |
| `postEngMakeVectors` | `(rgflVector: number[]) => void` |
| `postEngAngleVectors` | `(rgflVector: number[], forward: number[], right: number[], up: number[]) => void` |
| `postEngCreateEntity` | `() => void` |
| `postEngRemoveEntity` | `(e: Entity) => void` |
| `postEngCreateNamedEntity` | `(className: number) => void` |
| `postEngMakeStatic` | `(ent: Entity) => void` |
| `postEngEntIsOnFloor` | `(e: Entity) => void` |
| `postEngDropToFloor` | `(e: Entity) => void` |
| `postEngWalkMove` | `(ent: Entity, yaw: number, dist: number, iMode: number) => void` |
| `postEngSetOrigin` | `(e: Entity, rgflOrigin: number[]) => void` |
| `postEngEmitSound` | `(entity: Entity, channel: number, sample: string, volume: number, attenuation: number, fFlags: number, pitch: number) => void` |
| `postEngEmitAmbientSound` | `(entity: Entity, pos: number[], samp: string, vol: number, attenuation: number, fFlags: number, pitch: number) => void` |
| `postEngTraceLine` | `(start: number[], end: number[], flags: number, skipEntity: Entity | null) => void` |
| `postEngTraceToss` | `(pent: Entity, pentToIgnore: Entity) => void` |
| `postEngTraceMonsterHull` | `(pEdict: Entity, v1: number[], v2: number[], fNoMonsters: number, pentToSkip: Entity) => void` |
| `postEngTraceHull` | `(v1: number[], v2: number[], fNoMonsters: number, hullNumber: number, pentToSkip: Entity) => void` |
| `postEngTraceModel` | `(v1: number[], v2: number[], hullNumber: number, pent: Entity) => void` |
| `postEngTraceTexture` | `(pTextureEntity: Entity, v1: number[], v2: number[]) => void` |
| `postEngTraceSphere` | `(v1: number[], v2: number[], fNoMonsters: number, radius: number, pentToSkip: Entity) => void` |
| `postEngGetAimVector` | `(ent: Entity, speed: number, rgflReturn: number[]) => void` |
| `postEngServerCommand` | `(str: string) => void` |
| `postEngServerExecute` | `() => void` |
| `postEngClientCommand` | `(entity: Entity, commandArgs: string) => void` |
| `postEngParticleEffect` | `(org: number[], dir: number[], color: number, count: number) => void` |
| `postEngLightStyle` | `(style: number, val: string) => void` |
| `postEngDecalIndex` | `(name: string) => void` |
| `postEngPointContents` | `(rgflVector: number[]) => void` |
| `postEngMessageBegin` | `(msg_dest: number, msg_type: number, pOrigin: number[], ed: Entity | null) => void` |
| `postEngMessageEnd` | `() => void` |
| `postEngWriteByte` | `(iValue: number) => void` |
| `postEngWriteChar` | `(iValue: number) => void` |
| `postEngWriteShort` | `(iValue: number) => void` |
| `postEngWriteLong` | `(iValue: number) => void` |
| `postEngWriteAngle` | `(flValue: number) => void` |
| `postEngWriteCoord` | `(flValue: number) => void` |
| `postEngWriteString` | `(sz: string) => void` |
| `postEngWriteEntity` | `(iValue: number) => void` |
| `postEngCVarRegister` | `(cvar: Cvar) => void` |
| `postEngCVarGetFloat` | `(szVarName: string) => void` |
| `postEngCVarGetString` | `(szVarName: string) => void` |
| `postEngCVarSetFloat` | `(szVarName: string, flValue: number) => void` |
| `postEngCVarSetString` | `(szVarName: string, szValue: string) => void` |
| `postEngAlertMessage` | `(atype: number, szFmt: string, ...args: any[]) => void` |
| `postEngEngineFprintf` | `(pfile: FileHandle, szFmt: string, ...args: any[]) => void` |
| `postEngPvAllocEntPrivateData` | `(pEdict: Entity, cb: number) => void` |
| `postEngPvEntPrivateData` | `(pEdict: Entity) => void` |
| `postEngFreeEntPrivateData` | `(pEdict: Entity) => void` |
| `postEngSzFromIndex` | `(iString: number) => void` |
| `postEngAllocString` | `(szValue: string) => void` |
| `postEngGetVarsOfEnt` | `(pEdict: Entity) => void` |
| `postEngPEntityOfEntOffset` | `(iEntOffset: number) => void` |
| `postEngEntOffsetOfPEntity` | `(pEdict: Entity) => void` |
| `postEngIndexOfEdict` | `(pEdict: Entity) => void` |
| `postEngPEntityOfEntIndex` | `(iEntIndex: number) => void` |
| `postEngFindEntityByVars` | `(pvars: Entvars) => void` |
| `postEngGetModelPtr` | `(pEdict: Entity) => void` |
| `postEngRegUserMsg` | `(pszName: string, iSize: number) => void` |
| `postEngAnimationAutomove` | `(pEdict: Entity, flTime: number) => void` |
| `postEngGetBonePosition` | `(pEdict: Entity, iBone: number, rgflOrigin: number[], rgflAngles: number[]) => void` |
| `postEngFunctionFromName` | `(pName: string) => void` |
| `postEngNameForFunction` | `(callback: ArrayBuffer | Uint8Array | null) => void` |
| `postEngClientPrintf` | `(pEdict: Entity, ptype: number, szMsg: string) => void` |
| `postEngServerPrint` | `(szMsg: string) => void` |
| `postEngCmdArgs` | `() => void` |
| `postEngCmdArgv` | `(argc: number) => void` |
| `postEngCmdArgc` | `() => void` |
| `postEngGetAttachment` | `(pEdict: Entity, iAttachment: number, rgflOrigin: number[], rgflAngles: number[]) => void` |
| `postEngRandomLong` | `(lLow: number, lHigh: number) => void` |
| `postEngRandomFloat` | `(flLow: number, flHigh: number) => void` |
| `postEngSetView` | `(pClient: Entity, pViewent: Entity) => void` |
| `postEngTime` | `() => void` |
| `postEngCrosshairAngle` | `(pClient: Entity, pitch: number, yaw: number) => void` |
| `postEngLoadFileForMe` | `(filename: string) => void` |
| `postEngFreeFile` | `(buffer: ArrayBuffer | Uint8Array | null) => void` |
| `postEngEndSection` | `(pszSectionName: string) => void` |
| `postEngCompareFileTime` | `(filename1: string, filename2: string, iCompare: number[]) => void` |
| `postEngGetGameDir` | `(szGetGameDir: string) => void` |
| `postEngCvarRegisterVariable` | `(variable: Cvar) => void` |
| `postEngFadeClientVolume` | `(pEdict: Entity, fadePercent: number, fadeOutSeconds: number, holdTime: number, fadeInSeconds: number) => void` |
| `postEngSetClientMaxspeed` | `(pEdict: Entity, fNewMaxspeed: number) => void` |
| `postEngCreateFakeClient` | `(netname: string) => void` |
| `postEngRunPlayerMove` | `(fakeclient: Entity, viewangles: number[], forwardmove: number, sidemove: number, upmove: number, buttons: number, impulse: number, msec: number) => void` |
| `postEngNumberOfEntities` | `() => void` |
| `postEngGetInfoKeyBuffer` | `(e: Entity) => void` |
| `postEngInfoKeyValue` | `(infobuffer: string, key: string) => void` |
| `postEngSetKeyValue` | `(infobuffer: string, key: string, value: string) => void` |
| `postEngSetClientKeyValue` | `(clientIndex: number, entity: Entity, key: string, value: string) => void` |
| `postEngIsMapValid` | `(filename: string) => void` |
| `postEngStaticDecal` | `(origin: number[], decalIndex: number, entityIndex: number, modelIndex: number) => void` |
| `postEngPrecacheGeneric` | `(s: string) => void` |
| `postEngGetPlayerUserId` | `(e: Entity) => void` |
| `postEngBuildSoundMsg` | `(entity: Entity, channel: number, sample: string, volume: number, attenuation: number, fFlags: number, pitch: number, msg_dest: number, msg_type: number, pOrigin: number[], ed: Entity) => void` |
| `postEngIsDedicatedServer` | `() => void` |
| `postEngCVarGetPointer` | `(szVarName: string) => void` |
| `postEngGetPlayerWONId` | `(e: Entity) => void` |
| `postEngInfoRemoveKey` | `(s: string, key: string) => void` |
| `postEngGetPhysicsKeyValue` | `(pClient: Entity, key: string) => void` |
| `postEngSetPhysicsKeyValue` | `(pClient: Entity, key: string, value: string) => void` |
| `postEngGetPhysicsInfoString` | `(pClient: Entity) => void` |
| `postEngPrecacheEvent` | `(type: number, psz: string) => void` |
| `postEngPlaybackEvent` | `(flags: number, pInvoker: Entity, eventindex: number, delay: number, origin: number[], angles: number[], fparam1: number, fparam2: number, iparam1: number, iparam2: number, bparam1: number, bparam2: number) => void` |
| `postEngSetFatPVS` | `(org: number[]) => void` |
| `postEngSetFatPAS` | `(org: number[]) => void` |
| `postEngCheckVisibility` | `(entity: Entity, pset: number[]) => void` |
| `postEngDeltaSetField` | `(pFields: Delta, fieldname: string) => void` |
| `postEngDeltaUnsetField` | `(pFields: Delta, fieldname: string) => void` |
| `postEngDeltaAddEncoder` | `(encoderName: string, callback: (pFields: any, from: ArrayBuffer | Uint8Array | null, to: ArrayBuffer | Uint8Array | null) => void) => void` |
| `postEngGetCurrentPlayer` | `() => void` |
| `postEngCanSkipPlayer` | `(player: Entity) => void` |
| `postEngDeltaFindField` | `(pFields: Delta, fieldname: string) => void` |
| `postEngDeltaSetFieldByIndex` | `(pFields: Delta, fieldNumber: number) => void` |
| `postEngDeltaUnsetFieldByIndex` | `(pFields: Delta, fieldNumber: number) => void` |
| `postEngSetGroupMask` | `(mask: number, op: number) => void` |
| `postEngCreateInstancedBaseline` | `(classname: number, baseline: EntityState) => void` |
| `postEngCvarDirectSet` | `(variable: Cvar, value: string) => void` |
| `postEngForceUnmodified` | `(type: number, mins: number[], maxs: number[], filename: string) => void` |
| `postEngGetPlayerStats` | `(pClient: Entity, ping: number[], packet_loss: number[]) => void` |
| `postEngAddServerCommand` | `(commandName: string, callback: () => void) => void` |
| `postEngVoiceGetClientListening` | `(iReceiver: number, iSender: number) => void` |
| `postEngVoiceSetClientListening` | `(iReceiver: number, iSender: number, bListen: boolean) => void` |
| `postEngGetPlayerAuthId` | `(e: Entity) => void` |
| `postEngSequenceGet` | `(fileName: string, entryName: string) => void` |
| `postEngSequencePickSentence` | `(groupName: string, pickMethod: number, picked: number[]) => void` |
| `postEngGetFileSize` | `(filename: string) => void` |
| `postEngGetApproxWavePlayLen` | `(filepath: string) => void` |
| `postEngIsCareerMatch` | `() => void` |
| `postEngGetLocalizedStringLength` | `(label: string) => void` |
| `postEngRegisterTutorMessageShown` | `(mid: number) => void` |
| `postEngGetTimesTutorMessageShown` | `(mid: number) => void` |
| `postEngProcessTutorMessageDecayBuffer` | `(buffer: number[]) => void` |
| `postEngConstructTutorMessageDecayBuffer` | `(buffer: number[]) => void` |
| `postEngResetTutorMessageDecayData` | `() => void` |
| `postEngQueryClientCvarValue` | `(player: Entity, cvarName: string) => void` |
| `postEngQueryClientCvarValue2` | `(player: Entity, cvarName: string, requestID: number) => void` |
| `postEngCheckParm` | `(parm: string, ppnext: string[]) => void` |
| `postEngPEntityOfEntIndexAllEntities` | `(iEntIndex: number) => void` |
