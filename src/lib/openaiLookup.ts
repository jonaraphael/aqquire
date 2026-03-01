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
  heroImageAlternates?: string[];
  heroImageSource?: string;
  heroImageQuality?: string;
  priceEstimate?: number;
  currency?: string;
  supplierName?: string;
  supplierUrl?: string;
  priceSourceUrl?: string;
  purchasable?: boolean;
  priceConfidence?: number;
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

type ReasoningEffort = 'low' | 'medium' | 'high';

function getOpenAiApiKey() {
  return import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
}

function normalizeReasoningEffort(input: string | undefined, fallback: ReasoningEffort): ReasoningEffort {
  const value = (input ?? '').trim().toLowerCase();
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return fallback;
}

function normalizeCategory(input: string | undefined): Category {
  if (!input) return 'Other';
  const matched = CATEGORY_OPTIONS.find((entry) => entry.toLowerCase() === input.trim().toLowerCase());
  return matched ?? 'Other';
}

function normalizeCurrencyCode(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const code = input.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  return undefined;
}

function normalizeWebUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) return undefined;

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function normalizePriceValue(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return input;
  }

  if (typeof input === 'string') {
    const cleaned = input.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
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

  const request = async (payload: Record<string, unknown>) =>
    fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

  const response = await request(body);

  if (response.ok) {
    return (await response.json()) as ResponsesPayload;
  }

  const detail = await response.text();
  const reasoningRejected =
    typeof body.reasoning !== 'undefined' &&
    /reasoning/i.test(detail) &&
    /(unknown|invalid|unsupported)/i.test(detail);

  if (reasoningRejected) {
    const retryBody = { ...body };
    delete retryBody.reasoning;

    const retry = await request(retryBody);
    if (retry.ok) {
      return (await retry.json()) as ResponsesPayload;
    }
    const retryDetail = await retry.text();
    throw new Error(`OpenAI request failed (${retry.status}) after reasoning fallback: ${retryDetail}`);
  }

  throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
}

