import { useEffect, useRef, useState } from "react";

// Первый экран после загрузки страницы: ему не нужны ни анимация, ни перенос фокуса.
let isFirstStage = true;

/**
 * Один шаг дела. При переходе между шагами фокус уходит на заголовок,
 * чтобы скринридер объявил новый экран, а клавиатура начинала с его начала.
 */
export function Stage({
  title,
  level = 2,
  children,
}: {
  title: string;
  level?: 1 | 2;
  children: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [navigated] = useState(!isFirstStage);

  useEffect(() => {
    isFirstStage = false;
    if (navigated) heading.current?.focus({ preventScroll: true });
  }, [navigated]);

  const Heading = level === 1 ? "h1" : "h2";
  return (
    <section className={navigated ? "stage-enter" : undefined}>
      <Heading ref={heading} tabIndex={-1}>
        {title}
      </Heading>
      {children}
    </section>
  );
}
