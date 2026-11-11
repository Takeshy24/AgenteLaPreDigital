// Convierte los registros del OLTP en filas de análisis, una por unidad de conteo del informe
// (secciones 3.3, 3.4 y 4.5). Son reglas puras: reciben datos y la hora actual, no consultan nada.
// Todas las fechas del OLTP están en hora de Lima, sin zona; se leen con su desfase de -05:00.
export const WINDOW_HOURS = 168;
const HOUR = 3600000;

export const toMs = (value) => (value ? Date.parse(String(value) + '-05:00') : null);
const addWindow = (value) => toMs(value) + WINDOW_HOURS * HOUR;
const month = (value) => String(value).slice(0, 7);
const within = (at, from) =>
  at != null && from != null && at >= from && at <= from + WINDOW_HOURS * HOUR;

// L-1: una fila por participación LEAD–caso con seguimiento autorizado iniciado (M1).
export function initialContactRows({ participations, attempts, incoming }, now) {
  const attemptsOf = new Map();
  for (const attempt of attempts) {
    if (!attemptsOf.has(attempt.id)) attemptsOf.set(attempt.id, []);
    attemptsOf.get(attempt.id).push(attempt);
  }
  return participations.map((participation) => {
    const own = (attemptsOf.get(participation.id) ?? []).sort((a, b) => a.n - b.n);
    const start = toMs(participation.startAt);
    const sent = own.filter((attempt) => attempt.channel != null);
    const delivered = own.filter((attempt) => attempt.state === 2 && attempt.deliveredAt);
    const firstDelivery = delivered.length
      ? Math.min(...delivered.map((attempt) => toMs(attempt.deliveredAt)))
      : null;
    const m2 = within(firstDelivery, start);
    const replies = incoming.filter(
      (message) =>
        message.id === participation.id ||
        (message.id == null && message.contactId === participation.contactId),
    );
    const m3 =
      m2 &&
      replies.some(
        (message) => toMs(message.at) > firstDelivery && within(toMs(message.at), firstDelivery),
      );
    const windowOpen = now < start + WINDOW_HOURS * HOUR;
    let coverageReason = null;
    if (!m2) {
      if (firstDelivery != null) coverageReason = 'Entregado fuera de la ventana de 7 días';
      else if (sent.some((attempt) => attempt.state === 3))
        coverageReason = 'Entrega fallida en el canal';
      else if (sent.some((attempt) => attempt.state === 1))
        coverageReason = 'Envío pendiente de confirmación del canal';
      else if (!own.length) coverageReason = 'Sin agenda programada';
      else if (own.some((attempt) => attempt.omitted))
        coverageReason = 'Intento omitido por las reglas de envío';
      else coverageReason = windowOpen ? 'Ventana aún abierta' : 'Sin mensaje de la agenda enviado';
      if (windowOpen && coverageReason !== 'Ventana aún abierta')
        coverageReason += ' (ventana abierta)';
    }
    const replyEnd = firstDelivery != null ? firstDelivery + WINDOW_HOURS * HOUR : null;
    return {
      unitKey: String(participation.id),
      unitLabel: `Participación #${participation.id}`,
      originAt: participation.startAt,
      contactId: participation.contactId,
      contactName: participation.contactName,
      role: participation.role,
      channel: sent.length ? sent[0].channel : 0,
      flags: { m1: true, m2, m3 },
      windowEnd: { 'L-1.1': start + WINDOW_HOURS * HOUR, 'L-1.2': replyEnd },
      reasons: {
        'L-1.1': coverageReason,
        'L-1.2':
          m2 && !m3 ? (now < replyEnd ? 'Ventana aún abierta' : 'Sin respuesta en 7 días') : null,
      },
    };
  });
}

