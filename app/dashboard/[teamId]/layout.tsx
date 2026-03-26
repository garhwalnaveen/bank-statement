'use client';

import SidebarLayout, { SidebarItem } from "@/components/sidebar-layout";
import { useUser } from "@stackframe/stack";
import { LayoutDashboard, Building2, CloudUpload, BookOpen, RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

const navigationItems: SidebarItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    type: "item",
  },
  {
    name: "Clients",
    href: "/clients",
    icon: Building2,
    type: "item",
  },
  {
    name: "Uploads",
    href: "/statements",
    icon: CloudUpload,
    type: "item",
  },
  {
    name: "Rules",
    href: "/rules",
    icon: BookOpen,
    type: "item",
  },
  {
    name: "Tally Sync",
    href: "/settings",
    icon: RefreshCw,
    type: "item",
  },
];

export default function Layout(props: { children: React.ReactNode }) {
  const params = useParams<{ teamId: string }>();
  const user = useUser({ or: 'redirect' });
  const team = user.useTeam(params.teamId);
  const router = useRouter();

  if (!team) {
    router.push('/dashboard');
    return null;
  }

  return (
    <SidebarLayout
      items={navigationItems}
      basePath={`/dashboard/${team.id}`}
    >
      {props.children}
    </SidebarLayout>
  );
}