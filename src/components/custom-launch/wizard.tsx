"use client";

import type { PrintableChain } from "@onceupon/config/solana";
import { CustomLaunchDraftProvider, useCustomLaunch } from "@/components/custom-launch/draft-provider";
import { CustomLaunchShell } from "@/components/custom-launch/shell";
import { StepFooter } from "@/components/custom-launch/step-footer";
import { StepRail } from "@/components/custom-launch/step-rail";
import { AutomationStep } from "@/components/custom-launch/steps/automation";
import { DeployStep } from "@/components/custom-launch/steps/deploy";
import { LaunchModeStep } from "@/components/custom-launch/steps/launch-mode";
import { PrimaryMarketStep } from "@/components/custom-launch/steps/primary-market";
import { ReviewStep } from "@/components/custom-launch/steps/review";
import { SecondaryMarketsStep } from "@/components/custom-launch/steps/secondary-markets";
import { TokenStep } from "@/components/custom-launch/steps/token";
import { TradingEconomicsStep } from "@/components/custom-launch/steps/trading-economics";
import { DeploymentConfirmation } from "@/components/custom-launch/deployment-confirmation";
import { LaunchSummary } from "@/components/custom-launch/launch-summary";
import type { CustomLaunchStepId } from "@/lib/custom-launch/schema";

export function CustomLaunchWizard({ chain }: { chain: PrintableChain }) {
  return (
    <CustomLaunchDraftProvider key={chain} chain={chain}>
      <CustomLaunchShell>
        <LaunchSummary variant="mobile" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <StepRail />
          <div className="min-w-0 flex-1 space-y-4">
            <StepStage />
            <StepFooter />
          </div>
          <LaunchSummary />
        </div>
        <DeploymentConfirmation />
      </CustomLaunchShell>
    </CustomLaunchDraftProvider>
  );
}

function StepStage() {
  const { step } = useCustomLaunch();
  return (
    <div key={step} className="pad-fade">
      <StepBody id={step} />
    </div>
  );
}

function StepBody({ id }: { id: CustomLaunchStepId }) {
  switch (id) {
    case "mode":
      return <LaunchModeStep />;
    case "token":
      return <TokenStep />;
    case "economics":
      return <TradingEconomicsStep />;
    case "primary":
      return <PrimaryMarketStep />;
    case "secondary":
      return <SecondaryMarketsStep />;
    case "automation":
      return <AutomationStep />;
    case "review":
      return <ReviewStep />;
    case "deploy":
      return <DeployStep />;
  }
}
