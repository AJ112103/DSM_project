import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FEATURED_POST, OTHER_POSTS, type PostMeta } from "./posts";

export const metadata = {
  title: "Blog · WACMR Analytics",
  description:
    "Long-form technical writing on the investigation into India's Weighted Average Call Money Rate.",
};

function BlogCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col gap-2 py-8 transition-colors first:pt-0 last:pb-0"
    >
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
        <time>{post.date}</time>
        <span>·</span>
        <span>{post.readingTime}</span>
      </div>
      <h2
        className="text-balance text-2xl leading-tight text-white transition-colors group-hover:text-cyan-300 lg:text-3xl"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {post.title}
      </h2>
      <p className="text-slate-400">{post.summary}</p>
      <div className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-cyan-400">
        Read the essay
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <header className="space-y-3 pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-400">
          <div className="h-px w-8 bg-cyan-400/50" />
          Notes & essays
        </div>
        <h1
          className="text-4xl leading-tight text-white lg:text-6xl"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Writing about the WACMR project.
        </h1>
        <p className="max-w-2xl text-lg text-slate-400">
          Long-form posts that walk through the data, the modelling, the findings,
          and the things we got wrong before getting them right.
        </p>
      </header>

      <div className="divide-y divide-slate-800">
        <BlogCard post={FEATURED_POST} />
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
        <div className="h-px flex-1 bg-slate-800" />
        Further essays
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="divide-y divide-slate-800">
        {OTHER_POSTS.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
