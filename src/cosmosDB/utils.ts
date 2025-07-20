
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

export const cosmos_client = new CosmosClient({ 
    endpoint: process.env.COSMOS_CLIENT_URL,
    key: process.env.COSMOS_CLIENT_KEY
});

const cosmosDatabaseId = process.env.COSMOS_DATABASE_ID;
if( !cosmosDatabaseId ) {
    throw new Error('COSMOS_DATABASE_ID is not defined in environment variables.');
}

const cosmosContainerId = process.env.COSMOS_CONTAINER_ID;
if( !cosmosContainerId ) {
    throw new Error('COSMOS_CONTAINER_ID is not defined in environment variables.');
}

export async function getVectorContainer() {
    // Ensure the database exists
    const { database } = await cosmos_client.databases.createIfNotExists({ id: cosmosDatabaseId });
  
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