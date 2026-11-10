import { Priority } from '../data';
import { Pill } from './Pill';
export function PriorityPill({ value }: { value: Priority }) {
  const tone = (
    { Alta: 'red', Media: 'blue', Baja: 'amber', Nula: 'gray', Pendiente: 'slate' } as Record<
      string,
      string
    >
  )[value];
  return (
    <Pill tone={tone}>
      <i className="pill-dot" />
      {value}
    </Pill>
  );
}
