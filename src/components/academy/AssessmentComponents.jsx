import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, IconButton, Segments } from "@/design-system";
import { StatTile } from "@/components/academy/CourseElements";

const KEYS = ["A", "B", "C", "D", "E", "F"];

/** Slim assessment bar: exit, segmented progress, counter. */
export function AssessmentBar({ onExit, total = 0, current = 0, states = [], label = "Progress kuis", children }) {
  return (
    <div className="aapm-focus__bar">
      <IconButton label="Keluar" icon="close" onClick={onExit} />
      <div className="min-w-0 flex-1">
        <Segments total={total} current={current} states={states} label={label} />
      </div>
      <span className="aapm-text-caption aapm-numeric whitespace-nowrap">{Math.min(current + 1, total)}/{total}</span>
      {children}
    </div>
  );
}

/**
 * One question with A/B/C/D choice cards (radiogroup). `result` reveals the
 * correct and chosen-wrong options after checking.
 */
export function QuizQuestion({ question, number, total, answer, onAnswer, revealed = false, meta, children }) {
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

/** Feedback after checking an answer (Duolingo-style). */
export function AnswerFeedback({ question, answer }) {
  if (!question || answer === undefined) return null;
  const correct = answer === question.correctIndex;
  return (
    <div className="aapm-feedback-bar" data-tone={correct ? "success" : "danger"} role="status">
      <AapmIcon name={correct ? "check" : "closeCircle"} />
      <div className="min-w-0">
        <p className="font-semibold">{correct ? "Tepat sekali!" : "Belum tepat"}</p>
        <p className="text-support">
          {question.explanation || (correct ? "Jawaban Anda benar." : `Jawaban benar: ${question.options[question.correctIndex]}`)}
        </p>
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

/** Result screen: badge, headline, stat tiles; actions are passed as children. */
export function AssessmentResult({ passed = false, score = 0, total = 0, passingGrade = 70, title, description, children }) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="aapm-quiz">
      <div className="aapm-result" data-hue={passed ? "green" : "orange"}>
        <div className="aapm-result__badge"><AapmIcon name={passed ? "exam" : "refresh"} /></div>
        <h1 className="aapm-result__title">{title || (passed ? "Luar biasa!" : "Hampir sampai")}</h1>
        <p className="aapm-result__text">{description || (passed ? "Pemahaman Anda siap untuk modul berikutnya." : `Nilai lulus ${passingGrade}%. Tinjau materi lalu coba lagi.`)}</p>
      </div>
      <div className="aapm-stat-grid" style={{ "--stat-columns": 3 }}>
        <StatTile icon="target" hue={passed ? "green" : "orange"} label="Skor" value={`${percent}%`} />
        <StatTile icon="check" hue="blue" label="Jawaban benar" value={`${score}/${total}`} />
        <StatTile icon="flag" hue="violet" label="Nilai lulus" value={`${passingGrade}%`} />
      </div>
      {children}
    </div>
  );
}

/** Answer review after submission. */
export function AnswerReview({ questions = [], answers = {} }) {
  return (
    <details className="aapm-card mt-6">
      <summary className="aapm-card__header cursor-pointer">
        <span className="aapm-card__title">Tinjau jawaban</span>
        <span className="aapm-card__description">Lihat jawaban yang benar untuk setiap soal.</span>
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
