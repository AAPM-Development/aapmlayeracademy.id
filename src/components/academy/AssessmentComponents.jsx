import React, { useState } from "react";
import { appiAsset } from "@/components/appi/AppiMascot";
import AppiMascot from "@/components/appi/AppiMascot";
import CountUp from "@/components/motion/CountUp";
import { Ic } from "@/design-system/canvas";
import { formatDuration } from "@/lib/learningPath";
import { cn } from "@/lib/utils";

// Assessment patterns of the Redesign v2 canvas (quiz intro/question/result,
// final exam): focus bar with segments, tactile choice cards, the feedback
// bar, the question navigator and the celebration.

const KEYS = ["A", "B", "C", "D", "E", "F"];
const difficultyLabel = { easy: "Mudah", medium: "Sedang", hard: "Sulit" };

/** Focus bar for an assessment: exit, context and title, segmented progress, counter. */
export function AssessmentBar({ onExit, total = 0, current = 0, states = [], checked = undefined, label = "Progres kuis", title = undefined, context = undefined, hue = undefined, children = null }) {
  const done = checked ?? states.filter(Boolean).length;
  const segClass = { done: "on", correct: "on", wrong: "bad", current: "cur" };
  return (
    <header className="focus-bar" data-hue={hue}>
      <button type="button" className="btn btn-ghost btn-icon btn-quiet" aria-label="Keluar" onClick={onExit}><Ic name="x" /></button>
      <span className="vr hide-sm" style={{ margin: "14px 4px" }} />
      {title || context ? (
        <div className="stack grow" style={{ minWidth: 0 }}>
          {context ? <span className="t-caption t-muted t-clamp-1">{context}</span> : null}
          {title ? <span className="t-heading t-clamp-1" title={title}>{title}</span> : null}
        </div>
      ) : <span className="grow" />}
      {total ? (
        <div className="row gap-3 assessment-progress" role="group" aria-label={`${label}: ${done} dari ${total} soal diperiksa`}>
          <div className="segs grow" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => <i key={index} className={segClass[states[index]]} />)}
          </div>
          <span className="t-caption t-strong t-num">{done}/{total}</span>
        </div>
      ) : null}
      {children}
    </header>
  );
}

/**
 * One question with A/B/C/D choice cards (radiogroup). `revealed` shows the
 * correct and chosen-wrong options after checking; `correctIndex` is the
 * server's answer for that check, never a value the page holds. The quiz page
 * maps the A–F and 1–6 keys to the choices (announced through aria-keyshortcuts).
 */
