process.once('message', async (workerData) => {
  try {
    const bytes = Buffer.from(workerData.bytes);
    let content;
    if (workerData.format === 'docx') {
      const { default: mammoth } = await import('mammoth');
      content = (await mammoth.extractRawText({ buffer: bytes })).value;
    } else if (workerData.format === 'pdf') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const info = await parser.getInfo();
        if (info.total > 200) throw new Error('Máximo 200 páginas por PDF.');
        content = (await parser.getText({ pageJoiner: '\n\n' })).text;
      } finally {
        await parser.destroy();
      }
    } else {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    process.send({ content });
  } catch (error) {
    process.send({ error: error.message });
  }
});
