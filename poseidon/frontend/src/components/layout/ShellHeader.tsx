import { Waves } from "lucide-react";

export function ShellHeader() {
  return (
    <header className="h-14 border-b border-border bg-bg flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
          <Waves className="size-5 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-headline font-semibold text-text leading-none">Poseidon</p>
          <p className="text-[11px] text-text-muted mt-0.5">Leads calientes · agencia independiente</p>
        </div>
      </div>
      <p className="hidden sm:block text-[11px] text-text-dim font-mono">inbox.poseidon</p>
    </header>
  );
}
