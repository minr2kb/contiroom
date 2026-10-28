import { createApi, createFetchExecutor } from '@routar/core';
import { createQueries } from '@routar/react-query';
import { router } from './data-router';

const executor = createFetchExecutor(() => `${window.location.origin}/api`);

export const api = createApi(executor, router);
export const queries = createQueries(api);
