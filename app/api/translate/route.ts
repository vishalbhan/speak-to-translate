import * as deepl from 'deepl-node';

const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

interface TranslationError extends Error {
  message: string;
}

export async function POST(request: Request) {
  try {
    const { text, target_lang } = await request.json();
    const translation = await translator.translateText(text, 'en', target_lang);
    return Response.json({ translation });
  } catch (error: unknown) {
    console.error('Translation error:', error);
    return Response.json({ 
      error: 'Translation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 