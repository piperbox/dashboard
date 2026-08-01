const relaySteps = [
	{
		title: "visitor opens https://app.you.dev",
		body: "TLS handshake starts — destination is your box, not the relay",
		open: false,
	},
	{
		title: "relay reads the SNI and splices bytes",
		body: "L4 passthrough — it never holds a key, never sees plaintext",
		open: false,
	},
	{
		title: "an outbound tunnel carries it home",
		body: "your box dialled out — works behind CGNAT, no ports opened",
		open: false,
	},
	{
		title: "TLS terminates on your box",
		body: "Caddy holds the cert; Docker serves the app",
		open: true,
	},
];

// Wide layout: three nodes separated by two dashed connectors that Task 6
// animates ciphertext chips along. Hidden below md, where RelayStepList
// carries the same story as a vertical list.
function RelayDiagram() {
	return (
		<div
			data-lp-diagram
			className="hidden flex-nowrap items-stretch justify-center text-left md:flex"
		>
			<div className="min-w-0 flex-1 rounded-[2px] border border-border bg-card p-[18px]">
				<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
					visitors &amp; cli
				</div>
				<div className="text-[13px] text-foreground">https://app.you.dev</div>
				<div className="mt-2.5 text-[11px] text-fg-subtle">GET /index.html</div>
			</div>
			<div className="relative flex min-w-24 flex-[0_0_auto] flex-col items-center justify-center p-3 text-[12px] text-foreground">
				HTTPS →
				<div
					data-lp-track
					data-dir="1"
					className="absolute inset-x-1.5 top-1/2 mt-4 h-px border-t border-dashed border-border"
				/>
			</div>
			<div className="relative min-w-0 flex-[1.15] rounded-[2px] border border-primary bg-primary/[0.07] p-[18px]">
				<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-primary">
					piper-relay · cloud
				</div>
				<div className="text-[13px] text-foreground">
					SNI passthrough — ciphertext only
				</div>
				<div className="mt-2.5 text-[11px] text-fg-subtle">
					sees:{" "}
					<span data-lp-cipher className="text-muted-foreground">
						░▓▒░ 0x8f2a ▒░▓
					</span>
				</div>
			</div>
			<div className="relative flex min-w-24 flex-[0_0_auto] flex-col items-center justify-center p-3 text-center text-[11px] text-foreground">
				← tunnel
				<span className="mt-[3px] text-fg-subtle">(CGNAT)</span>
				<div
					data-lp-track
					data-dir="-1"
					className="absolute inset-x-1.5 top-1/2 mt-[22px] h-px border-t border-dashed border-border"
				/>
			</div>
			<div className="min-w-0 flex-[1.15] rounded-[2px] border border-border bg-card p-[18px]">
				<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-status-ok">
					your box · piperd
				</div>
				<div className="text-[13px] text-foreground">
					Docker · Caddy · TLS ends here
				</div>
				<div className="mt-2.5 text-[11px] text-fg-subtle">
					reads:{" "}
					<span data-lp-plain className="text-status-ok">
						GET /index.html
					</span>
				</div>
			</div>
		</div>
	);
}

// Narrow layout: the same four hops as a list. Task 6 cycles the highlight and
// flips the final step's lock glyph from ▣ to ▢ where TLS terminates.
function RelayStepList() {
	return (
		<div data-lp-steps className="flex flex-col gap-2.5 text-left md:hidden">
			{relaySteps.map((s, i) => (
				<div
					key={s.title}
					data-lp-step={i}
					data-lp-open={s.open ? "" : undefined}
					className="flex items-center gap-[14px] rounded-[2px] border border-border bg-card px-4 py-[14px] transition-colors duration-[250ms]"
				>
					<span data-lp-lock className="text-[14px] text-fg-subtle">
						▣
					</span>
					<div>
						<div className="text-[13px]">{s.title}</div>
						<div className="mt-1 text-[11.5px] text-fg-subtle">{s.body}</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function LandingRelay() {
	return (
		<div className="py-16">
			<div className="mb-9 text-center">
				<div
					data-lp-reveal
					className="mb-2 text-[11px] uppercase tracking-[0.16em] text-primary"
				>
					the relay
				</div>
				<h2 data-lp-reveal className="text-[26px] font-semibold">
					Public traffic, private network
				</h2>
				<p
					data-lp-reveal
					className="mx-auto mt-[14px] max-w-[600px] text-sm leading-[1.6] text-muted-foreground text-pretty"
				>
					TLS terminates on your box; the relay splices ciphertext by SNI over
					an outbound tunnel — so it works behind CGNAT and never sees
					plaintext.
				</p>
			</div>
			<RelayDiagram />
			<RelayStepList />
		</div>
	);
}
