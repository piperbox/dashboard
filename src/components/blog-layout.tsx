import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";

export function BlogLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen">
			<PublicHeader section="blog" />
			<main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
		</div>
	);
}
