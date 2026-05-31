import prisma from '../../config/database';
import { buildFilterSql, describeFilterSql, type ParsedFilters } from './filters';
import { getPropertyTextRepresentation } from './propertyEmbeddingText';

export { getPropertyTextRepresentation };

const EMBEDDING_DIMENSION = 384;
const COSINE_WEIGHT = 0.6;
const PRICE_WEIGHT = 0.4;

export interface VectorSearchOptions {
  targetPriceEtb?: number | null;
  logLabel?: string;
}

/**
 * Initializes pgvector and creates the HNSW expression index.
 */
export async function initVectorSearch() {
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS property_embedding_vector_idx
      ON "PropertyEmbedding"
      USING hnsw ((embedding::vector(${EMBEDDING_DIMENSION})) vector_cosine_ops);
    `).catch((err) => {
      console.warn('⚠ HNSW index creation failed, falling back to IVFFlat...', err.message);
      return prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS property_embedding_vector_idx
        ON "PropertyEmbedding"
        USING ivfflat ((embedding::vector(${EMBEDDING_DIMENSION})) vector_cosine_ops)
        WITH (lists = 100);
      `);
    });
    console.log('✅ pgvector extension and indexes verified successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize pgvector database structures:', err);
  }
}

/**
 * Hybrid search: hard SQL pre-filters, then ranked by
 * final_score = 0.6 * cosine_similarity + 0.4 * price_relevance_score
 */
export async function vectorSearch(
  embedding: number[],
  filters: ParsedFilters,
  skip: number,
  limit: number,
  etbPerUsd: number,
  options: VectorSearchOptions = {},
) {
  const { targetPriceEtb = null, logLabel = 'search' } = options;
  const embeddingString = `[${embedding.join(',')}]`;
  const filterSql = buildFilterSql(filters, etbPerUsd);
  const rentEtb = `(COALESCE(
    NULLIF((p.price->>'amountEtb')::numeric, 0),
    CASE
      WHEN UPPER(COALESCE(p.price->>'currency', 'ETB')) = 'USD'
      THEN (p.price->>'value')::numeric * ${Number(etbPerUsd)}
      ELSE (p.price->>'value')::numeric
    END
  ))`;

  const cosineExpr = `1 - (pe.embedding::vector(${EMBEDDING_DIMENSION}) <=> '${embeddingString}'::vector(${EMBEDDING_DIMENSION}))`;

  const priceRelevanceExpr =
    targetPriceEtb != null && targetPriceEtb > 0
      ? `GREATEST(0, 1 - (ABS((${rentEtb}) - ${targetPriceEtb}) / ${targetPriceEtb}))`
      : '0';

  const finalScoreExpr =
    targetPriceEtb != null && targetPriceEtb > 0
      ? `(${COSINE_WEIGHT} * (${cosineExpr}) + ${PRICE_WEIGHT} * (${priceRelevanceExpr}))`
      : cosineExpr;

  console.log(`[${logLabel}] SQL WHERE:`, describeFilterSql(filters, etbPerUsd));
  if (targetPriceEtb != null) {
    console.log(`[${logLabel}] targetPriceEtb:`, targetPriceEtb, `(ranking: ${COSINE_WEIGHT} cosine + ${PRICE_WEIGHT} price)`);
  }

  const query = `
    SELECT p.*,
           u.id AS "owner_id",
           u.first_name AS "owner_first_name",
           u.last_name AS "owner_last_name",
           u.email AS "owner_email",
           (${cosineExpr}) AS cosine_similarity,
           (${priceRelevanceExpr}) AS price_relevance,
           (${finalScoreExpr}) AS final_score
    FROM "Property" p
    JOIN "PropertyEmbedding" pe ON p.id = pe."propertyId"
    LEFT JOIN "User" u ON p."ownerId" = u.id
    WHERE p."isDeleted" = false AND p.status = 'AVAILABLE' ${filterSql}
    ORDER BY final_score DESC
    OFFSET ${skip} LIMIT ${limit};
  `;

  const countQuery = `
    SELECT COUNT(*)::integer as total
    FROM "Property" p
    JOIN "PropertyEmbedding" pe ON p.id = pe."propertyId"
    WHERE p."isDeleted" = false AND p.status = 'AVAILABLE' ${filterSql};
  `;

  const [results, countResults] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(query),
    prisma.$queryRawUnsafe<any[]>(countQuery),
  ]);

  const total = countResults[0]?.total ?? 0;

  return { results, total, filterSql };
}

async function createEmbedding(text: string): Promise<number[]> {
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

export async function syncPropertyEmbedding(propertyId: string) {
  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
    });

    if (!property) return;

    const text = getPropertyTextRepresentation(property as Record<string, unknown>);
    const vector = await createEmbedding(text);

    await prisma.propertyEmbedding.upsert({
      where: { propertyId },
      update: { embedding: vector },
      create: { propertyId, embedding: vector },
    });

    console.log(`📡 Cosine embedding synced for Property ID: ${propertyId}`);
  } catch (err) {
    console.error(`❌ Failed to sync embedding for Property ID: ${propertyId}`, err);
  }
}

export async function syncAllPropertyEmbeddings() {
  try {
    const properties = await prisma.property.findMany({
      where: {
        isDeleted: false,
        embedding: null,
      },
      select: { id: true },
    });

    if (properties.length === 0) return;

    console.log(`📡 Found ${properties.length} properties missing vector embeddings. Syncing...`);
    for (const property of properties) {
      await syncPropertyEmbedding(property.id);
    }
    console.log('✅ Embedding sync complete.');
  } catch (err) {
    console.error('❌ Failed to bulk sync property embeddings:', err);
  }
}

export interface EmbeddingResyncResult {
  total: number;
  success: number;
  failed: number;
  errors: { propertyId: string; error: string }[];
}

export async function resyncAllPropertyEmbeddings(): Promise<EmbeddingResyncResult> {
  const properties = await prisma.property.findMany({
    where: { isDeleted: false },
    select: { id: true },
  });

  const result: EmbeddingResyncResult = {
    total: properties.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const { id } of properties) {
    try {
      const property = await prisma.property.findFirst({
        where: { id, isDeleted: false },
      });

      if (!property) {
        throw new Error('Property not found');
      }

      const text = getPropertyTextRepresentation(property as Record<string, unknown>);
      const vector = await createEmbedding(text);

      await prisma.propertyEmbedding.upsert({
        where: { propertyId: id },
        update: { embedding: vector },
        create: { propertyId: id, embedding: vector },
      });

      result.success++;
      console.log(`📡 Resynced embedding for Property ID: ${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.failed++;
      result.errors.push({ propertyId: id, error: message });
      console.error(`❌ Failed to resync embedding for Property ID: ${id}`, message);
    }
  }

  return result;
}
