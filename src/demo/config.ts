import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  Plus,
  Target,
  Users,
} from 'lucide-react';

import { ProposalStatus } from '../data';

export const navGroups = [
  {
    title: 'OPERACIONES',
    items: [
      ['overview', 'Inicio', LayoutDashboard],
      ['leads', 'LEADS', Users],
      ['conversation', 'Agente negociador', MessageCircle],
      ['proposals', 'Propuestas', BookOpen],
    ],
  },
  {
    title: 'INTELIGENCIA',
    items: [
      ['priority', 'Prioridades', Target],
      ['rules', 'Reglas y seguimiento', CalendarDays],
      ['reports', 'Indicadores', BarChart3],
    ],
  },
] as const;
export const initialProposals = [
  {
    id: 'P-1042',
    lead: 'LP-2045',
    plan: 'Meta UNT Plus',
    status: 'Aceptada' as ProposalStatus,
    date: '04 nov 2026',
    price: 'S/ 99.90 / mes',
  },
  {
    id: 'P-1041',
    lead: 'LP-2048',
    plan: 'Meta UNT',
    status: 'Borrador' as ProposalStatus,
    date: '05 nov 2026',
    price: 'S/ 79.90 / mes',
  },
  {
    id: 'P-1038',
    lead: 'LP-2047',
    plan: 'Ruta UNT',
    status: 'Entregada' as ProposalStatus,
    date: '03 nov 2026',
    price: 'S/ 39.90 / mes',
  },
];