// L-2: una fila por contacto y mes con alguna pregunta de perfil entregada (M4).
export function profileRows({ questions, changes }, now) {
  const groups = new Map();
  for (const question of questions) {
    const key = `${question.contactId}|${month(question.deliveredAt)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(question);
  }
  return [...groups.entries()].map(([key, list]) => {
    list.sort((a, b) => toMs(a.deliveredAt) - toMs(b.deliveredAt));
    const first = list[0];
    const answered = list.some((question) =>
      changes.some(
        (change) =>
          change.contactId === question.contactId &&
          [1, 2].includes(change.type) &&
          change.operator == null &&
          within(toMs(change.at), toMs(question.deliveredAt)),
      ),
    );
    const end = Math.max(...list.map((question) => addWindow(question.deliveredAt)));
    return {
      unitKey: key,
      unitLabel: `${first.contactName} · ${month(first.deliveredAt)}`,
      originAt: first.deliveredAt,
      contactId: first.contactId,
      contactName: first.contactName,
      role: first.role,
      channel: first.channel,
      flags: { m4: true, m5: answered },
      windowEnd: { 'L-2.1': end },
      reasons: {
        'L-2.1': answered ? null : now < end ? 'Ventana aún abierta' : 'Sin dato nuevo en 7 días',
      },
    };
  });
}

// L-3: una fila por caso y mes con una necesidad nueva de vinculación (M6).
// Una necesidad es nueva cuando las anteriores del caso ya estaban satisfechas.
export function linkingRows({ needs, invitations }, now) {
  const achievedAt = (invitation) => {
    const dates = [invitation.linkedAt, invitation.linkAuthAt, invitation.contactAuthAt].map(toMs);
    return dates.some((date) => date == null) ? null : Math.max(...dates);
  };
  const byCase = new Map();
  for (const need of needs) {
    if (!byCase.has(need.caseId)) byCase.set(need.caseId, []);
    byCase.get(need.caseId).push(need);
  }
  const rows = [];
  for (const [caseId, list] of byCase) {
    list.sort((a, b) => toMs(a.at) - toMs(b.at) || a.id - b.id);
    const ids = new Set(list.map((need) => need.id));
    const own = invitations.filter((invitation) => ids.has(invitation.needId));
    const achievements = own.map(achievedAt).filter((date) => date != null);
    // La necesidad se satisface con el primer vínculo logrado desde que se registró.
    const satisfiedAt = (need) => {
      const later = achievements.filter((date) => date >= toMs(need.at));
      return later.length ? Math.min(...later) : null;
    };
    const seen = new Set();
    list.forEach((need, index) => {
      const fresh = list.slice(0, index).every((before) => {
        const when = satisfiedAt(before);
        return when != null && when <= toMs(need.at);
      });
      const key = `${caseId}|${month(need.at)}`;
      if (!fresh || seen.has(key)) return;
      seen.add(key);
      const when = satisfiedAt(need);
      const end = addWindow(need.at);
      const done = when != null && when <= end;
      let reason = null;
      if (!done) {
        if (now < end) reason = 'Ventana aún abierta';
        else if (!own.length) reason = 'Sin invitación al responsable';
        else if (when != null) reason = 'Vinculado después de 7 días';
        else reason = 'Invitación sin vincular o sin las dos autorizaciones';
      }
      rows.push({
        unitKey: key,
        unitLabel: `Caso #${caseId} · ${month(need.at)}`,
        originAt: need.at,
        contactId: need.contactId,
        contactName: need.contactName,
        role: need.role,
        channel: need.channel ?? 0,
        flags: { m6: true, m7: done },
        windowEnd: { 'L-3.1': end },
        reasons: { 'L-3.1': reason },
      });
    });
  }
  return rows;
}

// L-4: una fila por propuesta entregada; el caso se cuenta una vez por mes (unitKey).
export function proposalRows({ proposals }, now) {
  return proposals.map((proposal) => {
    const end = addWindow(proposal.deliveredAt);
    const acceptedAt = toMs(proposal.acceptedAt);
    const accepted = proposal.result === 1 && !!proposal.accepted;
    const inWindow = accepted && within(acceptedAt, toMs(proposal.deliveredAt));
    let reason = null;
    if (!inWindow) {
      if (proposal.result === 2) reason = 'Rechazada';
      else if (accepted) reason = 'Aceptada después de 7 días';
      else reason = now < end ? 'Ventana aún abierta' : 'Sin respuesta';
    }
    return {
      unitKey: `${proposal.caseId}|${month(proposal.deliveredAt)}`,
      unitLabel: `Caso #${proposal.caseId} · ${month(proposal.deliveredAt)}`,
      originAt: proposal.deliveredAt,
      contactId: null,
      contactName: null,
      role: null,
      channel: proposal.channel,
      plan: proposal.planId,
      flags: { m8: true, m9: inWindow },
      windowEnd: { 'L-4.1': end },
      reasons: { 'L-4.1': reason },
    };
  });
}

// L-5: una fila por caso con prioridad Alta (M10). La referencia es la evaluación más antigua.
export function conversionRows({ highs, cases, contracts, refunds }, now) {
  const first = new Map();
  for (const high of highs) {
    const current = first.get(high.caseId);
    if (
      !current ||
      toMs(high.at) < toMs(current.at) ||
      (toMs(high.at) === toMs(current.at) && high.id < current.id)
    )
      first.set(high.caseId, high);
  }
  const rows = [];
  let excluded = 0;
  for (const [caseId, high] of first) {
    const end = addWindow(high.at);
    const closed = cases.find((item) => item.caseId === caseId);
    if (closed?.reason === 2 && closed.closedAt && toMs(closed.closedAt) <= end) {
      excluded++;
      continue;
    }
    const contract = contracts.find((item) => item.caseId === caseId);
    const paid =
      contract?.paidAt && contract.amount > 0 && within(toMs(contract.paidAt), toMs(high.at));
    const validated = contract?.validatedAt && within(toMs(contract.validatedAt), toMs(high.at));
    const refunded = refunds.some((refund) => refund.caseId === caseId && toMs(refund.at) <= end);
    const done = !!(paid && validated && !refunded);
    let reason = null;
    if (!done) {
      if (now < end) reason = 'Ventana aún abierta';
      else if (!contract) reason = 'Sin contratación';
      else if (!paid) reason = 'Sin pago confirmado en 7 días';
      else if (!validated) reason = 'Pago sin validación contractual a tiempo';
      else reason = 'Contratación invalidada por reembolso';
    }
    rows.push({
      unitKey: String(caseId),
      unitLabel: `Caso #${caseId}`,
      originAt: high.at,
      contactId: high.contactId,
      contactName: high.contactName,
      role: high.role,
      channel: null,
      priority: 2,
      flags: { m10: true, m11: done },
      windowEnd: { 'L-5.1': end },
      reasons: { 'L-5.1': reason },
    });
  }
  return { rows, excluded };
}
