# Config Exemple

This page shows a fuller configuration with multiple `buildunifier(...)` instances.

The important idea is:

- plugins inside the same `buildunifier(...)` call share one builder
- separate `buildunifier(...)` calls create separate builders

## Full example

```typescript
import type { FrameMasterConfig } from "frame-master/server/types";
import BuildUnifier from "./";
import { getGlobalPluginContext } from "frame-master/plugin";

export default {
	HTTPServer: {
		port: 3000,
	},
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
						const builder =
							await getGlobalPluginContext("build-unifier")?.getBuilder?.(
								"build-1-1",
							);

						if (builder && !builder.isBuilding()) {
							await builder.build();
						}
					},
				},
			],
		}),
		...BuildUnifier({
			plugins: [
				{
					name: "build-2-1",
					version: "0.1.0",
					async createContext() {
						const ctx = getGlobalPluginContext("build-unifier");
						ctx?.setBuildConfig?.("build-2-1", {
							beforeBuild() {
								console.log("build-2-1 beforeBuild");
							},
							buildConfig: {
								entrypoints: ["mock/index.ts"],
								outdir: "mock/dist/2",
							},
						});
					},
					async serverReady() {
						const builder =
							await getGlobalPluginContext("build-unifier")?.getBuilder?.(
								"build-2-1",
							);

						if (builder && !builder.isBuilding()) {
							await builder.build();
						}
					},
				},
				{
					name: "build-2-2",
					version: "0.1.0",
					async createContext() {
						const ctx = getGlobalPluginContext("build-unifier");
						ctx?.setBuildConfig?.("build-2-2", {
							beforeBuild() {
								console.log("build-2-2 beforeBuild");
							},
							buildConfig: {
								entrypoints: ["mock/index.ts"],
								outdir: "mock/dist/3",
							},
						});
					},
				},
			],
		}),
	],
} as FrameMasterConfig;
```

## What this configuration means

### First `buildunifier(...)` block

The first block contains only `build-1-1`.

- `build-1-1` gets its own isolated builder
- its build output goes to `mock/dist/1`
- its `serverReady()` calls `builder.build()` on that isolated builder

### Second `buildunifier(...)` block

The second block contains `build-2-1` and `build-2-2`.

- both plugins register build fragments into the same builder bucket
- `build-2-1` contributes one `buildConfig` and one `beforeBuild`
- `build-2-2` contributes another `buildConfig` and another `beforeBuild`
- calling `getBuilder("build-2-1")` or `getBuilder("build-2-2")` resolves the same shared builder instance

## Why use this structure

Use multiple `buildunifier(...)` calls when you want separate build pipelines in the same Frame-Master app.

Use multiple plugins inside one `buildunifier(...)` call when you want several plugins to contribute build fragments to one shared build.

## Practical pattern

A common pattern is:

1. one plugin adds the main `entrypoints` and `outdir`
2. another plugin adds extra `beforeBuild` or `afterBuild` hooks
3. one plugin in the group triggers `await builder.build()` in `serverReady()`

## Notes

- `setBuildConfig(...)` only registers fragments; it does not run the build by itself.
- `getBuilder(...)` is the point where a plugin retrieves the shared builder instance.
- If several plugins share one build, any one of them can trigger `builder.build()`, but usually one plugin should own that responsibility to avoid duplicate runs.
