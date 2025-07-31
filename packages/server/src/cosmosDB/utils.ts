
import { CosmosClient } from '@azure/cosmos';
import {
    ContainerDefinition,
    PartitionKeyDefinition,
    PartitionKeyKind,
    IndexingMode,
    VectorEmbeddingPolicy,
    VectorEmbeddingDataType,
    VectorEmbeddingDistanceFunction,
    VectorIndex,
} from '@azure/cosmos';
import { logger } from 'genkit/logging';

export const EMBEDDING_VECTOR_SIZE = 1536;

let cosmos_client: CosmosClient | null = null;

function getClient(): CosmosClient {

  if (cosmos_client) {
    return cosmos_client;
  }

  // Validate required environment variables
  const cosmosEndpoint = process.env.COSMOS_CLIENT_URL;
  if (!cosmosEndpoint) {
      throw new Error('COSMOS_CLIENT_URL is not defined in environment variables.');
  }

  // Validate URL format
  try {
    new URL(cosmosEndpoint);
  } catch (error) {
    throw new Error(`COSMOS_CLIENT_URL is not a valid URL: ${cosmosEndpoint}`);
  }

  const cosmosKey = process.env.COSMOS_CLIENT_KEY;
  if (!cosmosKey) {
      throw new Error('COSMOS_CLIENT_KEY is not defined in environment variables.');
  }
  
  cosmos_client = new CosmosClient({ 
    endpoint: cosmosEndpoint,
    key: cosmosKey
  });

  return cosmos_client;

}

export async function getContainer() {

  const cosmosDatabaseId = process.env.COSMOS_DATABASE_ID;
  if( !cosmosDatabaseId ) {
      throw new Error('COSMOS_DATABASE_ID is not defined in environment variables.');
  }
  
  const cosmosContainerId = process.env.COSMOS_CONTAINER_ID;
  if( !cosmosContainerId ) {
      throw new Error('COSMOS_CONTAINER_ID is not defined in environment variables.');
  }

  // Ensure the database exists
  const { database } = await getClient().databases.createIfNotExists({ id: cosmosDatabaseId });

  // Create the container with vector index
  const { container } = await database.containers.createIfNotExists({
      id: cosmosContainerId,
      partitionKey: {
        paths: ['/TenantId'],
        kind: PartitionKeyKind.Hash,
      },
      indexingPolicy: {
        indexingMode: IndexingMode.consistent,
        automatic: true
      },
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [
            {
                path: '/embedding',
                dataType: VectorEmbeddingDataType.Float32,
                distanceFunction: VectorEmbeddingDistanceFunction.Cosine,
                dimensions: EMBEDDING_VECTOR_SIZE
            }
        ]
    }
    });
  
    logger.debug(`Vector container '${cosmosContainerId}' is ready`);
    return container;
  }