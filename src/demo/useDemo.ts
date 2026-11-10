import { useMemo, useState } from 'react';
import { catalog, initialLeads, Lead, ProposalStatus } from '../data';

import { Page } from './types';
import { initialProposals } from './config';
export function useDemo() {
  const [leads, setLeads] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lp-leads') || 'null') || initialLeads;
    } catch {
      return initialLeads;
    }
  });
  const [page, setPage] = useState<Page>('overview');
  const [selected, setSelected] = useState('LP-2048');
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [planFilter, setPlanFilter] = useState('Todos');
  const [channelFilter, setChannelFilter] = useState('Todos los canales');
  const [statusFilter, setStatusFilter] = useState('Todos los estados');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [proposals, setProposals] = useState(initialProposals);
  const [chosenPlan, setChosenPlan] = useState('Meta UNT');
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('Borrador');
  const [period, setPeriod] = useState('Este mes');
  const [message, setMessage] = useState('');
  const [demoActive, setDemoActive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const lead = leads.find((x: Lead) => x.id === selected) || leads[0];
  const notify = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(''), 2800);
  };
  const update = (patch: Partial<Lead>) => {
    const next = leads.map((x: Lead) => (x.id === selected ? { ...x, ...patch } : x));
    setLeads(next);
    localStorage.setItem('lp-leads', JSON.stringify(next));
  };
  const openLead = (id: string) => {
    setSelected(id);
    setPage('leads');
  };
  const filtered = useMemo(
    () =>
      leads.filter(
        (l: Lead) =>
          `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(query.toLowerCase()) &&
          (priorityFilter === 'Todas' || l.priority === priorityFilter) &&
          (planFilter === 'Todos' || l.plan === planFilter) &&
          (channelFilter === 'Todos los canales' || l.channel === channelFilter) &&
          (statusFilter === 'Todos los estados' || l.status === statusFilter),
      ),
    [leads, query, priorityFilter, planFilter, channelFilter, statusFilter],
  );
  const simulate = (scenario: string) => {
    let text = '',
      patch: Partial<Lead> = {};
    if (scenario === 'medicina') {
      text = 'Quiero estudiar Medicina en la UNT.';
      patch = {
        career: 'Medicina',
        priority: 'Media',
        activity: 'Declaró interés en Medicina; perfil actualizado de forma demostrativa.',
      };
    } else if (scenario === 'precio') {
      text = '¿Cuánto cuesta el plan Meta UNT?';
      patch = {
        priority: 'Alta',
        activity: 'Consultó el precio de Meta UNT; señal comercial registrada.',
      };
    } else {
      text = 'Quisiera recibir una propuesta para empezar.';
      patch = { priority: 'Alta', activity: 'Solicitó una propuesta; señal comercial registrada.' };
    }
    const msgs = [
      ...lead.messages,
      { from: 'lead' as const, text, time: 'Ahora' },
      {
        from: 'agent' as const,
        text:
          scenario === 'medicina'
            ? 'Anoto Medicina como tu carrera objetivo. ¿Qué cursos te gustaría reforzar?'
            : scenario === 'precio'
              ? 'Meta UNT tiene un precio de referencia de S/ 79.90 mensuales o S/ 399.90 por seis meses.'
              : 'Puedo preparar una propuesta con las opciones autorizadas del catálogo.',
        time: 'Ahora',
      },
    ];
    update({ ...patch, messages: msgs });
    setDemoActive(true);
    notify('Escenario demostrativo ejecutado');
  };
  const sendMessage = () => {
    if (!message.trim()) return;
    update({
      messages: [
        ...lead.messages,
        { from: 'lead', text: message, time: 'Ahora' },
        {
          from: 'agent',
          text: 'Gracias por contármelo. Lo registro para tenerlo en cuenta en el seguimiento.',
          time: 'Ahora',
        },
      ],
      activity: 'Nueva interacción de demostración registrada.',
      priority: lead.priority === 'Pendiente' ? 'Media' : lead.priority,
    });
    setMessage('');
    notify('Mensaje simulado registrado');
  };
  const makeProposal = () => {
    const plan = catalog.find((x) => x.name === chosenPlan)!;
    const price = plan.monthly ? `S/ ${plan.monthly.toFixed(2)} / mes` : 'Gratis · 14 días';
    setProposals([
      {
        id: `P-${1043 + proposals.length}`,
        lead: selected,
        plan: chosenPlan,
        status: proposalStatus,
        date: '05 nov 2026',
        price,
      },
      ...proposals,
    ]);
    setModal('preview');
  };
  const title = (
    {
      overview: 'Centro de operaciones',
      leads: 'Gestión de LEADS',
      conversation: 'Agente negociador',
      proposals: 'Propuestas comerciales',
      priority: 'Prioridad de seguimiento',
      rules: 'Reglas y responsables',
      reports: 'Indicadores de LEADS',
    } as Record<Page, string>
  )[page];
  return {
    leads,
    setLeads,
    page,
    setPage,
    selected,
    setSelected,
    query,
    setQuery,
    priorityFilter,
    setPriorityFilter,
    planFilter,
    setPlanFilter,
    channelFilter,
    setChannelFilter,
    statusFilter,
    setStatusFilter,
    toast,
    modal,
    setModal,
    proposals,
    chosenPlan,
    setChosenPlan,
    proposalStatus,
    setProposalStatus,
    period,
    setPeriod,
    message,
    setMessage,
    demoActive,
    setDemoActive,
    showFilters,
    setShowFilters,
    lead,
    notify,
    update,
    openLead,
    filtered,
    simulate,
    sendMessage,
    makeProposal,
    title,
  };
}
