import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setMockConfig } from "frame-master/config";
import {
	getGlobalPluginContext,
	InitPluginLoader,
	PluginLoader,
} from "frame-master/plugin";
import type { FrameMasterConfig, FrameMasterPlugin } from "frame-master/plugin/types";
import BuildUnifier from "../index";

const outputDir = join(import.meta.dir, ".test-output");
const generatedEntry = join(import.meta.dir, ".test-source", "generated-entry.ts");

afterEach(() => {
	rmSync(outputDir, { recursive: true, force: true });
	rmSync(join(import.meta.dir, ".test-source"), {
		recursive: true,
		force: true,
	});
});

describe("build-unifier", () => {
	test("resolves Frame-Master virtual modules from generated build files", async () => {
		const pluginName = `build-unifier-test-${Bun.randomUUIDv7()}`;
		const virtualModule = `@build-unifier/${Bun.randomUUIDv7()}`;
		mkdirSync(join(import.meta.dir, ".test-source"), { recursive: true });
		writeFileSync(
			generatedEntry,
			`import { message } from "${virtualModule}"; console.log(message);`,
		);
		const plugin: FrameMasterPlugin = {
			name: pluginName,
			version: "1.0.0",
			virtualModules: {
				[virtualModule]: {
					contents: "export const message = 'from a virtual module';",
					loader: "ts",
				},
			},
			createContext() {
				getGlobalPluginContext("build-unifier")?.setBuildConfig?.(
					pluginName,
					{
						buildConfig: {
							entrypoints: [generatedEntry],
							files: {
								[generatedEntry]: `import { message } from "${virtualModule}"; console.log(message);`,
							},
							outdir: outputDir,
						},
					},
				);
			},
		};
		const plugins = BuildUnifier({ plugins: [plugin] });
		const config = {
			HTTPServer: { port: 0 },
			plugins,
		} satisfies FrameMasterConfig;

		setMockConfig(config);
		InitPluginLoader(new PluginLoader(config));
		plugin.createContext?.();

		const internalPlugin = plugins.find((plugin) => plugin.serverStart?.main);
		await internalPlugin?.serverStart?.main?.();

		const builder = await getGlobalPluginContext("build-unifier")?.getBuilder?.(
			pluginName,
		);
		const result = await builder?.build();

		expect(result?.success).toBeTrue();
		expect(builder?.getConfig()?.files?.[generatedEntry]).toContain(
			virtualModule,
		);
		expect(result?.outputs.some((output) => output.kind === "entry-point")).toBe(
			true,
		);
	});
});
