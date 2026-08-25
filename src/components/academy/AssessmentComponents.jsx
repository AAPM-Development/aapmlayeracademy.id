import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

export function AssessmentProgress({ current = 0, total = 0, label = "Assessment progress" } = {}) {
  const percent = total ? Math.round(((current + 1) / total) * 100) : 0;
  return <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{label}</span><span>{total ? `${current + 1} / ${total}` : "—"}</span></div><Progress value={percent} className="h-2 bg-muted [&>div]:bg-brand-lime" /></div><span className="text-xs font-semibold text-brand-green">{percent}%</span></div>;
}

export function QuestionNavigator({ total = 0, current = 0, answers = {}, flagged = {}, onSelect = (_index) => {}, onToggleFlag = (_index) => {} } = {}) {
  const answered = Object.keys(answers).length;
  const marked = Object.values(flagged).filter(Boolean).length;
  return (
    <Card className="shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold">Review jawaban</div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Pilih nomor untuk berpindah soal.</p></div><div className="text-right text-[11px] text-muted-foreground"><div><span className="font-semibold text-foreground">{answered}</span>/{total} terjawab</div>{marked > 0 && <div className="mt-0.5 text-brand-orange">{marked} ditandai</div>}</div></div>
        <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-5">{Array.from({ length: total }, (_, index) => { const hasAnswer = answers[index] !== undefined; const active = index === current; const isMarked = flagged[index]; return <button key={index} type="button" onClick={() => onSelect(index)} className={cn("relative flex min-h-9 items-center justify-center rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-brand-green bg-brand-green text-white" : hasAnswer ? "border-brand-lime/60 bg-tint-lime text-brand-green" : "border-border bg-background text-muted-foreground hover:bg-muted")} aria-label={`Question ${index + 1}`}><span>{index + 1}</span>{isMarked && <AapmIcon name="flag" className="absolute -right-1 -top-1 h-3 w-3 text-brand-orange" />}</button>; })}</div>
        {total > 0 && <Button type="button" variant="ghost" size="sm" className="mt-4 w-full text-xs" onClick={() => onToggleFlag(current)}><AapmIcon name="flag" className={cn(flagged[current] && "text-brand-orange")} /> {flagged[current] ? "Hapus tanda review" : "Tandai untuk review"}</Button>}
      </CardContent>
    </Card>
  );
}

export function AnswerOption({ option = "", index = 0, selected = false, disabled = false, result = null, onSelect = () => {} } = {}) {
  const resultCorrect = result === "correct";
  const resultWrong = result === "wrong";
  return <button type="button" onClick={onSelect} disabled={disabled} className={cn("flex min-h-14 w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm leading-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && !result ? "border-brand-green bg-tint-lime" : "border-border hover:border-brand-green/35 hover:bg-muted/40", resultCorrect && "border-success/40 bg-success/10", resultWrong && "border-danger/40 bg-danger/10", disabled && "cursor-default")}><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", selected && !result ? "border-brand-green bg-brand-green text-white" : "border-border text-muted-foreground", resultCorrect && "border-success bg-success text-white", resultWrong && "border-danger bg-danger text-white")}>{resultCorrect ? <AapmIcon name="check" className="h-3.5 w-3.5" /> : resultWrong ? <AapmIcon name="close" className="h-3.5 w-3.5" /> : String.fromCharCode(65 + index)}</span><span className="pt-0.5">{option}</span></button>;
}

export function QuizQuestion({ question = null, answer = undefined, submitted = false, number = null, total = 0, onAnswer = (_answer) => {} } = {}) {
  if (!question) return null;
  return <Card className="overflow-hidden shadow-none"><div className="h-1 bg-brand-orange" /><CardContent className="p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><span className="rounded-full bg-muted px-2 py-1">{question.difficulty || "medium"}</span><span>{question.type || "mcq"}</span></div>{number !== null && <span className="text-xs font-semibold tabular-nums text-brand-green">Soal {number}{total ? ` / ${total}` : ""}</span>}</div><h2 className="mt-5 max-w-3xl text-lg font-semibold leading-7 sm:text-xl">{question.question}</h2><div className="mt-6 space-y-2.5">{question.options.map((option, index) => <AnswerOption key={`${option}-${index}`} option={option} index={index} selected={answer === index} disabled={submitted} result={submitted ? (answer === index ? (index === question.correctIndex ? "correct" : "wrong") : index === question.correctIndex ? "correct" : null) : null} onSelect={() => onAnswer(index)} />)}</div>{submitted && <div className={cn("mt-5 flex items-start gap-2 rounded-xl p-3 text-sm leading-6", answer === question.correctIndex ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{answer === question.correctIndex ? <AapmIcon name="checkRead" className="mt-0.5 h-4 w-4 shrink-0" /> : <AapmIcon name="closeCircle" className="mt-0.5 h-4 w-4 shrink-0" />}<span>{question.explanation || (answer === question.correctIndex ? "Jawaban benar." : `Jawaban benar: ${question.options[question.correctIndex]}`)}</span></div>}</CardContent></Card>;
}

export function AssessmentResult({ passed = false, score = 0, total = 0, passingGrade = 70, title = "Hasil assessment", children = null } = {}) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  return <Card className={cn("overflow-hidden shadow-none", passed ? "border-success/30" : "border-warning/30")}><div className={cn("h-1", passed ? "bg-success" : "bg-brand-orange")} /><CardContent className="p-6 text-center sm:p-10"><div className={cn("mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl", passed ? "bg-success/10 text-success" : "bg-warning/15 text-warning")}>{passed ? <AapmIcon name="checkRead" className="h-8 w-8" /> : <AapmIcon name="closeCircle" className="h-8 w-8" />}</div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Assessment result</div><h2 className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h2><p className="mt-2 text-sm text-muted-foreground">Skor {score}/{total} ({percent}%) · Passing grade {passingGrade}%</p>{children}</CardContent></Card>;
}
