import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, IconButton, Segments } from "@/design-system";
import { StatTile } from "@/components/academy/CourseElements";
import { formatDuration } from "@/lib/learningPath";
import AppiMascot from "@/components/appi/AppiMascot";
import CountUp from "@/components/motion/CountUp";

const KEYS = ["A", "B", "C", "D", "E", "F"];

/** Slim assessment bar: exit, segmented progress, counter. */
export function AssessmentBar({ onExit, total = 0, current = 0, states = [], label = "Progress kuis", title = undefined, context = undefined, children = null }) {
  return (
    <header className="aapm-topbar aapm-focus__bar">
      <IconButton label="Keluar" icon="close" onClick={onExit} />
      {title || context ? (
        <div className="aapm-topbar__title">
          {context ? <span className="aapm-topbar__context">{context}</span> : null}
          {title ? <h1 className="aapm-topbar__title-text">{title}</h1> : null}
        </div>
      ) : null}
      <div className="aapm-topbar__actions">
        <div className="aapm-focus__segments">
          <Segments total={total} current={current} states={states} label={label} />
        </div>
        <span className="aapm-text-caption aapm-numeric whitespace-nowrap">{Math.min(current + 1, total)}/{total}</span>
        {children}
      </div>
    </header>
  );
}

/**
 * One question with A/B/C/D choice cards (radiogroup). `revealed` shows the
 * correct and chosen-wrong options after checking; `correctIndex` is the
 * server's answer for that check, never a value the page holds. The quiz page
 * maps the A–F and 1–6 keys to the choices (announced through aria-keyshortcuts).
 */
