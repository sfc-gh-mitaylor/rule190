import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { APP_TITLE, DOGFOOD_AGENT, LOGO_SRC } from "@/lib/constants"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background text-foreground">
      <div className="w-full px-4 h-14 flex items-center gap-3">
        <Image src={LOGO_SRC} alt="Workbench logo" width={27} height={27} />
        <span className="text-sm font-semibold tracking-tight">{APP_TITLE}</span>
        <span className="hidden md:inline text-xs text-slate-500">{DOGFOOD_AGENT.database}.{DOGFOOD_AGENT.schema}.{DOGFOOD_AGENT.name}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={15}/> Caller&apos;s rights</span>
      </div>
    </header>
  )
}