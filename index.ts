import { Builder } from "frame-master/build";
import {
	getGlobalPluginContext,
	setGlobalPluginContext,
} from "frame-master/plugin";
import type {
	BuildOptionsPlugin,
	FrameMasterPlugin,
	GlobalPluginContextMap,
} from "frame-master/plugin/types";
import { isBuildMode } from "frame-master/utils";
import { name, peerDependencies, version } from "./package.json";

declare module "frame-master/plugin/types" {
	interface GlobalPluginContextMap {
		"build-unifier": Partial<{
			builders: Record<string, Promise<Builder>>;
			builderResolvers: Map<
				string,
				{
					resolve: (builder: Builder) => void;
					reject: (reason?: unknown) => void;
				}
			>;
			getBuilder: (pluginName: string) => Promise<Builder>;
			index: number;
			build_config: Record<string, Array<BuildOptionsPlugin>>;
			setBuildConfig: (pluginName: string, config: BuildOptionsPlugin) => void;
			/**
			 * key: pluginName, value: builder id
			 */
			_id_list: Map<string, string>;
		}>;
	}
}

type BuildUnifierContext = NonNullable<GlobalPluginContextMap["build-unifier"]>;

export type BuildUnifierPluginOptions = {
	plugins: FrameMasterPlugin[];
	logging?: boolean;
};

function setBuildConfig(pluginName: string, config: BuildOptionsPlugin): void {
	const ctx = ensureBuildUnifierContext();
	const builderId = ctx._id_list?.get(pluginName);

	if (!builderId) {
		throw new Error(`No builder found for plugin: ${pluginName}`);
	}

	ctx.build_config ??= {};
	ctx.build_config[builderId] = [
		...(ctx.build_config[builderId] || []),
		config,
	];
}

async function getBuilder(pluginName: string): Promise<Builder> {
	const ctx = ensureBuildUnifierContext();
	const builderId = ctx._id_list?.get(pluginName);

	if (!builderId) {
		throw new Error(`No builder found for plugin: ${pluginName}`);
	}

	const builder = ctx.builders?.[builderId];
	if (!builder) {
		throw new Error(`No builder found for plugin: ${pluginName}`);
	}

	return builder;
}

function createBuildUnifierContext(): BuildUnifierContext {
	return {
		builders: {},
		builderResolvers: new Map(),
		getBuilder,
		index: 0,
		build_config: {},
		setBuildConfig,
		_id_list: new Map<string, string>(),
	};
}

function ensureBuildUnifierContext(): BuildUnifierContext {
	const existing = getGlobalPluginContext("build-unifier") as
		| BuildUnifierContext
		| undefined;

	if (!existing) {
		return setGlobalPluginContext(
			"build-unifier",
			createBuildUnifierContext(),
		) as BuildUnifierContext;
	}

	existing.builders ??= {};
	existing.builderResolvers ??= new Map();
	existing.getBuilder ??= getBuilder;
	existing.index ??= 0;
	existing.build_config ??= {};
	existing.setBuildConfig ??= setBuildConfig;
	existing._id_list ??= new Map<string, string>();

	return existing;
}

function ensureBuilderPromise(
	builderId: string,
	ctx: BuildUnifierContext,
): void {
	ctx.builders ??= {};
	ctx.builderResolvers ??= new Map();

	if (ctx.builders[builderId]) {
		return;
	}

	let resolveBuilder: (builder: Builder) => void = () => {};
	let rejectBuilder: (reason?: unknown) => void = () => {};

	ctx.builders[builderId] = new Promise<Builder>((resolve, reject) => {
		resolveBuilder = resolve;
		rejectBuilder = reject;
	});

	ctx.builderResolvers.set(builderId, {
		resolve: resolveBuilder,
		reject: rejectBuilder,
	});
}

function registerPluginsForBuilder(
	builderId: string,
	pluginNames: string[],
	ctx: BuildUnifierContext,
): void {
	ctx.build_config ??= {};
	ctx._id_list ??= new Map<string, string>();
	ctx.build_config[builderId] ??= [];

	for (const pluginName of pluginNames) {
		ctx._id_list.set(pluginName, builderId);
	}

	ensureBuilderPromise(builderId, ctx);
}
/**
 * build-unifier - Frame-Master Plugin
 *
 * Description: Add your plugin description here
 */
export default function buildunifier(
	props: BuildUnifierPluginOptions,
): Array<FrameMasterPlugin> {
	const ctx = ensureBuildUnifierContext();
	const index = ctx.index || 0;
	const id = Bun.randomUUIDv7();
	const pluginNames = props.plugins.map((p) => p.name);
	const highestPriority = Math.max(
		...props.plugins.map((p) => p.priority ?? 0),
	);
	ctx.index = index + 1;
	registerPluginsForBuilder(id, pluginNames, ctx);

	const current_name = index ? `${name}_${index}` : name;

	let current_builder: Builder | null = null;

	const initSharedContext = () => {
		const sharedContext = ensureBuildUnifierContext();
		const configs = sharedContext.build_config?.[id] || [];
		const resolver = sharedContext.builderResolvers?.get(id);

		try {
			const builder = new Builder({
				afterBuilds: configs
					.flatMap((config) => config.afterBuild)
					.filter((config) => typeof config !== "undefined"),
				beforeBuilds: configs
					.flatMap((config) => config.beforeBuild)
					.filter((config) => typeof config !== "undefined"),
				pluginBuildConfig: configs
					.flatMap((config) => config.buildConfig)
					.filter((config) => typeof config !== "undefined"),
				enableLogging: props.logging ?? false,
				disableOnLoadChaining: false,
			});

			sharedContext.builders ??= {};
			sharedContext.builders[id] = Promise.resolve(builder);
			current_builder = builder;
			resolver?.resolve(builder);
		} catch (error) {
			resolver?.reject(error);
			throw error;
		} finally {
			sharedContext.builderResolvers?.delete(id);
		}
	};

	return [
		...props.plugins,
		{
			name: current_name,
			priority: highestPriority + 1, // Ensure this plugin runs after all registered plugins,
			version,
			requirement: {
				frameMasterVersion: peerDependencies["frame-master"],
				bunVersion: ">=1.3.10",
			},
			serverStart: {
				async main() {
					initSharedContext();
				},
			},
			build: {
				async beforeBuild() {
					if (!isBuildMode()) return;
					initSharedContext();
					await current_builder?.build();
				},
			},
		},
	];
}
