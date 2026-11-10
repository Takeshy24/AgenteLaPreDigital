import { ProposalStatus } from '../data';
import { Pill } from './Pill';
export function ProposalPill({ value }: { value: ProposalStatus }) {
  const tone = (
    {
      Borrador: 'slate',
      Preparada: 'blue',
      Entregada: 'violet',
      Aceptada: 'green',
      Rechazada: 'gray',
      'Pendiente de respuesta': 'amber',
    } as Record<string, string>
  )[value];
  return <Pill tone={tone}>{value}</Pill>;
}