export function QuizQuestion({ question, number, total, answer, onAnswer, revealed = false, correctIndex = null, meta = undefined, children = null }) {
  if (!question) return null;
  const titleId = `question-${number}`;
  return (
    <div className="stack gap-6 w-full quiz-stage" key={number}>
      <header className="stack gap-3">
        <div className="row wrap gap-2">
          <span className="t-overline t-ink">Soal {number}{total ? ` dari ${total}` : ""}</span>
          {question.difficulty ? <span className="chip">{difficultyLabel[question.difficulty] || question.difficulty}</span> : null}
          {meta}
        </div>
        <h1 className="t-title-c anim-rise" id={titleId}>{question.question}</h1>
      </header>
      <div className="stack gap-3" role="radiogroup" aria-labelledby={titleId}>
        {question.options.map((option, index) => {
          const selected = answer === index;
          const result = revealed ? (index === correctIndex ? "correct" : selected ? "wrong" : "dim") : undefined;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cn("choice anim-rise", !revealed && selected && "is-selected", result === "correct" && "is-correct", result === "wrong" && "is-wrong", result === "dim" && "is-dim")}
              style={{ "--i": index + 1 }}
              disabled={revealed}
              aria-keyshortcuts={KEYS[index] ? `${KEYS[index]} ${index + 1}` : undefined}
              onClick={() => onAnswer(index)}
            >
              <span className="choice-key" aria-hidden="true">{KEYS[index] || index + 1}</span>
              <span>{option}</span>
              {result === "correct" ? <Ic name="check-circle" size="lg" className="t-success" /> : result === "wrong" ? <Ic name="x-circle" size="lg" className="t-danger" /> : null}
              {result === "correct" && selected ? <span className="sr-only">Jawaban Anda, tepat</span> : result === "wrong" ? <span className="sr-only">Jawaban Anda, belum tepat</span> : null}
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
 * Answer feedback inside the action bar after "Periksa": APPI pops in (cheer
 * when right, wink when not), the verdict, a streak chip from three in a row,
 * the correct answer when wrong and a two-line explanation that can expand.
 * The bar itself carries the tone; the announcement goes through the page's
 * persistent live region.
 */
export function CheckFeedback({ question, feedback, run = 0 }) {
  const [expanded, setExpanded] = useState(false);
  if (!question || !feedback) return null;
  const correct = feedback.isCorrect;
  const long = String(feedback.explanation || "").length > 140;
  return (
    <>
      <div className="appi-stage hide-sm"><AppiMascot mood={correct ? "cheer" : "wink"} size="md" enter="pop" /></div>
      <div className="stack gap-1 check-feedback">
        <div className="row wrap gap-3">
          <span className={cn("t-heading", correct ? "t-success" : "t-danger")}>{correct ? "Tepat sekali!" : "Belum tepat"}</span>
          {correct && run >= 3 ? <span className="streak anim-pop"><Ic name="flame" className="anim-flicker" />{run} benar beruntun</span> : null}
        </div>
        {!correct ? <p className="t-support">Jawaban benar: <strong>{question.options[feedback.correctIndex]}</strong></p> : null}
        {feedback.explanation ? (
          <>
            <p className={cn("t-support", !expanded && "t-clamp-2")}>{feedback.explanation}</p>
            {long ? <button type="button" className="btn btn-link t-support check-more" onClick={() => setExpanded((value) => !value)}>{expanded ? "Ringkas penjelasan" : "Baca penjelasan"}</button> : null}
          </>
        ) : null}
      </div>
    </>
  );
}

/** Question navigator (`.qnav`) for the outline or the phone sheet, with a legend and the pass rule. */
export function QuestionNavigator({ total = 0, current = 0, answers = {}, flagged = {}, results = [], answeredLabel = "terjawab", passingGrade = null, onSelect = (_index) => {} }) {
  const answered = Object.keys(answers).length;
  const marked = Object.values(flagged).filter(Boolean).length;
  const hasResults = results.some((result) => result === "correct" || result === "wrong");
  const needed = passingGrade && total ? Math.ceil((passingGrade / 100) * total) : null;
  return (
    <>
      <div className="row between gap-2" style={{ padding: "4px 8px 0" }}>
        <span className="t-heading">Daftar soal</span>
        <span className="t-caption t-muted t-num">{answered}/{total} {answeredLabel}{marked ? ` · ${marked} ditandai` : ""}</span>
      </div>
      <div className="qnav" style={{ padding: "0 8px" }} role="group" aria-label="Pilih nomor soal">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(answers[index] !== undefined && "is-answered", results[index] === "correct" && "is-correct", results[index] === "wrong" && "is-wrong", index === current && "is-current", flagged[index] && "is-flagged")}
            aria-current={index === current ? "step" : undefined}
            aria-label={`Soal ${index + 1}${answers[index] !== undefined ? `, ${answeredLabel}` : ", belum dijawab"}${results[index] === "correct" ? ", tepat" : results[index] === "wrong" ? ", perlu ditinjau" : ""}${flagged[index] ? ", ditandai" : ""}${index === current ? ", sedang dibuka" : ""}`}
          >
            {index + 1}
            {results[index] === "correct" ? <span className="medal-badge"><Ic name="check" /></span> : null}
          </button>
        ))}
      </div>
      <ul className="stack gap-2" style={{ padding: "4px 8px 12px", borderBottom: "1px solid var(--border)" }} aria-label="Keterangan">
        {hasResults ? (
          <>
            <li className="row gap-2 t-caption t-muted"><Ic name="check-circle" size="sm" className="t-success" />Tepat</li>
            <li className="row gap-2 t-caption t-muted"><Ic name="x-circle" size="sm" className="t-danger" />Perlu ditinjau</li>
            <li className="row gap-2 t-caption t-muted"><Ic name="minus" size="sm" />Belum dijawab</li>
          </>
        ) : (
          <>
            <li className="row gap-2 t-caption t-muted"><span className="qnav-key is-answered" aria-hidden="true" />{answeredLabel.charAt(0).toUpperCase() + answeredLabel.slice(1)}</li>
            <li className="row gap-2 t-caption t-muted"><Ic name="minus" size="sm" />Belum dijawab</li>
          </>
        )}
        {marked || Object.keys(flagged).length ? <li className="row gap-2 t-caption t-muted"><span className="qnav-key is-flagged" aria-hidden="true" />Ditandai untuk ditinjau</li> : null}
      </ul>
      {passingGrade ? (
        <div className="inset row gap-3" style={{ margin: "0 8px", padding: "var(--s-3)" }}>
          <span className="tile tile-sm tile-round"><Ic name="target" /></span>
          <div className="stack" style={{ minWidth: 0 }}>
            <span className="t-support t-strong">Nilai lulus {passingGrade}%</span>
            {needed ? <span className="t-caption t-muted">Minimal {needed} dari {total} tepat</span> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

const confettiPieces = [
  { x: "6%", y: 28, r: "-24deg", c: "var(--gold)", d: 0 },
  { x: "14%", y: 96, c: "var(--blue)", d: 80, dot: true },
  { x: "21%", y: 10, r: "38deg", c: "var(--rose)", d: 160 },
  { x: "11%", y: 168, r: "62deg", c: "var(--green)", d: 240 },
  { x: "25%", y: 140, c: "var(--violet)", d: 320, dot: true },
  { x: "77%", y: 18, r: "18deg", c: "var(--green)", d: 40 },
  { x: "85%", y: 86, c: "var(--gold)", d: 120, dot: true },
  { x: "92%", y: 34, r: "-48deg", c: "var(--violet)", d: 200 },
  { x: "74%", y: 150, r: "-16deg", c: "var(--blue)", d: 280 },
  { x: "90%", y: 172, c: "var(--rose)", d: 360, dot: true },
  { x: "81%", y: 122, r: "74deg", c: "var(--teal)", d: 440 },
];

/**
 * Result screen (canvas "Kuis — hasil"): APPI drops in over rays and a glow
 * with confetti when passed (or pops in with a wink when not), the verdict,
 * the headline, and three stat tiles that pop in; rewards and actions come
 * in as children.
 */
export function AssessmentResult({ passed = false, score = 0, total = 0, passingGrade = 70, duration = undefined, title = undefined, description = undefined, streak = 0, hue = undefined, badge = null, children = null }) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  const perfect = passed && total > 0 && score === total;
  const outcome = perfect ? "perfect" : passed ? "passed" : "retry";
  const mood = { perfect: "proud", passed: "cheer", retry: "wink" }[outcome];
  const headline = { perfect: "Sempurna!", passed: "Luar biasa!", retry: "Hampir sampai" }[outcome];
  return (
    <div className="stack gap-6 w-full result-stage">
      <section className="rel stack items-center gap-4 t-center" aria-labelledby="result-title">
        <div className="halo" data-hue={hue || (passed ? "green" : "orange")} style={{ width: 280, height: 210 }}>
          {passed ? <span className="rays anim-spin" style={{ "--size": "320px" }} aria-hidden="true" /> : null}
          <span className="glow" style={{ "--size": "176px" }} aria-hidden="true" />
          <div className="appi-stage">
            <AppiMascot mood={mood} size="hero" enter={passed ? "drop" : "pop"} label={passed ? "APPI bersorak" : "APPI menyemangati"} />
          </div>
          {badge}
          {passed ? (
            <>
              <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: 34, top: 18, width: 30 }} />
              <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ left: 40, top: 70, width: 20, "--i": 2 }} />
              <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: 52, bottom: 30, width: 16, "--i": 4 }} />
            </>
          ) : null}
        </div>
        {passed ? (
          <div className="confetti" aria-hidden="true">
            {confettiPieces.map((piece, index) => (
              <i key={index} className={piece.dot ? "dot" : undefined} style={{ "--x": piece.x, "--y": `${piece.y}px`, "--r": piece.r, "--c": piece.c, "--d": `${piece.d}ms` }} />
            ))}
          </div>
        ) : null}
        <div className="row wrap justify-center gap-2">
          <span className={cn("verdict", passed ? "verdict-good" : "verdict-watch")}><Ic name={passed ? "check-circle" : "eye"} />{passed ? "Lulus" : "Belum lulus"} · nilai lulus {passingGrade}%</span>
          {streak >= 3 ? <span className="streak"><Ic name="flame" className="anim-flicker" />{streak} benar beruntun</span> : null}
        </div>
        <div className="stack items-center gap-2">
          <h1 className="t-display aapm-result__title" id="result-title">{title || headline}</h1>
          <p className="t-reading t-muted">{description || (perfect ? "Semua jawaban benar. Anda siap untuk modul berikutnya." : passed ? "Pemahaman Anda siap untuk modul berikutnya." : `Nilai lulus ${passingGrade}%. Tinjau materi lalu coba lagi — APPI yakin Anda bisa.`)}</p>
        </div>
      </section>

      <section className="cols-3 result-stats" aria-label="Ringkasan hasil">
        <div className="card metric items-center t-center anim-pop" data-hue={passed ? "green" : "orange"} style={{ "--i": 1 }}>
          <span className="metric-label"><span className="tile tile-xs tile-round tile-solid"><Ic name="target" /></span>Skor</span>
          <span className="metric-value"><CountUp value={percent} format={(value) => `${Math.round(value)}%`} duration={900} /></span>
        </div>
        <div className="card metric items-center t-center anim-pop" data-hue="blue" style={{ "--i": 2 }}>
          <span className="metric-label"><span className="tile tile-xs tile-round tile-solid"><Ic name="check" /></span>Jawaban benar</span>
          <span className="metric-value"><CountUp value={score} duration={900} /><small>/{total}</small></span>
        </div>
        <div className="card metric items-center t-center anim-pop" data-hue="violet" style={{ "--i": 3 }}>
          {duration !== undefined ? (
            <>
              <span className="metric-label"><span className="tile tile-xs tile-round tile-solid"><Ic name="clock" /></span>Waktu</span>
              <span className="metric-value">{formatDuration(duration)}</span>
            </>
          ) : (
            <>
              <span className="metric-label"><span className="tile tile-xs tile-round tile-solid"><Ic name="flag" /></span>Nilai lulus</span>
              <span className="metric-value">{passingGrade}%</span>
            </>
          )}
        </div>
      </section>
      {children}
    </div>
  );
}

