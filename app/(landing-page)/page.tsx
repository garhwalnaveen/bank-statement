import { FeatureGrid } from "@/components/features";
import { Hero } from "@/components/hero";
import { PricingGrid } from "@/components/pricing";
import { stackServerApp } from "@/stack";
import { FileText, Shield, Users, Zap, Lock, BarChart3 } from "lucide-react";

export default async function IndexPage() {
  const project = await stackServerApp.getProject();
  if (!project.config.clientTeamCreationEnabled) {
    return (
      <div className="w-full min-h-96 flex items-center justify-center">
        <div className="max-w-xl gap-4">
          <p className="font-bold text-xl">Setup Required</p>
          <p className="">
            {
              "To start using this project, please enable client-side team creation in the Stack Auth dashboard (Project > Team Settings). This message will disappear once the feature is enabled."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Hero
        capsuleText="Accounting Automation Platform"
        capsuleLink="#features"
        title="Welcome to Number Works"
        subtitle="Automate your accounting workflow. Upload bank statements, extract transactions natively into Tally, and keep your ledgers synchronized effortlessly."
        primaryCtaText="Get Started Free"
        primaryCtaLink={stackServerApp.urls.signUp}
        secondaryCtaText="Learn More"
        secondaryCtaLink="#features"
        credits={
          <>
            Supports 20+ banks including HDFC, SBI, ICICI, Chase, Wells Fargo, Barclays & more
          </>
        }
      />

      <div id="features" />
      <FeatureGrid
        title="Features"
        subtitle="Everything you need to process bank statements at scale."
        items={[
          {
            icon: <FileText className="h-12 w-12" />,
            title: "Universal PDF Parser",
            description:
              "Handles bordered tables, borderless layouts, merged rows, and even OCR for scanned statements.",
          },
          {
            icon: <Zap className="h-12 w-12" />,
            title: "Smart Extraction",
            description:
              "4-strategy parsing engine: table extraction, column clustering, regex parsing, and AI fallback.",
          },
          {
            icon: <Shield className="h-12 w-12" />,
            title: "Balance Validation",
            description:
              "Automatic balance chain verification catches sign errors, magnitude errors, and rounding issues.",
          },
          {
            icon: <Users className="h-12 w-12" />,
            title: "Team Collaboration",
            description:
              "Create teams, invite members, and share parsed statements across your organization.",
          },
          {
            icon: <Lock className="h-12 w-12" />,
            title: "Secure & Private",
            description:
              "Your files are processed and never stored permanently. Team-level access controls built in.",
          },
          {
            icon: <BarChart3 className="h-12 w-12" />,
            title: "Clean CSV Output",
            description:
              "Standardized output with date, description, debit, credit, amount, balance, and reference columns.",
          },
        ]}
      />

      <div id="pricing" />
      <PricingGrid
        title="Pricing"
        subtitle="Start free, scale as needed."
        items={[
          {
            title: "Free",
            price: "Free",
            description: "For individuals getting started.",
            features: [
              "5 statements per month",
              "Team collaboration",
              "CSV download",
              "Balance validation",
              "Email support",
            ],
            buttonText: "Get Started",
            buttonHref: stackServerApp.urls.signUp,
          },
          {
            title: "Pro",
            price: "$19/mo",
            description: "For growing teams and businesses.",
            features: [
              "Unlimited statements",
              "Priority processing",
              "API access",
              "Advanced validation",
              "Priority support",
            ],
            buttonText: "Start Free Trial",
            isPopular: true,
            buttonHref: stackServerApp.urls.signUp,
          },
          {
            title: "Enterprise",
            price: "Custom",
            description: "For large organizations.",
            features: [
              "Everything in Pro",
              "Custom integrations",
              "SLA guarantee",
              "Dedicated support",
              "On-premise option",
            ],
            buttonText: "Contact Us",
            buttonHref: stackServerApp.urls.signUp,
          },
        ]}
      />
    </>
  );
}
