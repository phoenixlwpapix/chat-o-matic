import type { ReplyLanguage } from "./reply-languages";

interface QuizSummaryCopy {
  heading: string;
  empty: string;
  chartTitle: string;
  unit: string;
  correct: string;
  incorrect: string;
  stats: string;
  note: string;
}

export const QUIZ_SUMMARY_COPY: Record<Exclude<ReplyLanguage, "auto">, QuizSummaryCopy> = {
  "zh-CN": {
    heading: "本次练习总结",
    empty: "还没有可统计的已提交答案。先完成一道题并提交，再来查看总结。未提交的题目不会计为答错。",
    chartTitle: "本次练习 · 作答结果", unit: "题", correct: "答对", incorrect: "答错",
    stats: "已提交 **{count} 题** · 答对 **{correct} 题** · 答错 **{incorrect} 题** · 正确率 **{accuracy}%**",
    note: "统计范围：当前对话中保留的互动题作答记录。未提交 **{unanswered} 题**，不计入正确率。判题依据题目所附答案；这是本次练习的表现，不代表完整能力评估。",
  },
  "zh-TW": {
    heading: "本次練習總結",
    empty: "還沒有可統計的已提交答案。先完成一道題並提交，再來查看總結。未提交的題目不會計為答錯。",
    chartTitle: "本次練習 · 作答結果", unit: "題", correct: "答對", incorrect: "答錯",
    stats: "已提交 **{count} 題** · 答對 **{correct} 題** · 答錯 **{incorrect} 題** · 正確率 **{accuracy}%**",
    note: "統計範圍：目前對話中保留的互動題作答紀錄。未提交 **{unanswered} 題**，不計入正確率。判題依據題目所附答案；這是本次練習的表現，不代表完整能力評估。",
  },
  en: {
    heading: "Practice summary",
    empty: "No submitted answers to summarize yet. Complete and submit a question first. Unsubmitted questions do not count as incorrect.",
    chartTitle: "Practice results", unit: "questions", correct: "Correct", incorrect: "Incorrect",
    stats: "Submitted: **{count}** · Correct: **{correct}** · Incorrect: **{incorrect}** · Accuracy: **{accuracy}%**",
    note: "Scope: submitted interactive answers retained in this conversation. **{unanswered}** unsubmitted questions are excluded from accuracy. Grading uses the supplied answer key; these practice results are not a full assessment of ability.",
  },
  fr: {
    heading: "Bilan des exercices",
    empty: "Aucune réponse soumise à résumer. Répondez à une question et validez-la d’abord. Les questions non soumises ne comptent pas comme des erreurs.",
    chartTitle: "Résultats des exercices", unit: "questions", correct: "Correctes", incorrect: "Incorrectes",
    stats: "Réponses soumises : **{count}** · Correctes : **{correct}** · Incorrectes : **{incorrect}** · Taux de réussite : **{accuracy}%**",
    note: "Périmètre : réponses aux exercices interactifs conservées dans cette conversation. **{unanswered}** questions non soumises sont exclues du taux de réussite. La correction suit le corrigé fourni ; ce bilan ne constitue pas une évaluation complète des compétences.",
  },
  ja: {
    heading: "今回の練習のまとめ",
    empty: "集計できる提出済みの回答はまだありません。まず問題に回答して提出してください。未提出の問題は不正解に数えません。",
    chartTitle: "今回の練習結果", unit: "問", correct: "正解", incorrect: "不正解",
    stats: "提出済み **{count} 問** · 正解 **{correct} 問** · 不正解 **{incorrect} 問** · 正答率 **{accuracy}%**",
    note: "集計対象は、この会話に保存されている対話型問題の回答です。未提出の **{unanswered} 問** は正答率に含めません。採点は問題に付属する解答に基づきます。今回の結果は能力全体の評価ではありません。",
  },
  ko: {
    heading: "이번 연습 요약",
    empty: "아직 집계할 제출 답안이 없습니다. 먼저 문제에 답하고 제출해 주세요. 미제출 문제는 오답으로 계산하지 않습니다.",
    chartTitle: "이번 연습 결과", unit: "문제", correct: "정답", incorrect: "오답",
    stats: "제출 **{count}문제** · 정답 **{correct}문제** · 오답 **{incorrect}문제** · 정답률 **{accuracy}%**",
    note: "집계 범위는 현재 대화에 보관된 대화형 문제의 제출 답안입니다. 미제출 **{unanswered}문제**는 정답률에서 제외됩니다. 채점은 문제에 첨부된 정답을 따르며, 이번 결과는 종합적인 능력 평가가 아닙니다.",
  },
  es: {
    heading: "Resumen de la práctica",
    empty: "Todavía no hay respuestas enviadas para resumir. Responde y envía una pregunta primero. Las preguntas no enviadas no cuentan como incorrectas.",
    chartTitle: "Resultados de la práctica", unit: "preguntas", correct: "Correctas", incorrect: "Incorrectas",
    stats: "Enviadas: **{count}** · Correctas: **{correct}** · Incorrectas: **{incorrect}** · Aciertos: **{accuracy}%**",
    note: "Alcance: respuestas a ejercicios interactivos conservadas en esta conversación. Las **{unanswered}** preguntas no enviadas se excluyen del porcentaje de aciertos. La corrección sigue las respuestas proporcionadas; estos resultados no son una evaluación completa de la capacidad.",
  },
  de: {
    heading: "Zusammenfassung der Übungen",
    empty: "Es gibt noch keine abgegebenen Antworten. Beantworte zuerst eine Frage und gib sie ab. Nicht abgegebene Fragen zählen nicht als falsch.",
    chartTitle: "Übungsergebnisse", unit: "Fragen", correct: "Richtig", incorrect: "Falsch",
    stats: "Abgegeben: **{count}** · Richtig: **{correct}** · Falsch: **{incorrect}** · Trefferquote: **{accuracy}%**",
    note: "Grundlage: die in diesem Gespräch gespeicherten Antworten auf interaktive Aufgaben. **{unanswered}** nicht abgegebene Fragen sind von der Trefferquote ausgeschlossen. Die Bewertung folgt den mitgelieferten Lösungen; diese Ergebnisse sind keine umfassende Leistungsbewertung.",
  },
};
