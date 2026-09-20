"use client";

import { useEffect } from "react";
import { DeploymentPreview } from "@/components/custom-launch/deployment-preview";
import { LaunchReview } from "@/components/custom-launch/launch-review";
import { useCustomLaunch } from "@/components/custom-launch/draft-provider";

export function ReviewStep() {
  const { markReviewed } = useCustomLaunch();
  useEffect(() => {
    markReviewed();
  }, [markReviewed]);

  return (
    <div className="space-y-4">
      <LaunchReview />
      <DeploymentPreview />
    </div>
  );
}
