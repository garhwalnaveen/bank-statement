"use client";

import { cn } from "@/lib/utils";
import { UserButton, SelectedTeamSwitcher } from "@stackframe/stack";
import { LucideIcon, Menu, Search, Bell, Activity } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "./ui/button";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

function useSegment(basePath: string) {
  const path = usePathname();
  const result = path.slice(basePath.length, path.length);
  return result ? result : "/";
}

type Item = {
  name: React.ReactNode;
  href: string;
  icon: LucideIcon;
  type: "item";
};

type Sep = {
  type: "separator";
};

type Label = {
  name: React.ReactNode;
  type: "label";
};

export type SidebarItem = Item | Sep | Label;

function NavItem(props: {
  item: Item;
  onClick?: () => void;
  basePath: string;
}) {
  const segment = useSegment(props.basePath);
  const selected = segment === props.item.href || (props.item.href !== "/" && segment.startsWith(props.item.href));

  return (
    <Link
      href={props.basePath + props.item.href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        selected ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15" : "text-zinc-600 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-300 font-medium",
        "flex-grow justify-start text-sm px-3 py-5 rounded-lg mb-1 transition-colors"
      )}
      onClick={props.onClick}
      prefetch={true}
    >
      <props.item.icon className={`mr-3 h-5 w-5 ${selected ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-400 dark:text-zinc-500'}`} />
      {props.item.name}
    </Link>
  );
}

function SidebarContent(props: {
  onNavigate?: () => void;
  items: SidebarItem[];
  basePath: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex flex-col h-full items-stretch bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/50">
      {/* Brand Header / Team Switcher */}
      <div className="h-[72px] flex items-center px-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800/50">
        <div className="w-full">
          <SelectedTeamSwitcher urlMap={(team) => `/dashboard/${team.id}`} />
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-grow flex-col gap-1 pt-6 px-4 overflow-y-auto">
        {props.items.map((item, index) => {
          if (item.type === "separator") {
            return <Separator key={index} className="my-2 bg-zinc-200 dark:bg-zinc-800" />;
          } else if (item.type === "item") {
            return (
              <div key={index} className="flex">
                <NavItem
                  item={item}
                  onClick={props.onNavigate}
                  basePath={props.basePath}
                />
              </div>
            );
          } else {
            return (
              <div key={index} className="flex my-2 mt-4">
                <div className="flex-grow justify-start text-xs font-semibold uppercase tracking-wider text-zinc-400 px-3">
                  {item.name}
                </div>
              </div>
            );
          }
        })}
        <div className="flex-grow" />
      </div>

      {/* Bottom Footer Area */}
      <div className="p-4 mt-auto border-t border-zinc-200 dark:border-zinc-800/50">

        {/* Sync Status Widget */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sync Status</h4>
          </div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Connector</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-500">Online</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-emerald-500 w-full" />
          </div>
          <p className="text-[10px] text-zinc-500 text-right font-medium">Last sync: 2m ago</p>
        </div>

      </div>
    </div>
  );
}

export type HeaderBreadcrumbItem = { title: string; href: string };

function HeaderTitle(props: { items: SidebarItem[], basePath: string }) {
  const segment = useSegment(props.basePath);
  const item = props.items.find((item) => item.type === 'item' && (item.href === segment || (item.href !== "/" && segment.startsWith(item.href))));
  const title: string = (item as any)?.name || "Dashboard";

  return (
    <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-50 tracking-tight hidden md:block">
      {title}
    </h1>
  );
}

export default function SidebarLayout(props: {
  children?: React.ReactNode;
  baseBreadcrumb?: HeaderBreadcrumbItem[]; // Keeping prop for backwards compatibility though unused
  items: SidebarItem[];
  sidebarTop?: React.ReactNode;
  basePath: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="w-full flex bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      <div className="flex-col w-[260px] h-screen sticky top-0 hidden md:flex">
        <SidebarContent items={props.items} basePath={props.basePath} />
      </div>

      <div className="flex flex-col flex-grow w-0">
        {/* Global Top Nav */}
        <div className="h-[72px] flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-20 px-6 md:px-8 border-b border-zinc-200 dark:border-zinc-800/50">

          <HeaderTitle basePath={props.basePath} items={props.items} />

          {/* Search & Actions block */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search data..."
                className="w-full h-10 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-900 dark:text-zinc-50"
              />
            </div>

            <button className="relative p-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors hidden sm:block">
              <Bell className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950" />
            </button>

            {/* User Profile & Logout Navbar */}
            <div className="flex items-center pl-2 hidden sm:flex">
              <UserButton colorModeToggle={() => setTheme(resolvedTheme === "light" ? "dark" : "light")} />
            </div>

            {/* Mobile Menu Trigger */}
            <div className="md:hidden flex items-center gap-3">
              <UserButton colorModeToggle={() => setTheme(resolvedTheme === "light" ? "dark" : "light")} />
              <Sheet
                onOpenChange={(open) => setSidebarOpen(open)}
                open={sidebarOpen}
              >
                <SheetTrigger asChild>
                  <button className="p-2 -mr-2 text-zinc-600 dark:text-zinc-400">
                    <Menu className="h-6 w-6" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] p-0 border-r-0 bg-white dark:bg-zinc-950">
                  <SidebarContent
                    onNavigate={() => setSidebarOpen(false)}
                    items={props.items}
                    basePath={props.basePath}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-grow p-4 md:p-8 overflow-x-hidden">
          {props.children}
        </div>
      </div>
    </div>
  );
}
