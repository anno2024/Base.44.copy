export function parseFeedbackJson(raw, questionIds = []) {
  if (!raw) {
    return fallbackFeedback(questionIds);
  }

  try {
    const data = JSON.parse(raw);
    return normalizeFeedback(data, questionIds);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const data = JSON.parse(match[0]);
        return normalizeFeedback(data, questionIds);
      } catch {
        return fallbackFeedback(questionIds);
      }
    }
    return fallbackFeedback(questionIds);
  }
}

function normalizeFeedback(input, questionIds) {
  const strengths = Array.isArray(input?.strengths) ? input.strengths : [];
  const improvements = Array.isArray(input?.improvements)
    ? input.improvements
    : [];
  const nextSteps = Array.isArray(input?.next_steps) ? input.next_steps : [];
  const questionFeedbackRaw = Array.isArray(input?.question_feedback)
    ? input.question_feedback
    : [];

  const question_feedback = questionIds.map((id) => {
    const fromModel = questionFeedbackRaw.find(
      (item) => item?.question_id === id,
    );
    return {
      question_id: id,
      comment:
        fromModel?.comment ||
        "Svar mangler detaljerte begrunnelser. Bruk fagbegreper tydeligere.",
      score: Number.isFinite(Number(fromModel?.score))
        ? Math.max(0, Math.min(100, Number(fromModel.score)))
        : 65,
    };
  });

  return {
    overall_comment:
      input?.overall_comment ||
      "Leveransen viser innsats og relevante idéer, men kan styrkes med tydeligere faglig begrunnelse.",
    strengths,
    improvements,
    next_steps: nextSteps,
    question_feedback,
  };
}

export function fallbackFeedback(questionIds) {
  return {
    overall_comment:
      "Besvarelsen er et godt utgangspunkt, men trenger mer struktur og faglig presisjon.",
    strengths: [
      "Du besvarer sentrale deler av oppgaven.",
      "Du viser forståelse for temaet på et grunnleggende nivå.",
    ],
    improvements: [
      "Bruk mer presise fagbegreper.",
      "Knytt argumentene tettere til pensum eller kilder.",
    ],
    next_steps: [
      "Revider svaret med tydeligere struktur.",
      "Legg inn ett konkret eksempel per hovedpoeng.",
    ],
    question_feedback: questionIds.map((id) => ({
      question_id: id,
      comment: "Forklar sammenhengen mellom teori og svaret ditt tydeligere.",
      score: 65,
    })),
  };
}
