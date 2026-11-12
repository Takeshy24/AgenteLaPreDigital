import { dataMartConfig, readDataMart } from '../datamart/service.mjs';
import * as facts from './datamart-rows.mjs';
import * as repository from './repository.mjs';
import { computeKpi, GRAINS, KPI_DEFINITIONS, matchesFilters } from './rules.mjs';

const limaNow = (now) => new Date(now - 5 * 3600000).toISOString().slice(0, 19);

export async function getKpis(filters, { now = Date.now() } = {}) {
  return readDataMart(async (db) => {
    const [initial, profile, linking, proposal, conversion, plans, contacts, channels, roles] =
      await Promise.all([
        repository.listInitial(db),
        repository.listProfile(db),
        repository.listLinking(db),
        repository.listProposals(db),
        repository.listConversion(db),
        repository.listPlans(db),
        repository.listContacts(db),
        repository.listChannels(db),
        repository.listRoles(db),
      ]);
    const rows = {
      initial: facts.initialRows(initial, now),
      profile: facts.profileRows(profile, now),
      linking: facts.linkingRows(linking, now),
      proposal: facts.proposalRows(proposal, now),
      conversion: facts.conversionRows(conversion, now),
    };
    const channelOptions = [{ id: 0, name: 'Sin canal' }, ...channels];
    const names = (items) => Object.fromEntries(items.map((item) => [item.id, item.name]));
    const kpis = KPI_DEFINITIONS.map((definition) => {
      const excluded =
        definition.id === 'L-5.1'
          ? rows.conversion.filter(
              (row) => !row.flags.m10 && matchesFilters(row, filters, definition.dimensions),
            ).length
          : 0;
      return computeKpi(definition, rows[definition.rows], filters, now, {
        planNames: names(plans),
        channelNames: names(channelOptions),
        roleNames: names(roles),
        note: excluded
          ? `${excluded} caso${excluded === 1 ? '' : 's'} cerrado${excluded === 1 ? '' : 's'} por beca completa dentro de la ventana se excluye${excluded === 1 ? '' : 'n'} de M10, como indica el informe.`
          : null,
      });
    });
    return {
      source: dataMartConfig().database,
      generatedAt: limaNow(now),
      filters,
      kpis,
      options: { grains: GRAINS, contacts, plans, channels: channelOptions, roles },
    };
  });
}
