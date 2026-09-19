"use client";

import { DeploymentPreview } from "@/components/custom-launch/deployment-preview";
import { LaunchReview } from "@/components/custom-launch/launch-review";

export function ReviewStep() {
  return (
    <div className="space-y-4">
      <LaunchReview />
      <DeploymentPreview />
    </div>
  );
}
