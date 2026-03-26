export function FeatureGridItem(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-2 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-emerald-500/30">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 dark:from-emerald-500/10 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex h-[200px] flex-col rounded-xl p-6 gap-4 bg-white dark:bg-zinc-950/50">
        <div className="text-emerald-500 dark:text-emerald-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300">
          {props.icon}
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50 group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-blue-600 dark:group-hover:from-emerald-400 dark:group-hover:to-blue-400 group-hover:bg-clip-text group-hover:text-transparent transition-all">{props.title}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{props.description}</p>
        </div>
      </div>
    </div>
  );
}

export function FeatureGrid(props: {
  title: string;
  subtitle: string;
  items: {
    icon: React.ReactNode;
    title: string;
    description: string;
  }[];
}) {
  return (
    <section
      id="features"
      className="container space-y-6 py-8 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center space-y-4 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold">
          {props.title}
        </h2>
        <p className="max-w-[85%] text-muted-foreground sm:text-lg">
          {props.subtitle}
        </p>
      </div>

      <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-5xl md:grid-cols-3">
        {props.items.map((item, index) => (
          <FeatureGridItem key={index} {...item} />
        ))}
      </div>
    </section>
  );
}
