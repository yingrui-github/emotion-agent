import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";
import ModuleView from "./ModuleView";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const m = getModule(id);
  return { title: m ? `${m.name} · 灵犀` : "没有这个模块 · 灵犀" };
}

export default async function ModulePage({ params }) {
  const { id } = await params;

  const m = getModule(id);
  if (!m) notFound();

  return <ModuleView module={m} />;
}
