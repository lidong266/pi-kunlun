// ─── 微内核：Agent 核心循环 ───
export * from "./agent.js";
export * from "./agent-loop.js";
export * from "./types.js";

// ─── 微内核：Agent Harness (运行时框架) ───
export * from "./harness/types.js";
export * from "./harness/skills.js";

// ─── 微内核：LLM 代理 ───
export * from "./proxy.js";

// ─── 微内核：三元认知引擎桥接 ───
export {
	registerKunlunEngine,
	isKunlunEngineLoaded,
	runKunlunAnalysis,
	formatAnalysisForPrompt,
	decideToolCall,
	decideToolCallBatch,
	sortToolCallsByPriority,
	getLatestAnalysis,
} from "./kunlun-bridge.js";
export type {
	KunlunEngine,
	AnalysisContext,
	AnalysisResult,
	ToolDecisionContext,
	BatchToolDecisionContext,
	ToolDecision,
} from "./kunlun-bridge.js";
