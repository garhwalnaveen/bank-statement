import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/stack";

export default function Handler(props: unknown) {
  return (
    <div className="flex h-full min-h-screen lg:min-h-0 w-full items-center justify-center p-4">
      <StackHandler fullPage={false} app={stackServerApp} routeProps={props} />
    </div>
  );
}