async function detectPrimaryTarget(imageDataUrl: string): Promise<TargetDetection> {
  const model = import.meta.env.VITE_OPENAI_VISION_MODEL || 'gpt-5.2';
  const reasoningEffort = normalizeReasoningEffort(import.meta.env.VITE_OPENAI_VISION_REASONING_EFFORT, 'high');
  const payload = await callResponsesApi({
    model,
    reasoning: { effort: reasoningEffort },
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              'Identify the single most prominent primary purchasable object in this image. Ignore people, background, and packaging unless packaging is clearly the product itself. ' +
              'Reason carefully about shape, materials, logo cues, and scale before deciding. Return strict JSON only with keys: canonicalName, category, confidence, brandHints, keyAttributes, searchQuery. ' +
              `category must be one of: ${CATEGORY_OPTIONS.join(', ')}.`,
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
            detail: 'high',
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
  const reasoningEffort = normalizeReasoningEffort(import.meta.env.VITE_OPENAI_SEARCH_REASONING_EFFORT, 'medium');
  const payload = await callResponsesApi({
    model,
    reasoning: { effort: reasoningEffort },
    tools: [{ type: 'web_search_preview' }],
    input: `Use web search to find the best real-world product match for "${target.searchQuery}".
Return strict JSON only with keys:
displayName, heroImageUrl, heroImageAlternates, heroImageSource, heroImageQuality, priceEstimate, currency, supplierName, supplierUrl, priceSourceUrl, purchasable, priceConfidence, uniqueFlag.
Rules:
- heroImageUrl must be a direct URL to a premium marketing image and should not be a thumbnail.
- Prefer official manufacturer source materials first (brand product page image/CDN, brand press kit, lookbook).
- If manufacturer assets are unavailable, use an authorized luxury retailer listing image.
- Favor high resolution images (ideally >= 1600px longest side, studio quality, clean background).
- Avoid social media screenshots, user-generated images, watermarks, collage graphics, or low-resolution previews.
- heroImageAlternates should include up to 3 additional direct image URLs ranked by quality.
- heroImageSource should be "manufacturer", "authorized_retailer", or "other".
- heroImageQuality should be "high", "medium", or "low".
- supplierUrl must be a direct listing/product detail page for this exact item (not editorial/search/category pages).
- For category "Automobiles", supplierUrl may be a dealer inventory page or manufacturer build/order page for the same model/trim.
- priceEstimate must be the currently listed purchase price on supplierUrl.
- priceSourceUrl must be the exact URL where priceEstimate was read (usually same as supplierUrl).
- purchasable must be true when the page clearly supports purchasing flow:
  add-to-cart/buy flow for standard commerce, or
  dealer/order/reservation inquiry flow for automobiles.
- priceConfidence is 0-1 confidence that the price is exact and current.
- If no purchasable page with visible price can be found, return supplierUrl: null, priceEstimate: null, purchasable: false.
- If unknown, use null values but still return best available non-null heroImageUrl when possible.`,
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<OnlineLookup>>(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI web lookup response');
  }

  return {
    displayName: parsed.displayName ? String(parsed.displayName) : target.canonicalName,
    heroImageUrl: parsed.heroImageUrl ? String(parsed.heroImageUrl) : undefined,
    heroImageAlternates: Array.isArray(parsed.heroImageAlternates)
      ? parsed.heroImageAlternates.map((item) => String(item))
      : undefined,
    heroImageSource: parsed.heroImageSource ? String(parsed.heroImageSource) : undefined,
    heroImageQuality: parsed.heroImageQuality ? String(parsed.heroImageQuality) : undefined,
    priceEstimate: normalizePriceValue(parsed.priceEstimate),
    currency: normalizeCurrencyCode(parsed.currency ? String(parsed.currency) : undefined) ?? 'USD',
    supplierName: parsed.supplierName ? String(parsed.supplierName) : undefined,
    supplierUrl: normalizeWebUrl(parsed.supplierUrl ? String(parsed.supplierUrl) : undefined),
    priceSourceUrl: normalizeWebUrl(parsed.priceSourceUrl ? String(parsed.priceSourceUrl) : undefined),
    purchasable: typeof parsed.purchasable === 'boolean' ? parsed.purchasable : undefined,
    priceConfidence:
      typeof parsed.priceConfidence === 'number' && Number.isFinite(parsed.priceConfidence)
        ? Math.max(0, Math.min(1, parsed.priceConfidence))
        : undefined,
    uniqueFlag: typeof parsed.uniqueFlag === 'boolean' ? parsed.uniqueFlag : undefined,
  };
}

async function validatePurchaseOffer(target: TargetDetection, online: OnlineLookup): Promise<OnlineLookup> {
  const candidateUrl = normalizeWebUrl(online.priceSourceUrl || online.supplierUrl);
  const model = import.meta.env.VITE_OPENAI_SEARCH_MODEL || 'gpt-5.2';
  const reasoningEffort = normalizeReasoningEffort(import.meta.env.VITE_OPENAI_SEARCH_REASONING_EFFORT, 'high');

  const payload = await callResponsesApi({
    model,
    reasoning: { effort: reasoningEffort },
    tools: [{ type: 'web_search_preview' }],
    input: `Validate or replace this purchasable listing for the item below.
Item:
- canonicalName: "${target.canonicalName}"
- category: "${target.category}"
- searchQuery: "${target.searchQuery}"
Candidate listing:
- supplierName: "${online.supplierName ?? ''}"
- supplierUrl: "${candidateUrl ?? ''}"
- candidatePrice: ${typeof online.priceEstimate === 'number' ? online.priceEstimate : 'null'}

Return strict JSON only with keys:
supplierName, supplierUrl, priceEstimate, currency, priceSourceUrl, purchasable, priceConfidence.

Rules:
- supplierUrl must be a direct product page where this exact item can be purchased now.
- For category "Automobiles", supplierUrl may be a dealer inventory page or manufacturer order/reservation page.
- priceEstimate must exactly match the currently listed purchase price shown on priceSourceUrl.
- If candidate listing is invalid, not purchasable, mismatched, or has no visible price, find a better purchasable listing.
- Prefer official brand stores or authorized retailers.
- If no valid purchasable listing with visible price exists, return supplierUrl: null, priceEstimate: null, purchasable: false.
- currency must be a 3-letter ISO code.
- priceConfidence must be 0-1 and reflect confidence in exactness/currentness.`,
  });

  const text = responseText(payload);
  const parsed = parseJsonFromText<Partial<OnlineLookup>>(text);
  if (!parsed) {
    return online;
  }

  const hasSupplierUrl = Object.prototype.hasOwnProperty.call(parsed, 'supplierUrl');
  const hasPriceSourceUrl = Object.prototype.hasOwnProperty.call(parsed, 'priceSourceUrl');
  const hasPriceEstimate = Object.prototype.hasOwnProperty.call(parsed, 'priceEstimate');
  const hasCurrency = Object.prototype.hasOwnProperty.call(parsed, 'currency');
  const hasPurchasable = Object.prototype.hasOwnProperty.call(parsed, 'purchasable');
  const hasPriceConfidence = Object.prototype.hasOwnProperty.call(parsed, 'priceConfidence');

  return {
    ...online,
    supplierName: parsed.supplierName ? String(parsed.supplierName) : online.supplierName,
    supplierUrl: hasSupplierUrl
      ? normalizeWebUrl(parsed.supplierUrl ? String(parsed.supplierUrl) : undefined)
      : online.supplierUrl,
    priceSourceUrl: hasPriceSourceUrl
      ? normalizeWebUrl(parsed.priceSourceUrl ? String(parsed.priceSourceUrl) : undefined)
      : online.priceSourceUrl ?? online.supplierUrl,
    priceEstimate: hasPriceEstimate ? normalizePriceValue(parsed.priceEstimate) : online.priceEstimate,
    currency: hasCurrency
      ? normalizeCurrencyCode(parsed.currency ? String(parsed.currency) : undefined)
      : online.currency,
    purchasable: hasPurchasable
      ? typeof parsed.purchasable === 'boolean'
        ? parsed.purchasable
        : undefined
      : online.purchasable,
    priceConfidence: hasPriceConfidence
      ? typeof parsed.priceConfidence === 'number' && Number.isFinite(parsed.priceConfidence)
        ? Math.max(0, Math.min(1, parsed.priceConfidence))
        : undefined
      : online.priceConfidence,
  };
}

function normalizeImageUrl(candidate: string | undefined): string | null {
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) return null;

  try {
    const url = new URL(candidate);
    const widthParam = url.searchParams.get('w') ?? url.searchParams.get('width');
    const heightParam = url.searchParams.get('h') ?? url.searchParams.get('height');

    if (widthParam && Number(widthParam) > 0 && Number(widthParam) < 1600) {
      url.searchParams.set(url.searchParams.has('w') ? 'w' : 'width', '2200');
    }
    if (heightParam && Number(heightParam) > 0 && Number(heightParam) < 1600) {
      url.searchParams.set(url.searchParams.has('h') ? 'h' : 'height', '2200');
    }
    if (url.searchParams.has('q')) {
      url.searchParams.set('q', '90');
    }
    return url.toString();
  } catch {
    return candidate;
  }
}

function chooseMarketingImageUrl(online: OnlineLookup): string | null {
  const candidates = [online.heroImageUrl, ...(online.heroImageAlternates ?? [])]
    .map((item) => normalizeImageUrl(item))
    .filter((item): item is string => !!item);

  if (candidates.length === 0) return null;

  const preferred = candidates.find((url) => !/thumb|thumbnail|small|icon/i.test(url));
  return preferred ?? candidates[0];
}

function resolvedImageUrl(online: OnlineLookup, capturedImageUrl: string): string {
  const candidate = chooseMarketingImageUrl(online);
  if (candidate) {
    return candidate;
  }
  return capturedImageUrl;
}

function requirePurchasableOffer(online: OnlineLookup) {
  const supplierUrl = normalizeWebUrl(online.priceSourceUrl || online.supplierUrl);
  const priceEstimate = typeof online.priceEstimate === 'number' && Number.isFinite(online.priceEstimate) ? online.priceEstimate : null;

  if (!supplierUrl || priceEstimate === null || priceEstimate <= 0) {
    throw new Error('Unable to verify a purchasable listing with a reliable current price. Try another capture.');
  }

  return {
    supplierUrl,
    priceEstimate: Math.round(priceEstimate),
  };
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
  const initialOnline = await lookupOnline(target);
  const online = await validatePurchaseOffer(target, initialOnline).catch(() => initialOnline);
  const purchasableOffer = requirePurchasableOffer(online);

  return {
    displayName: online.displayName || target.canonicalName,
    heroImageUrl: resolvedImageUrl(online, normalizedDataUrl),
    capturedImageUrl: normalizedDataUrl,
    category: target.category,
    priceEstimate: purchasableOffer.priceEstimate,
    currency: online.currency || 'USD',
    supplierName: online.supplierName,
    supplierUrl: purchasableOffer.supplierUrl,
    uniqueFlag: online.uniqueFlag ?? false,
    confidence: target.confidence,
    canonicalName: target.canonicalName,
    brandHints: target.brandHints,
    keyAttributes: target.keyAttributes,
    alternates: [],
  };
}
