type QuickTutorialProps = {
  title?: string;
  steps: readonly string[];
  note?: string;
};

export function QuickTutorial({
  title = 'Tutorial rápido',
  steps,
  note,
}: QuickTutorialProps) {
  return (
    <section className="border-primary/20 bg-primary/5 rounded-2xl border p-5">
      <h2 className="font-semibold">{title}</h2>
      <ol className="text-muted-foreground mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="bg-primary text-primary-foreground inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {note && <p className="text-muted-foreground mt-4 text-xs">{note}</p>}
    </section>
  );
}
