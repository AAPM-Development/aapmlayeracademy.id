import React from "react";
import { Check, CheckCircle2, Flag, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function AssessmentProgress({ current = 0, total = 0, label = "Assessment progress" } = {}) {
  const percent = total ? Math.round(((current + 1) / total) * 100) : 0;
  return <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{label}</span><span>{total ? `${current + 1} / ${total}` : "—"}</span></div><Progress value={percent} className="h-2 bg-muted [&>div]:bg-brand-orange" /></div><span className="text-xs font-semibold text-brand-orange">{percent}%</span></div>;
}

export function QuestionNavigator({ total = 0, current = 0, answers = {}, flagged = {}, onSelect = (_index) => {}, onToggleFlag = (_index) => {} } = {}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between"><div className="text-xs font-semibold">Question map</div><div className="text-[11px] text-muted-foreground">{Object.keys(answers).length}/{total}</div></div>
        <div className="grid grid-cols-5 gap-1.5">{Array.from({ length: total }, (_, index) => { const answered = answers[index] !== undefined; const active = index === current; const marked = flagged[index]; return <button key={index} type="button" onClick={() => onSelect(index)} className={cn("relative flex h-8 items-center justify-center rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-brand-orange bg-brand-orange text-white" : answered ? "border-brand-green/30 bg-brand-green/10 text-brand-green" : "border-border bg-background text-muted-foreground hover:bg-muted")} aria-label={`Question ${index + 1}`}><span>{index + 1}</span>{marked && <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-brand-orange text-brand-orange" />}</button>; })}</div>
        {total > 0 && <Button type="button" variant="ghost" size="sm" className="mt-3 w-full text-xs" onClick={() => onToggleFlag(current)}><Flag className={cn(flagged[current] && "fill-brand-orange text-brand-orange")} /> {flagged[current] ? "Hapus tanda review" : "Tandai untuk review"}</Button>}
      </CardContent>
    </Card>
  );
}

export function AnswerOption({ option = "", index = 0, selected = false, disabled = false, result = null, onSelect = () => {} } = {}) {
  const resultCorrect = result === "correct";
  const resultWrong = result === "wrong";
  return <button type="button" onClick={onSelect} disabled={disabled} className={cn("flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && !result ? "border-brand-orange bg-brand-orange/5" : "border-border hover:border-brand-green/35 hover:bg-muted/40", resultCorrect && "border-success/40 bg-success/10", resultWrong && "border-danger/40 bg-danger/10", disabled && "cursor-default")}><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", selected && !result ? "border-brand-orange bg-brand-orange text-white" : "border-border text-muted-foreground", resultCorrect && "border-success bg-success text-white", resultWrong && "border-danger bg-danger text-white")}>{resultCorrect ? <Check className="h-3.5 w-3.5" /> : resultWrong ? <X className="h-3.5 w-3.5" /> : String.fromCharCode(65 + index)}</span><span className="pt-0.5">{option}</span></button>;
}

export function QuizQuestion({ question = null, answer = undefined, submitted = false, onAnswer = (_answer) => {} } = {}) {
  if (!question) return null;
  return <Card className="shadow-none"><CardContent className="p-5 sm:p-7"><div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><span className="rounded-full bg-muted px-2 py-1">{question.difficulty || "medium"}</span><span>{question.type || "mcq"}</span></div><h2 className="text-lg font-semibold leading-7 sm:text-xl">{question.question}</h2><div className="mt-6 space-y-2.5">{question.options.map((option, index) => <AnswerOption key={`${option}-${index}`} option={option} index={index} selected={answer === index} disabled={submitted} result={submitted ? (answer === index ? (index === question.correctIndex ? "correct" : "wrong") : index === question.correctIndex ? "correct" : null) : null} onSelect={() => onAnswer(index)} />)}</div>{submitted && <div className={cn("mt-5 flex items-start gap-2 rounded-xl p-3 text-sm", answer === question.correctIndex ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
    {answer === question.correctIndex ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{question.explanation || (answer === question.correctIndex ? "Jawaban benar." : `Jawaban benar: ${question.options[question.correctIndex]}`)}</span>
  </div>}</CardContent></Card>;
}

export function AssessmentResult({ passed = false, score = 0, total = 0, passingGrade = 70, title = "Hasil assessment", children = null } = {}) {
  const percent = total ? Math.round((score / total) * 100) : 0;
  return <Card className={cn("shadow-none", passed ? "border-success/30" : "border-warning/30")}><CardContent className="p-6 text-center sm:p-8"><div className={cn("mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full", passed ? "bg-success/10 text-success" : "bg-warning/15 text-warning")}>{passed ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}</div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">Skor {score}/{total} ({percent}%) · Passing grade {passingGrade}%</p>{children}</CardContent></Card>;
}