/**
 * Answer review after submission, collapsed (`details.card`). Each item is a
 * checked attempt question with the server's `feedback`; the final exam never
 * renders this.
 */
export function AnswerReview({ questions = [] }) {
  const correctCount = questions.filter((item) => item.feedback?.isCorrect).length;
  return (
    <details className="card card-link answer-review">
      <summary className="row gap-3 card-pad">
        <span className="tile tile-sm" data-hue="neutral"><Ic name="list" /></span>
        <span className="stack grow" style={{ minWidth: 0 }}>
          <span className="card-title">Tinjau jawaban</span>
          <span className="card-desc">{correctCount} dari {questions.length} benar · lihat jawaban yang benar untuk setiap soal.</span>
        </span>
        <Ic name="chev-down" className="t-muted review-chevron" />
      </summary>
      <ol className="list">
        {questions.map((item, index) => {
          const correct = Boolean(item.feedback?.isCorrect);
          return (
            <li key={item.id || index} className="li" data-hue={correct ? "green" : "rose"}>
              <span className="tile tile-xs tile-round tile-solid"><Ic name={correct ? "check" : "x"} /></span>
              <div className="stack grow" style={{ minWidth: 0 }}>
                <span className="li-title">{index + 1}. {item.question}</span>
                <span className="li-meta">{correct ? "Jawaban Anda benar." : `Jawaban benar: ${item.options[item.feedback?.correctIndex]}`}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
