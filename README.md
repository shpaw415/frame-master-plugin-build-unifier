# build-unifier

`build-unifier` is a Frame-Master plugin helper that lets a group of plugins share one isolated `Builder` instance.

Each `buildunifier(...)` call creates its own builder bucket. Plugins passed in the same call can register `build.buildConfig`, `beforeBuild`, and `afterBuild` fragments through the global plugin context, then later retrieve the shared builder and trigger a build.

## Installation

```bash
bun add frame-master-plugin-build-unifier
```

## What it does

- Creates one isolated `Builder` per `buildunifier(...)` call.
- Lets the provided plugins register build fragments with `getGlobalPluginContext("build-unifier")?.setBuildConfig(...)`.
- Exposes that shared builder with `getGlobalPluginContext("build-unifier")?.getBuilder(...)`.
- Keeps separate `buildunifier(...)` calls isolated from each other.
- Triggers the shared builder when `frame-master build` is executed.

## Flow

```mermaid
flowchart TD
  A[Frame-Master config] --> B[buildunifier(...)]
  B --> C[Plugin group A]
  B --> D[Internal build-unifier plugin]

  subgraph Bucket[One isolated builder bucket per buildunifier call]
    C --> E[createContext on each wrapped plugin]
    E --> F[setBuildConfig(pluginName, fragment)]
    F --> G[Shared global context<br/>plugin name -> builder id<br/>builder id -> build fragments]
    D --> H[serverReady or build.beforeBuild]
    H --> I[Builder.createBuilder(merged fragments)]
    I --> J[getBuilder(pluginName) resolves to shared Builder]
    J --> K[builder.build()]
  end

  L[frame-master build] --> D
  D --> M[build.afterBuild]
  M --> K

  N[Another buildunifier(...)] --> O[Separate builder bucket]
```

The wrapped plugins contribute config fragments first. The internal plugin then creates one merged `Builder` for that specific `buildunifier(...)` call, and either plugin code or the `frame-master build` lifecycle can trigger the resulting shared build.

## API

```typescript
type BuildUnifierPluginOptions = {
  plugins: FrameMasterPlugin[];
  logging?: boolean;
};

declare module "frame-master/plugin/types" {
  interface GlobalPluginContextMap {
    "build-unifier": {
      setBuildConfig: (pluginName: string, config: BuildOptionsPlugin) => void;
      getBuilder: (pluginName: string) => Promise<Builder>;
    };
  }
}
```

`buildunifier(...)` returns an array of plugins, so it must be spread into the Frame-Master `plugins` list.

## Usage

```typescript
import type { FrameMasterConfig } from "frame-master/server/types";
import { getGlobalPluginContext } from "frame-master/plugin";
import BuildUnifier from "frame-master-plugin-build-unifier";

const config: FrameMasterConfig = {
  HTTPServer: { port: 3000 },
  plugins: [
    ...BuildUnifier({
      plugins: [
        {
          name: "build-1-1",
          version: "0.1.0",
          createContext() {
            const ctx = getGlobalPluginContext("build-unifier");
            ctx?.setBuildConfig?.("build-1-1", {
              beforeBuild() {
                console.log("build-1-1 beforeBuild");
              },
              buildConfig: {
                entrypoints: ["mock/index.ts"],
                outdir: "mock/dist/1",
              },
            });
          },
          async serverReady() {
            const builder = await getGlobalPluginContext(
              "build-unifier",
            )?.getBuilder?.("build-1-1");

            if (builder && !builder.isBuilding()) {
              await builder.build();
            }
          },
        },
      ],
    }),
  ],
};

export default config;
```

## Multiple plugins sharing one builder

If you pass multiple plugins in the same `buildunifier(...)` call, all `setBuildConfig(...)` calls from those plugins are merged into the same isolated builder.

```typescript
...BuildUnifier({
  plugins: [
    {
      name: "build-2-1",
      version: "0.1.0",
      createContext() {
        getGlobalPluginContext("build-unifier")?.setBuildConfig?.("build-2-1", {
          buildConfig: {
            entrypoints: ["mock/index.ts"],
            outdir: "mock/dist/2",
          },
        });
      },
    },
    {
      name: "build-2-2",
      version: "0.1.0",
      createContext() {
        getGlobalPluginContext("build-unifier")?.setBuildConfig?.("build-2-2", {
          beforeBuild() {
            console.log("build-2-2 beforeBuild");
          },
        });
      },
      async serverReady() {
        const builder = await getGlobalPluginContext(
          "build-unifier",
        )?.getBuilder?.("build-2-2");

        if (builder && !builder.isBuilding()) {
          await builder.build();
        }
      },
    },
  ],
})
```

In that example, `build-2-1` and `build-2-2` contribute to the same builder instance.

## Multiple `buildunifier(...)` instances

Separate `buildunifier(...)` calls create separate builders.

This means you can isolate unrelated build pipelines in the same Frame-Master config.

## Notes

- Call `setBuildConfig(pluginName, config)` using the exact plugin name registered in the `plugins` array passed to `buildunifier(...)`.
- `getBuilder(pluginName)` resolves only after the build-unifier plugin has created the shared builder in `serverReady`.
- The generated internal plugin creates the shared builder after wrapped plugins have had a chance to register their fragments.
- Plugin names should stay unique across build-unifier usage, because builder lookup is keyed by plugin name in the global context.

## License

MIT
