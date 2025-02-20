import * as deepl from 'deepl-node';

const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

export async function POST(request: Request) {
  try {
    const { text, target_lang } = await request.json();
    const translation = await translator.translateText(text, 'en', target_lang);
    return Response.json({ translation });
  } catch (error) {
    return Response.json({ error: 'Translation failed' }, { status: 500 });
  }
} 