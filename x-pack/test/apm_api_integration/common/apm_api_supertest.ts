/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { format } from 'url';
import supertest from 'supertest';
import request from 'superagent';
import type {
  APIReturnType,
  APIClientRequestParamsOf,
} from '@kbn/apm-plugin/public/services/rest/create_call_apm_api';
import type { APIEndpoint } from '@kbn/apm-plugin/server';
import type {
  APIEndpoint as SourcesAPIEndpoint,
  APIReturnType as SourcesAPIReturnType,
  APIClientRequestParamsOf as SourcesAPIClientRequestParamsOf,
} from '@kbn/apm-sources-access-plugin/server';
import { formatRequest } from '@kbn/server-route-repository';

type CombinedAPIRequest<TEndpoint extends APIEndpoint | SourcesAPIEndpoint> =
  TEndpoint extends APIEndpoint
    ? APIReturnType<TEndpoint>
    : TEndpoint extends SourcesAPIEndpoint
    ? SourcesAPIReturnType<TEndpoint>
    : never;

type CombinedOptions<TEndpoint extends APIEndpoint | SourcesAPIEndpoint> =
  TEndpoint extends APIEndpoint
    ? Options<TEndpoint>
    : TEndpoint extends SourcesAPIEndpoint
    ? SourceOptions<TEndpoint>
    : never;

type Options<TEndpoint extends APIEndpoint> = {
  type?: 'form-data';
  endpoint: TEndpoint;
  spaceId?: string;
} & APIClientRequestParamsOf<TEndpoint> & {
    params?: { query?: { _inspect?: boolean } };
  };

type SourceOptions<TEndpoint extends SourcesAPIEndpoint> = {
  type?: 'form-data';
  endpoint: TEndpoint;
  spaceId?: string;
} & SourcesAPIClientRequestParamsOf<TEndpoint>;

export function createApmApiClient(st: supertest.Agent) {
  return async <TEndpoint extends APIEndpoint | SourcesAPIEndpoint>(
    options: CombinedOptions<TEndpoint>
  ): Promise<SupertestReturnType<TEndpoint>> => {
    const { endpoint, type } = options;

    const params = 'params' in options ? (options.params as Record<string, any>) : {};

    const { method, pathname, version } = formatRequest(endpoint, params.path);
    const pathnameWithSpaceId = options.spaceId ? `/s/${options.spaceId}${pathname}` : pathname;
    const url = format({ pathname: pathnameWithSpaceId, query: params?.query });

    // eslint-disable-next-line no-console
    console.debug(`Calling APM API: ${method.toUpperCase()} ${url}`);

    const headers: Record<string, string> = {
      'kbn-xsrf': 'foo',
      'x-elastic-internal-origin': 'foo',
    };

    if (version) {
      headers['Elastic-Api-Version'] = version;
    }

    let res: request.Response;
    if (type === 'form-data') {
      const fields: Array<[string, any]> = Object.entries(params.body);
      const formDataRequest = st[method](url)
        .set(headers)
        .set('Content-type', 'multipart/form-data');

      for (const field of fields) {
        void formDataRequest.field(field[0], field[1]);
      }

      res = await formDataRequest;
    } else if (params.body) {
      res = await st[method](url).send(params.body).set(headers);
    } else {
      res = await st[method](url).set(headers);
    }

    // supertest doesn't throw on http errors
    if (res?.status !== 200) {
      throw new ApmApiError(res, endpoint);
    }

    return res;
  };
}

type ApiErrorResponse = Omit<request.Response, 'body'> & {
  body: {
    statusCode: number;
    error: string;
    message: string;
    attributes: object;
  };
};

export type ApmApiSupertest = ReturnType<typeof createApmApiClient>;

export class ApmApiError extends Error {
  res: ApiErrorResponse;

  constructor(res: request.Response, endpoint: string) {
    super(
      `Unhandled ApmApiError.
Status: "${res.status}"
Endpoint: "${endpoint}"
Body: ${JSON.stringify(res.body)}`
    );

    this.res = res;
  }
}

export interface SupertestReturnType<TEndpoint extends APIEndpoint | SourcesAPIEndpoint> {
  status: number;
  body: CombinedAPIRequest<TEndpoint>;
}
