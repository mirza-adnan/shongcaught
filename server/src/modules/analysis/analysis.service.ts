import { analyzeLiquidity } from "./liquidity.service.js";
import { analyzeAnomaly } from "./anomaly.service.js";

export async function analyzeAgent(agentId: string) {
  const [liquidityResult, anomalyResult] = await Promise.allSettled([
    analyzeLiquidity(agentId),
    analyzeAnomaly(agentId),
  ]);

  if (liquidityResult.status === "rejected") {
    console.error(`Liquidity analysis failed for agent ${agentId}:`, liquidityResult.reason);
  }
  if (anomalyResult.status === "rejected") {
    console.error(`Anomaly analysis failed for agent ${agentId}:`, anomalyResult.reason);
  }
}
