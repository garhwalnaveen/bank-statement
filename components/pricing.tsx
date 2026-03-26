import React from "react";
import { Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

type PricingCardProps = {
  title: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonHref: string;
  isPopular?: boolean;
};

export function PricingCard(props: PricingCardProps) {
  return (
    <div className={`relative group w-full max-w-sm rounded-[24px] p-[1px] transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${props.isPopular ? "bg-gradient-to-b from-emerald-500 via-emerald-600 to-blue-500 shadow-emerald-500/25 shadow-xl" : "bg-zinc-200 dark:bg-zinc-800"
      }`}>
      {props.isPopular && <div className="absolute -top-4 inset-x-0 flex justify-center z-10"><span className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">Most Popular</span></div>}
      <Card
        className={`w-full max-w-sm h-full flex flex-col rounded-[23px] border-0 outline-none ${props.isPopular ? "bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl" : "bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm"
          }`}
      >
        <CardHeader className="pt-8">
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{props.title}</CardTitle>
          <CardDescription className="text-sm mt-2 text-zinc-500 dark:text-zinc-400">{props.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <div className="mb-6 flex items-baseline gap-1 text-zinc-900 dark:text-zinc-50">
            {props.price !== "Custom" && props.price !== "Free" ? (
              <>
                <span className="text-5xl font-extrabold tracking-tighter">{props.price}</span>
                <span className="text-zinc-500 text-sm font-medium">/month</span>
              </>
            ) : (
              <span className="text-4xl font-extrabold tracking-tighter">{props.price}</span>
            )}
          </div>
          <ul className="space-y-3">
            {props.features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
                <div className="mr-3 rounded-full bg-emerald-500/10 p-1">
                  <Check className="h-3 w-3 text-emerald-500 font-bold" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="pb-8">
          <Link
            href={props.buttonHref}
            className={buttonVariants({
              className: `w-full rounded-full border-0 py-6 font-semibold transition-all ${props.isPopular ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:text-zinc-950 hover:shadow-lg hover:-translate-y-0.5' : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm'}`
            })}
          >
            {props.buttonText}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export function PricingGrid(props: {
  title: string;
  subtitle: string;
  items: PricingCardProps[];
}) {
  return (
    <section
      id="features"
      className="container space-y-6 py-8 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center space-y-4 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-50">{props.title}</h2>
        <p className="max-w-[85%] text-zinc-500 dark:text-zinc-400 sm:text-lg">
          {props.subtitle}
        </p>
      </div>

      <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-5xl md:grid-cols-3">
        {props.items.map((item, index) => (
          <PricingCard key={index} {...item} />
        ))}
      </div>
    </section>
  );
}
