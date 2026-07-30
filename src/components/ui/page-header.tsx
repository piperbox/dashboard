import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
	kicker,
	title,
	subtitle,
	className,
	as: Heading = "h1",
}: {
	kicker?: ReactNode;
	title: string;
	subtitle?: ReactNode;
	className?: string;
	as?: "h1" | "h2";
}) {
	return (
		<div className={cn("flex flex-col gap-1", className)}>
			{kicker != null && (
				<div className="text-[11px] uppercase tracking-widest text-primary">
					{kicker}
				</div>
			)}
			<Heading className="font-semibold text-xl">
				<span className="text-muted-foreground">{"# "}</span>
				{title}
			</Heading>
			{subtitle != null && (
				<p className="text-muted-foreground text-sm">{subtitle}</p>
			)}
		</div>
	);
}
