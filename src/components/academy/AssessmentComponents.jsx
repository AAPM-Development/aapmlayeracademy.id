import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, IconButton, Segments } from "@/design-system";
import { StatTile } from "@/components/academy/CourseElements";
import { formatDuration } from "@/lib/learningPath";

const KEYS = ["A", "B", "C", "D", "E", "F"];

/** Slim assessment bar: exit, segmented progress, counter. */
export function AssessmentBar({ onExit, total = 0, current = 0, states = [], label = "Progress kuis", title, context, children }) {
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
 * correct and chosen-wrong options after checking. The quiz page maps the
 * A–F and 1–6 keys to the choices (announced through aria-keyshortcuts).
 */
export function QuizQuestion({ question, number, total, answer, onAnswer, revealed = false, meta, children = null }) {
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
          const result = revealed ? (index === question.correctIndex ? "correct" : selected ? "wrong" : undefined) : undefined;
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
export function checkAnnouncement(question, answer, run = 0) {
  if (!question || answer === undefined) return "";
  if (answer !== question.correctIndex) return `Belum tepat. Jawaban benar: ${question.options[question.correctIndex]}.`;
  return run >= 3 ? `Tepat sekali! ${run} benar beruntun.` : "Tepat sekali!";
}

/**
 * Answer feedback inside the action bar after "Periksa" (Duolingo-style):
 * verdict, the correct answer when wrong, the explanation, and a run of
 * correct answers from three on. The bar itself carries the tone; the
 * announcement goes through the page's persistent live region.
 */
export function CheckFeedback({ question, answer, run = 0 }) {
  if (!question || answer === undefined) return null;
  const correct = answer === question.correctIndex;
  return (
    <div className="aapm-check-feedback" data-tone={correct ? "success" : "danger"}>
      <span className="aapm-check-feedback__icon" aria-hidden="true"><AapmIcon name={correct ? "glyphCheck" : "close"} /></span>
      <div className="aapm-check-feedback__body">
        <p className="aapm-check-feedback__title">
          {correct ? "Tepat sekali!" : "Belum tepat"}
          {correct && run >= 3 ? <span className="aapm-check-feedback__run"><AapmIcon name="streak" />{run} benar beruntun</span> : null}
        </p>
        {!correct ? <p className="aapm-check-feedback__answer">Jawaban benar: <strong>{question.options[question.correctIndex]}</strong></p> : null}
        {question.explanation ? <p className="aapm-check-feedback__text">{question.explanation}</p> : null}
      </div>
    </div>
  );
}

/** Numbered grid to move between questions; flagged items carry a dot. */
export function QuestionNavigator({ total = 0, current = 0, answers = {}, flagged = {}, onSelect = (_index) => {} }) {
  const answered = Object.keys(answers).length;
  const marked = Object.values(flagged).filter(Boolean).length;
  return (
    <div className="grid gap-4 p-4">
      <div>
        <p className="aapm-text-label m-0">Daftar soal</p>
        <p className="aapm-text-caption m-0">{answered}/{total} terjawab{marked ? ` · ${marked} ditandai` : ""}</p>
      </div>
      <div className="aapm-question-nav">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={index === current ? "step" : undefined}
            data-answered={answers[index] !== undefined ? "true" : undefined}
            data-flagged={flagged[index] ? "true" : undefined}
            aria-label={`Soal ${index + 1}${answers[index] !== undefined ? ", terjawab" : ""}${flagged[index] ? ", ditandai" : ""}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="grid gap-1.5 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm bg-[var(--aapm-semantic-primary-soft)]" />Terjawab</span>
        <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--aapm-semantic-attention)]" />Ditandai untuk ditinjau</span>
      </div>
    </div>
  );
}

/**
 * Result screen: badge, headline, stat tiles; actions are passed as children.
 * With `duration` (ms) the third tile shows the time taken instead of the
 * passing grade, like a lesson-complete screen.
 */
export function AssessmentResult({ passed = false, score = 0, total = 0, passingGrade = 70, duration = undefined, title, description, children }) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="aapm-quiz">
      <div className="aapm-result" data-hue={passed ? "green" : "orange"}>
        <div className="aapm-result__badge"><AapmIcon name={passed ? "exam" : "refresh"} /></div>
        {/* The assessment bar already holds the screen's h1 (quiz or exam title). */}
        <h2 className="aapm-result__title">{title || (passed ? "Luar biasa!" : "Hampir sampai")}</h2>
        <p className="aapm-result__text">{description || (passed ? "Pemahaman Anda siap untuk modul berikutnya." : `Nilai lulus ${passingGrade}%. Tinjau materi lalu coba lagi.`)}</p>
      </div>
      <div className="aapm-stat-grid aapm-stat-grid--result">
        <StatTile icon="target" hue={passed ? "green" : "orange"} label="Skor" value={`${percent}%`} />
        <StatTile icon="check" hue="blue" label="Jawaban benar" value={`${score}/${total}`} />
        {duration !== undefined
          ? <StatTile icon="timer" hue="violet" label="Waktu" value={formatDuration(duration)} />
          : <StatTile icon="flag" hue="violet" label="Nilai lulus" value={`${passingGrade}%`} />}
      </div>
      {children}
    </div>
  );
}

/** Answer review after submission. */
export function AnswerReview({ questions = [], answers = {} }) {
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
          const correct = answers[index] === item.correctIndex;
          return (
            <li key={item.id || index} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[var(--aapm-primitive-radius-panel)] bg-[var(--aapm-semantic-surface-subtle)] p-3">
              <span className="aapm-icon-tile" data-size="xs" data-shape="circle" data-hue={correct ? "green" : "rose"}><AapmIcon name={correct ? "check" : "closeCircle"} /></span>
              <div className="min-w-0">
                <p className="m-0 text-body font-medium">{index + 1}. {item.question}</p>
                <p className="m-0 text-caption text-muted-foreground">{correct ? "Jawaban Anda benar." : `Jawaban benar: ${item.options[item.correctIndex]}`}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
