import { pool } from '../db.mjs';
import * as cohorts from './cohorts.mjs';
import * as repository from './repository.mjs';
import { CHANNEL_NAMES, computeKpi, GRAINS, KPI_DEFINITIONS, ROLE_NAMES } from './rules.mjs';

const limaNow = (now) => new Date(now - 5 * 3600000).toISOString().slice(0, 19);

async function loadRows(db, now) {
  const [participations, attempts, incoming] = await Promise.all([
    repository.listParticipations(db),
    repository.listAttempts(db),
    repository.listIncoming(db),
  ]);
  const [questions, changes, needs, invitations] = await Promise.all([
    repository.listQuestions(db),
    repository.listProfileChanges(db),
    repository.listNeeds(db),
    repository.listInvitations(db),
  ]);
  const [proposals, highs, cases, contracts, refunds] = await Promise.all([
    repository.listProposals(db),
    repository.listHighPriorities(db),
    repository.listCases(db),
    repository.listContracts(db),
    repository.listRefunds(db),
  ]);
  const conversion = cohorts.conversionRows({ highs, cases, contracts, refunds }, now);
  return {
    initial: cohorts.initialContactRows({ participations, attempts, incoming }, now),
    profile: cohorts.profileRows({ questions, changes }, now),
    linking: cohorts.linkingRows({ needs, invitations }, now),
    proposal: cohorts.proposalRows({ proposals }, now),
    conversion: conversion.rows,
    excluded: conversion.excluded,
  };
}

export async function getKpis(filters, { now = Date.now() } = {}) {
  const db = await pool();
  const rows = await loadRows(db, now);
  const [plans, contacts] = await Promise.all([
    repository.listPlans(db),
    repository.listContacts(db),
  ]);
  const planNames = Object.fromEntries(plans.map((plan) => [plan.id, plan.name]));
  const kpis = KPI_DEFINITIONS.map((definition) =>
    computeKpi(definition, rows[definition.rows], filters, now, {
      planNames,
      note:
        definition.id === 'L-5.1' && rows.excluded
          ? `${rows.excluded} caso${rows.excluded === 1 ? '' : 's'} cerrado${rows.excluded === 1 ? '' : 's'} por beca completa dentro de la ventana se excluye${rows.excluded === 1 ? '' : 'n'} de M10, como indica el informe.`
          : null,
    }),
  );
  return {
    generatedAt: limaNow(now),
    filters,
    kpis,
    options: {
      grains: GRAINS,
      contacts,
      plans,
      channels: Object.entries(CHANNEL_NAMES).map(([id, name]) => ({ id: Number(id), name })),
      roles: Object.entries(ROLE_NAMES).map(([id, name]) => ({ id: Number(id), name })),
    },
  };
}
