import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "./BrandMark";

interface LegalPageLayoutProps {
  title: string;
  intro: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, intro, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-rose-300 hover:text-rose-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm shadow-zinc-100 sm:p-10">
          <div className="mb-6 flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">MalluCupid</p>
              <h1 className="text-3xl font-bold text-zinc-900">{title}</h1>
            </div>
          </div>

          <p className="mb-8 text-lg leading-8 text-zinc-600">{intro}</p>
          <div className="space-y-6 text-zinc-700">{children}</div>
        </div>
      </div>
    </div>
  );
}
