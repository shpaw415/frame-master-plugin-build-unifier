import type { FrameMasterConfig } from "frame-master/server/types";
import BuildUnifier from "./";
import { getGlobalPluginContext } from "frame-master/plugin";

declare module "frame-master/plugin/types" {
	interface GlobalPluginContextMap {
		test: {
			test: true;
		};
	}
}

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
							//await builder.build();
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
