import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCache, setCache } from '../../utils/cache';
import { vectorSearch } from './repository';
import {
  buildFilterRelaxationLadder,
  describeFilterSql,
  finalizeParsedFilters,
  hasStructuredFilters,
  type ParsedFilters,
  type SearchMatchMode,
} from './filters';
import {
  getTargetPriceEtb,
  hasAnyPriceFilter,
  hasExplicitPriceConstraint,
} from './intent';
import {
  buildQueryParserUserPrompt,
  QUERY_PARSER_SYSTEM_PROMPT,
} from './queryParser.prompt';
import {
  mergeParsedFilters,
  parseQueryLocally,
  sanitizeParsedFilters,
} from './queryParser';
import { getEtbPerUsd, normalizeDisplayCurrency, type SupportedCurrency } from './currency';
import { formatSearchProperty } from './formatSearchProperty';

const EMBEDDING_DIMENSION = 384;
const SEARCH_CACHE_VERSION = 'v2';

let genAI: GoogleGenerativeAI | null = null;
function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function isGeminiQuotaError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  return status === 429 || /quota|rate.?limit|too many requests/i.test(message);
}

function emptyFilters(keywords: string[], confidence: number, currency: SupportedCurrency): ParsedFilters {
  return {
    location: null,
    bedrooms: null,
    minPrice: null,
    maxPrice: null,
    priceCurrency: 'ETB',
    currency,
    amenities: [],
    propertyType: null,
    keywords,
    confidence,
    hardPriceConstraint: false,
  };
}

export async function parseQuery(
  query: string,
  displayCurrency: SupportedCurrency = 'ETB',
): Promise<ParsedFilters> {
  const local = parseQueryLocally(query, displayCurrency);
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    console.warn('⚠ GEMINI_API_KEY is not configured. Using local query parser.');
    return local;
  }

  try {
    const ai = getGeminiClient(apiKey);
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${QUERY_PARSER_SYSTEM_PROMPT}\n\n${buildQueryParserUserPrompt(query)}`,
            },
          ],
        },
      ],
    });

    const text = result.response.text();
    const gemini = sanitizeParsedFilters(
      JSON.parse(text || '{}') as Partial<ParsedFilters>,
      query,
      displayCurrency,
    );
    return mergeParsedFilters(gemini, local, query, displayCurrency);
  } catch (err) {
    if (isGeminiQuotaError(err)) {
      console.warn('⚠ Gemini quota exceeded. Using local query parser for this request.');
    } else {
      console.warn('⚠ Gemini query parse failed. Using local query parser.');
    }
    return local;
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  const url = process.env.EMBEDDING_URL || 'http://localhost:8000';
  try {
    const response = await fetch(`${url}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Embedding service responded with status ${response.status}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    if (!data.embedding || data.embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Invalid embedding returned: expected dimension ${EMBEDDING_DIMENSION}`);
    }

    return data.embedding;
  } catch (err) {
    console.error('Error generating vector embedding:', err);
    throw err;
  }
}

export async function searchProperties(
  query: string,
  page = 1,
  limit = 12,
  displayCurrency: SupportedCurrency = 'ETB',
) {
  const currency = normalizeDisplayCurrency(displayCurrency);
  const cacheKey = `search:${SEARCH_CACHE_VERSION}:${query.trim().toLowerCase()}:${currency}:${page}:${limit}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    console.log(`⚡ Search cache hit for key: ${cacheKey}`);
    return cached;
  }

  const etbPerUsd = await getEtbPerUsd();
  const parsed = await parseQuery(query, currency);
  const filters = finalizeParsedFilters(query, { ...parsed, currency });
  const targetPriceEtb = getTargetPriceEtb(filters, etbPerUsd);
  const priceLocked = hasAnyPriceFilter(filters) || filters.hardPriceConstraint;

  console.log('PARSED FILTERS:', JSON.stringify(filters, null, 2));
  console.log('APPLIED FILTERS (initial):', JSON.stringify(filters, null, 2));
  console.log('SQL WHERE (initial):', describeFilterSql(filters, etbPerUsd));
  console.log('SEARCH INTENT:', {
    hardPriceConstraint: filters.hardPriceConstraint,
    explicitPrice: hasExplicitPriceConstraint(query),
    priceLocked,
    targetPriceEtb,
  });

  const embedding = await createEmbedding(query);

  const skip = (page - 1) * limit;
  const searchOptions = { targetPriceEtb, logLabel: 'search' };

  let { results, total } = await vectorSearch(
    embedding,
    filters,
    skip,
    limit,
    etbPerUsd,
    searchOptions,
  );
  let appliedFilters = filters;
  let matchMode: SearchMatchMode = 'strict';

  if (total === 0 && hasStructuredFilters(filters)) {
    for (const relaxed of buildFilterRelaxationLadder(filters)) {
      console.log('APPLIED FILTERS (relaxed attempt):', JSON.stringify(relaxed, null, 2));
      console.log('SQL WHERE (relaxed attempt):', describeFilterSql(relaxed, etbPerUsd));

      const relaxedResult = await vectorSearch(
        embedding,
        relaxed,
        skip,
        limit,
        etbPerUsd,
        { ...searchOptions, logLabel: 'search-relaxed' },
      );
      if (relaxedResult.total > 0) {
        ({ results, total } = relaxedResult);
        appliedFilters = relaxed;
        matchMode = 'relaxed';
        break;
      }
    }
  }

  if (total === 0 && !priceLocked) {
    const vectorOnly = emptyFilters(filters.keywords, filters.confidence, currency);
    console.log('APPLIED FILTERS (semantic fallback):', JSON.stringify(vectorOnly, null, 2));

    const vectorOnlyResult = await vectorSearch(
      embedding,
      vectorOnly,
      skip,
      limit,
      etbPerUsd,
      { targetPriceEtb: null, logLabel: 'search-semantic' },
    );
    if (vectorOnlyResult.total > 0) {
      ({ results, total } = vectorOnlyResult);
      appliedFilters = vectorOnly;
      matchMode = 'semantic';
    }
  }

  const formattedProperties = results.map((row) => {
    const property = {
      ...row,
      owner: row.owner_id
        ? {
            id: row.owner_id,
            first_name: row.owner_first_name || '',
            last_name: row.owner_last_name || '',
            email: row.owner_email || '',
          }
        : null,
    };
    return {
      ...formatSearchProperty(property, etbPerUsd, currency),
      similarity: Number(row.final_score?.toFixed(4) ?? row.similarity?.toFixed(4) ?? 0),
      cosineSimilarity: Number(row.cosine_similarity?.toFixed(4) ?? 0),
      priceRelevance: Number(row.price_relevance?.toFixed(4) ?? 0),
    };
  });

  const responsePayload = {
    properties: formattedProperties,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: appliedFilters,
      parsedFilters: filters,
      matchMode,
      targetPriceEtb,
      hardPriceConstraint: filters.hardPriceConstraint,
      fxRate: {
        etbPerUsd,
        base: 'ETB',
      },
    },
  };

  await setCache(cacheKey, responsePayload, 3600);

  return responsePayload;
}
