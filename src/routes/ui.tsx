import { createFileRoute } from "@tanstack/react-router";
import { UiPreview } from "@/components/ui/preview";

export const Route = createFileRoute("/ui")({
	head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
	component: UiPreviewPage,
});

function UiPreviewPage() {
	return (
		<div className="min-h-screen">
			<UiPreview />
		</div>
	);
}
