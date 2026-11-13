import { transaction, close } from '../server/db.mjs';
import { requireKnowledge } from '../server/knowledge/service.mjs';
import { add, findSource, index } from '../server/knowledge/repository.mjs';
import { splitContent } from '../server/knowledge/search.mjs';
import { initialDocuments } from '../server/knowledge/initial.mjs';
import { publicTariffs } from '../server/public/repository.mjs';
try {
  let added = 0;
  await transaction(async (db) => {
    await requireKnowledge(db);
    for (const item of initialDocuments(await publicTariffs(db))) {
      if (await findSource(db, item.key)) continue;
      const id = await add(db, {
        title: item.title,
        content: item.content,
        keywords: item.keywords,
        source: item.source,
        active: true,
        fileName: null,
        format: 'md',
        fileHex: null,
        sourceKey: item.key,
      });
      await index(db, id, splitContent(item.content));
      added++;
    }
  });
  console.log(`${added} documentos iniciales importados. Los ya existentes se conservaron.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
