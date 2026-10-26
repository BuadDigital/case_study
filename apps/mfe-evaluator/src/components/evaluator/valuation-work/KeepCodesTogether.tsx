import { splitComparableCodes } from "./lib/comparable-codes";

/** Alert text whose comparable codes never break across lines (the line may wrap around them). */
export function KeepCodesTogether({ text }: { text: string }) {
  return (
    <>
      {splitComparableCodes(text).map((run, i) =>
        run.code ? (
          <bdi key={i} dir="ltr" className="whitespace-nowrap">
            {run.text}
          </bdi>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}
