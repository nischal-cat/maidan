import { Clock3, ShieldCheck, Zap } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: Zap,
    title: 'Live availability',
    body: 'Every slot updates in real time.',
  },
  {
    icon: ShieldCheck,
    title: 'Book with confidence',
    body: 'Clear pricing and cancellation policies.',
  },
  {
    icon: Clock3,
    title: 'Ready in a minute',
    body: 'From search to confirmed in four steps.',
  },
];

export function TrustColumns() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-20 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 id="how-it-works-title" className="sr-only">
          How it works
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="border-l-2 border-primary py-2 pl-5">
              <item.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-extrabold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
