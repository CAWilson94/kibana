/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { badData, badRequest } from '@hapi/boom';
import {
  IngestGetResponse,
  StreamUpsertRequest,
  ingestUpsertRequestSchema,
  isUnwiredStreamDefinition,
  isWiredStreamDefinition,
} from '@kbn/streams-schema';
import { z } from '@kbn/zod';
import { STREAMS_API_PRIVILEGES } from '../../../../common/constants';
import { createServerRoute } from '../../create_server_route';
import { ASSET_ID, ASSET_TYPE } from '../../../lib/streams/assets/fields';
import { QueryAsset } from '../../../../common/assets';

const readIngestRoute = createServerRoute({
  endpoint: 'GET /api/streams/{name}/_ingest 2023-10-31',
  options: {
    access: 'public',
    summary: 'Get ingest stream settings',
    description: 'Fetches the ingest settings of an ingest stream definition',
    availability: {
      stability: 'experimental',
    },
  },
  security: {
    authz: {
      requiredPrivileges: [STREAMS_API_PRIVILEGES.read],
    },
  },
  params: z.object({
    path: z.object({ name: z.string() }),
  }),
  handler: async ({ params, request, getScopedClients }): Promise<IngestGetResponse> => {
    const { streamsClient } = await getScopedClients({
      request,
    });

    const name = params.path.name;

    const definition = await streamsClient.getStream(name);

    if (isWiredStreamDefinition(definition)) {
      return { ingest: definition.ingest };
    }

    if (isUnwiredStreamDefinition(definition)) {
      return { ingest: definition.ingest };
    }

    throw badRequest(`Stream is not an ingest stream`);
  },
});

const upsertIngestRoute = createServerRoute({
  endpoint: 'PUT /api/streams/{name}/_ingest 2023-10-31',
  options: {
    access: 'public',
    summary: 'Update ingest stream settings',
    description: 'Upserts the ingest settings of an ingest stream definition',
    availability: {
      stability: 'experimental',
    },
  },
  security: {
    authz: {
      requiredPrivileges: [STREAMS_API_PRIVILEGES.manage],
    },
  },
  params: z.object({
    path: z.object({
      name: z.string(),
    }),
    body: ingestUpsertRequestSchema,
  }),
  handler: async ({ params, request, getScopedClients }) => {
    const { streamsClient, assetClient } = await getScopedClients({
      request,
    });

    if (
      isWiredStreamDefinition({ name: params.path.name, ...params.body }) &&
      !(await streamsClient.isStreamsEnabled())
    ) {
      throw badData('Streams are not enabled for Wired streams.');
    }

    const name = params.path.name;

    const assets = await assetClient.getAssets(name);

    const ingestUpsertRequest = params.body;

    const dashboards = assets
      .filter((asset) => asset[ASSET_TYPE] === 'dashboard')
      .map((asset) => asset[ASSET_ID]);

    const queries = assets
      .filter((asset): asset is QueryAsset => asset[ASSET_TYPE] === 'query')
      .map((asset) => asset.query);

    const upsertRequest = {
      dashboards,
      stream: ingestUpsertRequest,
      queries,
    } as StreamUpsertRequest;

    return await streamsClient.upsertStream({
      request: upsertRequest,
      name: params.path.name,
    });
  },
});

export const ingestRoutes = {
  ...readIngestRoute,
  ...upsertIngestRoute,
};
