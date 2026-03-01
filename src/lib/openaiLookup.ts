import { CATEGORY_OPTIONS } from '@/lib/constants';

type Category = (typeof CATEGORY_OPTIONS)[number];

interface TargetDetection {
  canonicalName: string;
  category: Category;
  confidence: number;
  brandHints: string[];
  keyAttributes: string[];
  searchQuery: string;
}

interface OnlineLookup {
  displayName: string;
  heroImageUrl?: string;
  priceEstimate?: number;
  currency?: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag?: boolean;
}

export interface OpenAiLookupResult {
  displayName: string;
  heroImageUrl: string;
  capturedImageUrl: string;
  category: Category;
  priceEstimate: number;
  currency: string;
  supplierName?: string;
  supplierUrl?: string;
  uniqueFlag: boolean;
  confidence: number;
  canonicalName: string;
  brandHints: string[];
  keyAttributes: string[];
  alternates: string[];
}

interface ResponsesPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

function getOpenAiApiKey() {
  return import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
}

function normalizeCategory(input: string | undefined): Category {
  if (!input) return 'Other';
  const matched = CATEGORY_OPTIONS.find((entry) => entry.toLowerCase() === input.trim().toLowerCase());
  return matched ?? 'Other';
}

function parseJsonFromText<T>(raw: string): T | null {
  const trimmed = raw.trim();

  const direct = () => {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  };

  const maybeDirect = direct();
  if (maybeDirect) return maybeDirect;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      return null;
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      return null;
    }
  }

  return null;
}

function responseText(payload: ResponsesPayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  for (const entry of payload.output ?? []) {
    for (const content of entry.content ?? []) {
      if (content.type === 'output_text' || content.type === 'text') {
        if (typeof content.text === 'string') {
          chunks.push(content.text);
        }
      }
    }
  }
  return chunks.join('\n').trim();
}

async function callResponsesApi(body: Record<string, unknown>): Promise<ResponsesPayload> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI key missing. Set VITE_OPENAI_API_KEY (or OPENAI_API_KEY), then restart the dev server.',
    );
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as ResponsesPayload;
}

async function detectPrimaryTarget(imageDataUrl: string): Promise<TargetDetection> {
  const model = import.meta.env.VITE_OPENAI_VISION_MODEL || 'gpt-5.2';
  const payload = await callResponsesApi({
    model,
    temperature: 0.2,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              'Identify the single most prominent primary object in this image. Return strict JSON only with keys: canonicalName, category, confidence, brandHints, keyAttributes, searchQuery. ' +
              `category must be one of: ${CATEGORY_OPTIONS.join(', ')}.`,
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
          },
        ],
      },
    ],
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<TargetDetection>>(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI target detection response');
  }

  return {
    canonicalName: String(parsed.canonicalName ?? 'Curated Luxury Selection').slice(0, 120),
    category: normalizeCategory(parsed.category),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
    brandHints: Array.isArray(parsed.brandHints) ? parsed.brandHints.map((item) => String(item)) : [],
    keyAttributes: Array.isArray(parsed.keyAttributes) ? parsed.keyAttributes.map((item) => String(item)) : [],
    searchQuery: String(parsed.searchQuery ?? parsed.canonicalName ?? 'luxury product'),
  };
}

async function lookupOnline(target: TargetDetection): Promise<OnlineLookup> {
  const model = import.meta.env.VITE_OPENAI_SEARCH_MODEL || 'gpt-5.2';
  const payload = await callResponsesApi({
    model,
    temperature: 0.2,
    tools: [{ type: 'web_search_preview' }],
    input: `Use web search to find the best real-world product match for "${target.searchQuery}".
Return strict JSON only with keys:
displayName, heroImageUrl, priceEstimate, currency, supplierName, supplierUrl, uniqueFlag.
Rules:
- heroImageUrl must be a direct image URL when possible.
- supplierUrl should be the best canonical listing URL.
- priceEstimate should be a number in USD unless a different currency is clear.
- If unknown, use null values.`,
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<OnlineLookup>>(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI web lookup response');
  }

  return {
    displayName: parsed.displayName ? String(parsed.displayName) : target.canonicalName,
    heroImageUrl: parsed.heroImageUrl ? String(parsed.heroImageUrl) : undefined,
    priceEstimate:
      typeof parsed.priceEstimate === 'number' && Number.isFinite(parsed.priceEstimate)
        ? parsed.priceEstimate
        : undefined,
    currency: parsed.currency ? String(parsed.currency).toUpperCase() : 'USD',
    supplierName: parsed.supplierName ? String(parsed.supplierName) : undefined,
    supplierUrl: parsed.supplierUrl ? String(parsed.supplierUrl) : undefined,
    uniqueFlag: typeof parsed.uniqueFlag === 'boolean' ? parsed.uniqueFlag : undefined,
  };
}

function resolvedImageUrl(online: OnlineLookup, capturedImageUrl: string): string {
  const candidate = online.heroImageUrl;
  if (candidate && /^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  return capturedImageUrl;
}

function resolvedPrice(online: OnlineLookup): number {
  const value = online.priceEstimate;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return 2500;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to decode image payload'));
    image.src = dataUrl;
  });
}

async function optimizeDataUrlForVision(imageDataUrl: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return imageDataUrl;
  }

  if (imageDataUrl.length <= 4_800_000) {
    return imageDataUrl;
  }

  try {
    const image = await loadImage(imageDataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width === 0 || height === 0) {
      return imageDataUrl;
    }

    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      return imageDataUrl;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  } catch {
    return imageDataUrl;
  }
}

export async function analyzeWithOpenAi(imageDataUrl: string): Promise<OpenAiLookupResult> {
  const normalizedDataUrl = await optimizeDataUrlForVision(imageDataUrl);

  const target = await detectPrimaryTarget(normalizedDataUrl);
  const online = await lookupOnline(target);

  return {
    displayName: online.displayName || target.canonicalName,
    heroImageUrl: resolvedImageUrl(online, normalizedDataUrl),
    capturedImageUrl: normalizedDataUrl,
    category: target.category,
    priceEstimate: resolvedPrice(online),
    currency: online.currency || 'USD',
    supplierName: online.supplierName,
    supplierUrl: online.supplierUrl,
    uniqueFlag: online.uniqueFlag ?? false,
    confidence: target.confidence,
    canonicalName: target.canonicalName,
    brandHints: target.brandHints,
    keyAttributes: target.keyAttributes,
    alternates: [],
  };
}
