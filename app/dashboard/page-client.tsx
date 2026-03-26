"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { useUser } from "@stackframe/stack";
import { useRouter } from "next/navigation";

export function PageClient() {
  const router = useRouter();
  const user = useUser({ or: "redirect" });
  const teams = user.useTeams();

  const [teamDisplayName, setTeamDisplayName] = React.useState("");
  const [userName, setUserName] = React.useState(user.displayName || "");
  const [orgSize, setOrgSize] = React.useState("");
  const [firmType, setFirmType] = React.useState("CA Firm");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (teams.length > 0 && !user.selectedTeam) {
      user.setSelectedTeam(teams[0]).then(() => {
        router.push(`/dashboard/${teams[0].id}`);
      });
    } else if (user.selectedTeam) {
      router.push(`/dashboard/${user.selectedTeam.id}`);
    }
  }, [teams, user, router]);

  if (teams.length === 0) {
    return (
      <div className="flex min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden">
        {/* Abstract background graphics */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[20%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
        </div>

        <div className="absolute top-6 left-6 z-10">
          <div className="font-bold text-xl tracking-tight">Number Works</div>
        </div>

        <div className="flex-1 flex items-center justify-center relative z-10 p-6">
          <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-xl shadow-2xl">
            <h1 className="text-center text-3xl font-bold mb-2 tracking-tight bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">Complete Profile</h1>
            <p className="text-center text-zinc-400 mb-8 font-medium">
              Let&apos;s set up your first firm workspace
            </p>
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (isSubmitting) return;
                setIsSubmitting(true);
                try {
                  await user.update({
                    displayName: userName,
                    clientMetadata: {
                      ...(user.clientMetadata || {}),
                      orgSize,
                      firmType,
                    }
                  });
                  const newTeam = await user.createTeam({ displayName: teamDisplayName });
                  await user.setSelectedTeam(newTeam);
                  router.push(`/dashboard/${newTeam.id}`);
                } catch (err) {
                  console.error("Failed to complete onboarding", err);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-300">Business Name (Team Name)</Label>
                <Input
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-emerald-500/50"
                  placeholder="E.g. Acme Corp"
                  value={teamDisplayName}
                  onChange={(e) => setTeamDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-300">Your Name</Label>
                <Input
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-emerald-500/50"
                  placeholder="John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-300">Organisation Size</Label>
                <select
                  className="flex h-10 w-full rounded-md border text-zinc-50 border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-zinc-900"
                  value={orgSize}
                  onChange={(e) => setOrgSize(e.target.value)}
                  required
                >
                  <option value="" disabled>Select size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-zinc-300">Type of Firm</Label>
                <select
                  className="flex h-10 w-full rounded-md border text-zinc-50 border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-zinc-900"
                  value={firmType}
                  onChange={(e) => setFirmType(e.target.value)}
                  required
                >
                  <option value="CA Firm">CA Firm</option>
                  <option value="Advocate">Advocate</option>
                  <option value="Account">Account</option>
                  <option value="Article Intern">Article Intern</option>
                </select>
              </div>

              <Button className="w-full mt-4 bg-zinc-50 text-zinc-900 hover:bg-zinc-200 border-none font-semibold transition-colors" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Setting up..." : "Complete Setup"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
