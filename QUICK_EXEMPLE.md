# Quick Exemple

This page shows the smallest useful `build-unifier` setup.

Use this when you want one plugin to register its build fragments with `setBuildConfig(...)`, then retrieve the shared builder with `getBuilder(...)` and run the build.

## Minimal pattern

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

## How it works

1. `BuildUnifier({ plugins: [...] })` creates one isolated shared builder for that plugin group.
2. The plugin registers `buildConfig`, `beforeBuild`, or `afterBuild` by calling `setBuildConfig(pluginName, config)`.
3. Later, the same plugin can call `getBuilder(pluginName)` to get the shared builder instance.
4. Calling `builder.build()` runs the merged build configuration collected for that group.

## Important rules

- The plugin name passed to `setBuildConfig(...)` must exactly match the plugin name inside the `plugins` array.
- `getBuilder(...)` is async because the builder is created by `build-unifier` during `serverReady`.
- One `buildunifier(...)` call means one isolated builder.

