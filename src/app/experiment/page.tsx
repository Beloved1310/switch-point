import type { Metadata } from "next";
import { ExperimentFlow } from "@/components/ExperimentFlow";
import { EXPERIMENT } from "@/lib/experiment/config";

export const metadata: Metadata = { title: "Take part · SwitchPoint" };

export default function ExperimentPage() {
  return <ExperimentFlow fulfilmentEnabled={EXPERIMENT.fulfilment.enabled} />;
}
