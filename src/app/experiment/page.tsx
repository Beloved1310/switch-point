import type { Metadata } from "next";
import { ExperimentFlow } from "@/components/experiment/ExperimentFlow";
import { activeExperiment } from "@/config/experiments";

export const metadata: Metadata = { title: "Take part · SwitchPoint" };

export default function ExperimentPage() {
  const config = activeExperiment();
  return (
    <ExperimentFlow
      intro={{
        category: config.category,
        choiceCount: config.scenarios.length + 1,
        fulfilmentEnabled: config.fulfilment.enabled,
      }}
    />
  );
}
