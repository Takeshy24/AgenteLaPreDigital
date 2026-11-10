export type Page =
  'overview' | 'leads' | 'conversation' | 'proposals' | 'priority' | 'rules' | 'reports';
export interface DemoProposal {
  id: string;
  lead: string;
  plan: string;
  status: import('../data').ProposalStatus;
  date: string;
  price: string;
}
