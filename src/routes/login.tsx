import { createFileRoute } from "@tanstack/react-router";
import { LoginCard } from "@/components/login-card";

export const Route = createFileRoute("/login")({
	head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
	component: LoginCard,
});