export function QuizQuestion({ question, number, total, answer, onAnswer, revealed = false, correctIndex = null, meta, children = null }) {
  if (!question) return null;
  const titleId = `question-${number}`;
  return (
    <div className="aapm-quiz" key={number}>
      <div className="aapm-quiz__meta">
        <span className="aapm-text-overline">Soal {number}{total ? ` dari ${total}` : ""}</span>
        <div className="flex flex-wrap gap-1.5">
          {question.difficulty ? <Badge>{question.difficulty}</Badge> : null}
          {meta}
        </div>
      </div>
      <h2 id={titleId} className="aapm-quiz__question aapm-motion-rise">{question.question}</h2>
      <div className="aapm-choices aapm-motion-stack" role="radiogroup" aria-labelledby={titleId}>
        {question.options.map((option, index) => {
          const selected = answer === index;
          const result = revealed ? (index === correctIndex ? "correct" : selected ? "wrong" : undefined) : undefined;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              role="radio"
              aria-checked={selected}
              className="aapm-choice"
              data-result={result}
              disabled={revealed}
              aria-keyshortcuts={KEYS[index] ? `${KEYS[index]} ${index + 1}` : undefined}
              onClick={() => onAnswer(index)}
            >
              <span className="aapm-choice__key" aria-hidden="true">{KEYS[index] || index + 1}</span>
              <span>{option}</span>
              {result === "correct" ? <AapmIcon name="check" className="aapm-choice__mark" /> : result === "wrong" ? <AapmIcon name="closeCircle" className="aapm-choice__mark" /> : <span />}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/** Short screen-reader sentence for a checked answer (feeds a live region). */
export function checkAnnouncement(question, feedback, run = 0) {
  if (!question || !feedback) return "";
  if (!feedback.isCorrect) return `Belum tepat. Jawaban benar: ${question.options[feedback.correctIndex]}.`;
  return run >= 3 ? `Tepat sekali! ${run} benar beruntun.` : "Tepat sekali!";
}

/**
 * Answer feedback inside the action bar after "Periksa" (Duolingo-style):
 * verdict, the correct answer when wrong, the explanation, and a run of
 * correct answers from three on. The bar itself carries the tone; the
 * announcement goes through the page's persistent live region.
 */
export function CheckFeedback({ question, feedback, run = 0 }) {
  if (!question || !feedback) return null;
  const correct = feedback.isCorrect;
  // A run of three or more is an APPI moment: the mascot cheers in place of
  // the check mark, which stays as a small badge so the verdict never
  // depends on the character alone.
  const streak = correct && run >= 3;
  return (
    <div className="aapm-check-feedback" data-tone={correct ? "success" : "danger"} data-streak={streak ? "true" : undefined}>
      <span className="aapm-check-feedback__icon" aria-hidden="true">
        {streak ? <AppiMascot mood="cheer" size={52} decor={false} /> : null}
        <AapmIcon name={correct ? "glyphCheck" : "close"} />
      </span>
      <div className="aapm-check-feedback__body">
        <p className="aapm-check-feedback__title">
          {correct ? "Tepat sekali!" : "Belum tepat"}
          {correct && run >= 3 ? <span className="aapm-check-feedback__run"><AapmIcon name="streak" />{run} benar beruntun</span> : null}
        </p>
        {!correct ? <p className="aapm-check-feedback__answer">Jawaban benar: <strong>{question.options[feedback.correctIndex]}</strong></p> : null}
        {feedback.explanation ? <p className="aapm-check-feedback__text">{feedback.explanation}</p> : null}
      </div>
    </div>
  );
}

/** Numbered grid to move between questions; flagged items carry a dot. */
export function QuestionNavigator({ total = 0, current = 0, answers = {}, flagged = {}, results = [], answeredLabel = "terjawab", onSelect = (_index) => {} }) {
  const answered = Object.keys(answers).length;
  const marked = Object.values(flagged).filter(Boolean).length;
  const hasResults = results.some((result) => result === "correct" || result === "wrong");
  return (
    <div className="grid gap-4 p-4">
      <div>
        <p className="aapm-text-label m-0">Daftar soal</p>
        <p className="aapm-text-caption m-0">{answered}/{total} {answeredLabel}{marked ? ` · ${marked} ditandai` : ""}</p>
      </div>
      <div className="aapm-question-nav" role="group" aria-label="Pilih nomor soal">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={index === current ? "step" : undefined}
            data-answered={answers[index] !== undefined ? "true" : undefined}
            data-flagged={flagged[index] ? "true" : undefined}
            data-result={results[index] || undefined}
            aria-label={`Soal ${index + 1}${answers[index] !== undefined ? `, ${answeredLabel}` : ", belum dijawab"}${results[index] === "correct" ? ", jawaban tepat" : results[index] === "wrong" ? ", perlu ditinjau" : ""}${flagged[index] ? ", ditandai" : ""}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="grid gap-1.5 text-caption text-muted-foreground">
        {hasResults ? (
          <>
            <span className="inline-flex items-center gap-2"><i className="aapm-question-nav__key" data-result="correct" />Tepat</span>
            <span className="inline-flex items-center gap-2"><i className="aapm-question-nav__key" data-result="wrong" />Perlu ditinjau</span>
            <span className="inline-flex items-center gap-2"><i className="aapm-question-nav__key" data-result="pending" />Belum dijawab</span>
          </>
        ) : <span className="inline-flex items-center gap-2"><i className="aapm-question-nav__key" />{answeredLabel.charAt(0).toUpperCase() + answeredLabel.slice(1)}</span>}
        <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--aapm-semantic-attention)]" />Ditandai untuk ditinjau</span>
      </div>
    </div>
  );
}

/**
 * Result screen (lesson-complete style): APPI reacts to the outcome over a
 * sunburst, the headline, then stat tiles whose numbers count up; actions are
 * passed as children. With `duration` (ms) the third tile shows the time
 * taken instead of the passing grade.
 */
export function AssessmentResult({ passed = false, score = 0, total = 0, passingGrade = 70, duration = undefined, title = undefined, description = undefined, children = null }) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  const perfect = passed && total > 0 && score === total;
  const outcome = perfect ? "perfect" : passed ? "passed" : "retry";
  const mood = { perfect: "proud", passed: "cheer", retry: "wink" }[outcome];
  const headline = { perfect: "Sempurna!", passed: "Luar biasa!", retry: "Hampir sampai" }[outcome];
  return (
    <div className="aapm-quiz">
      <div className="aapm-result" data-hue={passed ? "green" : "orange"} data-outcome={outcome}>
        <div className="aapm-result__badge aapm-result__badge--appi">
          {passed ? <span className="aapm-result__rays" aria-hidden="true" /> : null}
          <span className="aapm-result__glow" aria-hidden="true" />
          <AppiMascot mood={mood} size="hero" />
        </div>
        {/* The assessment bar already holds the screen's h1 (quiz or exam title). */}
        <h2 className="aapm-result__title">{title || headline}</h2>
        <p className="aapm-result__text">{description || (perfect ? "Semua jawaban benar. Anda siap untuk modul berikutnya." : passed ? "Pemahaman Anda siap untuk modul berikutnya." : `Nilai lulus ${passingGrade}%. Tinjau materi lalu coba lagi — APPI yakin Anda bisa.`)}</p>
      </div>
      <div className="aapm-stat-grid aapm-stat-grid--result">
        <StatTile icon="target" hue={passed ? "green" : "orange"} label="Skor" value={<CountUp value={percent} format={(value) => `${Math.round(value)}%`} duration={900} />} />
        <StatTile icon="check" hue="blue" label="Jawaban benar" value={<><CountUp value={score} duration={900} />/{total}</>} />
        {duration !== undefined
          ? <StatTile icon="timer" hue="violet" label="Waktu" value={formatDuration(duration)} />
          : <StatTile icon="flag" hue="violet" label="Nilai lulus" value={`${passingGrade}%`} />}
      </div>
      {children}
    </div>
  );
}

/**
 * Answer review after submission. Each item is a checked attempt question
 * with the server's `feedback`; the final exam never renders this.
 */
export function AnswerReview({ questions = [] }) {
  return (
    <details className="aapm-card aapm-disclosure mt-6">
      <summary className="aapm-card__header">
        <span className="grid min-w-0 gap-0.5">
          <span className="aapm-card__title">Tinjau jawaban</span>
          <span className="aapm-card__description">Lihat jawaban yang benar untuk setiap soal.</span>
        </span>
        <AapmIcon name="chevronDown" className="aapm-disclosure__chevron" />
      </summary>
      <ol className="aapm-card__content m-0 grid list-none gap-2 p-5 pt-0">
        {questions.map((item, index) => {
          const correct = Boolean(item.feedback?.isCorrect);
          return (
            <li key={item.id || index} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[var(--aapm-primitive-radius-panel)] bg-[var(--aapm-semantic-surface-subtle)] p-3">
              <span className="aapm-icon-tile" data-size="xs" data-shape="circle" data-hue={correct ? "green" : "rose"}><AapmIcon name={correct ? "check" : "closeCircle"} /></span>
              <div className="min-w-0">
                <p className="m-0 text-body font-medium">{index + 1}. {item.question}</p>
                <p className="m-0 text-caption text-muted-foreground">{correct ? "Jawaban Anda benar." : `Jawaban benar: ${item.options[item.feedback?.correctIndex]}`}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
